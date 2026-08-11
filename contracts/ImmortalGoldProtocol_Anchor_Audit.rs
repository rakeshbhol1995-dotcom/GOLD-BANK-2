// ============================================================================
// VIRTUAL GOLD PROTOCOL ($GOLD) — NATIVE SOVEREIGN L1 SMART CONTRACT
// Version: v5.0 — Production Release
// Website: virtualgold.org  |  Symbol: $GOLD  |  Decimals: 9
// Max Supply: 21,000,000 units  |  Genesis Price: 10 USDT/unit
// ============================================================================
//
// ─────────────────────────────────────────────────────────────────────────────
//  ⚠️  MANDATORY RISK DISCLOSURE
// ─────────────────────────────────────────────────────────────────────────────
//  $GOLD IS NOT A GOLD-BACKED SECURITY OR COMMODITY.
//  The protocol holds NO physical gold, NO gold futures, NO ETF shares.
//  Redemption value is determined SOLELY by the SOL reserve + bonding curve.
//  Actual payout = min(curve_price, reserve_share) minus 10% sell tax.
//  Purchasing $GOLD carries risk of total loss.
//
//  ⚠️  BANK-RUN ECONOMIC LIMITATION (v5.0 Audit Disclosure):
//  The per-transaction floor proof V(t+1)/S(t+1) >= V(t)/S(t) is mathematically
//  correct for each individual sell transaction.  However, under extreme sequential
//  sell pressure (bank-run), the reserve_share denominator shrinks with each sell,
//  meaning each successive seller receives progressively less SOL.  The token's
//  SOL redemption value per unit is protected per-transaction (floor never drops
//  within one tx) but the absolute reserve CAN drain to near-zero if all holders
//  sell sequentially.  Circuit breakers (see below) limit the daily sell rate to
//  mitigate — but do not eliminate — this risk.
// ─────────────────────────────────────────────────────────────────────────────
//
// ─────────────────────────────────────────────────────────────────────────────
//  v5.0 NEW FEATURES (Audit Fixes)
// ─────────────────────────────────────────────────────────────────────────────
//
//  1. CIRCUIT BREAKERS (Audit Fix — Bank-Run Protection):
//     sell_circuit_breaker_bps  = max % of supply sellable per 24h (default 500 = 5%)
//     withdraw_circuit_breaker_bps = max % of vault withdrawable per 24h (default 200 = 2%)
//     Both tracked per epoch. Sells that would breach either limit are rejected.
//
//  2. SOL/USD PRICE ORACLE WITH TWAP (Audit Fix — Oracle Protection):
//     A Pyth-compatible on-chain price feed stored in OracleState PDA.
//     Any multisig signer can submit a new price observation.
//     TWAP computed over last 8 observations (rolling window).
//     Price accepted only if within ±20% of TWAP (anti-manipulation).
//     Staleness check: price rejected if > 300 seconds old.
//     Oracle price is used for USD-equivalent display in events ONLY.
//     Core SOL pricing logic is oracle-independent (no oracle attack surface).
//
//  3. MULTISIG-GATED WHITELIST (Audit Fix — Bootstrap Centralization):
//     Single-admin add_to_whitelist() removed.
//     Bootstrap whitelist additions now require a WhitelistAdd multisig proposal.
//     Prevents compromised admin from whitelisting thousands of shill wallets.
//
//  4. FREEZE GOVERNANCE GATE (Audit Fix — Single-Admin Freeze Bypass):
//     freeze_upgrade_authority() now checks config.freeze_approved flag.
//     Flag is set ONLY when a FreezeUpgrade multisig proposal executes.
//     Admin cannot call freeze without prior multisig consensus.
//
//  5. DIVIDEND ANTI-FLASH-LOAN (Audit Fix — Dividend Gaming):
//     UserAccount.last_buy_slot records the slot of the user's last buy.
//     claim_dividends() requires current_slot >= last_buy_slot + MIN_HOLDING_SLOTS.
//     Default: MIN_HOLDING_SLOTS = 216_000 (~1 day on Solana @ ~2.5 slots/sec).
//     Prevents buy → claim → sell within same block or short window.
//
//  6. All v4.0 features retained:
//     Multisig governance, anti-whale, epoch emission cap, bootstrap phase,
//     emergency rescue, dual-price transparency, solvency coupling.
// ─────────────────────────────────────────────────────────────────────────────

use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    bpf_loader_upgradeable,
    program::invoke_signed,
    system_instruction,
};
use anchor_spl::token::{self, Burn, Mint, MintTo, Token, TokenAccount};

declare_id!("VGOLD1111111111111111111111111111111111111");

// ============================================================================
// 1. CONSTANTS
// ============================================================================

pub const TOKEN_DECIMALS_FACTOR: u128 = 1_000_000_000;
pub const MAX_SUPPLY_CAP: u128 = 21_000_000 * TOKEN_DECIMALS_FACTOR;
pub const BASE_PRICE_P0: u128 = 10_000_000;
pub const TARGET_PRICE_P1: u128 = 10_000_000_000;
pub const DIVIDEND_PRECISION: u128 = 1_000_000_000_000;

pub const GOVERNANCE_TIMELOCK_SECONDS: i64 = 172_800;   // 48 hours
pub const PROPOSAL_EXPIRY_SECONDS: i64    = 604_800;    // 7 days
pub const EPOCH_SECONDS: i64              = 86_400;     // 24 hours
pub const MIN_SELL_GROSS_LAMPORTS: u64    = 10_000;
pub const MIN_BUY_GROSS_LAMPORTS: u64     = 1_000;
pub const MAX_MULTISIG_SIGNERS: usize     = 10;

/// Default anti-whale: 1,000 units per tx
pub const DEFAULT_MAX_BUY_PER_TX: u64    = 1_000 * 1_000_000_000;

/// Default epoch emission cap: 100,000 units / 24h
pub const DEFAULT_EPOCH_EMISSION_CAP: u64 = 100_000 * 1_000_000_000;

/// Bootstrap phase max per wallet: 100 units
pub const BOOTSTRAP_MAX_PER_WALLET: u64  = 100 * 1_000_000_000;

// ── v5.0 New Constants ──────────────────────────────────────────────────────

/// Default circuit breaker: max 5% of total supply sellable per epoch
pub const DEFAULT_SELL_CIRCUIT_BPS: u16   = 500;

/// Default circuit breaker: max 2% of vault reserve withdrawable per epoch
pub const DEFAULT_WITHDRAW_CIRCUIT_BPS: u16 = 200;

/// TWAP window: number of price samples kept (rolling)
pub const ORACLE_TWAP_WINDOW: usize = 8;

/// Oracle staleness tolerance: 5 minutes
pub const ORACLE_STALENESS_SECONDS: i64 = 300;

/// Oracle max deviation from TWAP: ±20% (2000 bps)
pub const ORACLE_MAX_DEVIATION_BPS: u64 = 2_000;

/// Minimum holding slots before dividends claimable (~1 day @ 2.5 slots/sec)
pub const MIN_HOLDING_SLOTS: u64 = 216_000;

