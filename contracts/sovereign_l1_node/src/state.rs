use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub const BASE_PRICE_USDT: u64 = 10_000_000; // $10.00 USDT (6 Decimals)
pub const TARGET_PRICE_USDT: u64 = 10_000_000_000; // $10,000.00 USDT
pub const MAX_SUPPLY_GRAMS: u64 = 21_000_000_000_000; // 21,000,000.0000 Grams (6 Decimals)
pub const PRECISION: u128 = 1_000_000_000_000;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountState {
    pub address: String,
    pub gold_balance: u64,
    pub usdt_balance: u64,
    pub reward_debt: u128,
    pub pending_rewards: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SovereignL1State {
    pub chain_id: String,
    pub block_height: u64,
    pub total_supply_gold: u64,
    pub vault_reserve_usdt: u64,
    pub dividend_pool_usdt: u64,
    pub ratchet_locked_usdt: u64,
    pub admin_treasury_usdt: u64,
    pub acc_dividend_per_share: u128,
    pub current_floor_price_usdt: u64,
    pub current_marginal_price_usdt: u64,
    pub accounts: HashMap<String, AccountState>,
}

impl SovereignL1State {
    pub fn new() -> Self {
        SovereignL1State {
            chain_id: "VGOLD_SOVEREIGN_L1_MAINNET".to_string(),
            block_height: 0,
            total_supply_gold: 0,
            vault_reserve_usdt: 0,
            dividend_pool_usdt: 0,
            ratchet_locked_usdt: 0,
            admin_treasury_usdt: 0,
            acc_dividend_per_share: 0,
            current_floor_price_usdt: BASE_PRICE_USDT,
            current_marginal_price_usdt: BASE_PRICE_USDT,
            accounts: HashMap::new(),
        }
    }

    pub fn get_account_mut(&mut self, address: &str) -> &mut AccountState {
        self.accounts.entry(address.to_string()).or_insert_with(|| AccountState {
            address: address.to_string(),
            gold_balance: 0,
            usdt_balance: 1_000_000_000, // Default 1,000 USDT demo test balance
            reward_debt: 0,
            pending_rewards: 0,
        })
    }

    pub fn update_floor_price(&mut self) {
        if self.total_supply_gold > 0 {
            // Floor Price = Total Vault Collateral / Total Gold Supply
            let floor = (self.vault_reserve_usdt as u128 * 1_000_000) / self.total_supply_gold as u128;
            let computed_floor = floor as u64;
            // Enforce Non-Decreasing Ratchet: P_floor(t+1) >= P_floor(t)
            if computed_floor > self.current_floor_price_usdt {
                self.current_floor_price_usdt = computed_floor;
            }
        }
    }

    pub fn calculate_state_root(&self) -> String {
        let raw = format!(
            "{}:{}:{}:{}:{}:{}:{}",
            self.chain_id,
            self.block_height,
            self.total_supply_gold,
            self.vault_reserve_usdt,
            self.dividend_pool_usdt,
            self.ratchet_locked_usdt,
            self.accounts.len()
        );
        blake3::hash(raw.as_bytes()).to_hex().to_string()
    }
}
