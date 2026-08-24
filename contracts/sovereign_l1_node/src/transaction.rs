use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum TxType {
    InitializeGenesis,
    BuyGold,
    SellGold,
    ClaimDividends,
    TransferGold,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Transaction {
    pub tx_hash: String,
    pub tx_type: TxType,
    pub sender: String,
    pub recipient: String,
    pub gold_amount: u64,
    pub usdt_amount: u64,
    pub fee_usdt: u64,
    pub timestamp: i64,
    pub signature: String,
}

impl Transaction {
    pub fn new(
        tx_type: TxType,
        sender: String,
        recipient: String,
        gold_amount: u64,
        usdt_amount: u64,
        fee_usdt: u64,
        timestamp: i64,
        signature: String,
    ) -> Self {
        let raw = format!(
            "{:?}:{}:{}:{}:{}:{}:{}",
            tx_type, sender, recipient, gold_amount, usdt_amount, fee_usdt, timestamp
        );
        let hash = blake3::hash(raw.as_bytes()).to_hex().to_string();
        Transaction {
            tx_hash: hash,
            tx_type,
            sender,
            recipient,
            gold_amount,
            usdt_amount,
            fee_usdt,
            timestamp,
            signature,
        }
    }
}