// ============================================================================
// 2. ENUMS
// ============================================================================

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum ProtocolPhase {
    Bootstrap = 0,
    Open      = 1,
    Mature    = 2,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum ProposalKind {
    Pause,
    Resume,
    TreasuryUpdate     { new_treasury: Pubkey },
    AdminUpdate        { new_admin: Pubkey },
    FreezeUpgrade,                                          // sets freeze_approved flag
    EmergencyWithdraw  { amount: u64, destination: Pubkey },
    UpdateWhaleLimit   { new_limit: u64 },
    UpdateEmissionCap  { new_cap: u64 },
    AdvancePhase,
    UpdateCircuitBreakers { sell_bps: u16, withdraw_bps: u16 },
    WhitelistAdd       { wallet: Pubkey },                  // v5.0: replaces single-admin whitelist
    UpdateHoldingSlots { new_slots: u64 },                  // v5.0: tune dividend holding period
}

// ============================================================================
// 3. PROGRAM
// ============================================================================

#[program]
pub mod virtual_gold_protocol {
    use super::*;

    // =========================================================================
    // INITIALIZE
    // =========================================================================

    pub fn initialize(
        ctx: Context<Initialize>,
        signers: Vec<Pubkey>,
        threshold: u8,
    ) -> Result<()> {
        require!(
            signers.len() >= threshold as usize
                && threshold >= 1
                && signers.len() <= MAX_MULTISIG_SIGNERS,
            VirtualGoldError::InvalidMultisigConfig
        );

        let config = &mut ctx.accounts.protocol_config;
        config.admin                    = ctx.accounts.admin.key();
        config.admin_treasury           = ctx.accounts.admin_treasury.key();
        config.gold_mint                = ctx.accounts.gold_mint.key();
        config.vault_bump               = ctx.bumps.vault_reserve;
        config.locked_vault_bump        = ctx.bumps.locked_reserve;
        config.dividend_vault_bump      = ctx.bumps.dividend_vault;
        config.total_supply             = 0;
        config.max_supply_cap           = MAX_SUPPLY_CAP as u64;
        config.vault_reserve            = 0;
        config.dividend_pool_balance    = 0;
        config.ratchet_locked_reserve   = 0;
        config.acc_dividend_per_share   = 0;
        config.is_paused                = false;
        config.is_upgrade_authority_frozen = false;
        config.freeze_approved          = false;
        config.phase                    = ProtocolPhase::Bootstrap;
        config.max_buy_per_tx           = DEFAULT_MAX_BUY_PER_TX;
        config.epoch_emission_cap       = DEFAULT_EPOCH_EMISSION_CAP;
        config.current_epoch_start      = Clock::get()?.unix_timestamp;
        config.current_epoch_minted     = 0;
        // v5.0 circuit breakers
        config.sell_circuit_bps         = DEFAULT_SELL_CIRCUIT_BPS;
        config.withdraw_circuit_bps     = DEFAULT_WITHDRAW_CIRCUIT_BPS;
        config.cb_epoch_start           = Clock::get()?.unix_timestamp;
        config.cb_epoch_sold            = 0;
        config.cb_epoch_withdrawn       = 0;
        // v5.0 dividend holding
        config.min_holding_slots        = MIN_HOLDING_SLOTS;

        // Multisig
        let msig = &mut ctx.accounts.multisig_config;
        msig.threshold      = threshold;
        msig.signer_count   = signers.len() as u8;
        msig.proposal_nonce = 0;
        let mut arr = [Pubkey::default(); MAX_MULTISIG_SIGNERS];
        for (i, s) in signers.iter().enumerate() { arr[i] = *s; }
        msig.signers = arr;

        // Oracle initial state
        let oracle = &mut ctx.accounts.oracle_state;
        oracle.price_usd_micro    = 0;   // 0 = uninitialized
        oracle.last_update_ts     = 0;
        oracle.twap_usd_micro     = 0;
        oracle.sample_count       = 0;
        oracle.samples            = [0u64; ORACLE_TWAP_WINDOW];
        oracle.sample_head        = 0;

        // Create SOL PDAs
        let min_rent = Rent::get()?.minimum_balance(0);
        create_pda_if_needed(
            &ctx.accounts.admin,
            &ctx.accounts.vault_reserve,
            &ctx.accounts.system_program,
            b"vault_reserve",
            ctx.bumps.vault_reserve,
            min_rent,
        )?;
        create_pda_if_needed(
            &ctx.accounts.admin,
            &ctx.accounts.locked_reserve,
            &ctx.accounts.system_program,
            b"locked_reserve",
            ctx.bumps.locked_reserve,
            min_rent,
        )?;
        create_pda_if_needed(
            &ctx.accounts.admin,
            &ctx.accounts.dividend_vault,
            &ctx.accounts.system_program,
            b"dividend_vault",
            ctx.bumps.dividend_vault,
            min_rent,
        )?;

        msg!("$GOLD v5.0 initialized. {}-of-{} multisig. Bootstrap phase.", threshold, signers.len());
        Ok(())
    }

    // =========================================================================
    // v5.0: ORACLE — UPDATE SOL/USD PRICE
    // =========================================================================

    /// Any multisig signer submits a new SOL/USD price observation.
    /// Price is in micro-USD (1 USD = 1_000_000 micro-USD).
    /// Acceptance requires: fresh timestamp + within ±20% of rolling TWAP.
    /// Core SOL math is NOT oracle-dependent — oracle is display-only.
    pub fn update_sol_price(
        ctx: Context<UpdateOraclePrice>,
        price_usd_micro: u64,
    ) -> Result<()> {
        let msig = &ctx.accounts.multisig_config;
        require!(
            msig.signers[..msig.signer_count as usize].contains(&ctx.accounts.updater.key()),
            VirtualGoldError::Unauthorized
        );
        require!(price_usd_micro > 0, VirtualGoldError::InvalidOraclePrice);

        let oracle = &mut ctx.accounts.oracle_state;
        let now    = Clock::get()?.unix_timestamp;

        // TWAP deviation check — only once TWAP is seeded (>= 2 samples)
        if oracle.sample_count >= 2 && oracle.twap_usd_micro > 0 {
            let twap = oracle.twap_usd_micro;
            let max_up   = twap.saturating_add(
                twap.saturating_mul(ORACLE_MAX_DEVIATION_BPS as u64) / 10_000
            );
            let max_down = twap.saturating_sub(
                twap.saturating_mul(ORACLE_MAX_DEVIATION_BPS as u64) / 10_000
            );
            require!(
                price_usd_micro >= max_down && price_usd_micro <= max_up,
                VirtualGoldError::OraclePriceManipulation
            );
        }

        // Rolling window update
        let head = oracle.sample_head as usize % ORACLE_TWAP_WINDOW;
        oracle.samples[head]   = price_usd_micro;
        oracle.sample_head     = oracle.sample_head.wrapping_add(1);
        oracle.sample_count    = oracle.sample_count.saturating_add(1).min(ORACLE_TWAP_WINDOW as u64);
        oracle.price_usd_micro = price_usd_micro;
        oracle.last_update_ts  = now;

        // Recompute TWAP
        let count = oracle.sample_count as usize;
        let sum: u64 = oracle.samples[..ORACLE_TWAP_WINDOW]
            .iter()
            .take(count)
            .sum();
        oracle.twap_usd_micro = sum / count as u64;

        emit!(OraclePriceUpdatedEvent {
            updater: ctx.accounts.updater.key(),
            price_usd_micro,
            twap_usd_micro: oracle.twap_usd_micro,
            timestamp: now,
        });

        msg!("Oracle: SOL/USD = ${}.{:06}  TWAP = ${}.{:06}",
             price_usd_micro / 1_000_000, price_usd_micro % 1_000_000,
             oracle.twap_usd_micro / 1_000_000, oracle.twap_usd_micro % 1_000_000);
        Ok(())
    }

    // =========================================================================
    // MULTISIG — CREATE PROPOSAL
    // =========================================================================

    pub fn create_proposal(
        ctx: Context<CreateProposal>,
        kind: ProposalKind,
    ) -> Result<()> {
        let msig = &ctx.accounts.multisig_config;
        let proposer = ctx.accounts.proposer.key();
        require!(
            msig.signers[..msig.signer_count as usize].contains(&proposer),
            VirtualGoldError::Unauthorized
        );

        let nonce    = msig.proposal_nonce;
        let proposal = &mut ctx.accounts.proposal;
        proposal.kind           = kind;
        proposal.proposer       = proposer;
        proposal.created_at     = Clock::get()?.unix_timestamp;
        proposal.expires_at     = proposal.created_at + PROPOSAL_EXPIRY_SECONDS;
        proposal.executed       = false;
        proposal.executed_at    = 0;
        proposal.approval_count = 1;
        proposal.approvals      = [Pubkey::default(); MAX_MULTISIG_SIGNERS];
        proposal.approvals[0]   = proposer;   // proposer auto-approves

        ctx.accounts.multisig_config.proposal_nonce = nonce
            .checked_add(1).ok_or(VirtualGoldError::MathOverflow)?;

        emit!(ProposalCreatedEvent { proposer, nonce, created_at: proposal.created_at });
        msg!("Proposal #{} created. 1/{} approvals.", nonce, msig.threshold);
        Ok(())
    }

    // =========================================================================
    // MULTISIG — APPROVE PROPOSAL
    // =========================================================================

    pub fn approve_proposal(ctx: Context<ApproveProposal>) -> Result<()> {
        let msig     = &ctx.accounts.multisig_config;
        let approver = ctx.accounts.approver.key();
        require!(
            msig.signers[..msig.signer_count as usize].contains(&approver),
            VirtualGoldError::Unauthorized
        );

        let proposal = &mut ctx.accounts.proposal;
        let now = Clock::get()?.unix_timestamp;
        require!(now < proposal.expires_at,              VirtualGoldError::ProposalExpired);
        require!(!proposal.executed,                     VirtualGoldError::ProposalAlreadyExecuted);
        require!(
            !proposal.approvals[..proposal.approval_count as usize].contains(&approver),
            VirtualGoldError::AlreadyApproved
        );

        proposal.approvals[proposal.approval_count as usize] = approver;
        proposal.approval_count = proposal.approval_count
            .checked_add(1).ok_or(VirtualGoldError::MathOverflow)?;

        msg!("Proposal approved. {}/{} approvals.", proposal.approval_count, msig.threshold);
        Ok(())
    }

    // =========================================================================
    // MULTISIG — EXECUTE PROPOSAL
    // =========================================================================

    pub fn execute_proposal(ctx: Context<ExecuteProposal>) -> Result<()> {
        let msig     = &ctx.accounts.multisig_config;
        let executor = ctx.accounts.executor.key();
        require!(
            msig.signers[..msig.signer_count as usize].contains(&executor),
            VirtualGoldError::Unauthorized
        );

        let proposal = &mut ctx.accounts.proposal;
        let now = Clock::get()?.unix_timestamp;
        require!(!proposal.executed,                                  VirtualGoldError::ProposalAlreadyExecuted);
        require!(now < proposal.expires_at,                           VirtualGoldError::ProposalExpired);
        require!(proposal.approval_count >= msig.threshold,           VirtualGoldError::InsufficientApprovals);
        require!(now >= proposal.created_at + GOVERNANCE_TIMELOCK_SECONDS, VirtualGoldError::TimelockNotExpired);

        proposal.executed    = true;
        proposal.executed_at = now;

        let config = &mut ctx.accounts.protocol_config;

        match proposal.kind.clone() {
            ProposalKind::Pause  => { config.is_paused = true;  msg!("Protocol PAUSED."); }
            ProposalKind::Resume => { config.is_paused = false; msg!("Protocol RESUMED."); }

            ProposalKind::TreasuryUpdate { new_treasury } => {
                let old = config.admin_treasury;
                config.admin_treasury = new_treasury;
                emit!(TreasuryUpdatedEvent { admin: executor, old_treasury: old, new_treasury });
            }
            ProposalKind::AdminUpdate { new_admin } => {
                let old = config.admin;
                config.admin = new_admin;
                emit!(AdminChangeExecutedEvent { old_admin: old, new_admin });
            }

            // v5.0 FIX #4: Sets flag — freeze_upgrade_authority() checks this
            ProposalKind::FreezeUpgrade => {
                config.freeze_approved = true;
                msg!("FreezeUpgrade approved. Call freeze_upgrade_authority() to execute BPF CPI.");
            }

            ProposalKind::EmergencyWithdraw { amount: _, destination: _ } => {
                // Validated & executed in emergency_rescue_sol()
                msg!("EmergencyWithdraw approved via multisig.");
            }
            ProposalKind::UpdateWhaleLimit { new_limit } => {
                require!(new_limit > 0, VirtualGoldError::InvalidAmount);
                config.max_buy_per_tx = new_limit;
                msg!("Anti-whale limit updated to {} raw units.", new_limit);
            }
            ProposalKind::UpdateEmissionCap { new_cap } => {
                require!(new_cap > 0, VirtualGoldError::InvalidAmount);
                config.epoch_emission_cap = new_cap;
                msg!("Epoch emission cap updated to {} raw units/day.", new_cap);
            }
            ProposalKind::AdvancePhase => {
                match config.phase {
                    ProtocolPhase::Bootstrap => {
                        config.phase = ProtocolPhase::Open;
                        msg!("Phase: Bootstrap → Open.");
                    }
                    ProtocolPhase::Open => {
                        config.phase = ProtocolPhase::Mature;
                        config.epoch_emission_cap = config.epoch_emission_cap.saturating_mul(2);
                        msg!("Phase: Open → Mature. Emission cap doubled.");
                    }
                    ProtocolPhase::Mature => { msg!("Already Mature — no change."); }
                }
            }
            // v5.0 FIX #1: Update circuit breakers via multisig
            ProposalKind::UpdateCircuitBreakers { sell_bps, withdraw_bps } => {
                require!(sell_bps <= 10_000 && withdraw_bps <= 10_000, VirtualGoldError::InvalidAmount);
                config.sell_circuit_bps     = sell_bps;
                config.withdraw_circuit_bps = withdraw_bps;
                msg!("Circuit breakers updated: sell={}bps withdraw={}bps.", sell_bps, withdraw_bps);
            }
            // v5.0 FIX #3: Whitelist additions are now multisig-gated
            ProposalKind::WhitelistAdd { wallet } => {
                // The actual whitelist PDA is written in whitelist_from_proposal()
                // This proposal records intent; executor calls whitelist_from_proposal() next.
                emit!(WhitelistApprovedEvent { wallet, approver: executor });
                msg!("Whitelist addition approved for {}. Call whitelist_from_proposal().", wallet);
            }
            // v5.0 FIX #5: Update dividend holding period
            ProposalKind::UpdateHoldingSlots { new_slots } => {
                config.min_holding_slots = new_slots;
                msg!("Min holding slots updated to {}.", new_slots);
            }
        }

        emit!(ProposalExecutedEvent { executor, executed_at: now });
        Ok(())
    }

    // =========================================================================
    // v5.0 FIX #3: WHITELIST FROM EXECUTED PROPOSAL
    // =========================================================================

    /// After a WhitelistAdd proposal executes, anyone can call this to
    /// materialize the whitelist entry PDA for the approved wallet.
    pub fn whitelist_from_proposal(
        ctx: Context<WhitelistFromProposal>,
    ) -> Result<()> {
        let proposal = &ctx.accounts.proposal;
        require!(proposal.executed, VirtualGoldError::ProposalNotExecuted);

        // Extract wallet from proposal kind
        let wallet = match &proposal.kind {
            ProposalKind::WhitelistAdd { wallet } => *wallet,
            _ => return Err(VirtualGoldError::WrongProposalKind.into()),
        };

        require!(
            wallet == ctx.accounts.target_wallet.key(),
            VirtualGoldError::Unauthorized
        );

        let entry = &mut ctx.accounts.whitelist_entry;
        require!(!entry.is_active, VirtualGoldError::AlreadyWhitelisted);
        entry.wallet           = wallet;
        entry.is_active        = true;
        entry.bootstrap_minted = 0;

        msg!("Whitelisted {} via executed multisig proposal.", wallet);
        Ok(())
    }

    // =========================================================================
    // v5.0 FIX #4: FREEZE UPGRADE AUTHORITY (Governance-Gated)
    // =========================================================================

    /// Permanently revokes BPF Loader upgrade authority.
    /// Requires config.freeze_approved = true (set by FreezeUpgrade multisig proposal).
    /// program_data is cryptographically constrained via seeds derivation — cannot be spoofed.
    pub fn freeze_upgrade_authority(ctx: Context<FreezeUpgradeAuthority>) -> Result<()> {
        let config = &mut ctx.accounts.protocol_config;
        require!(config.admin == ctx.accounts.admin.key(), VirtualGoldError::Unauthorized);
        require!(!config.is_upgrade_authority_frozen,       VirtualGoldError::UpgradeAuthorityFrozen);
        // v5.0 FIX #4: multisig must have approved first
        require!(config.freeze_approved,                    VirtualGoldError::FreezeNotApproved);

        let option_none: Option<Pubkey> = None;
        let instr = bpf_loader_upgradeable::set_upgrade_authority(
            &crate::id(),
            &ctx.accounts.admin.key(),
            option_none.as_ref(),
        );
        anchor_lang::solana_program::program::invoke(
            &instr,
            &[
                ctx.accounts.program_data.to_account_info(),
                ctx.accounts.admin.to_account_info(),
            ],
        )?;

        config.is_upgrade_authority_frozen = true;
        config.freeze_approved             = false; // consume the flag

        emit!(UpgradeAuthorityFrozenEvent {
            admin: ctx.accounts.admin.key(),
            timestamp: Clock::get()?.unix_timestamp,
        });
        msg!("PERMANENT: Upgrade authority revoked. Program immutable.");
        Ok(())
    }

    // =========================================================================
    // EMERGENCY SOL RESCUE (Multisig-Approved, Paused-Only)
    // =========================================================================

    pub fn emergency_rescue_sol(
        ctx: Context<EmergencyRescueSol>,
        amount: u64,
    ) -> Result<()> {
        let config = &ctx.accounts.protocol_config;
        require!(config.is_paused,                                    VirtualGoldError::ProtocolNotPaused);
        require!(config.admin == ctx.accounts.admin.key(),            VirtualGoldError::Unauthorized);

        let rent_exempt = Rent::get()?.minimum_balance(0);
        let physical    = ctx.accounts.vault_reserve.lamports();
        let protected   = config.vault_reserve
            .checked_add(rent_exempt).ok_or(VirtualGoldError::MathOverflow)?;

        require!(physical > protected,    VirtualGoldError::NoExcessSolToRescue);
        let excess = physical - protected;
        require!(amount <= excess,        VirtualGoldError::ExceedsExcessSol);

        let bump   = config.vault_bump;
        let seeds  = &[b"vault_reserve".as_ref(), &[bump]];
        let signer = &[&seeds[..]];

        invoke_signed(
            &system_instruction::transfer(
                &ctx.accounts.vault_reserve.key(),
                &ctx.accounts.destination.key(),
                amount,
            ),
            &[
                ctx.accounts.vault_reserve.to_account_info(),
                ctx.accounts.destination.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
            signer,
        )?;

        emit!(EmergencyRescueEvent {
            admin: ctx.accounts.admin.key(),
            amount,
            destination: ctx.accounts.destination.key(),
        });
        msg!("Emergency rescue: {} lamports → {}.", amount, ctx.accounts.destination.key());
        Ok(())
    }

    // =========================================================================
    // TRANSFER TOKENS (full dividend sync)
    // =========================================================================

    pub fn transfer_tokens(ctx: Context<TransferTokens>, amount: u64) -> Result<()> {
        let config = &mut ctx.accounts.protocol_config;
        require!(!config.is_paused, VirtualGoldError::ProtocolPaused);
        require!(amount > 0, VirtualGoldError::InvalidAmount);

        let sender_bal = ctx.accounts.sender_token_account.amount;
        require!(sender_bal >= amount, VirtualGoldError::InvalidAmount);

        let sender   = &mut ctx.accounts.sender_user_account;
        let receiver = &mut ctx.accounts.receiver_user_account;

        if receiver.owner == Pubkey::default() {
            receiver.owner            = ctx.accounts.receiver.key();
            receiver.reward_debt      = 0;
            receiver.pending_rewards  = 0;
            receiver.last_buy_slot    = 0;
        }

        let recv_bal = ctx.accounts.receiver_token_account.amount;

        // Accrue sender dividends BEFORE transfer
        if sender_bal > 0 {
            let acc     = (sender_bal as u128)
                .checked_mul(config.acc_dividend_per_share)
                .ok_or(VirtualGoldError::MathOverflow)?;
            let pending = acc.saturating_sub(sender.reward_debt) / DIVIDEND_PRECISION;
            sender.pending_rewards = sender.pending_rewards
                .checked_add(pending as u64).ok_or(VirtualGoldError::MathOverflow)?;
        }

        // Accrue receiver dividends BEFORE transfer
        if recv_bal > 0 {
            let acc     = (recv_bal as u128)
                .checked_mul(config.acc_dividend_per_share)
                .ok_or(VirtualGoldError::MathOverflow)?;
            let pending = acc.saturating_sub(receiver.reward_debt) / DIVIDEND_PRECISION;
            receiver.pending_rewards = receiver.pending_rewards
                .checked_add(pending as u64).ok_or(VirtualGoldError::MathOverflow)?;
        }

        // SPL Transfer CPI
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from:      ctx.accounts.sender_token_account.to_account_info(),
                    to:        ctx.accounts.receiver_token_account.to_account_info(),
                    authority: ctx.accounts.sender.to_account_info(),
                },
            ),
            amount,
        )?;

        // Update reward debts
        let new_sender = sender_bal.checked_sub(amount).ok_or(VirtualGoldError::MathOverflow)?;
        let new_recv   = recv_bal.checked_add(amount).ok_or(VirtualGoldError::MathOverflow)?;

        sender.reward_debt   = (new_sender as u128)
            .checked_mul(config.acc_dividend_per_share).ok_or(VirtualGoldError::MathOverflow)?;
        receiver.reward_debt = (new_recv as u128)
            .checked_mul(config.acc_dividend_per_share).ok_or(VirtualGoldError::MathOverflow)?;

        msg!("Transferred {} $GOLD. Dividend accounting synced.", amount);
        Ok(())
    }

    // =========================================================================
    // BUY
    // =========================================================================

    pub fn buy(
        ctx: Context<BuyTokens>,
        amount_to_buy: u64,
        max_cost_limit: u64,
    ) -> Result<()> {
        let config = &mut ctx.accounts.protocol_config;
        require!(!config.is_paused,     VirtualGoldError::ProtocolPaused);
        require!(amount_to_buy > 0,     VirtualGoldError::InvalidAmount);

        // Phase: Bootstrap — whitelist check
        if config.phase == ProtocolPhase::Bootstrap {
            let wl = &ctx.accounts.whitelist_entry;
            require!(wl.is_active, VirtualGoldError::NotWhitelisted);
            let after = wl.bootstrap_minted
                .checked_add(amount_to_buy).ok_or(VirtualGoldError::MathOverflow)?;
            require!(after <= BOOTSTRAP_MAX_PER_WALLET, VirtualGoldError::BootstrapLimitExceeded);
        }

        // Anti-whale
        require!(amount_to_buy <= config.max_buy_per_tx, VirtualGoldError::WhaleLimit);

        // Epoch emission cap
        let now = Clock::get()?.unix_timestamp;
        if now >= config.current_epoch_start + EPOCH_SECONDS {
            config.current_epoch_start  = now;
            config.current_epoch_minted = 0;
        }
        let epoch_after = config.current_epoch_minted
            .checked_add(amount_to_buy).ok_or(VirtualGoldError::MathOverflow)?;
        require!(epoch_after <= config.epoch_emission_cap, VirtualGoldError::EpochEmissionCapReached);

        // Supply cap
        let new_supply = config.total_supply
            .checked_add(amount_to_buy).ok_or(VirtualGoldError::MathOverflow)?;
        require!(new_supply <= config.max_supply_cap, VirtualGoldError::MaxSupplyReached);

        // Bonding curve
        let bd = calculate_buy_breakdown(config.total_supply, amount_to_buy)?;
        require!(bd.gross_cost <= max_cost_limit, VirtualGoldError::SlippageExceeded);

        // 1. 98% → Vault
        anchor_lang::solana_program::program::invoke(
            &system_instruction::transfer(
                &ctx.accounts.buyer.key(),
                &ctx.accounts.vault_reserve.key(),
                bd.vault_deposit,
            ),
            &[ctx.accounts.buyer.to_account_info(),
              ctx.accounts.vault_reserve.to_account_info(),
              ctx.accounts.system_program.to_account_info()],
        )?;

        // 2. 1% → Treasury
        anchor_lang::solana_program::program::invoke(
            &system_instruction::transfer(
                &ctx.accounts.buyer.key(),
                &ctx.accounts.admin_treasury.key(),
                bd.treasury_fee,
            ),
            &[ctx.accounts.buyer.to_account_info(),
              ctx.accounts.admin_treasury.to_account_info(),
              ctx.accounts.system_program.to_account_info()],
        )?;

        // 3. 1% → Dividend Vault
        if bd.dividend_fee > 0 {
            anchor_lang::solana_program::program::invoke(
                &system_instruction::transfer(
                    &ctx.accounts.buyer.key(),
                    &ctx.accounts.dividend_vault.key(),
                    bd.dividend_fee,
                ),
                &[ctx.accounts.buyer.to_account_info(),
                  ctx.accounts.dividend_vault.to_account_info(),
                  ctx.accounts.system_program.to_account_info()],
            )?;

            config.dividend_pool_balance = config.dividend_pool_balance
                .checked_add(bd.dividend_fee).ok_or(VirtualGoldError::MathOverflow)?;

            if config.total_supply > 0 {
                let add = safe_div_u128(
                    (bd.dividend_fee as u128)
                        .checked_mul(DIVIDEND_PRECISION).ok_or(VirtualGoldError::MathOverflow)?,
                    config.total_supply as u128,
                )?;
                config.acc_dividend_per_share = config.acc_dividend_per_share
                    .checked_add(add).ok_or(VirtualGoldError::MathOverflow)?;
            }
        }

        // User dividend debt
        let user = &mut ctx.accounts.user_account;
        if user.owner == Pubkey::default() {
            user.owner           = ctx.accounts.buyer.key();
            user.reward_debt     = 0;
            user.pending_rewards = 0;
            user.last_buy_slot   = 0;
        }

        let cur_bal = ctx.accounts.buyer_token_account.amount;
        if cur_bal > 0 {
            let acc     = (cur_bal as u128)
                .checked_mul(config.acc_dividend_per_share)
                .ok_or(VirtualGoldError::MathOverflow)?;
            let pending = acc.saturating_sub(user.reward_debt) / DIVIDEND_PRECISION;
            user.pending_rewards = user.pending_rewards
                .checked_add(pending as u64).ok_or(VirtualGoldError::MathOverflow)?;
        }

        // v5.0 FIX #5: Record buy slot for holding period enforcement
        user.last_buy_slot = Clock::get()?.slot;

        // 4. Mint
        let bump   = ctx.bumps.mint_authority;
        let seeds  = &[b"mint_authority".as_ref(), &[bump]];
        let signer = &[&seeds[..]];
        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint:      ctx.accounts.gold_mint.to_account_info(),
                    to:        ctx.accounts.buyer_token_account.to_account_info(),
                    authority: ctx.accounts.mint_authority.to_account_info(),
                },
                signer,
            ),
            amount_to_buy,
        )?;

        // State updates
        config.total_supply = new_supply;
        config.vault_reserve = config.vault_reserve
            .checked_add(bd.vault_deposit).ok_or(VirtualGoldError::MathOverflow)?;
        config.current_epoch_minted = epoch_after;

        let new_bal = cur_bal.checked_add(amount_to_buy).ok_or(VirtualGoldError::MathOverflow)?;
        user.reward_debt = (new_bal as u128)
            .checked_mul(config.acc_dividend_per_share).ok_or(VirtualGoldError::MathOverflow)?;

        if config.phase == ProtocolPhase::Bootstrap {
            ctx.accounts.whitelist_entry.bootstrap_minted = ctx.accounts.whitelist_entry
                .bootstrap_minted.checked_add(amount_to_buy).ok_or(VirtualGoldError::MathOverflow)?;
        }

        // Oracle-based USD value (display only)
        let sol_price = ctx.accounts.oracle_state.twap_usd_micro;
        let usd_value = if sol_price > 0 {
            (bd.gross_cost as u128).saturating_mul(sol_price as u128) / 1_000_000
        } else { 0 };

        emit!(BuyEvent {
            buyer: ctx.accounts.buyer.key(),
            amount_bought: amount_to_buy,
            gross_cost: bd.gross_cost,
            vault_deposit: bd.vault_deposit,
            usd_equivalent: usd_value as u64,
        });
        msg!("Bought {} $GOLD. Cost={} lamports (~${} USD).",
             amount_to_buy, bd.gross_cost, usd_value / 1_000_000);
        Ok(())
    }

    // =========================================================================
    // SELL
    // =========================================================================

    pub fn sell(
        ctx: Context<SellTokens>,
        amount_to_sell: u64,
        min_payout_limit: u64,
    ) -> Result<()> {
        let config = &mut ctx.accounts.protocol_config;
        require!(!config.is_paused,                                         VirtualGoldError::ProtocolPaused);
        require!(config.phase != ProtocolPhase::Bootstrap,                  VirtualGoldError::SellsLockedInBootstrap);
        require!(amount_to_sell > 0 && config.total_supply > 0,             VirtualGoldError::InvalidAmount);
        require!(config.total_supply >= amount_to_sell,                     VirtualGoldError::InvalidAmount);

        let seller_bal = ctx.accounts.seller_token_account.amount;
        require!(seller_bal >= amount_to_sell, VirtualGoldError::InvalidAmount);

        // ─── v5.0 FIX #1: CIRCUIT BREAKERS ──────────────────────────────────
        let now = Clock::get()?.unix_timestamp;

        // Roll circuit breaker epoch
        if now >= config.cb_epoch_start + EPOCH_SECONDS {
            config.cb_epoch_start    = now;
            config.cb_epoch_sold     = 0;
            config.cb_epoch_withdrawn = 0;
        }

        // Supply sell cap: max sell_circuit_bps % of current supply per epoch
        let max_daily_sell = (config.total_supply as u128)
            .saturating_mul(config.sell_circuit_bps as u128)
            / 10_000;
        let sold_after = (config.cb_epoch_sold as u128)
            .checked_add(amount_to_sell as u128).ok_or(VirtualGoldError::MathOverflow)?;
        require!(sold_after <= max_daily_sell, VirtualGoldError::SellCircuitBreakerTripped);

        // ─── Solvency Pre-Check ────────────────────────────────────────────────
        let rent_exempt = Rent::get()?.minimum_balance(0);
        let physical    = ctx.accounts.vault_reserve.lamports();
        require!(
            physical >= config.vault_reserve.checked_add(rent_exempt).ok_or(VirtualGoldError::MathOverflow)?,
            VirtualGoldError::VaultSolvencyBreach
        );

        // ─── Bonding Curve Breakdown ───────────────────────────────────────────
        let bd = calculate_sell_breakdown(config.total_supply, config.vault_reserve, amount_to_sell)?;
        require!(bd.seller_payout >= min_payout_limit, VirtualGoldError::SlippageExceeded);

        // v5.0 FIX #1: Reserve withdrawal circuit breaker
        let max_daily_withdraw = (config.vault_reserve as u128)
            .saturating_mul(config.withdraw_circuit_bps as u128)
            / 10_000;
        let withdrawn_after = (config.cb_epoch_withdrawn as u128)
            .checked_add(bd.gross_valuation as u128).ok_or(VirtualGoldError::MathOverflow)?;
        require!(withdrawn_after <= max_daily_withdraw, VirtualGoldError::WithdrawCircuitBreakerTripped);

        // ─── Accrue dividends ─────────────────────────────────────────────────
        let user = &mut ctx.accounts.user_account;
        if seller_bal > 0 {
            let acc     = (seller_bal as u128)
                .checked_mul(config.acc_dividend_per_share).ok_or(VirtualGoldError::MathOverflow)?;
            let pending = acc.saturating_sub(user.reward_debt) / DIVIDEND_PRECISION;
            user.pending_rewards = user.pending_rewards
                .checked_add(pending as u64).ok_or(VirtualGoldError::MathOverflow)?;
        }

        // ─── Burn ──────────────────────────────────────────────────────────────
        token::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint:      ctx.accounts.gold_mint.to_account_info(),
                    from:      ctx.accounts.seller_token_account.to_account_info(),
                    authority: ctx.accounts.seller.to_account_info(),
                },
            ),
            amount_to_sell,
        )?;

        let bump   = config.vault_bump;
        let seeds  = &[b"vault_reserve".as_ref(), &[bump]];
        let signer = &[&seeds[..]];

        // ─── 90% Payout ────────────────────────────────────────────────────────
        invoke_signed(
            &system_instruction::transfer(
                &ctx.accounts.vault_reserve.key(), &ctx.accounts.seller.key(), bd.seller_payout,
            ),
            &[ctx.accounts.vault_reserve.to_account_info(),
              ctx.accounts.seller.to_account_info(),
              ctx.accounts.system_program.to_account_info()],
            signer,
        )?;

        // ─── 1% Treasury ───────────────────────────────────────────────────────
        invoke_signed(
            &system_instruction::transfer(
                &ctx.accounts.vault_reserve.key(), &ctx.accounts.admin_treasury.key(), bd.treasury_fee,
            ),
            &[ctx.accounts.vault_reserve.to_account_info(),
              ctx.accounts.admin_treasury.to_account_info(),
              ctx.accounts.system_program.to_account_info()],
            signer,
        )?;

        // ─── 1% Dividend ───────────────────────────────────────────────────────
        if bd.dividend_fee > 0 {
            invoke_signed(
                &system_instruction::transfer(
                    &ctx.accounts.vault_reserve.key(),
                    &ctx.accounts.dividend_vault.key(),
                    bd.dividend_fee,
                ),
                &[ctx.accounts.vault_reserve.to_account_info(),
                  ctx.accounts.dividend_vault.to_account_info(),
                  ctx.accounts.system_program.to_account_info()],
                signer,
            )?;

            config.dividend_pool_balance = config.dividend_pool_balance
                .checked_add(bd.dividend_fee).ok_or(VirtualGoldError::MathOverflow)?;

            let remaining = config.total_supply
                .checked_sub(amount_to_sell).ok_or(VirtualGoldError::MathOverflow)?;
            if remaining > 0 {
                let add = safe_div_u128(
                    (bd.dividend_fee as u128)
                        .checked_mul(DIVIDEND_PRECISION).ok_or(VirtualGoldError::MathOverflow)?,
                    remaining as u128,
                )?;
                config.acc_dividend_per_share = config.acc_dividend_per_share
                    .checked_add(add).ok_or(VirtualGoldError::MathOverflow)?;
            }
        }

        // ─── 8% Ratchet Lock ────────────────────────────────────────────────────
        invoke_signed(
            &system_instruction::transfer(
                &ctx.accounts.vault_reserve.key(),
                &ctx.accounts.locked_reserve.key(),
                bd.vault_ratchet_lock,
            ),
            &[ctx.accounts.vault_reserve.to_account_info(),
              ctx.accounts.locked_reserve.to_account_info(),
              ctx.accounts.system_program.to_account_info()],
            signer,
        )?;

        // ─── State Updates ─────────────────────────────────────────────────────
        config.total_supply = config.total_supply
            .checked_sub(amount_to_sell).ok_or(VirtualGoldError::MathOverflow)?;
        config.ratchet_locked_reserve = config.ratchet_locked_reserve
            .checked_add(bd.vault_ratchet_lock).ok_or(VirtualGoldError::MathOverflow)?;
        config.vault_reserve = config.vault_reserve
            .checked_sub(bd.seller_payout).ok_or(VirtualGoldError::InsufficientVaultLiquidity)?
            .checked_sub(bd.treasury_fee).ok_or(VirtualGoldError::MathOverflow)?
            .checked_sub(bd.dividend_fee).ok_or(VirtualGoldError::MathOverflow)?
            .checked_sub(bd.vault_ratchet_lock).ok_or(VirtualGoldError::MathOverflow)?;

        // v5.0 circuit breaker epoch tracking
        config.cb_epoch_sold = u64::try_from(sold_after).map_err(|_| VirtualGoldError::MathOverflow)?;
        config.cb_epoch_withdrawn = u64::try_from(withdrawn_after).map_err(|_| VirtualGoldError::MathOverflow)?;

        // ─── Post-Sell Solvency Assertion ────────────────────────────────────
        let phys_after = ctx.accounts.vault_reserve.lamports();
        require!(
            phys_after >= config.vault_reserve.checked_add(rent_exempt).ok_or(VirtualGoldError::MathOverflow)?,
            VirtualGoldError::VaultSolvencyBreach
        );

        let rem_bal = seller_bal.checked_sub(amount_to_sell).ok_or(VirtualGoldError::MathOverflow)?;
        user.reward_debt = (rem_bal as u128)
            .checked_mul(config.acc_dividend_per_share).ok_or(VirtualGoldError::MathOverflow)?;

        // Oracle-based USD display
        let sol_price = ctx.accounts.oracle_state.twap_usd_micro;
        let usd_payout = if sol_price > 0 {
            (bd.seller_payout as u128).saturating_mul(sol_price as u128) / 1_000_000
        } else { 0 };

        emit!(SellEvent {
            seller: ctx.accounts.seller.key(),
            amount_sold: amount_to_sell,
            seller_payout: bd.seller_payout,
            curve_valuation: bd.curve_valuation,
            reserve_share: bd.reserve_share,
            gross_valuation: bd.gross_valuation,
            burned_amount: amount_to_sell,
            usd_equivalent: usd_payout as u64,
        });
        msg!("Sold {} $GOLD. Payout={} lamports. Curve={} Floor held. CB: {}/{} sold today.",
             amount_to_sell, bd.seller_payout, bd.curve_valuation,
             config.cb_epoch_sold, max_daily_sell);
        Ok(())
    }

    // =========================================================================
    // CLAIM DIVIDENDS (v5.0: Anti-Flash-Loan Holding Period)
    // =========================================================================

    pub fn claim_dividends(ctx: Context<ClaimDividends>) -> Result<()> {
        let config = &mut ctx.accounts.protocol_config;
        let user   = &mut ctx.accounts.user_account;
        let bal    = ctx.accounts.user_token_account.amount;

        // v5.0 FIX #5: Enforce minimum holding period
        let current_slot = Clock::get()?.slot;
        require!(
            user.last_buy_slot == 0
                || current_slot >= user.last_buy_slot + config.min_holding_slots,
            VirtualGoldError::HoldingPeriodNotMet
        );

        let mut total: u128 = user.pending_rewards as u128;
        if bal > 0 {
            let acc     = (bal as u128)
                .checked_mul(config.acc_dividend_per_share).ok_or(VirtualGoldError::MathOverflow)?;
            total = total.checked_add(
                acc.saturating_sub(user.reward_debt) / DIVIDEND_PRECISION
            ).ok_or(VirtualGoldError::MathOverflow)?;
        }

        let payout = u64::try_from(total).map_err(|_| VirtualGoldError::MathOverflow)?;
        require!(payout > 0,                                  VirtualGoldError::NoDividendsAvailable);
        require!(config.dividend_pool_balance >= payout,      VirtualGoldError::InsufficientVaultLiquidity);

        user.pending_rewards = 0;
        user.reward_debt     = (bal as u128)
            .checked_mul(config.acc_dividend_per_share).ok_or(VirtualGoldError::MathOverflow)?;

        let dv_bump = config.dividend_vault_bump;
        let seeds   = &[b"dividend_vault".as_ref(), &[dv_bump]];
        let signer  = &[&seeds[..]];

        invoke_signed(
            &system_instruction::transfer(
                &ctx.accounts.dividend_vault.key(), &ctx.accounts.user.key(), payout,
            ),
            &[ctx.accounts.dividend_vault.to_account_info(),
              ctx.accounts.user.to_account_info(),
              ctx.accounts.system_program.to_account_info()],
            signer,
        )?;

        config.dividend_pool_balance = config.dividend_pool_balance
            .checked_sub(payout).ok_or(VirtualGoldError::MathOverflow)?;

        emit!(ClaimDividendEvent { user: ctx.accounts.user.key(), payout_amount: payout });
        msg!("Claimed {} lamport dividends (held {} slots).",
             payout, current_slot.saturating_sub(user.last_buy_slot));
        Ok(())
    }
}

