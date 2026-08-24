use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};
use crate::state::{ProtocolConfig, MultisigConfig, MAX_MULTISIG_SIGNERS};
use crate::errors::ImmortalGoldError;
use crate::math::MAX_SUPPLY_CAP;

pub const DEFAULT_MIN_HOLDING_SLOTS: u64 = 216_000; // ~24h at 400ms/slot

#[derive(Accounts)]
#[instruction(signers: Vec<Pubkey>, threshold: u8)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    /// Admin treasury USDT token account receiving 1% fees
    #[account(
        constraint = admin_treasury.mint == usdt_mint.key() @ ImmortalGoldError::UnauthorizedTreasury
    )]
    pub admin_treasury: Account<'info, TokenAccount>,

    /// $IMG SPL Token Mint (9 decimals, 0 initial supply)
    #[account(
        constraint = img_mint.decimals == 9 @ ImmortalGoldError::InvalidMintDecimals,
        constraint = img_mint.supply   == 0 @ ImmortalGoldError::InvalidMintSupply,
        constraint = img_mint.mint_authority.contains(&mint_authority.key()) @ ImmortalGoldError::InvalidMintAuthority
    )]
    pub img_mint: Account<'info, Mint>,

    /// USDT SPL Token Mint (6 decimals)
    #[account(
        constraint = usdt_mint.decimals == 6 @ ImmortalGoldError::InvalidMintDecimals
    )]
    pub usdt_mint: Account<'info, Mint>,

    /// CHECK: Mint authority PDA
    #[account(seeds = [b"mint_authority"], bump)]
    pub mint_authority: UncheckedAccount<'info>,

    /// Protocol config PDA — central state
    #[account(
        init,
        payer = admin,
        space = ProtocolConfig::LEN,
        seeds = [b"protocol_config"],
        bump
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,

    /// Multisig config PDA — governance signers
    #[account(
        init,
        payer = admin,
        space = MultisigConfig::LEN,
        seeds = [b"multisig_config"],
        bump
    )]
    pub multisig_config: Account<'info, MultisigConfig>,

    /// Protocol Vault USDT Token Account (holds 98% reserve)
    #[account(mut, seeds = [b"vault_reserve"], bump, constraint = vault_reserve.mint == usdt_mint.key())]
    pub vault_reserve: Account<'info, TokenAccount>,

    /// Immutable Permanent Ratchet Locked Reserve (holds 8% sell ratchet lock)
    #[account(mut, seeds = [b"locked_reserve"], bump, constraint = locked_reserve.mint == usdt_mint.key())]
    pub locked_reserve: Account<'info, TokenAccount>,

    /// Separate Holder Dividend Vault (holds 1% buy/sell dividend fee + external yield)
    #[account(mut, seeds = [b"dividend_vault"], bump, constraint = dividend_vault.mint == usdt_mint.key())]
    pub dividend_vault: Account<'info, TokenAccount>,

    pub token_program:  Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(ctx: Context<Initialize>, signers: Vec<Pubkey>, threshold: u8) -> Result<()> {
    // Validate multisig params
    require!(threshold > 0, ImmortalGoldError::InvalidMultisigConfig);
    require!(signers.len() >= threshold as usize, ImmortalGoldError::InvalidMultisigConfig);
    require!(signers.len() <= MAX_MULTISIG_SIGNERS, ImmortalGoldError::InvalidMultisigConfig);
    for i in 0..signers.len() {
        require!(signers[i] != Pubkey::default(), ImmortalGoldError::InvalidMultisigConfig);
        for j in (i + 1)..signers.len() {
            require!(signers[i] != signers[j], ImmortalGoldError::InvalidMultisigConfig);
        }
    }

    // ── ProtocolConfig ────────────────────────────────────────────────────────
    let config = &mut ctx.accounts.protocol_config;
    config.admin                   = ctx.accounts.admin.key();
    config.admin_treasury          = ctx.accounts.admin_treasury.key();
    config.img_mint                = ctx.accounts.img_mint.key();
    config.usdt_mint               = ctx.accounts.usdt_mint.key();
    config.vault_bump              = ctx.bumps.vault_reserve;
    config.locked_vault_bump       = ctx.bumps.locked_reserve;
    config.dividend_vault_bump     = ctx.bumps.dividend_vault;
    config.total_supply            = 0;
    config.max_supply_cap          = MAX_SUPPLY_CAP as u64;
    config.vault_reserve           = 0u128;
    config.dividend_pool_balance   = 0u128;
    config.ratchet_locked_reserve  = 0u128;
    config.tracked_excess_usdt     = 0u128;
    config.total_yield_injected    = 0u128;
    config.acc_dividend_per_share  = 0u128;
    config.is_paused               = false;
    config.min_holding_slots       = DEFAULT_MIN_HOLDING_SLOTS;

    // ── MultisigConfig ────────────────────────────────────────────────────────
    let ms = &mut ctx.accounts.multisig_config;
    ms.threshold      = threshold;
    ms.signer_count   = signers.len() as u8;
    ms.proposal_nonce = 0;
    for (i, s) in signers.iter().enumerate() {
        ms.signers[i] = *s;
    }

    msg!(
        "Virtual Gold Protocol v5.4 initialized. Multisig: {}/{} threshold. Min hold: {} slots.",
        threshold, signers.len(), DEFAULT_MIN_HOLDING_SLOTS
    );
    Ok(())
}
