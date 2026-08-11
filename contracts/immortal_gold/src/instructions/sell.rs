use anchor_lang::solana_program::{program::invoke_signed, system_instruction};

#[derive(Accounts)]
pub struct SellTokens<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,

    #[account(
        mut,
        seeds = [b"protocol_config"],
        bump
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,

    #[account(
        mut,
        seeds = [b"user_account", seller.key().as_ref()],
        bump
    )]
    pub user_account: Account<'info, UserAccount>,

    #[account(
        mut,
        seeds = [b"vault_reserve"],
        bump = protocol_config.vault_bump
    )]
    /// CHECK: Main Vault PDA releasing 90% payout & transferring fees
    pub vault_reserve: SystemAccount<'info>,

    #[account(
        mut,
        seeds = [b"locked_reserve"],
        bump = protocol_config.locked_vault_bump
    )]
    /// CHECK: Immutable Permanent Locked Reserve PDA holding 8% ratchet lock funds
    pub locked_reserve: SystemAccount<'info>,

    #[account(
        mut,
        seeds = [b"dividend_vault"],
        bump = protocol_config.dividend_vault_bump
    )]
    /// CHECK: Separate Dividend Vault PDA holding 1% holder dividend fees
    pub dividend_vault: SystemAccount<'info>,

    #[account(
        mut,
        constraint = admin_treasury.key() == protocol_config.admin_treasury @ ImmortalGoldError::UnauthorizedTreasury
    )]
    /// CHECK: Admin Treasury wallet receiving 1% sell fee (validated against protocol_config)
    pub admin_treasury: UncheckedAccount<'info>,

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