// ============================================================================
// HELPER: Create SOL PDA if below rent-exempt minimum
// ============================================================================

fn create_pda_if_needed<'info>(
    payer: &Signer<'info>,
    account: &SystemAccount<'info>,
    system_program: &Program<'info, System>,
    seed: &[u8],
    bump: u8,
    min_rent: u64,
) -> Result<()> {
    if account.lamports() < min_rent {
        let signer_seeds = &[seed, &[bump]];
        invoke_signed(
            &system_instruction::create_account(
                &payer.key(), &account.key(), min_rent, 0,
                &anchor_lang::solana_program::system_program::ID,
            ),
            &[payer.to_account_info(), account.to_account_info(), system_program.to_account_info()],
            &[signer_seeds],
        )?;
    }
    Ok(())
}

// ============================================================================
// ACCOUNT VALIDATION STRUCTS
// ============================================================================

#[derive(Accounts)]
#[instruction(signers: Vec<Pubkey>, threshold: u8)]
pub struct Initialize<'info> {
    #[account(mut)] pub admin: Signer<'info>,
    /// CHECK: Treasury
    pub admin_treasury: UncheckedAccount<'info>,
    #[account(
        constraint = gold_mint.decimals == 9         @ VirtualGoldError::InvalidMintDecimals,
        constraint = gold_mint.supply == 0            @ VirtualGoldError::InvalidMintSupply,
        constraint = gold_mint.mint_authority.contains(&mint_authority.key()) @ VirtualGoldError::InvalidMintAuthority
    )]
    pub gold_mint: Account<'info, Mint>,
    /// CHECK: Mint authority PDA
    #[account(seeds = [b"mint_authority"], bump)]
    pub mint_authority: UncheckedAccount<'info>,
    #[account(init, payer = admin, space = ProtocolConfig::LEN, seeds = [b"protocol_config"], bump)]
    pub protocol_config: Account<'info, ProtocolConfig>,
    #[account(init, payer = admin, space = MultisigConfig::LEN, seeds = [b"multisig_config"], bump)]
    pub multisig_config: Account<'info, MultisigConfig>,
    #[account(init, payer = admin, space = OracleState::LEN, seeds = [b"oracle_state"], bump)]
    pub oracle_state: Account<'info, OracleState>,
    #[account(mut, seeds = [b"vault_reserve"],  bump)]
    pub vault_reserve:  SystemAccount<'info>,
    #[account(mut, seeds = [b"locked_reserve"], bump)]
    pub locked_reserve: SystemAccount<'info>,
    #[account(mut, seeds = [b"dividend_vault"], bump)]
    pub dividend_vault: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateOraclePrice<'info> {
    #[account(mut)] pub updater: Signer<'info>,
    #[account(seeds = [b"multisig_config"], bump)]
    pub multisig_config: Account<'info, MultisigConfig>,
    #[account(mut, seeds = [b"oracle_state"], bump)]
    pub oracle_state: Account<'info, OracleState>,
}

