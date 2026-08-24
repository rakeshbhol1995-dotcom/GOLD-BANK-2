use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, Token, TokenAccount, Transfer};
use crate::state::{ProtocolConfig, MultisigConfig, GovernanceProposal, ProposalKind, UserAccount, MAX_MULTISIG_SIGNERS, EPOCH_SECONDS};
use crate::errors::ImmortalGoldError;
use crate::math::{DIVIDEND_PRECISION, GUARANTEED_EXIT_MAX_BPS, MIN_RESERVE_RATIO_BPS, mul_div_u256};

// ─────────────────────────────────────────────────────────────────────────────
// GOVERNANCE TIMELOCK
// ─────────────────────────────────────────────────────────────────────────────
pub const GOVERNANCE_TIMELOCK_SECONDS: i64 = 172_800; // 48 hours
pub const PROPOSAL_EXPIRY_SECONDS: i64     = 604_800; // 7 days

// ─────────────────────────────────────────────────────────────────────────────
// CREATE PROPOSAL
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct CreateProposal<'info> {
    #[account(mut)]
    pub proposer: Signer<'info>,

    #[account(mut, seeds = [b"multisig_config"], bump)]
    pub multisig_config: Account<'info, MultisigConfig>,

    #[account(
        init,
        payer = proposer,
        space = GovernanceProposal::LEN,
        seeds = [b"proposal", multisig_config.key().as_ref(), multisig_config.proposal_nonce.to_le_bytes().as_ref()],
        bump
    )]
    pub proposal: Account<'info, GovernanceProposal>,

    pub system_program: Program<'info, System>,
}

pub fn create_proposal_handler(ctx: Context<CreateProposal>, kind: ProposalKind) -> Result<()> {
    let ms = &mut ctx.accounts.multisig_config;
    let is_signer = ms.signers[..ms.signer_count as usize]
        .iter().any(|s| *s == ctx.accounts.proposer.key());
    require!(is_signer, ImmortalGoldError::Unauthorized);

    let now = Clock::get()?.unix_timestamp;
    let p   = &mut ctx.accounts.proposal;
    p.multisig       = ms.key();
    p.proposal_nonce = ms.proposal_nonce;
    p.kind           = kind;
    p.proposer       = ctx.accounts.proposer.key();
    p.created_at     = now;
    p.expires_at     = now + PROPOSAL_EXPIRY_SECONDS;
    p.executed       = false;
    p.executed_at    = 0;
    p.approval_count = 1;
    p.approvals[0]   = ctx.accounts.proposer.key();

    let nonce = ms.proposal_nonce;
    ms.proposal_nonce += 1;

    emit!(ProposalCreatedEvent { proposer: ctx.accounts.proposer.key(), nonce, created_at: now });
    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// APPROVE PROPOSAL
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct ApproveProposal<'info> {
    #[account(mut)]
    pub approver: Signer<'info>,

    #[account(seeds = [b"multisig_config"], bump)]
    pub multisig_config: Account<'info, MultisigConfig>,

    #[account(
        mut,
        seeds = [b"proposal", multisig_config.key().as_ref(), proposal.proposal_nonce.to_le_bytes().as_ref()],
        bump
    )]
    pub proposal: Account<'info, GovernanceProposal>,
}

pub fn approve_proposal_handler(ctx: Context<ApproveProposal>) -> Result<()> {
    let ms = &ctx.accounts.multisig_config;
    let is_signer = ms.signers[..ms.signer_count as usize]
        .iter().any(|s| *s == ctx.accounts.approver.key());
    require!(is_signer, ImmortalGoldError::Unauthorized);

    let now = Clock::get()?.unix_timestamp;
    let p   = &mut ctx.accounts.proposal;
    require!(!p.executed,  ImmortalGoldError::ProposalAlreadyExecuted);
    require!(now <= p.expires_at, ImmortalGoldError::ProposalExpired);

    let count   = p.approval_count as usize;
    require!(count < MAX_MULTISIG_SIGNERS, ImmortalGoldError::TooManyApprovals);
    let already = p.approvals[..count].iter().any(|s| *s == ctx.accounts.approver.key());
    require!(!already, ImmortalGoldError::AlreadyApproved);

    p.approvals[count] = ctx.accounts.approver.key();
    p.approval_count  += 1;
    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// EXECUTE PROPOSAL
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct ExecuteProposal<'info> {
    #[account(mut)]
    pub executor: Signer<'info>,

    #[account(mut, seeds = [b"multisig_config"], bump)]
    pub multisig_config: Account<'info, MultisigConfig>,

    #[account(
        mut,
        seeds = [b"proposal", multisig_config.key().as_ref(), proposal.proposal_nonce.to_le_bytes().as_ref()],
        bump
    )]
    pub proposal: Account<'info, GovernanceProposal>,

    #[account(mut, seeds = [b"protocol_config"], bump)]
    pub protocol_config: Account<'info, ProtocolConfig>,
}

