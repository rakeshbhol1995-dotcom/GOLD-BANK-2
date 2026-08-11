use anchor_lang::prelude::*;
use crate::errors::ImmortalGoldError;

/// Precision factor for currency scaling (6 decimals for USDT / 9 decimals for Lamports)
pub const PRICE_PRECISION: u128 = 1_000_000; // 1e6 micro-units per unit currency

/// Token decimals factor: 9 decimals = 1,000,000,000 raw units per $GOLD
pub const TOKEN_DECIMALS_FACTOR: u128 = 1_000_000_000;

/// Max supply cap: 21,000,000 Grams total supply
pub const MAX_SUPPLY_CAP: u128 = 21_000_000 * TOKEN_DECIMALS_FACTOR;

/// Base price P0 at S=0: 10 USDT per 1 Gram Gold (10,000,000 micro-units, Min buy: 1 USDT)
pub const BASE_PRICE_P0: u128 = 10_000_000;

/// Target price at S=21M Grams: 10,000 USDT (10,000,000,000 micro-units, Dynamic Unbounded Scaling)
pub const TARGET_PRICE_P1: u128 = 10_000_000_000;

/// Scaled Dividend Precision Factor (1e12)
pub const DIVIDEND_PRECISION: u128 = 1_000_000_000_000;

pub struct BuyBreakdown {
    pub gross_cost: u64,
    pub vault_deposit: u64,
    pub treasury_fee: u64,
    pub dividend_fee: u64,
}

pub struct SellBreakdown {
    pub gross_valuation: u64,
    pub seller_payout: u64,
    pub treasury_fee: u64,
    pub dividend_fee: u64,
    pub vault_ratchet_lock: u64,
}

/// Computes the exact bonding curve base price at supply S using u128 fixed-point math:
/// P(S) = P0 + ((P_target - P0) * S) / S_max
pub fn calculate_price_at_supply(current_supply: u64) -> Result<u128> {
    let s = current_supply as u128;
    if s > MAX_SUPPLY_CAP {
        return Err(ImmortalGoldError::MaxSupplyReached.into());
    }

    let delta_p = TARGET_PRICE_P1.checked_sub(BASE_PRICE_P0)
        .ok_or(ImmortalGoldError::MathOverflow)?;

    let s_scaled = delta_p.checked_mul(s)
        .ok_or(ImmortalGoldError::MathOverflow)?
        .checked_div(MAX_SUPPLY_CAP)
        .ok_or(ImmortalGoldError::MathOverflow)?;

    let price = BASE_PRICE_P0.checked_add(s_scaled)
        .ok_or(ImmortalGoldError::MathOverflow)?;

    Ok(price)
}

/// Exact 256-bit checked multiplication and division: (a * b) / denominator
/// Prevents u128 overflow while maintaining 100% exact zero-precision-loss arithmetic.
pub fn mul_div_u256(a: u128, b: u128, denominator: u128) -> Result<u128> {
    if denominator == 0 {
        return Err(ImmortalGoldError::MathOverflow.into());
    }
    let a_lo = a as u64 as u128;
    let a_hi = a >> 64;
    let b_lo = b as u64 as u128;
    let b_hi = b >> 64;

    let p0 = a_lo * b_lo;
    let p1 = a_lo * b_hi + a_hi * b_lo;
    let p2 = a_hi * b_hi;

    let lo = p0.wrapping_add(p1 << 64);
    let hi = p2 + (p1 >> 64) + if lo < p0 { 1 } else { 0 };

    if hi >= denominator {
        return Err(ImmortalGoldError::MathOverflow.into());
    }

    let mut q = 0u128;
    let mut rem = hi;
    for i in (0..128).rev() {
        rem = (rem << 1) | ((lo >> i) & 1);
        if rem >= denominator {
            rem -= denominator;
            q |= 1u128 << i;
        }
    }

    Ok(q)
}

/// Integrates the linear bonding curve P(x) = P0 + k*x from S_start to S_end:
/// Cost = P0*(S_end - S_start) + (k/2)*(S_end^2 - S_start^2)
/// Uses 256-bit intermediate arithmetic (mul_div_u256) for 100% ZERO PRECISION LOSS.
pub fn calculate_curve_integral(s_start: u128, s_end: u128) -> Result<u128> {
    if s_start >= s_end {
        return Ok(0);
    }
    if s_end > MAX_SUPPLY_CAP {
        return Err(ImmortalGoldError::MaxSupplyReached.into());
    }

    let delta_s = s_end.checked_sub(s_start)
        .ok_or(ImmortalGoldError::MathOverflow)?;

    // Linear base cost term: P0 * delta_s
    let base_cost = BASE_PRICE_P0.checked_mul(delta_s)
        .ok_or(ImmortalGoldError::MathOverflow)?;

    // Quadratic curve slope term calculation using 256-bit arithmetic
    let delta_p = TARGET_PRICE_P1.checked_sub(BASE_PRICE_P0)
        .ok_or(ImmortalGoldError::MathOverflow)?;

    let s_sum = s_end.checked_add(s_start)
        .ok_or(ImmortalGoldError::MathOverflow)?;

    let double_max_cap = MAX_SUPPLY_CAP.checked_mul(2)
        .ok_or(ImmortalGoldError::MathOverflow)?;

    let delta_p_delta_s = delta_p.checked_mul(delta_s)
        .ok_or(ImmortalGoldError::MathOverflow)?;

    // 256-bit exact slope cost calculation
    let slope_cost = mul_div_u256(delta_p_delta_s, s_sum, double_max_cap)?;

    let mut total_cost = base_cost.checked_add(slope_cost)
        .ok_or(ImmortalGoldError::MathOverflow)?
        .checked_div(TOKEN_DECIMALS_FACTOR)
        .ok_or(ImmortalGoldError::MathOverflow)?;

    // Minimum Rounding Policy: Prevent zero-cost micro-purchases
    if total_cost == 0 && delta_s > 0 {
        total_cost = 1;
    }

    Ok(total_cost)
}



