use anchor_lang::prelude::*;

#[account]
pub struct ProtocolConfig {
    /// Admin authority who initialized the protocol (or Squads Multisig PDA)
    pub admin: Pubkey,
    
    /// Wallet receiving 1% treasury buy/sell fees
    pub admin_treasury: Pubkey,
    
    /// SPL Token Mint address for $IMG
    pub img_mint: Pubkey,
    
    /// Bump seed for main protocol collateral vault PDA
    pub vault_bump: u8,
    
    /// Bump seed for immutable locked reserve vault PDA (8% ratchet lock)
    pub locked_vault_bump: u8,

    /// Bump seed for separate holder dividend pool vault PDA
    pub dividend_vault_bump: u8,

    /// Current circulating supply in raw 9-decimal units
    pub total_supply: u64,
    
    /// Maximum supply cap: 21,000,000 $IMG (21,000,000 * 10^9)
    pub max_supply_cap: u64,
    
    /// Total collateral vault reserve balance (in lamports / 6-decimal USDC)
    pub vault_reserve: u64,
    
    /// Total accumulated dividend pool balance
    pub dividend_pool_balance: u64,
    
    /// Total permanently locked ratchet reserve balance (8% sell fee lock)
    pub ratchet_locked_reserve: u64,
    
    /// Accumulated dividend per share (scaled by 1e12 for zero precision loss)
    pub acc_dividend_per_share: u128,
    
    /// Paused status flag
    pub is_paused: bool,
}

impl ProtocolConfig {
    pub const LEN: usize = 8 + // discriminator
        32 + // admin
        32 + // admin_treasury
        32 + // img_mint
        1 +  // vault_bump
        1 +  // locked_vault_bump
        1 +  // dividend_vault_bump
        8 +  // total_supply
        8 +  // max_supply_cap
        8 +  // vault_reserve
        8 +  // dividend_pool_balance
        8 +  // ratchet_locked_reserve
        16 + // acc_dividend_per_share (u128)
        1;   // is_paused
}

#[account]
pub struct UserAccount {
    /// Owner of this user position PDA
    pub owner: Pubkey,
    
    /// Reward debt for scaled dividend distribution (u128)
    pub reward_debt: u128,
    
    /// Accrued unclaimed dividend rewards (in lamports / base units)
    pub pending_rewards: u64,
}

impl UserAccount {
    pub const LEN: usize = 8 + // discriminator
        32 + // owner
        16 + // reward_debt (u128)
        8;   // pending_rewards
}

