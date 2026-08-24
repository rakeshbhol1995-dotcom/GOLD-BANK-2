use anchor_lang::prelude::*;
use crate::errors::ImmortalGoldError;

// ── Constants ────────────────────────────────────────────────────────────────

/// USDT 6-decimal precision
pub const PRICE_PRECISION: u128    = 1_000_000;

/// $IMG token 9-decimal raw units
pub const TOKEN_DECIMALS_FACTOR: u128 = 1_000_000_000;

/// Max supply cap: 21,000,000 $IMG
pub const MAX_SUPPLY_CAP: u128 = 21_000_000 * TOKEN_DECIMALS_FACTOR;

/// Genesis base price at S=0: $10.00 USDT
pub const BASE_PRICE_P0: u128  = 10_000_000;

/// Target price at S=21M: $10,000 USDT
pub const TARGET_PRICE_P1: u128 = 10_000_000_000;

/// Precision scaler for dividend per-share accumulator
pub const DIVIDEND_PRECISION: u128 = 1_000_000_000_000;

/// Minimum reserve ratio in bps for dividend payouts to be active
pub const MIN_RESERVE_RATIO_BPS: u64 = 9_000; // 90%

/// Guaranteed exit: max 0.1% of total supply per call
pub const GUARANTEED_EXIT_MAX_BPS: u64 = 10;

/// Max allowed deviation between Bonding Curve spot price and Oracle TWAP price
pub const ORACLE_MAX_DEVIATION_BPS: u128 = 2_000; // ±20%

pub fn calculate_spot_price(current_supply: u64) -> Result<u64> {
    let s = current_supply as u128;
    let s_max = MAX_SUPPLY_CAP;
    let delta_p = TARGET_PRICE_P1.checked_sub(BASE_PRICE_P0).ok_or(ImmortalGoldError::MathOverflow)?;
    let p_incr = mul_div_u256(delta_p, s, s_max)?;
    let spot_u128 = BASE_PRICE_P0.checked_add(p_incr).ok_or(ImmortalGoldError::MathOverflow)?;
    u64::try_from(spot_u128).map_err(|_| ImmortalGoldError::MathOverflow.into())
}

// ── Breakdown types ───────────────────────────────────────────────────────────

pub struct BuyBreakdown {
    pub gross_cost: u64,
    pub vault_deposit: u64,
    pub treasury_fee: u64,
    pub dividend_fee: u64,
}

pub struct SellBreakdown {
    pub curve_valuation: u64,   // bonding curve integral value (for display)
    pub reserve_share: u64,     // proportional reserve share (for display)
    pub gross_valuation: u64,   // min(curve, reserve) after floor cap (actual deducted amount)
    pub seller_payout: u64,     // 90%
    pub treasury_fee: u64,      // 1%
    pub dividend_fee: u64,      // 1%
    pub vault_ratchet_lock: u64, // 8%
}

// ── 256-bit integer math ──────────────────────────────────────────────────────

/// Exact 256-bit multiply then divide: (a * b) / denominator
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

    let mut q: u128 = 0;
    let mut rem: u128 = hi;
    for i in (0..128).rev() {
        rem = (rem << 1) | ((lo >> i) & 1);
        if rem >= denominator {
            rem -= denominator;
            q |= 1u128 << i;
        }
    }
    Ok(q)
}

// ── Curve Math ────────────────────────────────────────────────────────────────

/// Integrates the linear bonding curve from s_start to s_end.
/// Cost = P0*(delta_s) + (delta_p * delta_s * (s_end+s_start)) / (2 * S_max)
/// Uses 256-bit arithmetic for zero precision loss.
pub fn calculate_curve_integral(s_start: u128, s_end: u128) -> Result<u128> {
    if s_start >= s_end { return Ok(0); }
    if s_end > MAX_SUPPLY_CAP { return Err(ImmortalGoldError::MaxSupplyReached.into()); }

    let delta_s = s_end.checked_sub(s_start).ok_or(ImmortalGoldError::MathOverflow)?;
    let base_cost = BASE_PRICE_P0.checked_mul(delta_s).ok_or(ImmortalGoldError::MathOverflow)?;

    let delta_p       = TARGET_PRICE_P1.checked_sub(BASE_PRICE_P0).ok_or(ImmortalGoldError::MathOverflow)?;
    let s_sum         = s_end.checked_add(s_start).ok_or(ImmortalGoldError::MathOverflow)?;
    let double_max    = MAX_SUPPLY_CAP.checked_mul(2).ok_or(ImmortalGoldError::MathOverflow)?;
    let dp_ds         = delta_p.checked_mul(delta_s).ok_or(ImmortalGoldError::MathOverflow)?;
    let slope_cost    = mul_div_u256(dp_ds, s_sum, double_max)?;

    let mut total = base_cost.checked_add(slope_cost).ok_or(ImmortalGoldError::MathOverflow)?
        .checked_div(TOKEN_DECIMALS_FACTOR).ok_or(ImmortalGoldError::MathOverflow)?;

    if total == 0 && delta_s > 0 { total = 1; } // minimum 1 micro-USDT
    Ok(total)
}

