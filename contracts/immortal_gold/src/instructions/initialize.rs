use anchor_lang::prelude::*;
use anchor_spl::token::Mint;
use crate::state::ProtocolConfig;
use crate::errors::ImmortalGoldError;
use crate::math::MAX_SUPPLY_CAP;

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    /// CHECK: Admin treasury wallet receiving 1% fees
    pub admin_treasury: UncheckedAccount<'info>,

    /// $IMG SPL Token Mint (validated to have 9 decimals and 0 initial supply)
    #[account(
        constraint = img_mint.decimals == 9 @ ImmortalGoldError::InvalidMintDecimals,
        constraint = img_mint.supply == 0 @ ImmortalGoldError::InvalidMintSupply,
        constraint = img_mint.mint_authority.contains(&mint_authority.key()) @ ImmortalGoldError::InvalidMintAuthority
    )]
    pub img_mint: Account<'info, Mint>,

    /// CHECK: Mint authority PDA
    #[account(seeds = [b"mint_authority"], bump)]
    pub mint_authority: UncheckedAccount<'info>,

    #[account(
        init,
        payer = admin,
        space = ProtocolConfig::LEN,
        seeds = [b"protocol_config"],
        bump
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,

    /// CHECK: Protocol Vault PDA holding reserve funds
    #[account(
        mut,
        seeds = [b"vault_reserve"],
        bump
    )]
    pub vault_reserve: SystemAccount<'info>,

    /// CHECK: Immutable Permanent Ratchet Locked Reserve PDA holding 8% ratchet lock funds
    #[account(
        mut,
        seeds = [b"locked_reserve"],
        bump
    )]
    pub locked_reserve: SystemAccount<'info>,

    /// CHECK: Separate Holder Dividend Vault PDA holding dividend pool funds
    #[account(
        mut,
        seeds = [b"dividend_vault"],
        bump
    )]
    pub dividend_vault: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

use anchor_lang::solana_program::{program::invoke_signed, system_instruction};

pub fn handler(ctx: Context<Initialize>) -> Result<()> {
    let config = &mut ctx.accounts.protocol_config;
    config.admin = ctx.accounts.admin.key();
    config.admin_treasury = ctx.accounts.admin_treasury.key();
    config.img_mint = ctx.accounts.img_mint.key();
    config.vault_bump = ctx.bumps.vault_reserve;
    config.locked_vault_bump = ctx.bumps.locked_reserve;
    config.dividend_vault_bump = ctx.bumps.dividend_vault;
    config.total_supply = 0;
    config.max_supply_cap = MAX_SUPPLY_CAP as u64;
    config.vault_reserve = 0;
    config.dividend_pool_balance = 0;
    config.ratchet_locked_reserve = 0;
    config.acc_dividend_per_share = 0;
    config.is_paused = false;

    // Initialize 3 System-Owned PDAs with system create_account & invoke_signed
    let min_rent = Rent::get()?.minimum_balance(0);

    if ctx.accounts.vault_reserve.lamports() < min_rent {
        let bump = ctx.bumps.vault_reserve;
        let signer_seeds = &[b"vault_reserve".as_ref(), &[bump]];

        invoke_signed(
            &system_instruction::create_account(
                &ctx.accounts.admin.key(),
                &ctx.accounts.vault_reserve.key(),
                min_rent,
                0,
                &anchor_lang::solana_program::system_program::ID,
            ),
            &[
                ctx.accounts.admin.to_account_info(),
                ctx.accounts.vault_reserve.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
            &[signer_seeds],
        )?;
    }

    if ctx.accounts.locked_reserve.lamports() < min_rent {
        let bump = ctx.bumps.locked_reserve;
        let signer_seeds = &[b"locked_reserve".as_ref(), &[bump]];

        invoke_signed(
            &system_instruction::create_account(
                &ctx.accounts.admin.key(),
                &ctx.accounts.locked_reserve.key(),
                min_rent,
                0,
                &anchor_lang::solana_program::system_program::ID,
            ),
            &[
                ctx.accounts.admin.to_account_info(),
                ctx.accounts.locked_reserve.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
            &[signer_seeds],
        )?;
    }

    if ctx.accounts.dividend_vault.lamports() < min_rent {
        let bump = ctx.bumps.dividend_vault;
        let signer_seeds = &[b"dividend_vault".as_ref(), &[bump]];

        invoke_signed(
            &system_instruction::create_account(
                &ctx.accounts.admin.key(),
                &ctx.accounts.dividend_vault.key(),
                min_rent,
                0,
                &anchor_lang::solana_program::system_program::ID,
            ),
            &[
                ctx.accounts.admin.to_account_info(),
                ctx.accounts.dividend_vault.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
            &[signer_seeds],
        )?;
    }

    msg!("Immortal Gold Protocol Initialized. Vault, Locked Reserve & Dividend PDAs active. Max Supply: 21,000,000 $IMG");
    Ok(())
}




