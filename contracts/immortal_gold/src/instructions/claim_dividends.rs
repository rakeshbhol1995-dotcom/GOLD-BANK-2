use anchor_lang::prelude::*;
use anchor_lang::solana_program::{program::invoke_signed, system_instruction};
use anchor_spl::token::{Mint, TokenAccount};
use crate::state::{ProtocolConfig, UserAccount};
use crate::errors::ImmortalGoldError;
use crate::math::DIVIDEND_PRECISION;

#[derive(Accounts)]
pub struct ClaimDividends<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"protocol_config"],
        bump
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,

    #[account(
        mut,
        seeds = [b"user_account", user.key().as_ref()],
        bump
    )]
    pub user_account: Account<'info, UserAccount>,

    #[account(
        mut,
        seeds = [b"dividend_vault"],
        bump = protocol_config.dividend_vault_bump
    )]
    /// CHECK: Separate Dividend Vault PDA releasing accrued dividend rewards
    pub dividend_vault: SystemAccount<'info>,

    #[account(
        constraint = img_mint.key() == protocol_config.img_mint @ ImmortalGoldError::UnauthorizedMint
    )]
    pub img_mint: Account<'info, Mint>,

    #[account(
        constraint = user_token_account.owner == user.key(),
        constraint = user_token_account.mint == img_mint.key()
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ClaimDividends>) -> Result<()> {
    let config = &mut ctx.accounts.protocol_config;
    let user_account = &mut ctx.accounts.user_account;
    let user_spl_balance = ctx.accounts.user_token_account.amount;

    // Calculate total claimable dividend using SPL Token Account balance directly
    let mut total_claimable = user_account.pending_rewards as u128;

    if user_spl_balance > 0 {
        let accumulated = (user_spl_balance as u128)
            .checked_mul(config.acc_dividend_per_share)
            .ok_or(ImmortalGoldError::MathOverflow)?;

        let current_pending = accumulated.checked_sub(user_account.reward_debt)
            .unwrap_or(0) / DIVIDEND_PRECISION;

        total_claimable = total_claimable.checked_add(current_pending)
            .ok_or(ImmortalGoldError::MathOverflow)?;
    }

    let payout_amount = u64::try_from(total_claimable)
        .map_err(|_| ImmortalGoldError::MathOverflow)?;
    require!(payout_amount > 0, ImmortalGoldError::NoDividendsAvailable);
    require!(config.dividend_pool_balance >= payout_amount, ImmortalGoldError::InsufficientVaultLiquidity);

    // Reset user pending rewards & debt
    user_account.pending_rewards = 0;
    user_account.reward_debt = (user_spl_balance as u128)
        .checked_mul(config.acc_dividend_per_share)
        .ok_or(ImmortalGoldError::MathOverflow)?;

    let dividend_vault_bump = config.dividend_vault_bump;
    let dividend_signer_seeds = &[b"dividend_vault".as_ref(), &[dividend_vault_bump]];
    let signer = &[&dividend_signer_seeds[..]];

    // Transfer claimable dividends directly from Separate Dividend Vault PDA to User via System CPI
    invoke_signed(
        &system_instruction::transfer(
            &ctx.accounts.dividend_vault.key(),
            &ctx.accounts.user.key(),
            payout_amount,
        ),
        &[
            ctx.accounts.dividend_vault.to_account_info(),
            ctx.accounts.user.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
        signer,
    )?;

    config.dividend_pool_balance = config.dividend_pool_balance.checked_sub(payout_amount)
        .ok_or(ImmortalGoldError::MathOverflow)?;

    emit!(crate::instructions::admin::ClaimDividendEvent {
        user: ctx.accounts.user.key(),
        payout_amount,
    });

    msg!("Claimed {} dividend rewards from Dividend Vault.", payout_amount);
    Ok(())
}
