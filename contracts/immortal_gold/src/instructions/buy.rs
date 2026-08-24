use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount, Transfer};
use crate::state::{ProtocolConfig, UserAccount};
use crate::errors::ImmortalGoldError;
use crate::math::{calculate_buy_breakdown, DIVIDEND_PRECISION};
use crate::instructions::admin::{BuyEvent, ReserveHealthEvent};

#[derive(Accounts)]
pub struct BuyTokens<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(mut, seeds = [b"protocol_config"], bump)]
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
        constraint = buyer_usdt_account.owner == buyer.key(),
        constraint = buyer_usdt_account.mint == protocol_config.usdt_mint @ ImmortalGoldError::UnauthorizedMint
    )]
    pub buyer_usdt_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"vault_reserve"],
        bump = protocol_config.vault_bump,
        constraint = vault_reserve.mint == protocol_config.usdt_mint @ ImmortalGoldError::UnauthorizedMint
    )]
    pub vault_reserve: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"dividend_vault"],
        bump = protocol_config.dividend_vault_bump,
        constraint = dividend_vault.mint == protocol_config.usdt_mint @ ImmortalGoldError::UnauthorizedMint
    )]
    pub dividend_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = admin_treasury.key() == protocol_config.admin_treasury @ ImmortalGoldError::UnauthorizedTreasury,
        constraint = admin_treasury.mint == protocol_config.usdt_mint @ ImmortalGoldError::UnauthorizedMint
    )]
    pub admin_treasury: Account<'info, TokenAccount>,

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

    /// CHECK: Mint authority PDA — verified by seeds constraint
    #[account(seeds = [b"mint_authority"], bump)]
    pub mint_authority: UncheckedAccount<'info>,

    pub token_program:  Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<BuyTokens>, amount_to_buy: u64, max_cost_limit: u64) -> Result<()> {
    let config = &mut ctx.accounts.protocol_config;
    require!(!config.is_paused, ImmortalGoldError::ProtocolPaused);
    require!(amount_to_buy > 0, ImmortalGoldError::InvalidAmount);

    let new_supply = config.total_supply.checked_add(amount_to_buy).ok_or(ImmortalGoldError::MathOverflow)?;
    require!(new_supply <= config.max_supply_cap, ImmortalGoldError::MaxSupplyReached);

    // Calculate buy cost breakdown (6-decimal micro-USDT)
    let bd = calculate_buy_breakdown(config.total_supply, amount_to_buy)?;
    require!(bd.gross_cost <= max_cost_limit, ImmortalGoldError::SlippageExceeded);

    // ── 1. 98% → Vault Reserve ───────────────────────────────────────────────
    token::transfer(
        CpiContext::new(ctx.accounts.token_program.to_account_info(),
            Transfer {
                from:      ctx.accounts.buyer_usdt_account.to_account_info(),
                to:        ctx.accounts.vault_reserve.to_account_info(),
                authority: ctx.accounts.buyer.to_account_info(),
            }),
        bd.vault_deposit,
    )?;

    // ── 2. 1% → Admin Treasury ───────────────────────────────────────────────
    token::transfer(
        CpiContext::new(ctx.accounts.token_program.to_account_info(),
            Transfer {
                from:      ctx.accounts.buyer_usdt_account.to_account_info(),
                to:        ctx.accounts.admin_treasury.to_account_info(),
                authority: ctx.accounts.buyer.to_account_info(),
            }),
        bd.treasury_fee,
    )?;

    // ── 3. 1% → Dividend Vault ───────────────────────────────────────────────
    if bd.dividend_fee > 0 {
        token::transfer(
            CpiContext::new(ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from:      ctx.accounts.buyer_usdt_account.to_account_info(),
                    to:        ctx.accounts.dividend_vault.to_account_info(),
                    authority: ctx.accounts.buyer.to_account_info(),
                }),
            bd.dividend_fee,
        )?;

        config.dividend_pool_balance = config.dividend_pool_balance
            .checked_add(bd.dividend_fee as u128).ok_or(ImmortalGoldError::MathOverflow)?;

        // Distribute to existing holders
        if config.total_supply > 0 {
            let add = (bd.dividend_fee as u128)
                .checked_mul(DIVIDEND_PRECISION).ok_or(ImmortalGoldError::MathOverflow)?
                / (config.total_supply as u128);
            config.acc_dividend_per_share = config.acc_dividend_per_share
                .checked_add(add).ok_or(ImmortalGoldError::MathOverflow)?;
        }
    }

    // ── 4. Mint $IMG to Buyer ─────────────────────────────────────────────────
    // Derive mint_authority bump via find_program_address (works without Bumps trait on UncheckedAccount)
    let (_, ma_bump) = Pubkey::find_program_address(
        &[b"mint_authority"],
        ctx.program_id,
    );
    let seeds  = &[b"mint_authority".as_ref(), &[ma_bump]];
    let signer = &[&seeds[..]];

    token::mint_to(
        CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint:      ctx.accounts.img_mint.to_account_info(),
                to:        ctx.accounts.buyer_token_account.to_account_info(),
                authority: ctx.accounts.mint_authority.to_account_info(),
            }, signer),
        amount_to_buy,
    )?;

    // ── Dividend Debt Update ──────────────────────────────────────────────────
    let user = &mut ctx.accounts.user_account;
    if user.owner == Pubkey::default() {
        user.owner           = ctx.accounts.buyer.key();
        user.reward_debt     = 0;
        user.pending_rewards = 0;
        user.last_buy_slot   = 0;
    }

    let cur_bal = ctx.accounts.buyer_token_account.amount;

    // Accrue existing pending rewards BEFORE new tokens are minted
    if cur_bal > 0 {
        let acc     = (cur_bal as u128)
            .checked_mul(config.acc_dividend_per_share).ok_or(ImmortalGoldError::MathOverflow)?;
        let pending = acc.saturating_sub(user.reward_debt) / DIVIDEND_PRECISION;
        user.pending_rewards = user.pending_rewards.checked_add(pending as u64)
            .ok_or(ImmortalGoldError::MathOverflow)?;
    }

    // ── State Updates ─────────────────────────────────────────────────────────
    config.total_supply  = new_supply;
    config.vault_reserve = config.vault_reserve
        .checked_add(bd.vault_deposit as u128).ok_or(ImmortalGoldError::MathOverflow)?;

    let new_bal = cur_bal.checked_add(amount_to_buy).ok_or(ImmortalGoldError::MathOverflow)?;
    user.reward_debt   = (new_bal as u128)
        .checked_mul(config.acc_dividend_per_share).ok_or(ImmortalGoldError::MathOverflow)?;
    user.last_buy_slot = Clock::get()?.slot; // track for holding period

    emit!(ReserveHealthEvent {
        vault_reserve: config.vault_reserve,
        total_supply:  config.total_supply,
        timestamp:     Clock::get()?.unix_timestamp,
    });
    emit!(BuyEvent {
        buyer:        ctx.accounts.buyer.key(),
        amount_bought: amount_to_buy,
        gross_cost:   bd.gross_cost,
        vault_deposit: bd.vault_deposit,
    });

    msg!("Bought {} $IMG for {} micro-USDT gross. Reserve: {} micro-USDT.",
        amount_to_buy, bd.gross_cost, config.vault_reserve);
    Ok(())
}