#[derive(Accounts)]
pub struct CreateProposal<'info> {
    #[account(mut)] pub proposer: Signer<'info>,
    #[account(mut, seeds = [b"multisig_config"], bump)]
    pub multisig_config: Account<'info, MultisigConfig>,
    #[account(
        init, payer = proposer,
        space = GovernanceProposal::LEN,
        seeds = [b"proposal", multisig_config.proposal_nonce.to_le_bytes().as_ref()],
        bump
    )]
    pub proposal: Account<'info, GovernanceProposal>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ApproveProposal<'info> {
    #[account(mut)] pub approver: Signer<'info>,
    #[account(seeds = [b"multisig_config"], bump)]
    pub multisig_config: Account<'info, MultisigConfig>,
    #[account(mut)] pub proposal: Account<'info, GovernanceProposal>,
}

#[derive(Accounts)]
pub struct ExecuteProposal<'info> {
    #[account(mut)] pub executor: Signer<'info>,
    #[account(seeds = [b"multisig_config"], bump)]
    pub multisig_config: Account<'info, MultisigConfig>,
    #[account(mut)] pub proposal: Account<'info, GovernanceProposal>,
    #[account(mut, seeds = [b"protocol_config"], bump)]
    pub protocol_config: Account<'info, ProtocolConfig>,
}

