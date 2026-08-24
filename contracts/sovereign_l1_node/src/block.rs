use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use crate::transaction::Transaction;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockHeader {
    pub index: u64,
    pub previous_hash: String,
    pub merkle_root: String,
    pub state_root: String,
    pub timestamp: i64,
    pub nonce: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Block {
    pub header: BlockHeader,
    pub hash: String,
    pub transactions: Vec<Transaction>,
}

impl Block {
    pub fn new(
        index: u64,
        previous_hash: String,
        state_root: String,
        transactions: Vec<Transaction>,
        timestamp: i64,
    ) -> Self {
        let merkle_root = Self::calculate_merkle_root(&transactions);
        let header = BlockHeader {
            index,
            previous_hash,
            merkle_root,
            state_root,
            timestamp,
            nonce: 0,
        };
        let hash = Self::calculate_hash(&header);

        Block {
            header,
            hash,
            transactions,
        }
    }

    pub fn calculate_merkle_root(txs: &[Transaction]) -> String {
        if txs.is_empty() {
            return "0".repeat(64);
        }
        let mut hasher = Sha256::new();
        for tx in txs {
            hasher.update(tx.tx_hash.as_bytes());
        }
        format!("{:x}", hasher.finalize())
    }

    pub fn calculate_hash(header: &BlockHeader) -> String {
        let mut hasher = Sha256::new();
        let payload = format!(
            "{}:{}:{}:{}:{}:{}",
            header.index,
            header.previous_hash,
            header.merkle_root,
            header.state_root,
            header.timestamp,
            header.nonce
        );
        hasher.update(payload.as_bytes());
        format!("{:x}", hasher.finalize())
    }
}
