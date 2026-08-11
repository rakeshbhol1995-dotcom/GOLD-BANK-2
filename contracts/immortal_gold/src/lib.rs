use anchor_lang::prelude::*;

pub mod state;
pub mod errors;
pub mod math;
pub mod instructions;

use instructions::*;

declare_id!("IMGold1111111111111111111111111111111111111");

#[program]
pub mod immortal_gold_protocol {
    use super::*;

    /// Initializes the Virtual Gold Sovereign L1 protocol configuration, mint, and 3 System PDAs.
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        instructions::initialize::handler(ctx)
    }

    /// Mints $GOLD tokens along the bonding curve up to the 21M cap.
    /// Charges 2% fee (1% Admin Treasury, 1% Holder Dividend Vault).
    pub fn buy(ctx: Context<BuyTokens>, amount_to_buy: u64, max_cost_limit: u64) -> Result<()> {
        instructions::buy::handler(ctx, amount_to_buy, max_cost_limit)
    }

    /// Sells and BURNS $GOLD tokens.
    /// Charges 10% tax (1% Admin Treasury, 1% Dividend Vault, 8% Permanent locked_reserve PDA).
    /// Guarantees a monotonic non-decreasing price floor ratchet: P_floor(t+1) >= P_floor(t).
    pub fn sell(ctx: Context<SellTokens>, amount_to_sell: u64, min_payout_limit: u64) -> Result<()> {
        instructions::sell::handler(ctx, amount_to_sell, min_payout_limit)
    }

    /// Claims accumulated global dividend rewards for $GOLD holders.
    pub fn claim_dividends(ctx: Context<ClaimDividends>) -> Result<()> {
        instructions::claim_dividends::handler(ctx)
    }

    /// Admin Emergency Pause/Unpause control instruction.
    pub fn set_pause(ctx: Context<SetPause>, paused: bool) -> Result<()> {
        instructions::admin::set_pause_handler(ctx, paused)
    }

    /// Admin Emergency Treasury wallet recovery instruction.
    pub fn update_admin_treasury(ctx: Context<UpdateAdminTreasury>) -> Result<()> {
        instructions::admin::update_admin_treasury_handler(ctx)
    }
}