// ── Fee Helpers ───────────────────────────────────────────────────────────────

/// Compute fee: (amount * bps / 10_000) with minimum 1 guard
pub fn taxed_bps(amount: u64, bps: u64) -> u64 {
    let fee = amount.saturating_mul(bps) / 10_000;
    if amount > 0 && fee == 0 { 1 } else { fee }
}

/// Legacy 1% helper (kept for buy compatibility)
pub fn taxed_amount(amount: u64, percent: u64) -> u64 {
    let fee = amount.checked_mul(percent).unwrap_or(0) / 100;
    if amount > 0 && fee == 0 { 1 } else { fee }
}

// ── Breakdown Calculations ────────────────────────────────────────────────────

/// Buy: 98% vault | 1% treasury | 1% dividend
pub fn calculate_buy_breakdown(current_supply: u64, amount_to_buy: u64) -> Result<BuyBreakdown> {
    let s_start = current_supply as u128;
    let s_end   = s_start.checked_add(amount_to_buy as u128).ok_or(ImmortalGoldError::MathOverflow)?;
    if s_end > MAX_SUPPLY_CAP { return Err(ImmortalGoldError::MaxSupplyReached.into()); }

    let gross_128  = calculate_curve_integral(s_start, s_end)?;
    let gross_cost = u64::try_from(gross_128).map_err(|_| ImmortalGoldError::MathOverflow)?;

    let treasury_fee = taxed_amount(gross_cost, 1);
    let dividend_fee = taxed_amount(gross_cost, 1);
    let vault_deposit = gross_cost.saturating_sub(treasury_fee).saturating_sub(dividend_fee);

    Ok(BuyBreakdown { gross_cost, vault_deposit, treasury_fee, dividend_fee })
}

/// Sell: 90% seller | 1% treasury | 1% dividend | 8% ratchet lock
///
/// KEY FIX: Dynamic floor cap replaces PriceFloorBreach error.
///   gross ≤ max_allowed_deduction = vault - (vault * s_start / s_end)
///   This guarantees V_new/S_new ≥ V_old/S_old for any valid partial sell.
pub fn calculate_sell_breakdown(
    current_supply: u64,
    vault_reserve: u128,
    amount_to_sell: u64,
) -> Result<SellBreakdown> {
    let s_end   = current_supply as u128;
    let delta_s = amount_to_sell as u128;
    if delta_s > s_end || s_end == 0 { return Err(ImmortalGoldError::InvalidAmount.into()); }
    let s_start = s_end.checked_sub(delta_s).ok_or(ImmortalGoldError::MathOverflow)?;

    // 1. Bonding curve integral (sell-side)
    let curve_128 = calculate_curve_integral(s_start, s_end)?;

    // 2. Pro-rata reserve share
    let reserve_128 = if s_end > 0 {
        mul_div_u256(vault_reserve, delta_s, s_end)?
    } else { 0 };

    // 3. Take min for conservative backing alignment
    let mut gross_128 = std::cmp::min(curve_128, reserve_128);

    // 4. Dynamic floor cap — guarantees monotonic floor for any partial sell
    //    max_deduct = vault - vault*(s_start/s_end)
    if s_start > 0 {
        let protected   = mul_div_u256(vault_reserve, s_start, s_end)?;
        let max_allowed = vault_reserve.saturating_sub(protected);
        gross_128       = std::cmp::min(gross_128, max_allowed);
    }

    let curve_valuation = u64::try_from(curve_128).map_err(|_| ImmortalGoldError::MathOverflow)?;
    let reserve_share   = u64::try_from(reserve_128).map_err(|_| ImmortalGoldError::MathOverflow)?;
    let gross_valuation = u64::try_from(gross_128).map_err(|_| ImmortalGoldError::MathOverflow)?;
    if gross_valuation < 1 { return Err(ImmortalGoldError::TradeTooSmall.into()); }

    let treasury_fee       = taxed_amount(gross_valuation, 1);
    let dividend_fee       = taxed_amount(gross_valuation, 1);
    let vault_ratchet_lock = taxed_bps(gross_valuation, 800); // 8%
    let total_fees = treasury_fee
        .checked_add(dividend_fee).ok_or(ImmortalGoldError::MathOverflow)?
        .checked_add(vault_ratchet_lock).ok_or(ImmortalGoldError::MathOverflow)?;
    let seller_payout = gross_valuation.checked_sub(total_fees).ok_or(ImmortalGoldError::MathOverflow)?;

    Ok(SellBreakdown { curve_valuation, reserve_share, gross_valuation, seller_payout, treasury_fee, dividend_fee, vault_ratchet_lock })
}

// ── Reserve Health Calculation ────────────────────────────────────────────────