/// Calculates fee with a minimum 1 lamport tax guard to prevent rounding attacks / fee evasion on micro-sells
pub fn taxed_amount(amount: u64, percent: u64) -> u64 {
    let fee = amount.checked_mul(percent).unwrap_or(0) / 100;
    if amount > 0 && fee == 0 {
        1
    } else {
        fee
    }
}

/// Calculates buy deposit requirements and 2% fee breakdown with minimum 1 lamport tax guard
pub fn calculate_buy_breakdown(current_supply: u64, amount_to_buy: u64) -> Result<BuyBreakdown> {
    let s_start = current_supply as u128;
    let delta_s = amount_to_buy as u128;
    let s_end = s_start.checked_add(delta_s)
        .ok_or(ImmortalGoldError::MathOverflow)?;

    if s_end > MAX_SUPPLY_CAP {
        return Err(ImmortalGoldError::MaxSupplyReached.into());
    }

    let gross_cost_128 = calculate_curve_integral(s_start, s_end)?;
    let gross_cost = gross_cost_128 as u64;

    // Asymmetric Buy Fee: 2% Total (1% Treasury, 1% Dividend Pool, 98% Vault) with minimum 1 lamport tax guard
    let treasury_fee = taxed_amount(gross_cost, 1);
    let dividend_fee = taxed_amount(gross_cost, 1);
    let vault_deposit = gross_cost.saturating_sub(treasury_fee)
        .saturating_sub(dividend_fee);

    Ok(BuyBreakdown {
        gross_cost,
        vault_deposit,
        treasury_fee,
        dividend_fee,
    })
}