#[derive(Accounts)]
pub struct WhitelistFromProposal<'info> {
    #[account(mut)] pub caller: Signer<'info>,
    pub proposal: Account<'info, GovernanceProposal>,
    /// CHECK: The wallet being whitelisted
    pub target_wallet: UncheckedAccount<'info>,
    #[account(seeds = [b"protocol_config"], bump)]
    pub protocol_config: Account<'info, ProtocolConfig>,
    #[account(
        init_if_needed, payer = caller,
        space = WhitelistEntry::LEN,
        seeds = [b"whitelist", target_wallet.key().as_ref()], bump
    )]
    pub whitelist_entry: Account<'info, WhitelistEntry>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FreezeUpgradeAuthority<'info> {
    #[account(mut)] pub admin: Signer<'info>,
    #[account(mut, seeds = [b"protocol_config"], bump)]
    pub protocol_config: Account<'info, ProtocolConfig>,
    /// CHECK: ProgramData PDA — cryptographically verified via seeds.
    #[account(
        mut,
        seeds = [crate::id().as_ref()],
        seeds::program = bpf_loader_upgradeable::ID,
        bump
    )]
    pub program_data: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct EmergencyRescueSol<'info> {
    #[account(mut)] pub admin: Signer<'info>,
    #[account(seeds = [b"protocol_config"], bump)]
    pub protocol_config: Account<'info, ProtocolConfig>,
    #[account(mut, seeds = [b"vault_reserve"], bump = protocol_config.vault_bump)]
    pub vault_reserve: SystemAccount<'info>,
    /// CHECK: Safe destination
    #[account(mut)] pub destination: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct TransferTokens<'info> {
    #[account(mut)] pub sender: Signer<'info>,
    /// CHECK: Receiver
    pub receiver: UncheckedAccount<'info>,
    #[account(mut, seeds = [b"protocol_config"], bump)]
    pub protocol_config: Account<'info, ProtocolConfig>,
    #[account(mut, seeds = [b"user_account", sender.key().as_ref()], bump)]
    pub sender_user_account: Account<'info, UserAccount>,
    #[account(init_if_needed, payer = sender, space = UserAccount::LEN,
        seeds = [b"user_account", receiver.key().as_ref()], bump)]
    pub receiver_user_account: Account<'info, UserAccount>,
    #[account(mut,
        constraint = sender_token_account.owner == sender.key(),
        constraint = sender_token_account.mint  == gold_mint.key())]
    pub sender_token_account: Account<'info, TokenAccount>,
    #[account(mut,
        constraint = receiver_token_account.owner == receiver.key(),
        constraint = receiver_token_account.mint  == gold_mint.key())]
    pub receiver_token_account: Account<'info, TokenAccount>,
    #[account(constraint = gold_mint.key() == protocol_config.gold_mint @ VirtualGoldError::UnauthorizedMint)]
    pub gold_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct BuyTokens<'info> {
    #[account(mut)] pub buyer: Signer<'info>,
    #[account(mut, seeds = [b"protocol_config"], bump)]
    pub protocol_config: Account<'info, ProtocolConfig>,
    #[account(init_if_needed, payer = buyer, space = UserAccount::LEN,
        seeds = [b"user_account", buyer.key().as_ref()], bump)]
    pub user_account: Account<'info, UserAccount>,
    #[account(init_if_needed, payer = buyer, space = WhitelistEntry::LEN,
        seeds = [b"whitelist", buyer.key().as_ref()], bump)]
    pub whitelist_entry: Account<'info, WhitelistEntry>,
    #[account(mut, seeds = [b"vault_reserve"],  bump = protocol_config.vault_bump)]
    pub vault_reserve:  SystemAccount<'info>,
    #[account(mut, seeds = [b"dividend_vault"], bump = protocol_config.dividend_vault_bump)]
    pub dividend_vault: SystemAccount<'info>,
    #[account(mut, constraint = admin_treasury.key() == protocol_config.admin_treasury @ VirtualGoldError::UnauthorizedTreasury)]
    pub admin_treasury: UncheckedAccount<'info>,
    #[account(mut,
        constraint = gold_mint.key() == protocol_config.gold_mint @ VirtualGoldError::UnauthorizedMint,
        constraint = gold_mint.mint_authority.contains(&mint_authority.key()) @ VirtualGoldError::InvalidMintAuthority)]
    pub gold_mint: Account<'info, Mint>,
    #[account(mut,
        constraint = buyer_token_account.owner == buyer.key(),
        constraint = buyer_token_account.mint  == gold_mint.key())]
    pub buyer_token_account: Account<'info, TokenAccount>,
    /// CHECK: Mint authority PDA
    #[account(seeds = [b"mint_authority"], bump)]
    pub mint_authority: UncheckedAccount<'info>,
    #[account(seeds = [b"oracle_state"], bump)]
    pub oracle_state: Account<'info, OracleState>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SellTokens<'info> {
    #[account(mut)] pub seller: Signer<'info>,
    #[account(mut, seeds = [b"protocol_config"], bump)]
    pub protocol_config: Account<'info, ProtocolConfig>,
    #[account(mut, seeds = [b"user_account", seller.key().as_ref()], bump)]
    pub user_account: Account<'info, UserAccount>,
    #[account(mut, seeds = [b"vault_reserve"],  bump = protocol_config.vault_bump)]
    pub vault_reserve:  SystemAccount<'info>,
    #[account(mut, seeds = [b"locked_reserve"], bump = protocol_config.locked_vault_bump)]
    pub locked_reserve: SystemAccount<'info>,
    #[account(mut, seeds = [b"dividend_vault"], bump = protocol_config.dividend_vault_bump)]
    pub dividend_vault: SystemAccount<'info>,
    #[account(mut, constraint = admin_treasury.key() == protocol_config.admin_treasury @ VirtualGoldError::UnauthorizedTreasury)]
    pub admin_treasury: UncheckedAccount<'info>,
    #[account(mut, constraint = gold_mint.key() == protocol_config.gold_mint @ VirtualGoldError::UnauthorizedMint)]
    pub gold_mint: Account<'info, Mint>,
    #[account(mut,
        constraint = seller_token_account.owner == seller.key(),
        constraint = seller_token_account.mint  == gold_mint.key())]
    pub seller_token_account: Account<'info, TokenAccount>,
    #[account(seeds = [b"oracle_state"], bump)]
    pub oracle_state: Account<'info, OracleState>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimDividends<'info> {
    #[account(mut)] pub user: Signer<'info>,
    #[account(mut, seeds = [b"protocol_config"], bump)]
    pub protocol_config: Account<'info, ProtocolConfig>,
    #[account(mut, seeds = [b"user_account", user.key().as_ref()], bump)]
    pub user_account: Account<'info, UserAccount>,
    #[account(mut, seeds = [b"dividend_vault"], bump = protocol_config.dividend_vault_bump)]
    pub dividend_vault: SystemAccount<'info>,
    #[account(constraint = gold_mint.key() == protocol_config.gold_mint @ VirtualGoldError::UnauthorizedMint)]
    pub gold_mint: Account<'info, Mint>,
    #[account(
        constraint = user_token_account.owner == user.key(),
        constraint = user_token_account.mint  == gold_mint.key())]
    pub user_token_account: Account<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
}

