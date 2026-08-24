use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, Token, TokenAccount, Transfer};
use crate::state::{ProtocolConfig, UserAccount};
use crate::errors::ImmortalGoldError;
use crate::math::{calculate_sell_breakdown, DIVIDEND_PRECISION};
use crate::instructions::admin::{SellEvent, ReserveHealthEvent};

#[derive(Accounts)]
pub struct SellTokens<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,

    #[account(mut, seeds = [b"protocol_config"], bump)]
    pub protocol_config: Account<'info, ProtocolConfig>,

    #[account(mut, seeds = [b"user_account", seller.key().as_ref()], bump)]
    pub user_account: Account<'info, UserAccount>,

    #[account(
        mut,
        constraint = seller_usdt_account.owner == seller.key(),
        constraint = seller_usdt_account.mint == protocol_config.usdt_mint @ ImmortalGoldError::UnauthorizedMint
    )]
    pub seller_usdt_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"vault_reserve"],
        bump = protocol_config.vault_bump,
        constraint = vault_reserve.mint == protocol_config.usdt_mint @ ImmortalGoldError::UnauthorizedMint
    )]
    pub vault_reserve: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"locked_reserve"],
        bump = protocol_config.locked_vault_bump,
        constraint = locked_reserve.mint == protocol_config.usdt_mint @ ImmortalGoldError::UnauthorizedMint
    )]
    pub locked_reserve: Account<'info, TokenAccount>,

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
        constraint = img_mint.key() == protocol_config.img_mint @ ImmortalGoldError::UnauthorizedMint
    )]
    pub img_mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = seller_token_account.owner == seller.key(),
        constraint = seller_token_account.mint == img_mint.key()
    )]
    pub seller_token_account: Account<'info, TokenAccount>,

    pub token_program:  Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<SellTokens>, amount_to_sell: u64, min_payout_limit: u64) -> Result<()> {
    let config = &mut ctx.accounts.protocol_config;
    require!(!config.is_paused,                              ImmortalGoldError::ProtocolPaused);
    require!(amount_to_sell > 0,                             ImmortalGoldError::InvalidAmount);
    require!(config.total_supply >= amount_to_sell,          ImmortalGoldError::InvalidAmount);

    let seller_bal = ctx.accounts.seller_token_account.amount;
    require!(seller_bal >= amount_to_sell,                   ImmortalGoldError::InvalidAmount);

    // Use u128 vault_reserve (no overflow at large volumes)
    let bd = calculate_sell_breakdown(config.total_supply, config.vault_reserve, amount_to_sell)?;
    require!(bd.seller_payout >= min_payout_limit,           ImmortalGoldError::SlippageExceeded);

    // Physical solvency check
    let physical = ctx.accounts.vault_reserve.amount as u128;
    require!(physical >= config.vault_reserve,               ImmortalGoldError::VaultSolvencyBreach);

    let user = &mut ctx.accounts.user_account;

    // Accrue pending dividends before burn
    if seller_bal > 0 {
        let acc     = (seller_bal as u128)
            .checked_mul(config.acc_dividend_per_share).ok_or(ImmortalGoldError::MathOverflow)?;
        let pending = acc.saturating_sub(user.reward_debt) / DIVIDEND_PRECISION;
        user.pending_rewards = user.pending_rewards.checked_add(pending as u64).ok_or(ImmortalGoldError::MathOverflow)?;
    }

    // ── 1. BURN $IMG ─────────────────────────────────────────────────────────
    token::burn(
        CpiContext::new(ctx.accounts.token_program.to_account_info(),
            Burn {
                mint:      ctx.accounts.img_mint.to_account_info(),
                from:      ctx.accounts.seller_token_account.to_account_info(),
                authority: ctx.accounts.seller.to_account_info(),
            }),
        amount_to_sell,
    )?;

    let vault_bump = config.vault_bump;
    let seeds      = &[b"vault_reserve".as_ref(), &[vault_bump]];
    let signer     = &[&seeds[..]];

    // ── 2. 90% → Seller ──────────────────────────────────────────────────────
    token::transfer(
        CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(),
            Transfer {
                from:      ctx.accounts.vault_reserve.to_account_info(),
                to:        ctx.accounts.seller_usdt_account.to_account_info(),
                authority: ctx.accounts.vault_reserve.to_account_info(),
            }, signer),
        bd.seller_payout,
    )?;

    // ── 3. 1% → Treasury ─────────────────────────────────────────────────────
    if bd.treasury_fee > 0 {
        token::transfer(
            CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from:      ctx.accounts.vault_reserve.to_account_info(),
                    to:        ctx.accounts.admin_treasury.to_account_info(),
                    authority: ctx.accounts.vault_reserve.to_account_info(),
                }, signer),
            bd.treasury_fee,
        )?;
    }

    // ── 4. 1% → Dividend Vault ───────────────────────────────────────────────
    if bd.dividend_fee > 0 {
        token::transfer(
            CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from:      ctx.accounts.vault_reserve.to_account_info(),
                    to:        ctx.accounts.dividend_vault.to_account_info(),
                    authority: ctx.accounts.vault_reserve.to_account_info(),
                }, signer),
            bd.dividend_fee,
        )?;

        config.dividend_pool_balance = config.dividend_pool_balance
            .checked_add(bd.dividend_fee as u128).ok_or(ImmortalGoldError::MathOverflow)?;

        let remaining = config.total_supply.checked_sub(amount_to_sell).ok_or(ImmortalGoldError::MathOverflow)?;
        if remaining > 0 {
            let add = (bd.dividend_fee as u128)
                .checked_mul(DIVIDEND_PRECISION).ok_or(ImmortalGoldError::MathOverflow)?
                / (remaining as u128);
            config.acc_dividend_per_share = config.acc_dividend_per_share
                .checked_add(add).ok_or(ImmortalGoldError::MathOverflow)?;
        }
    }

    // ── 5. 8% → Locked Ratchet Reserve ───────────────────────────────────────
    if bd.vault_ratchet_lock > 0 {
        token::transfer(
            CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from:      ctx.accounts.vault_reserve.to_account_info(),
                    to:        ctx.accounts.locked_reserve.to_account_info(),
                    authority: ctx.accounts.vault_reserve.to_account_info(),
                }, signer),
            bd.vault_ratchet_lock,
        )?;
    }

    // ── State Updates ─────────────────────────────────────────────────────────
    config.total_supply = config.total_supply.checked_sub(amount_to_sell).ok_or(ImmortalGoldError::MathOverflow)?;
    config.ratchet_locked_reserve = config.ratchet_locked_reserve
        .checked_add(bd.vault_ratchet_lock as u128).ok_or(ImmortalGoldError::MathOverflow)?;

    let total_deducted = (bd.seller_payout as u128)
        .checked_add(bd.treasury_fee as u128).ok_or(ImmortalGoldError::MathOverflow)?
        .checked_add(bd.dividend_fee as u128).ok_or(ImmortalGoldError::MathOverflow)?
        .checked_add(bd.vault_ratchet_lock as u128).ok_or(ImmortalGoldError::MathOverflow)?;
    config.vault_reserve = config.vault_reserve.checked_sub(total_deducted)
        .ok_or(ImmortalGoldError::InsufficientVaultLiquidity)?;

    // Post-sell solvency guard
    let phys_after = ctx.accounts.vault_reserve.amount as u128;
    require!(phys_after >= config.vault_reserve, ImmortalGoldError::VaultSolvencyBreach);

    let rem_bal = seller_bal.checked_sub(amount_to_sell).ok_or(ImmortalGoldError::MathOverflow)?;
    user.reward_debt = (rem_bal as u128)
        .checked_mul(config.acc_dividend_per_share).ok_or(ImmortalGoldError::MathOverflow)?;

    emit!(ReserveHealthEvent {
        vault_reserve: config.vault_reserve,
        total_supply:  config.total_supply,
        timestamp:     Clock::get()?.unix_timestamp,
    });
    emit!(SellEvent {
        seller:        ctx.accounts.seller.key(),
        amount_sold:   amount_to_sell,
        seller_payout: bd.seller_payout,
        burned_amount: amount_to_sell,
    });

    msg!("Sold & burned {} $IMG. Payout: {} micro-USDT. Reserve: {} micro-USDT.",
        amount_to_sell, bd.seller_payout, config.vault_reserve);
    Ok(())
}