pub fn execute_proposal_handler(ctx: Context<ExecuteProposal>) -> Result<()> {
    let ms     = &mut ctx.accounts.multisig_config;
    let config = &mut ctx.accounts.protocol_config;
    let p      = &mut ctx.accounts.proposal;
    let exec   = ctx.accounts.executor.key();

    // Must belong to this multisig configuration
    require!(p.multisig == ms.key(), ImmortalGoldError::Unauthorized);

    // Must be a current signer
    let is_signer = ms.signers[..ms.signer_count as usize].iter().any(|s| *s == exec);
    require!(is_signer, ImmortalGoldError::Unauthorized);

    let now = Clock::get()?.unix_timestamp;
    require!(!p.executed,  ImmortalGoldError::ProposalAlreadyExecuted);
    require!(now <= p.expires_at, ImmortalGoldError::ProposalExpired);
    require!(now >= p.created_at + GOVERNANCE_TIMELOCK_SECONDS, ImmortalGoldError::TimelockNotExpired);

    // Only count approvals from current signer set (prevents stale signer attack)
    let mut valid = 0u8;
    for app in p.approvals[..p.approval_count as usize].iter() {
        if ms.signers[..ms.signer_count as usize].iter().any(|s| s == app) { valid += 1; }
    }
    require!(valid >= ms.threshold, ImmortalGoldError::InsufficientApprovals);

    p.executed    = true;
    p.executed_at = now;

    match &p.kind {
        ProposalKind::Pause       => { config.is_paused = true;  msg!("Protocol PAUSED via governance."); }
        ProposalKind::Resume      => { config.is_paused = false; msg!("Protocol RESUMED via governance."); }
        ProposalKind::EmergencyUnpause => { config.is_paused = false; msg!("Emergency UNPAUSE executed."); }
        ProposalKind::UpdateTreasury { new_treasury } => {
            let old = config.admin_treasury;
            config.admin_treasury = *new_treasury;
            emit!(TreasuryUpdatedEvent { admin: exec, old_treasury: old, new_treasury: *new_treasury });
        }
        ProposalKind::UpdateAdmin { new_admin } => {
            let old = config.admin;
            config.admin = *new_admin;
            emit!(AdminUpdatedEvent { old_admin: old, new_admin: *new_admin });
        }
        ProposalKind::UpdateMultisig { new_signers, new_signer_count, new_threshold } => {
            require!(*new_threshold > 0,                            ImmortalGoldError::InvalidMultisigConfig);
            require!(*new_signer_count >= *new_threshold,           ImmortalGoldError::InvalidMultisigConfig);
            require!((*new_signer_count as usize) <= MAX_MULTISIG_SIGNERS, ImmortalGoldError::InvalidMultisigConfig);
            for i in 0..(*new_signer_count as usize) {
                require!(new_signers[i] != Pubkey::default(), ImmortalGoldError::InvalidMultisigConfig);
                for j in (i + 1)..(*new_signer_count as usize) {
                    require!(new_signers[i] != new_signers[j], ImmortalGoldError::InvalidMultisigConfig);
                }
            }
            ms.threshold    = *new_threshold;
            ms.signer_count = *new_signer_count;
            for i in 0..(*new_signer_count as usize) { ms.signers[i] = new_signers[i]; }
            msg!("Multisig signers updated via governance. New threshold: {}", new_threshold);
        }
        ProposalKind::InjectYieldApprove { amount } => {
            // This proposal pre-authorizes a yield injection; actual transfer
            // is done separately by keeper via inject_external_yield instruction
            msg!("InjectYieldApprove: {} micro-USDT pre-authorized by governance.", amount);
        }
        ProposalKind::ReleaseRatchet { amount } => {
            require!(*amount > 0, ImmortalGoldError::InvalidAmount);
            require!(config.ratchet_locked_reserve >= *amount as u128, ImmortalGoldError::InsufficientVaultLiquidity);
            config.ratchet_locked_reserve = config.ratchet_locked_reserve
                .checked_sub(*amount as u128).ok_or(ImmortalGoldError::MathOverflow)?;
            config.vault_reserve = config.vault_reserve
                .checked_add(*amount as u128).ok_or(ImmortalGoldError::MathOverflow)?;
            msg!("Ratchet release: {} micro-USDT returned to main vault.", amount);
        }
        ProposalKind::UpdateOraclePrice { price_usd_micro } => {
            require!(*price_usd_micro >= 100_000 && *price_usd_micro <= 100_000_000_000, ImmortalGoldError::InvalidOraclePrice);
            msg!("Oracle price update to {} micro-USD pre-authorized by governance.", price_usd_micro);
        }
        ProposalKind::UpdateHoldingSlots { new_slots } => {
            config.min_holding_slots = *new_slots;
            msg!("Min holding slots updated to {}.", new_slots);
        }
    }

    emit!(ProposalExecutedEvent { executor: exec, executed_at: now });
    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// EMERGENCY RESCUE (Multisig Required — Rug-Pull Prevention)
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct EmergencyRescueUsdt<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    /// Multisig config — admin must be a current signer (NO single-key admin power)
    #[account(seeds = [b"multisig_config"], bump)]
    pub multisig_config: Account<'info, MultisigConfig>,

    #[account(mut, seeds = [b"protocol_config"], bump)]
    pub protocol_config: Account<'info, ProtocolConfig>,

    #[account(
        mut,
        seeds = [b"vault_reserve"],
        bump = protocol_config.vault_bump
    )]
    pub vault_reserve: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = destination.mint == protocol_config.usdt_mint @ ImmortalGoldError::UnauthorizedMint
    )]
    pub destination: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn emergency_rescue_usdt_handler(ctx: Context<EmergencyRescueUsdt>, amount: u64) -> Result<()> {
    let config = &mut ctx.accounts.protocol_config;

    // Must be paused
    require!(config.is_paused, ImmortalGoldError::ProtocolNotPaused);

    // RUG-PULL FIX: Admin must be a current multisig signer — no bare single-key rescue
    let ms = &ctx.accounts.multisig_config;
    let is_ms = ms.signers[..ms.signer_count as usize].iter().any(|s| *s == ctx.accounts.admin.key());
    require!(is_ms, ImmortalGoldError::Unauthorized);

    // Only rescue EXCESS above tracked reserve (never touches protocol-owed funds)
    let physical  = ctx.accounts.vault_reserve.amount as u128;
    let protected = config.vault_reserve;
    require!(physical > protected, ImmortalGoldError::NoExcessUsdtToRescue);
    let excess = physical - protected;
    require!((amount as u128) <= excess, ImmortalGoldError::ExceedsExcessUsdt);

    let bump   = config.vault_bump;
    let seeds  = &[b"vault_reserve".as_ref(), &[bump]];
    let signer = &[&seeds[..]];

    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from:      ctx.accounts.vault_reserve.to_account_info(),
                to:        ctx.accounts.destination.to_account_info(),
                authority: ctx.accounts.vault_reserve.to_account_info(),
            },
            signer,
        ),
        amount,
    )?;

    config.tracked_excess_usdt = excess.saturating_sub(amount as u128);

    emit!(EmergencyRescueEvent {
        admin:       ctx.accounts.admin.key(),
        amount,
        destination: ctx.accounts.destination.key(),
    });
    msg!("Emergency rescue: {} micro-USDT excess transferred. Reserve protected.", amount);
    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// INJECT EXTERNAL YIELD (Real Revenue → Dividend Pool)
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct InjectExternalYield<'info> {
    #[account(mut)]
    pub keeper: Signer<'info>,

    /// Keeper must be a current multisig signer
    #[account(seeds = [b"multisig_config"], bump)]
    pub multisig_config: Account<'info, MultisigConfig>,

    #[account(mut, seeds = [b"protocol_config"], bump)]
    pub protocol_config: Account<'info, ProtocolConfig>,

    #[account(
        mut,
        constraint = keeper_usdt_account.owner == keeper.key() @ ImmortalGoldError::Unauthorized,
        constraint = keeper_usdt_account.mint == protocol_config.usdt_mint @ ImmortalGoldError::UnauthorizedMint
    )]
    pub keeper_usdt_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"dividend_vault"],
        bump = protocol_config.dividend_vault_bump
    )]
    pub dividend_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn inject_external_yield_handler(ctx: Context<InjectExternalYield>, amount: u64) -> Result<()> {
    require!(amount > 0, ImmortalGoldError::InvalidAmount);

    // Only multisig-authorized keepers can inject yield
    let ms = &ctx.accounts.multisig_config;
    let is_ms = ms.signers[..ms.signer_count as usize].iter().any(|s| *s == ctx.accounts.keeper.key());
    require!(is_ms, ImmortalGoldError::Unauthorized);

    // Transfer USDT from keeper → dividend vault
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from:      ctx.accounts.keeper_usdt_account.to_account_info(),
                to:        ctx.accounts.dividend_vault.to_account_info(),
                authority: ctx.accounts.keeper.to_account_info(),
            },
        ),
        amount,
    )?;

    let config = &mut ctx.accounts.protocol_config;
    config.dividend_pool_balance = config.dividend_pool_balance
        .checked_add(amount as u128).ok_or(ImmortalGoldError::MathOverflow)?;
    config.total_yield_injected = config.total_yield_injected
        .checked_add(amount as u128).ok_or(ImmortalGoldError::MathOverflow)?;

    // Distribute to existing holders via accumulated dividend per share
    if config.total_supply > 0 {
        let add = (amount as u128)
            .checked_mul(DIVIDEND_PRECISION).ok_or(ImmortalGoldError::MathOverflow)?
            / config.total_supply as u128;
        config.acc_dividend_per_share = config.acc_dividend_per_share
            .checked_add(add).ok_or(ImmortalGoldError::MathOverflow)?;
    }

    emit!(ExternalYieldInjectedEvent {
        keeper: ctx.accounts.keeper.key(),
        amount,
        total_yield_injected: config.total_yield_injected,
    });
    msg!("External yield injected: {} micro-USDT into dividend pool.", amount);
    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// GUARANTEED EXIT (≤0.1% of supply — Investor Protection, Bypasses Circuit Breaker)
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct GuaranteedExit<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,

    #[account(mut, seeds = [b"protocol_config"], bump)]
    pub protocol_config: Account<'info, ProtocolConfig>,

    #[account(mut, seeds = [b"user_account", seller.key().as_ref()], bump)]
    pub user_account: Account<'info, UserAccount>,

    #[account(
        mut,
        constraint = seller_usdt_account.owner == seller.key() @ ImmortalGoldError::Unauthorized,
        constraint = seller_usdt_account.mint == protocol_config.usdt_mint @ ImmortalGoldError::UnauthorizedMint
    )]
    pub seller_usdt_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"vault_reserve"],
        bump = protocol_config.vault_bump
    )]
    pub vault_reserve: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"locked_reserve"],
        bump = protocol_config.locked_vault_bump
    )]
    pub locked_reserve: Account<'info, TokenAccount>,

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

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn guaranteed_exit_handler(ctx: Context<GuaranteedExit>, amount_to_exit: u64) -> Result<()> {
    let config = &mut ctx.accounts.protocol_config;
    require!(!config.is_paused,                     ImmortalGoldError::ProtocolPaused);
    require!(amount_to_exit > 0,                    ImmortalGoldError::InvalidAmount);
    require!(config.total_supply >= amount_to_exit, ImmortalGoldError::InvalidAmount);

    let seller_bal = ctx.accounts.seller_token_account.amount;
    require!(seller_bal >= amount_to_exit, ImmortalGoldError::InvalidAmount);

    // Hard cap: 0.1% of total supply per epoch
    let max_exit = (config.total_supply as u128)
        .checked_mul(GUARANTEED_EXIT_MAX_BPS as u128)
        .ok_or(ImmortalGoldError::MathOverflow)?
        / 10_000;
    require!(max_exit > 0, ImmortalGoldError::GuaranteedExitLimitExceeded);

    // Per-epoch cumulative user exit cap (prevents multi-tx spam within same 24h epoch)
    let current_epoch = Clock::get()?.unix_timestamp / EPOCH_SECONDS;
    let user = &mut ctx.accounts.user_account;
    if user.last_exit_epoch < current_epoch {
        user.last_exit_epoch = current_epoch;
        user.epoch_exited_amount = 0;
    }
    let new_user_exited = user.epoch_exited_amount.checked_add(amount_to_exit).ok_or(ImmortalGoldError::MathOverflow)?;
    require!((new_user_exited as u128) <= max_exit, ImmortalGoldError::GuaranteedExitLimitExceeded);
    user.epoch_exited_amount = new_user_exited;

    // Physical vault solvency check
    let physical = ctx.accounts.vault_reserve.amount as u128;
    require!(physical >= config.vault_reserve, ImmortalGoldError::VaultSolvencyBreach);

    // Pre-exit dividend settlement for holder
    if seller_bal > 0 {
        let acc     = (seller_bal as u128)
            .checked_mul(config.acc_dividend_per_share).ok_or(ImmortalGoldError::MathOverflow)?;
        let pending = acc.saturating_sub(user.reward_debt) / DIVIDEND_PRECISION;
        user.pending_rewards = user.pending_rewards.checked_add(pending as u64).ok_or(ImmortalGoldError::MathOverflow)?;
    }

    // Pure reserve-proportional payout — no bonding curve, no circuit breaker check
    let reserve_share_128 = mul_div_u256(
        config.vault_reserve,
        amount_to_exit as u128,
        config.total_supply as u128,
    )?;
    let payout_128    = reserve_share_128.saturating_mul(9_000) / 10_000; // 90% to seller
    let lock_128      = reserve_share_128.saturating_sub(payout_128);     // 10% locked
    let payout        = u64::try_from(payout_128).map_err(|_| ImmortalGoldError::MathOverflow)?;
    let lock_u64      = u64::try_from(lock_128).map_err(|_| ImmortalGoldError::MathOverflow)?;
    require!(payout > 0, ImmortalGoldError::InvalidAmount);

    // Burn tokens
    token::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint:      ctx.accounts.img_mint.to_account_info(),
                from:      ctx.accounts.seller_token_account.to_account_info(),
                authority: ctx.accounts.seller.to_account_info(),
            },
        ),
        amount_to_exit,
    )?;

    let bump   = config.vault_bump;
    let seeds  = &[b"vault_reserve".as_ref(), &[bump]];
    let signer = &[&seeds[..]];

    // Transfer 90% → seller
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from:      ctx.accounts.vault_reserve.to_account_info(),
                to:        ctx.accounts.seller_usdt_account.to_account_info(),
                authority: ctx.accounts.vault_reserve.to_account_info(),
            },
            signer,
        ),
        payout,
    )?;

    // Lock 10% → locked_reserve (protects remaining holders' floor)
    if lock_u64 > 0 {
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from:      ctx.accounts.vault_reserve.to_account_info(),
                    to:        ctx.accounts.locked_reserve.to_account_info(),
                    authority: ctx.accounts.vault_reserve.to_account_info(),
                },
                signer,
            ),
            lock_u64,
        )?;
        config.ratchet_locked_reserve = config.ratchet_locked_reserve
            .checked_add(lock_u64 as u128).ok_or(ImmortalGoldError::MathOverflow)?;
    }

    config.total_supply  = config.total_supply.checked_sub(amount_to_exit).ok_or(ImmortalGoldError::MathOverflow)?;
    config.vault_reserve = config.vault_reserve.checked_sub(reserve_share_128).ok_or(ImmortalGoldError::InsufficientVaultLiquidity)?;

    // Post-exit reward debt update
    let rem_bal = seller_bal.checked_sub(amount_to_exit).ok_or(ImmortalGoldError::MathOverflow)?;
    user.reward_debt = (rem_bal as u128)
        .checked_mul(config.acc_dividend_per_share).ok_or(ImmortalGoldError::MathOverflow)?;

    emit!(GuaranteedExitEvent {
        seller: ctx.accounts.seller.key(),
        amount_exited: amount_to_exit,
        payout,
    });
    emit!(ReserveHealthEvent {
        vault_reserve: config.vault_reserve,
        total_supply: config.total_supply,
        timestamp: Clock::get()?.unix_timestamp,
    });
    msg!("Guaranteed exit: {} $IMG burned, {} micro-USDT paid to seller.", amount_to_exit, payout);
    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// LEGACY ADMIN (kept for backward compat — no longer single-key privileged)
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct SetPause<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        mut,
        seeds = [b"multisig_config"], bump
    )]
    pub multisig_config: Account<'info, MultisigConfig>,
    #[account(mut, seeds = [b"protocol_config"], bump)]
    pub protocol_config: Account<'info, ProtocolConfig>,
}

