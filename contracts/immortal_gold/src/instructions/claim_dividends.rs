use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use crate::state::{ProtocolConfig, UserAccount};
use crate::errors::ImmortalGoldError;
use crate::math::{DIVIDEND_PRECISION, MIN_RESERVE_RATIO_BPS, TOKEN_DECIMALS_FACTOR, BASE_PRICE_P0};
use crate::instructions::admin::ClaimDividendEvent;

#[derive(Accounts)]
pub struct ClaimDividends<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut, seeds = [b"protocol_config"], bump)]
    pub protocol_config: Account<'info, ProtocolConfig>,

    #[account(mut, seeds = [b"user_account", user.key().as_ref()], bump)]
    pub user_account: Account<'info, UserAccount>,

    #[account(
        mut,
        constraint = user_usdt_account.owner == user.key(),
        constraint = user_usdt_account.mint == protocol_config.usdt_mint @ ImmortalGoldError::UnauthorizedMint
    )]
    pub user_usdt_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"dividend_vault"],
        bump = protocol_config.dividend_vault_bump,
        constraint = dividend_vault.mint == protocol_config.usdt_mint @ ImmortalGoldError::UnauthorizedMint
    )]
    pub dividend_vault: Account<'info, TokenAccount>,

    #[account(
        constraint = img_mint.key() == protocol_config.img_mint @ ImmortalGoldError::UnauthorizedMint
    )]
    pub img_mint: Account<'info, Mint>,

    #[account(
        constraint = user_token_account.owner == user.key(),
        constraint = user_token_account.mint == img_mint.key()
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    pub token_program:  Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ClaimDividends>) -> Result<()> {
    let config     = &mut ctx.accounts.protocol_config;
    let user       = &mut ctx.accounts.user_account;
    let user_bal   = ctx.accounts.user_token_account.amount;
    let now_slot   = Clock::get()?.slot;

    // ── 1. Holding Period Guard ────────────────────────────────────────────────
    // Prevents instant buy → dividend → sell attack
    if user.last_buy_slot > 0 && config.min_holding_slots > 0 {
        require!(
            now_slot >= user.last_buy_slot + config.min_holding_slots,
            ImmortalGoldError::HoldingPeriodNotMet
        );
    }

    // ── 2. Reserve Ratio Guard ─────────────────────────────────────────────────
    // Dividends automatically suspend if reserve/supply < 90% of base price
    // This protects principal redemption before yield distribution
    if config.total_supply > 0 {
        // reserve_per_token = vault_reserve / total_supply (in micro-USDT per raw token unit)
        let reserve_per_token = config.vault_reserve / config.total_supply as u128;
        // base_per_token = BASE_PRICE_P0 / TOKEN_DECIMALS_FACTOR (genesis price per raw unit)
        let base_per_raw = BASE_PRICE_P0 / TOKEN_DECIMALS_FACTOR; // = 10 micro-USDT per unit
        if base_per_raw > 0 {
            let ratio_bps = (reserve_per_token * 10_000) / base_per_raw;
            require!(
                ratio_bps >= MIN_RESERVE_RATIO_BPS as u128,
                ImmortalGoldError::ReserveTooLow
            );
        }
    }

    // ── 3. Calculate Total Claimable ───────────────────────────────────────────
    let mut total: u128 = user.pending_rewards as u128;
    if user_bal > 0 {
        let acc     = (user_bal as u128)
            .checked_mul(config.acc_dividend_per_share).ok_or(ImmortalGoldError::MathOverflow)?;
        let pending = acc.saturating_sub(user.reward_debt) / DIVIDEND_PRECISION;
        total = total.checked_add(pending).ok_or(ImmortalGoldError::MathOverflow)?;
    }

    let payout = u64::try_from(total).map_err(|_| ImmortalGoldError::MathOverflow)?;
    require!(payout > 0,                              ImmortalGoldError::NoDividendsAvailable);
    require!(config.dividend_pool_balance >= payout as u128, ImmortalGoldError::InsufficientVaultLiquidity);

    // ── 4. Reset Debt & Pay ────────────────────────────────────────────────────
    user.pending_rewards = 0;
    user.reward_debt = (user_bal as u128)
        .checked_mul(config.acc_dividend_per_share).ok_or(ImmortalGoldError::MathOverflow)?;

    let dv_bump = config.dividend_vault_bump;
    let seeds   = &[b"dividend_vault".as_ref(), &[dv_bump]];
    let signer  = &[&seeds[..]];

    token::transfer(
        CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(),
            Transfer {
                from:      ctx.accounts.dividend_vault.to_account_info(),
                to:        ctx.accounts.user_usdt_account.to_account_info(),
                authority: ctx.accounts.dividend_vault.to_account_info(),
            }, signer),
        payout,
    )?;

    config.dividend_pool_balance = config.dividend_pool_balance
        .checked_sub(payout as u128).ok_or(ImmortalGoldError::MathOverflow)?;

    emit!(ClaimDividendEvent { user: ctx.accounts.user.key(), payout_amount: payout });
    msg!("Claimed {} micro-USDT dividend. Reserve ratio guarded.", payout);
    Ok(())
}