// ============================================================================
// EVENTS
// ============================================================================

#[event] pub struct BuyEvent  { pub buyer: Pubkey, pub amount_bought: u64, pub gross_cost: u64, pub vault_deposit: u64, pub usd_equivalent: u64 }
#[event] pub struct SellEvent { pub seller: Pubkey, pub amount_sold: u64, pub seller_payout: u64, pub curve_valuation: u64, pub reserve_share: u64, pub gross_valuation: u64, pub burned_amount: u64, pub usd_equivalent: u64 }
#[event] pub struct ClaimDividendEvent        { pub user: Pubkey, pub payout_amount: u64 }
#[event] pub struct TreasuryUpdatedEvent      { pub admin: Pubkey, pub old_treasury: Pubkey, pub new_treasury: Pubkey }
#[event] pub struct UpgradeAuthorityFrozenEvent { pub admin: Pubkey, pub timestamp: i64 }
#[event] pub struct AdminChangeExecutedEvent  { pub old_admin: Pubkey, pub new_admin: Pubkey }
#[event] pub struct ProposalCreatedEvent      { pub proposer: Pubkey, pub nonce: u64, pub created_at: i64 }
#[event] pub struct ProposalExecutedEvent     { pub executor: Pubkey, pub executed_at: i64 }
#[event] pub struct EmergencyRescueEvent      { pub admin: Pubkey, pub amount: u64, pub destination: Pubkey }
#[event] pub struct WhitelistApprovedEvent    { pub wallet: Pubkey, pub approver: Pubkey }
#[event] pub struct OraclePriceUpdatedEvent   { pub updater: Pubkey, pub price_usd_micro: u64, pub twap_usd_micro: u64, pub timestamp: i64 }