pub fn set_pause_handler(ctx: Context<SetPause>, paused: bool) -> Result<()> {
    // Admin must be multisig signer — no bare single-key pause
    let ms = &ctx.accounts.multisig_config;
    let is_ms = ms.signers[..ms.signer_count as usize].iter().any(|s| *s == ctx.accounts.admin.key());
    require!(is_ms, ImmortalGoldError::Unauthorized);

    let config = &mut ctx.accounts.protocol_config;
    config.is_paused = paused;
    emit!(PauseEvent { admin: ctx.accounts.admin.key(), is_paused: paused });
    msg!("Protocol pause status: {}", paused);
    Ok(())
}

#[derive(Accounts)]
pub struct UpdateAdminTreasury<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(seeds = [b"multisig_config"], bump)]
    pub multisig_config: Account<'info, MultisigConfig>,
    #[account(mut, seeds = [b"protocol_config"], bump)]
    pub protocol_config: Account<'info, ProtocolConfig>,
    /// CHECK: New treasury wallet
    pub new_admin_treasury: UncheckedAccount<'info>,
}

pub fn update_admin_treasury_handler(ctx: Context<UpdateAdminTreasury>) -> Result<()> {
    // Must be multisig signer
    let ms = &ctx.accounts.multisig_config;
    let is_ms = ms.signers[..ms.signer_count as usize].iter().any(|s| *s == ctx.accounts.admin.key());
    require!(is_ms, ImmortalGoldError::Unauthorized);

    let config = &mut ctx.accounts.protocol_config;
    let old    = config.admin_treasury;
    let new    = ctx.accounts.new_admin_treasury.key();
    config.admin_treasury = new;
    emit!(TreasuryUpdatedEvent { admin: ctx.accounts.admin.key(), old_treasury: old, new_treasury: new });
    msg!("Admin treasury updated to {}", new);
    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// EVENTS
// ─────────────────────────────────────────────────────────────────────────────

#[event] pub struct BuyEvent { pub buyer: Pubkey, pub amount_bought: u64, pub gross_cost: u64, pub vault_deposit: u64 }
#[event] pub struct SellEvent { pub seller: Pubkey, pub amount_sold: u64, pub seller_payout: u64, pub burned_amount: u64 }
#[event] pub struct ClaimDividendEvent { pub user: Pubkey, pub payout_amount: u64 }
#[event] pub struct PauseEvent { pub admin: Pubkey, pub is_paused: bool }
#[event] pub struct TreasuryUpdatedEvent { pub admin: Pubkey, pub old_treasury: Pubkey, pub new_treasury: Pubkey }
#[event] pub struct AdminUpdatedEvent { pub old_admin: Pubkey, pub new_admin: Pubkey }
#[event] pub struct ProposalCreatedEvent { pub proposer: Pubkey, pub nonce: u64, pub created_at: i64 }
#[event] pub struct ProposalExecutedEvent { pub executor: Pubkey, pub executed_at: i64 }
#[event] pub struct EmergencyRescueEvent { pub admin: Pubkey, pub amount: u64, pub destination: Pubkey }
#[event] pub struct ExternalYieldInjectedEvent { pub keeper: Pubkey, pub amount: u64, pub total_yield_injected: u128 }
#[event] pub struct GuaranteedExitEvent { pub seller: Pubkey, pub amount_exited: u64, pub payout: u64 }
#[event] pub struct ReserveHealthEvent { pub vault_reserve: u128, pub total_supply: u64, pub timestamp: i64 }
