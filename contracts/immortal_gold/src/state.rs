use anchor_lang::prelude::*;

pub const MAX_MULTISIG_SIGNERS: usize = 10;
pub const EPOCH_SECONDS: i64 = 86_400; // 24 hours in seconds

// ─────────────────────────────────────────────────────────────────────────────
// ProtocolConfig — Central Protocol State
// ─────────────────────────────────────────────────────────────────────────────
#[account]
pub struct ProtocolConfig {
    // Identity
    pub admin: Pubkey,                        // 32
    pub admin_treasury: Pubkey,               // 32
    pub img_mint: Pubkey,                     // 32
    pub usdt_mint: Pubkey,                    // 32

    // PDA Bumps
    pub vault_bump: u8,                       // 1
    pub locked_vault_bump: u8,                // 1
    pub dividend_vault_bump: u8,              // 1

    // Supply
    pub total_supply: u64,                    // 8
    pub max_supply_cap: u64,                  // 8

    // Reserves — u128 for full precision (no overflow at large balances)
    pub vault_reserve: u128,                  // 16
    pub dividend_pool_balance: u128,          // 16
    pub ratchet_locked_reserve: u128,         // 16
    pub tracked_excess_usdt: u128,            // 16
    pub total_yield_injected: u128,           // 16  ← external real yield tracker

    // Dividends
    pub acc_dividend_per_share: u128,         // 16

    // Status
    pub is_paused: bool,                      // 1

    // Governance
    pub min_holding_slots: u64,               // 8  ← dividend holding period
}

impl ProtocolConfig {
    pub const LEN: usize = 8
        + 32 + 32 + 32 + 32          // pubkeys
        + 1 + 1 + 1                  // bumps
        + 8 + 8                      // supply fields
        + 16 + 16 + 16 + 16 + 16     // u128 reserves + yield
        + 16                         // acc_dividend_per_share
        + 1                          // is_paused
        + 8                          // min_holding_slots
        + 64;                        // future-proof padding
}

// ─────────────────────────────────────────────────────────────────────────────
// MultisigConfig — Timelocked multisig governance
// ─────────────────────────────────────────────────────────────────────────────
#[account]
pub struct MultisigConfig {
    pub threshold: u8,
    pub signer_count: u8,
    pub signers: [Pubkey; MAX_MULTISIG_SIGNERS],  // up to 10 signers
    pub proposal_nonce: u64,
}

impl MultisigConfig {
    pub const LEN: usize = 8 + 1 + 1 + (32 * MAX_MULTISIG_SIGNERS) + 8;
}

// ─────────────────────────────────────────────────────────────────────────────
// GovernanceProposal — Timelocked multisig governance proposals
// ─────────────────────────────────────────────────────────────────────────────
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum ProposalKind {
    Pause,
    Resume,
    UpdateTreasury        { new_treasury: Pubkey },
    UpdateAdmin           { new_admin: Pubkey },
    UpdateMultisig        { new_signers: [Pubkey; MAX_MULTISIG_SIGNERS], new_signer_count: u8, new_threshold: u8 },
    EmergencyUnpause,
    InjectYieldApprove    { amount: u64 },
    ReleaseRatchet        { amount: u64 },
    UpdateHoldingSlots    { new_slots: u64 },
    UpdateOraclePrice     { price_usd_micro: u64 },
}

#[account]
pub struct GovernanceProposal {
    pub multisig: Pubkey,
    pub proposal_nonce: u64,
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
    pub const LEN: usize = 8 + 32 + 8 + 400 + 32 + 8 + 8 + 1 + 8 + 1 + (32 * MAX_MULTISIG_SIGNERS);
}

// ─────────────────────────────────────────────────────────────────────────────
// UserAccount — Per-wallet dividend & exit tracking
// ─────────────────────────────────────────────────────────────────────────────
#[account]
pub struct UserAccount {
    pub owner: Pubkey,             // 32
    pub reward_debt: u128,         // 16
    pub pending_rewards: u64,      // 8
    pub last_buy_slot: u64,        // 8  ← for holding period enforcement
    pub last_exit_epoch: i64,      // 8  ← per-epoch exit tracking
    pub epoch_exited_amount: u64,  // 8  ← per-epoch cumulative exit tracking
}

impl UserAccount {
    pub const LEN: usize = 8 + 32 + 16 + 8 + 8 + 8 + 8;
}