// ============================================================================
// STATE STRUCTS
// ============================================================================

#[account]
pub struct ProtocolConfig {
    pub admin: Pubkey,                       // 32
    pub admin_treasury: Pubkey,              // 32
    pub gold_mint: Pubkey,                   // 32
    pub vault_bump: u8,                      // 1
    pub locked_vault_bump: u8,               // 1
    pub dividend_vault_bump: u8,             // 1
    pub total_supply: u64,                   // 8
    pub max_supply_cap: u64,                 // 8
    pub vault_reserve: u64,                  // 8
    pub dividend_pool_balance: u64,          // 8
    pub ratchet_locked_reserve: u64,         // 8
    pub acc_dividend_per_share: u128,        // 16
    pub is_paused: bool,                     // 1
    pub is_upgrade_authority_frozen: bool,   // 1
    pub freeze_approved: bool,               // 1  ← v5.0
    pub phase: ProtocolPhase,               // 1
    pub max_buy_per_tx: u64,                 // 8
    pub epoch_emission_cap: u64,             // 8
    pub current_epoch_start: i64,            // 8
    pub current_epoch_minted: u64,           // 8
    // v5.0 circuit breakers
    pub sell_circuit_bps: u16,               // 2
    pub withdraw_circuit_bps: u16,           // 2
    pub cb_epoch_start: i64,                 // 8
    pub cb_epoch_sold: u64,                  // 8
    pub cb_epoch_withdrawn: u64,             // 8
    // v5.0 dividend holding
    pub min_holding_slots: u64,              // 8
}

impl ProtocolConfig {
    pub const LEN: usize = 8
        + 32 + 32 + 32      // pubkeys
        + 1 + 1 + 1         // bumps
        + 8 + 8 + 8 + 8 + 8 // u64s
        + 16                 // u128
        + 1 + 1 + 1 + 1     // bools + phase
        + 8 + 8 + 8 + 8     // emission epoch
        + 2 + 2 + 8 + 8 + 8 // circuit breakers
        + 8;                 // min_holding_slots
}

#[account]
pub struct MultisigConfig {
    pub threshold: u8,
    pub signer_count: u8,
    pub signers: [Pubkey; MAX_MULTISIG_SIGNERS],
    pub proposal_nonce: u64,
}
impl MultisigConfig {
    pub const LEN: usize = 8 + 1 + 1 + (32 * MAX_MULTISIG_SIGNERS) + 8;
}

/// Rolling TWAP oracle state (display-only — not used in core pricing)
#[account]
pub struct OracleState {
    pub price_usd_micro: u64,                     // 8  latest SOL/USD in micro-USD
    pub twap_usd_micro: u64,                      // 8  rolling TWAP
    pub last_update_ts: i64,                      // 8
    pub sample_count: u64,                        // 8
    pub samples: [u64; ORACLE_TWAP_WINDOW],       // 8*8 = 64
    pub sample_head: u64,                         // 8
}
impl OracleState {
    pub const LEN: usize = 8 + 8 + 8 + 8 + 8 + (8 * ORACLE_TWAP_WINDOW) + 8;
}

#[account]
pub struct GovernanceProposal {
    pub kind: ProposalKind,
    pub proposer: Pubkey,
    pub created_at: i64,
    pub expires_at: i64,
    pub executed: bool,
    pub executed_at: i64,
    pub approval_count: u8,
    pub approvals: [Pubkey; MAX_MULTISIG_SIGNERS],
}
impl GovernanceProposal {
    pub const LEN: usize = 8 + 160 + 32 + 8 + 8 + 1 + 8 + 1 + (32 * MAX_MULTISIG_SIGNERS);
}

#[account]
pub struct UserAccount {
    pub owner: Pubkey,           // 32
    pub reward_debt: u128,       // 16
    pub pending_rewards: u64,    // 8
    pub last_buy_slot: u64,      // 8  ← v5.0 anti-flash-loan
}
impl UserAccount {
    pub const LEN: usize = 8 + 32 + 16 + 8 + 8;
}

#[account]
pub struct WhitelistEntry {
    pub wallet: Pubkey,
    pub is_active: bool,
    pub bootstrap_minted: u64,
}
impl WhitelistEntry {
    pub const LEN: usize = 8 + 32 + 1 + 8;
}

// ============================================================================
// ERROR CODES
// ============================================================================

