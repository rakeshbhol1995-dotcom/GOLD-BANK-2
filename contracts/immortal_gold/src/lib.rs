// ============================================================================
// VIRTUAL GOLD PROTOCOL ($GOLD) — Anchor Smart Contract
// Version: v5.4 — Pre-Audit Production Release
// Website: virtualgold.org  |  Symbol: $GOLD  |  Decimals: 9 ($IMG) / 6 (USDT)
// Max Supply: 21,000,000 $IMG  |  Genesis Base Price: $10.00 USDT
// Reserve: 98% Vault | 1% Treasury | 1% Dividend Pool
//
// ⚠️  MANDATORY DISCLOSURES
//  1. Partial-reserve bonding curve. Reserve ≠ Token Value.
//  2. Dividends funded by 1% fees + external injected yield. NOT guaranteed.
//  3. Sell payout = min(curve, reserve_share) × 90%. 8% locked (ratchet).
//  4. ALL admin actions require multisig threshold. 48h timelock enforced.
//  5. Dividends auto-suspend if vault/supply < 90% of base price.
//  6. Guaranteed Exit: exit ≤0.1% supply at reserve_share, bypasses circuit breaker.
//  7. NOT independently audited. Deploy at own risk.
// ============================================================================

use anchor_lang::prelude::*;

pub mod state;
pub mod errors;
pub mod math;
pub mod instructions;

// Re-export all instruction module types at crate root.
// This is the standard Anchor multi-file pattern: Anchor's #[program] macro
// generates `use crate::*` internally, so types must be visible at crate root.
use instructions::*;
use instructions::admin::*;
use instructions::initialize::*;
use instructions::buy::*;
use instructions::sell::*;
use instructions::claim_dividends::*;
use state::ProposalKind;

declare_id!("vGLD111111111111111111111111111111111111111");

#[program]
pub mod immortal_gold_protocol {
    use super::*;

    // ── Initialization ─────────────────────────────────────────────────────────
    /// Initializes protocol + multisig config. `signers`: 1-10 keys, `threshold`: min approvals.
    pub fn initialize(ctx: Context<Initialize>, signers: Vec<Pubkey>, threshold: u8) -> Result<()> {
        instructions::initialize::handler(ctx, signers, threshold)
    }

    // ── Core Trading ───────────────────────────────────────────────────────────
    /// Mints $IMG along bonding curve. 98% vault, 1% treasury, 1% dividend.
    pub fn buy(ctx: Context<BuyTokens>, amount_to_buy: u64, max_cost_limit: u64) -> Result<()> {
        instructions::buy::handler(ctx, amount_to_buy, max_cost_limit)
    }

    /// Burns $IMG. 90% seller, 1% treasury, 1% dividend, 8% ratchet lock.
    pub fn sell(ctx: Context<SellTokens>, amount_to_sell: u64, min_payout_limit: u64) -> Result<()> {
        instructions::sell::handler(ctx, amount_to_sell, min_payout_limit)
    }

    /// Guaranteed exit ≤0.1% of supply at reserve price. Bypasses circuit breaker.
    pub fn guaranteed_exit(ctx: Context<GuaranteedExit>, amount_to_exit: u64) -> Result<()> {
        instructions::admin::guaranteed_exit_handler(ctx, amount_to_exit)
    }

    // ── Dividends ──────────────────────────────────────────────────────────────
    /// Claims USDT dividends. Requires holding period + 90% reserve ratio guard.
    pub fn claim_dividends(ctx: Context<ClaimDividends>) -> Result<()> {
        instructions::claim_dividends::handler(ctx)
    }

    /// Injects external USDT yield into dividend pool (multisig keeper only).
    pub fn inject_external_yield(ctx: Context<InjectExternalYield>, amount: u64) -> Result<()> {
        instructions::admin::inject_external_yield_handler(ctx, amount)
    }

    // ── Governance ─────────────────────────────────────────────────────────────
    pub fn create_proposal(ctx: Context<CreateProposal>, kind: ProposalKind) -> Result<()> {
        instructions::admin::create_proposal_handler(ctx, kind)
    }

    pub fn approve_proposal(ctx: Context<ApproveProposal>) -> Result<()> {
        instructions::admin::approve_proposal_handler(ctx)
    }

    pub fn execute_proposal(ctx: Context<ExecuteProposal>) -> Result<()> {
        instructions::admin::execute_proposal_handler(ctx)
    }

    // ── Emergency (Multisig Required) ──────────────────────────────────────────
    pub fn emergency_rescue_usdt(ctx: Context<EmergencyRescueUsdt>, amount: u64) -> Result<()> {
        instructions::admin::emergency_rescue_usdt_handler(ctx, amount)
    }

    pub fn set_pause(ctx: Context<SetPause>, paused: bool) -> Result<()> {
        instructions::admin::set_pause_handler(ctx, paused)
    }

    pub fn update_admin_treasury(ctx: Context<UpdateAdminTreasury>) -> Result<()> {
        instructions::admin::update_admin_treasury_handler(ctx)
    }
}
