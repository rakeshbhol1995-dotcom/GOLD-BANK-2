use anchor_lang::prelude::*;
use crate::state::ProtocolConfig;
use crate::errors::ImmortalGoldError;

#[derive(Accounts)]
pub struct SetPause<'info> {
    #[account(
        mut,
        constraint = admin.key() == protocol_config.admin @ ImmortalGoldError::Unauthorized
    )]
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [b"protocol_config"],
        bump
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,
}

#[derive(Accounts)]
pub struct UpdateAdminTreasury<'info> {
    #[account(
        mut,
        constraint = admin.key() == protocol_config.admin @ ImmortalGoldError::Unauthorized
    )]
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [b"protocol_config"],
        bump
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,

    /// CHECK: New treasury wallet receiving fees
    pub new_admin_treasury: UncheckedAccount<'info>,
}

pub fn set_pause_handler(ctx: Context<SetPause>, paused: bool) -> Result<()> {
    let config = &mut ctx.accounts.protocol_config;
    config.is_paused = paused;

    emit!(PauseEvent {
        admin: ctx.accounts.admin.key(),
        is_paused: paused,
    });

    msg!("Protocol pause status updated to: {}", paused);
    Ok(())
}

pub fn update_admin_treasury_handler(ctx: Context<UpdateAdminTreasury>) -> Result<()> {
    let config = &mut ctx.accounts.protocol_config;
    let old_treasury = config.admin_treasury;
    let new_treasury = ctx.accounts.new_admin_treasury.key();

    config.admin_treasury = new_treasury;

    emit!(TreasuryUpdatedEvent {
        admin: ctx.accounts.admin.key(),
        old_treasury,
        new_treasury,
    });

    msg!("Admin Treasury updated from {} to {}", old_treasury, new_treasury);
    Ok(())
}

// Anchor Events
#[event]
pub struct BuyEvent {
    pub buyer: Pubkey,
    pub amount_bought: u64,
    pub gross_cost: u64,
    pub vault_deposit: u64,
}

#[event]
pub struct SellEvent {
    pub seller: Pubkey,
    pub amount_sold: u64,
    pub seller_payout: u64,
    pub burned_amount: u64,
}

#[event]
pub struct ClaimDividendEvent {
    pub user: Pubkey,
    pub payout_amount: u64,
}

#[event]
pub struct PauseEvent {
    pub admin: Pubkey,
    pub is_paused: bool,
}

#[event]
pub struct TreasuryUpdatedEvent {
    pub admin: Pubkey,
    pub old_treasury: Pubkey,
    pub new_treasury: Pubkey,
}