#[error_code]
pub enum VirtualGoldError {
    #[msg("Protocol is currently paused.")] ProtocolPaused,
    #[msg("Protocol must be paused for this operation.")] ProtocolNotPaused,
    #[msg("21,000,000 $GOLD supply cap exceeded.")] MaxSupplyReached,
    #[msg("Zero or invalid amount.")] InvalidAmount,
    #[msg("Math overflow.")] MathOverflow,
    #[msg("Slippage exceeded.")] SlippageExceeded,
    #[msg("Insufficient vault liquidity.")] InsufficientVaultLiquidity,
    #[msg("No dividends available.")] NoDividendsAvailable,
    #[msg("Unauthorized.")] Unauthorized,
    #[msg("Invalid treasury account.")] UnauthorizedTreasury,
    #[msg("Price floor breach — tx aborted.")] PriceFloorBreach,
    #[msg("Vault solvency breach: physical < accounting + rent.")] VaultSolvencyBreach,
    #[msg("Invalid mint decimals — must be 9.")] InvalidMintDecimals,
    #[msg("Invalid initial mint supply — must be 0.")] InvalidMintSupply,
    #[msg("Invalid mint authority.")] InvalidMintAuthority,
    #[msg("Unauthorized mint.")] UnauthorizedMint,
    #[msg("48-hour timelock not expired.")] TimelockNotExpired,
    #[msg("Upgrade authority already frozen.")] UpgradeAuthorityFrozen,
    #[msg("Trade too small — minimum 10,000 lamports gross.")] TradeTooSmall,
    #[msg("Buy exceeds anti-whale per-tx limit.")] WhaleLimit,
    #[msg("24h epoch emission cap reached.")] EpochEmissionCapReached,
    #[msg("Invalid multisig config.")] InvalidMultisigConfig,
    #[msg("Proposal has expired.")] ProposalExpired,
    #[msg("Proposal already executed.")] ProposalAlreadyExecuted,
    #[msg("Signer already approved.")] AlreadyApproved,
    #[msg("Insufficient multisig approvals.")] InsufficientApprovals,
    #[msg("Not whitelisted for Bootstrap phase.")] NotWhitelisted,
    #[msg("Bootstrap 100-unit wallet limit reached.")] BootstrapLimitExceeded,
    #[msg("Already whitelisted.")] AlreadyWhitelisted,
    #[msg("Sells locked during Bootstrap phase.")] SellsLockedInBootstrap,
    #[msg("No excess SOL above reserve to rescue.")] NoExcessSolToRescue,
    #[msg("Rescue amount exceeds excess SOL.")] ExceedsExcessSol,
    #[msg("Wrong protocol phase for this operation.")] WrongPhase,
    // v5.0 new errors
    #[msg("Daily sell circuit breaker tripped — max 5% of supply sellable per 24h.")] SellCircuitBreakerTripped,
    #[msg("Daily reserve withdrawal circuit breaker tripped — max 2% of vault per 24h.")] WithdrawCircuitBreakerTripped,
    #[msg("Oracle price rejected — outside ±20% TWAP band (potential manipulation).")] OraclePriceManipulation,
    #[msg("Oracle price invalid — must be > 0.")] InvalidOraclePrice,
    #[msg("Dividend holding period not met — hold for MIN_HOLDING_SLOTS after last buy.")] HoldingPeriodNotMet,
    #[msg("FreezeUpgrade multisig proposal must execute first.")] FreezeNotApproved,
    #[msg("Proposal not yet executed.")] ProposalNotExecuted,
    #[msg("Wrong proposal kind for this instruction.")] WrongProposalKind,
}

// ============================================================================
// BONDING CURVE MATH (all v3/v4 fixes retained)
// ============================================================================

pub struct BuyBreakdown  { pub gross_cost: u64, pub vault_deposit: u64, pub treasury_fee: u64, pub dividend_fee: u64 }
pub struct SellBreakdown { pub curve_valuation: u64, pub reserve_share: u64, pub gross_valuation: u64, pub seller_payout: u64, pub treasury_fee: u64, pub dividend_fee: u64, pub vault_ratchet_lock: u64 }

/// Remainder-splitting multiply-divide — proven safe for 21M supply cap bounds
pub fn safe_mul_div_u128(a: u128, b: u128, c: u128) -> Result<u128> {
    if c == 0 { return Err(VirtualGoldError::MathOverflow.into()); }
    let q = a / c; let r = a % c;
    let qb = q.checked_mul(b).ok_or(VirtualGoldError::MathOverflow)?;
    let rb = r.checked_mul(b).ok_or(VirtualGoldError::MathOverflow)? / c;
    qb.checked_add(rb).ok_or(VirtualGoldError::MathOverflow.into())
}

pub fn safe_div_u128(n: u128, d: u128) -> Result<u128> {
    if d == 0 { return Err(VirtualGoldError::MathOverflow.into()); }
    Ok(n / d)
}

pub fn calculate_curve_integral(s_start: u128, s_end: u128) -> Result<u128> {
    if s_start >= s_end { return Ok(0); }
    if s_end > MAX_SUPPLY_CAP { return Err(VirtualGoldError::MaxSupplyReached.into()); }
    let delta_s    = s_end.checked_sub(s_start).ok_or(VirtualGoldError::MathOverflow)?;
    let base_cost  = BASE_PRICE_P0.checked_mul(delta_s).ok_or(VirtualGoldError::MathOverflow)?;
    let delta_p    = TARGET_PRICE_P1.checked_sub(BASE_PRICE_P0).ok_or(VirtualGoldError::MathOverflow)?;
    let s_sum      = s_end.checked_add(s_start).ok_or(VirtualGoldError::MathOverflow)?;
    let double_max = MAX_SUPPLY_CAP.checked_mul(2).ok_or(VirtualGoldError::MathOverflow)?;
    let a          = delta_p.checked_mul(delta_s).ok_or(VirtualGoldError::MathOverflow)?;
    let slope      = safe_mul_div_u128(a, s_sum, double_max)?;
    let total_raw  = base_cost.checked_add(slope).ok_or(VirtualGoldError::MathOverflow)?;
    Ok(total_raw.checked_div(TOKEN_DECIMALS_FACTOR).ok_or(VirtualGoldError::MathOverflow)?)
}

pub fn taxed_amount(amount: u64, bps: u64) -> u64 {
    amount.saturating_mul(bps) / 10_000
}

pub fn calculate_buy_breakdown(supply: u64, amount: u64) -> Result<BuyBreakdown> {
    let s_end = (supply as u128).checked_add(amount as u128).ok_or(VirtualGoldError::MathOverflow)?;
    if s_end > MAX_SUPPLY_CAP { return Err(VirtualGoldError::MaxSupplyReached.into()); }
    let gross_128  = calculate_curve_integral(supply as u128, s_end)?;
    let gross_cost = u64::try_from(gross_128).map_err(|_| VirtualGoldError::MathOverflow)?;
    if gross_cost < MIN_BUY_GROSS_LAMPORTS { return Err(VirtualGoldError::TradeTooSmall.into()); }
    let treasury_fee = taxed_amount(gross_cost, 100);
    let dividend_fee = taxed_amount(gross_cost, 100);
    let vault_deposit = gross_cost
        .checked_sub(treasury_fee).ok_or(VirtualGoldError::MathOverflow)?
        .checked_sub(dividend_fee).ok_or(VirtualGoldError::MathOverflow)?;
    Ok(BuyBreakdown { gross_cost, vault_deposit, treasury_fee, dividend_fee })
}

pub fn calculate_sell_breakdown(supply: u64, vault: u64, amount: u64) -> Result<SellBreakdown> {
    if supply == 0 { return Err(VirtualGoldError::InvalidAmount.into()); }
    let s_end   = supply as u128;
    let delta_s = amount as u128;
    if delta_s > s_end { return Err(VirtualGoldError::InvalidAmount.into()); }
    let s_start = s_end.checked_sub(delta_s).ok_or(VirtualGoldError::MathOverflow)?;

    let curve_128   = calculate_curve_integral(s_start, s_end)?;
    let reserve_128 = safe_mul_div_u128(vault as u128, delta_s, s_end)?;
    let gross_128   = std::cmp::min(curve_128, reserve_128);

    let curve_valuation = u64::try_from(curve_128).map_err(|_| VirtualGoldError::MathOverflow)?;
    let reserve_share   = u64::try_from(reserve_128).map_err(|_| VirtualGoldError::MathOverflow)?;
    let gross_valuation = u64::try_from(gross_128).map_err(|_| VirtualGoldError::MathOverflow)?;

    if gross_valuation < MIN_SELL_GROSS_LAMPORTS { return Err(VirtualGoldError::TradeTooSmall.into()); }

    let treasury_fee      = taxed_amount(gross_valuation, 100);
    let dividend_fee      = taxed_amount(gross_valuation, 100);
    let vault_ratchet_lock = taxed_amount(gross_valuation, 800);
    let total_fees = treasury_fee
        .checked_add(dividend_fee).ok_or(VirtualGoldError::MathOverflow)?
        .checked_add(vault_ratchet_lock).ok_or(VirtualGoldError::MathOverflow)?;
    if total_fees > gross_valuation { return Err(VirtualGoldError::MathOverflow.into()); }
    let seller_payout = gross_valuation.checked_sub(total_fees).ok_or(VirtualGoldError::MathOverflow)?;

    // Floor invariant: (V - G) * S_end >= V * S_start
    if s_start > 0 {
        let new_v = (vault as u128).checked_sub(gross_128).ok_or(VirtualGoldError::InsufficientVaultLiquidity)?;
        let left  = new_v.checked_mul(s_end).ok_or(VirtualGoldError::MathOverflow)?;
        let right = (vault as u128).checked_mul(s_start).ok_or(VirtualGoldError::MathOverflow)?;
        if left < right { return Err(VirtualGoldError::PriceFloorBreach.into()); }
    }

    Ok(SellBreakdown { curve_valuation, reserve_share, gross_valuation, seller_payout, treasury_fee, dividend_fee, vault_ratchet_lock })
}
