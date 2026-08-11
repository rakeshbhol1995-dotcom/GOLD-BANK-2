use anchor_lang::prelude::*;
use anchor_lang::solana_program::{program::invoke, system_instruction};
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount};
use crate::state::{ProtocolConfig, UserAccount};
use crate::errors::ImmortalGoldError;
use crate::math::{calculate_buy_breakdown, DIVIDEND_PRECISION};

#[derive(Accounts)]
pub struct BuyTokens<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"protocol_config"],
        bump
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,

    #[account(
        init_if_needed,
        payer = buyer,
        space = UserAccount::LEN,
        seeds = [b"user_account", buyer.key().as_ref()],
        bump
    )]
    pub user_account: Account<'info, UserAccount>,

    #[account(
        mut,
        seeds = [b"vault_reserve"],
        bump
    )]
    /// CHECK: Main Vault PDA collecting 98% reserve deposits
    pub vault_reserve: SystemAccount<'info>,

    #[account(
        mut,
        seeds = [b"dividend_vault"],
        bump = protocol_config.dividend_vault_bump
    )]
    /// CHECK: Separate Dividend Vault PDA collecting 1% holder dividend fees
    pub dividend_vault: SystemAccount<'info>,

    #[account(
        mut,
        constraint = admin_treasury.key() == protocol_config.admin_treasury @ ImmortalGoldError::UnauthorizedTreasury
    )]
    /// CHECK: Admin Treasury wallet receiving 1% buy fee (validated against protocol_config)
    pub admin_treasury: UncheckedAccount<'info>,

    #[account(
        mut,
        constraint = img_mint.key() == protocol_config.img_mint @ ImmortalGoldError::UnauthorizedMint,
        constraint = img_mint.mint_authority.contains(&mint_authority.key()) @ ImmortalGoldError::InvalidMintAuthority
    )]
    pub img_mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = buyer_token_account.owner == buyer.key(),
        constraint = buyer_token_account.mint == img_mint.key()
    )]
    pub buyer_token_account: Account<'info, TokenAccount>,

    /// CHECK: Mint authority PDA
    #[account(seeds = [b"mint_authority"], bump)]
    pub mint_authority: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<BuyTokens>, amount_to_buy: u64, max_cost_limit: u64) -> Result<()> {
    let config = &mut ctx.accounts.protocol_config;
    require!(!config.is_paused, ImmortalGoldError::ProtocolPaused);
    require!(amount_to_buy > 0, ImmortalGoldError::InvalidAmount);

    let new_supply = config.total_supply.checked_add(amount_to_buy)
        .ok_or(ImmortalGoldError::MathOverflow)?;
    require!(new_supply <= config.max_supply_cap, ImmortalGoldError::MaxSupplyReached);

    // Calculate Bonding Curve Buy Breakdown
    let breakdown = calculate_buy_breakdown(config.total_supply, amount_to_buy)?;
    require!(breakdown.gross_cost <= max_cost_limit, ImmortalGoldError::SlippageExceeded);

    // 1. Transfer 98% Main Vault Reserve Deposit
    invoke(
        &system_instruction::transfer(
            &ctx.accounts.buyer.key(),
            &ctx.accounts.vault_reserve.key(),
            breakdown.vault_deposit,
        ),
        &[
            ctx.accounts.buyer.to_account_info(),
            ctx.accounts.vault_reserve.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
    )?;

    // 2. Transfer 1% Admin Treasury Fee
    invoke(
        &system_instruction::transfer(
            &ctx.accounts.buyer.key(),
            &ctx.accounts.admin_treasury.key(),
            breakdown.treasury_fee,
        ),
        &[
            ctx.accounts.buyer.to_account_info(),
            ctx.accounts.admin_treasury.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
    )?;

    // 3. Process 1% Dividend Fee directly into Separate Dividend Vault PDA
    if breakdown.dividend_fee > 0 {
        invoke(
            &system_instruction::transfer(
                &ctx.accounts.buyer.key(),
                &ctx.accounts.dividend_vault.key(),
                breakdown.dividend_fee,
            ),
            &[
                ctx.accounts.buyer.to_account_info(),
                ctx.accounts.dividend_vault.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        config.dividend_pool_balance = config.dividend_pool_balance.checked_add(breakdown.dividend_fee)
            .ok_or(ImmortalGoldError::MathOverflow)?;

        if config.total_supply > 0 {
            let dividend_addition = (breakdown.dividend_fee as u128)
                .checked_mul(DIVIDEND_PRECISION)
                .ok_or(ImmortalGoldError::MathOverflow)?
                .checked_div(config.total_supply as u128)
                .ok_or(ImmortalGoldError::MathOverflow)?;

            config.acc_dividend_per_share = config.acc_dividend_per_share.checked_add(dividend_addition)
                .ok_or(ImmortalGoldError::MathOverflow)?;
        }
    }

    // Update User Account Dividend Debt using SPL Token Account balance directly (Single Source of Truth)
    let user_account = &mut ctx.accounts.user_account;
    if user_account.owner == Pubkey::default() {
        user_account.owner = ctx.accounts.buyer.key();
        user_account.reward_debt = 0;
        user_account.pending_rewards = 0;
    }

    let current_spl_balance = ctx.accounts.buyer_token_account.amount;

    // Accrue existing pending rewards BEFORE new tokens are minted
    if current_spl_balance > 0 {
        let accumulated = (current_spl_balance as u128)
            .checked_mul(config.acc_dividend_per_share)
            .ok_or(ImmortalGoldError::MathOverflow)?;
        
        let pending = accumulated.checked_sub(user_account.reward_debt)
            .unwrap_or(0) / DIVIDEND_PRECISION;

        user_account.pending_rewards = user_account.pending_rewards.checked_add(pending as u64)
            .ok_or(ImmortalGoldError::MathOverflow)?;
    }

    // 4. Mint $IMG Tokens to Buyer via CPI
    let mint_authority_bump = ctx.bumps.mint_authority;
    let seeds = &[b"mint_authority".as_ref(), &[mint_authority_bump]];
    let signer = &[&seeds[..]];

    let cpi_accounts = MintTo {
        mint: ctx.accounts.img_mint.to_account_info(),
        to: ctx.accounts.buyer_token_account.to_account_info(),
        authority: ctx.accounts.mint_authority.to_account_info(),
    };
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        cpi_accounts,
        signer,
    );
    token::mint_to(cpi_ctx, amount_to_buy)?;

    // State Updates
    config.total_supply = new_supply;
    config.vault_reserve = config.vault_reserve.checked_add(breakdown.vault_deposit)
        .ok_or(ImmortalGoldError::MathOverflow)?;

    let new_spl_balance = current_spl_balance.checked_add(amount_to_buy)
        .ok_or(ImmortalGoldError::MathOverflow)?;

    user_account.reward_debt = (new_spl_balance as u128)
        .checked_mul(config.acc_dividend_per_share)
        .ok_or(ImmortalGoldError::MathOverflow)?;

    emit!(crate::instructions::admin::BuyEvent {
        buyer: ctx.accounts.buyer.key(),
        amount_bought: amount_to_buy,
        gross_cost: breakdown.gross_cost,
        vault_deposit: breakdown.vault_deposit,
    });

    msg!("Bought {} $IMG tokens for {} gross cost.", amount_to_buy, breakdown.gross_cost);
    Ok(())
}