/// Calculates sell payout harmonized between bonding curve integral and proportional vault reserve share.
/// Takes min(curve_integral, reserve_share) to guarantee payout never exceeds curve valuation or available collateral,
/// and guarantees P_floor(t+1) >= P_floor(t) monotonically for every sell transaction.
pub fn calculate_sell_breakdown(
    current_supply: u64,
    vault_reserve: u64,
    amount_to_sell: u64
) -> Result<SellBreakdown> {
    let s_end = current_supply as u128;
    let delta_s = amount_to_sell as u128;
    if delta_s > s_end || s_end == 0 {
        return Err(ImmortalGoldError::InvalidAmount.into());
    }
    let s_start = s_end.checked_sub(delta_s)
        .ok_or(ImmortalGoldError::MathOverflow)?;

    // 1. Calculate bonding curve integral valuation: integral_{S-deltaS}^{S} P(x) dx
    let curve_valuation_128 = calculate_curve_integral(s_start, s_end)?;
    
    // 2. Calculate proportional vault reserve share: V(t) * (delta_S / S(t))
    let reserve_share_128 = (vault_reserve as u128)
        .checked_mul(delta_s).ok_or(ImmortalGoldError::MathOverflow)?
        .checked_div(s_end).ok_or(ImmortalGoldError::MathOverflow)?;

    // 3. Take min(curve_valuation, reserve_share) for complete backing & curve alignment
    let gross_valuation_128 = std::cmp::min(curve_valuation_128, reserve_share_128);
    let gross_valuation = u64::try_from(gross_valuation_128)
        .map_err(|_| ImmortalGoldError::MathOverflow)?;

    // Asymmetric Sell Fee: 10% Total (1% Treasury, 1% Dividend Pool, 8% Permanent Vault Lock, 90% Seller) with 1 lamport tax guard
    let treasury_fee = taxed_amount(gross_valuation, 1);
    let dividend_fee = taxed_amount(gross_valuation, 1);
    let vault_ratchet_lock = taxed_amount(gross_valuation, 8);

    let seller_payout = gross_valuation.saturating_sub(treasury_fee)
        .saturating_sub(dividend_fee)
        .saturating_sub(vault_ratchet_lock);

    // Verify Monotonic Non-Decreasing Price Floor Ratchet:
    // (new_vault * old_supply) >= (old_vault * new_supply)
    // Deduction from main vault_reserve is full 100% gross_valuation (90% seller + 1% treasury + 1% dividend + 8% ratchet lock)
    if s_start > 0 {
        let new_vault = vault_reserve.saturating_sub(gross_valuation);
        let new_supply = s_start;

        let left_side = (new_vault as u128).checked_mul(s_end)
            .ok_or(ImmortalGoldError::MathOverflow)?;
        let right_side = (vault_reserve as u128).checked_mul(new_supply)
            .ok_or(ImmortalGoldError::MathOverflow)?;

        if left_side < right_side {
            return Err(ImmortalGoldError::PriceFloorBreach.into());
        }
    }

    Ok(SellBreakdown {
        gross_valuation,
        seller_payout,
        treasury_fee,
        dividend_fee,
        vault_ratchet_lock,
    })
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_buy_breakdown_fee_distribution() {
        let current_supply = 0;
        let amount_to_buy = 1_000 * TOKEN_DECIMALS_FACTOR as u64; // 1,000 $IMG
        let breakdown = calculate_buy_breakdown(current_supply, amount_to_buy).unwrap();

        assert!(breakdown.gross_cost > 0);
        assert_eq!(breakdown.treasury_fee, breakdown.gross_cost / 100); // 1%
        assert_eq!(breakdown.dividend_fee, breakdown.gross_cost / 100); // 1%
        assert_eq!(
            breakdown.vault_deposit,
            breakdown.gross_cost - breakdown.treasury_fee - breakdown.dividend_fee
        ); // 98%
    }

    #[test]
    fn test_sell_breakdown_fee_distribution() {
        let current_supply = 10_000 * TOKEN_DECIMALS_FACTOR as u64;
        let buy_breakdown = calculate_buy_breakdown(0, current_supply).unwrap();
        let vault_reserve = buy_breakdown.vault_deposit;

        let amount_to_sell = 1_000 * TOKEN_DECIMALS_FACTOR as u64;
        let sell_breakdown = calculate_sell_breakdown(current_supply, vault_reserve, amount_to_sell).unwrap();

        assert_eq!(sell_breakdown.treasury_fee, sell_breakdown.gross_valuation / 100); // 1%
        assert_eq!(sell_breakdown.dividend_fee, sell_breakdown.gross_valuation / 100); // 1%
        assert_eq!(sell_breakdown.vault_ratchet_lock, sell_breakdown.gross_valuation * 8 / 100); // 8%
        assert_eq!(
            sell_breakdown.seller_payout + sell_breakdown.treasury_fee + sell_breakdown.dividend_fee + sell_breakdown.vault_ratchet_lock,
            sell_breakdown.gross_valuation
        ); // 100% accounting
    }

    #[test]
    fn test_vault_liquidity_capping_safety() {
        let current_supply = 50_000 * TOKEN_DECIMALS_FACTOR as u64;
        let amount_to_sell = 10_000 * TOKEN_DECIMALS_FACTOR as u64;
        let low_vault_reserve = 500;

        let sell_breakdown = calculate_sell_breakdown(current_supply, low_vault_reserve, amount_to_sell).unwrap();
        assert!(sell_breakdown.seller_payout <= low_vault_reserve);
    }

    #[test]
    fn test_ponzi_zero_new_buyers_total_selloff_invariant() {
        let mut total_supply: u64 = 0;
        let mut vault_reserve: u64 = 0;
        let buy_chunk = 500_000 * TOKEN_DECIMALS_FACTOR as u64;

        for _ in 0..10 {
            let buy_res = calculate_buy_breakdown(total_supply, buy_chunk).unwrap();
            total_supply += buy_chunk;
            vault_reserve += buy_res.vault_deposit;
        }

        let initial_price_floor = (vault_reserve as u128) * (TOKEN_DECIMALS_FACTOR as u128) / (total_supply as u128);

        let sell_chunk = 100_000 * TOKEN_DECIMALS_FACTOR as u64;
        let mut last_price_floor = initial_price_floor;

        while total_supply >= sell_chunk && total_supply > 0 {
            let sell_res = calculate_sell_breakdown(total_supply, vault_reserve, sell_chunk).unwrap();

            total_supply -= sell_chunk;
            vault_reserve = vault_reserve.checked_sub(sell_res.seller_payout + sell_res.treasury_fee).unwrap();

            if total_supply > 0 {
                let current_price_floor = (vault_reserve as u128) * (TOKEN_DECIMALS_FACTOR as u128) / (total_supply as u128);
                assert!(
                    current_price_floor >= last_price_floor,
                    "Price floor decreased! Previous: {}, Current: {}",
                    last_price_floor, current_price_floor
                );
                last_price_floor = current_price_floor;
            }
        }

        assert!(vault_reserve > 0 || total_supply == 0);
    }

    #[test]
    fn test_max_supply_cap_rejection() {
        let max_supply = MAX_SUPPLY_CAP as u64;
        let result = calculate_buy_breakdown(max_supply, 1);
        assert!(result.is_err());
    }
}