pub fn handler(ctx: Context<SellTokens>, amount_to_sell: u64, min_payout_limit: u64) -> Result<()> {
    let config = &mut ctx.accounts.protocol_config;
    require!(!config.is_paused, ImmortalGoldError::ProtocolPaused);
    require!(amount_to_sell > 0, ImmortalGoldError::InvalidAmount);
    require!(config.total_supply >= amount_to_sell, ImmortalGoldError::InvalidAmount);

    let seller_spl_balance = ctx.accounts.seller_token_account.amount;
    require!(seller_spl_balance >= amount_to_sell, ImmortalGoldError::InvalidAmount);

    // Calculate 10% Asymmetric Sell Fee Breakdown
    let breakdown = calculate_sell_breakdown(
        config.total_supply,
        config.vault_reserve,
        amount_to_sell
    )?;

    require!(breakdown.seller_payout >= min_payout_limit, ImmortalGoldError::SlippageExceeded);

    let user_account = &mut ctx.accounts.user_account;

    // 1. Accrue Pending Dividends before balance update
    if seller_spl_balance > 0 {
        let accumulated = (seller_spl_balance as u128)
            .checked_mul(config.acc_dividend_per_share)
            .ok_or(ImmortalGoldError::MathOverflow)?;

        let pending = accumulated.checked_sub(user_account.reward_debt)
            .unwrap_or(0) / DIVIDEND_PRECISION;

        user_account.pending_rewards = user_account.pending_rewards.checked_add(pending as u64)
            .ok_or(ImmortalGoldError::MathOverflow)?;
    }

    // 2. BURN 100% of sold $IMG Tokens via CPI
    let cpi_accounts = Burn {
        mint: ctx.accounts.img_mint.to_account_info(),
        from: ctx.accounts.seller_token_account.to_account_info(),
        authority: ctx.accounts.seller.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        cpi_accounts,
    );
    token::burn(cpi_ctx, amount_to_sell)?;

    let vault_bump = config.vault_bump;
    let vault_signer_seeds = &[b"vault_reserve".as_ref(), &[vault_bump]];
    let signer = &[&vault_signer_seeds[..]];

    // 3. Process 90% Payout Transfer from Vault PDA to Seller via CPI System Transfer
    invoke_signed(
        &system_instruction::transfer(
            &ctx.accounts.vault_reserve.key(),
            &ctx.accounts.seller.key(),
            breakdown.seller_payout,
        ),
        &[
            ctx.accounts.vault_reserve.to_account_info(),
            ctx.accounts.seller.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
        signer,
    )?;

    // 4. Transfer 1% Admin Treasury Fee from Vault via CPI
    if breakdown.treasury_fee > 0 {
        invoke_signed(
            &system_instruction::transfer(
                &ctx.accounts.vault_reserve.key(),
                &ctx.accounts.admin_treasury.key(),
                breakdown.treasury_fee,
            ),
            &[
                ctx.accounts.vault_reserve.to_account_info(),
                ctx.accounts.admin_treasury.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
            signer,
        )?;
    }

    // 5. Transfer 1% Dividend Fee from Main Vault directly into Separate Dividend Vault PDA via CPI
    if breakdown.dividend_fee > 0 {
        invoke_signed(
            &system_instruction::transfer(
                &ctx.accounts.vault_reserve.key(),
                &ctx.accounts.dividend_vault.key(),
                breakdown.dividend_fee,
            ),
            &[
                ctx.accounts.vault_reserve.to_account_info(),
                ctx.accounts.dividend_vault.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
            signer,
        )?;

        config.dividend_pool_balance = config.dividend_pool_balance.checked_add(breakdown.dividend_fee)
            .ok_or(ImmortalGoldError::MathOverflow)?;

        let remaining_supply = config.total_supply.checked_sub(amount_to_sell)
            .ok_or(ImmortalGoldError::MathOverflow)?;

        if remaining_supply > 0 {
            let dividend_addition = (breakdown.dividend_fee as u128)
                .checked_mul(DIVIDEND_PRECISION)
                .ok_or(ImmortalGoldError::MathOverflow)?
                .checked_div(remaining_supply as u128)
                .ok_or(ImmortalGoldError::MathOverflow)?;

            config.acc_dividend_per_share = config.acc_dividend_per_share.checked_add(dividend_addition)
                .ok_or(ImmortalGoldError::MathOverflow)?;
        }
    }

    // 6. Transfer 8% Permanent Ratchet Lock from Main Vault to Immutable Locked Reserve PDA via CPI
    if breakdown.vault_ratchet_lock > 0 {
        invoke_signed(
            &system_instruction::transfer(
                &ctx.accounts.vault_reserve.key(),
                &ctx.accounts.locked_reserve.key(),
                breakdown.vault_ratchet_lock,
            ),
            &[
                ctx.accounts.vault_reserve.to_account_info(),
                ctx.accounts.locked_reserve.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
            signer,
        )?;
    }

    // State Updates
    config.total_supply = config.total_supply.checked_sub(amount_to_sell)
        .ok_or(ImmortalGoldError::MathOverflow)?;

    // Record permanently locked 8% ratchet reserve balance in state
    config.ratchet_locked_reserve = config.ratchet_locked_reserve.checked_add(breakdown.vault_ratchet_lock)
        .ok_or(ImmortalGoldError::MathOverflow)?;

    // Vault reserve is reduced by net seller payout, treasury fee, dividend fee, and ratchet lock transfer
    config.vault_reserve = config.vault_reserve.checked_sub(breakdown.seller_payout)
        .ok_or(ImmortalGoldError::InsufficientVaultLiquidity)?
        .checked_sub(breakdown.treasury_fee)
        .ok_or(ImmortalGoldError::MathOverflow)?
        .checked_sub(breakdown.dividend_fee)
        .ok_or(ImmortalGoldError::MathOverflow)?
        .checked_sub(breakdown.vault_ratchet_lock)
        .ok_or(ImmortalGoldError::MathOverflow)?;

    let remaining_spl_balance = seller_spl_balance.checked_sub(amount_to_sell)
        .ok_or(ImmortalGoldError::MathOverflow)?;

    user_account.reward_debt = (remaining_spl_balance as u128)
        .checked_mul(config.acc_dividend_per_share)
        .ok_or(ImmortalGoldError::MathOverflow)?;

    emit!(crate::instructions::admin::SellEvent {
        seller: ctx.accounts.seller.key(),
        amount_sold: amount_to_sell,
        seller_payout: breakdown.seller_payout,
        burned_amount: amount_to_sell,
    });

    msg!("Sold & BURNED {} $IMG tokens. Payout: {} micro-units. Price floor ratcheted UP!", amount_to_sell, breakdown.seller_payout);
    Ok(())
}