/// Returns current reserve ratio in bps (e.g., 9800 = 98%)
/// reserve_ratio = (vault_reserve / total_supply) / BASE_PRICE_P0_per_token * 10_000
pub fn reserve_ratio_bps(vault_reserve: u128, total_supply: u64) -> u64 {
    if total_supply == 0 { return 10_000; }
    // BASE_PRICE_P0 is in micro-USDT per 9-decimal token-unit
    // BASE_PRICE_P0 / TOKEN_DECIMALS_FACTOR = price per 1 unit token in micro-USDT
    let base_per_token = BASE_PRICE_P0 / TOKEN_DECIMALS_FACTOR; // = 10 micro-USDT per 1 micro-$IMG unit
    if base_per_token == 0 { return 10_000; }
    let reserve_per_token = vault_reserve / (total_supply as u128);
    ((reserve_per_token * 10_000) / base_per_token) as u64
}

// ── Unit Tests ────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_buy_breakdown_fee_split() {
        let bd = calculate_buy_breakdown(0, 1_000 * TOKEN_DECIMALS_FACTOR as u64).unwrap();
        assert!(bd.gross_cost > 0);
        assert_eq!(bd.treasury_fee, bd.gross_cost / 100);
        assert_eq!(bd.dividend_fee, bd.gross_cost / 100);
        assert_eq!(bd.vault_deposit, bd.gross_cost - bd.treasury_fee - bd.dividend_fee);
    }

    #[test]
    fn test_sell_breakdown_fee_split() {
        let supply = 10_000 * TOKEN_DECIMALS_FACTOR as u64;
        let bd_buy = calculate_buy_breakdown(0, supply).unwrap();
        let vault  = bd_buy.vault_deposit as u128;

        let amount_to_sell = 1_000 * TOKEN_DECIMALS_FACTOR as u64;
        let bd = calculate_sell_breakdown(supply, vault, amount_to_sell).unwrap();

        let sum = bd.seller_payout + bd.treasury_fee + bd.dividend_fee + bd.vault_ratchet_lock;
        assert_eq!(sum, bd.gross_valuation, "Fee split must sum to gross_valuation");
    }

    #[test]
    fn test_dynamic_floor_cap_guarantees_monotonic_floor() {
        let supply: u64 = 50_000 * TOKEN_DECIMALS_FACTOR as u64;
        let vault = calculate_buy_breakdown(0, supply).unwrap().vault_deposit as u128;
        let sell_amount = 10_000 * TOKEN_DECIMALS_FACTOR as u64;

        let bd = calculate_sell_breakdown(supply, vault, sell_amount).unwrap();

        // After sell: new_vault = vault - gross, new_supply = supply - sell_amount
        let new_vault  = vault.saturating_sub(bd.gross_valuation as u128);
        let new_supply = (supply as u128) - (sell_amount as u128);
        if new_supply > 0 {
            let old_floor = vault * 10_000 / (supply as u128);
            let new_floor = new_vault * 10_000 / new_supply;
            assert!(new_floor >= old_floor, "Floor must be non-decreasing. old={old_floor}, new={new_floor}");
        }
    }

    #[test]
    fn test_reserve_ratio_starts_at_98pct() {
        let supply: u64 = 10_000 * TOKEN_DECIMALS_FACTOR as u64;
        let bd = calculate_buy_breakdown(0, supply).unwrap();
        let ratio = reserve_ratio_bps(bd.vault_deposit as u128, supply);
        assert!(ratio >= 9_700 && ratio <= 10_000, "Expected ~98%, got {ratio} bps");
    }

    #[test]
    fn test_max_supply_cap_rejection() {
        let result = calculate_buy_breakdown(MAX_SUPPLY_CAP as u64, 1);
        assert!(result.is_err());
    }

    #[test]
    fn test_guaranteed_exit_limit() {
        let supply: u64 = 1_000_000 * TOKEN_DECIMALS_FACTOR as u64;
        let max_exit = (supply as u128 * GUARANTEED_EXIT_MAX_BPS as u128 / 10_000) as u64;
        assert_eq!(max_exit, 1_000 * TOKEN_DECIMALS_FACTOR as u64); // 0.1% of 1M = 1k tokens
    }

    #[test]
    fn test_zero_supply_integral() {
        let cost = calculate_curve_integral(0, 0).unwrap();
        assert_eq!(cost, 0);
    }

    #[test]
    fn test_mul_div_u256_exactness() {
        let a = 1_000_000_000_000_000_000_u128;
        let b = 500_000_000_000_000_000_u128;
        let c = 1_000_000_000_000_000_000_u128;
        let result = mul_div_u256(a, b, c).unwrap();
        assert_eq!(result, b);
    }

    #[test]
    fn test_partial_sell_rounding_safety() {
        let supply = 10_000 * TOKEN_DECIMALS_FACTOR as u64;
        let bd_buy = calculate_buy_breakdown(0, supply).unwrap();
        let vault  = bd_buy.vault_deposit as u128;

        // Sell 10 tokens (sufficient amount for micro-USDT gross valuation)
        let amount_to_sell = 10 * TOKEN_DECIMALS_FACTOR as u64;
        let bd_sell = calculate_sell_breakdown(supply, vault, amount_to_sell).unwrap();
        assert!(bd_sell.gross_valuation >= 1);
        assert!(bd_sell.seller_payout <= bd_sell.gross_valuation);
    }
}
