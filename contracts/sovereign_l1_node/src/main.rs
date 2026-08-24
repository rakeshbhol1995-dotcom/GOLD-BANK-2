mod block;
mod transaction;
mod state;

use block::Block;
use transaction::{Transaction, TxType};
use state::SovereignL1State;
use std::sync::{Arc, Mutex};
use warp::Filter;
use serde_json::json;

#[tokio::main]
async fn main() {
    println!("--------------------------------------------------");
    println!("  VIRTUAL GOLD PROTOCOL ($GOLD) - SOVEREIGN L1 NODE ");
    println!("  Domain: virtualgold.org");
    println!("  Engine: Native Pure-Rust Sovereign Layer 1 Node");
    println!("--------------------------------------------------");

    let state = Arc::new(Mutex::new(SovereignL1State::new()));
    let blocks = Arc::new(Mutex::new(vec![Block::new(
        0,
        "0".repeat(64),
        state.lock().unwrap().calculate_state_root(),
        vec![],
        chrono::Utc::now().timestamp(),
    )]));

    let state_filter = warp::any().map(move || state.clone());
    let blocks_filter = warp::any().map(move || blocks.clone());

    // GET /rpc/info - Returns sovereign chain details
    let info_route = warp::path!("rpc" / "info")
        .and(warp::get())
        .and(state_filter.clone())
        .and(blocks_filter.clone())
        .map(|state: Arc<Mutex<SovereignL1State>>, blocks: Arc<Mutex<Vec<Block>>>| {
            let st = state.lock().unwrap();
            let blk = blocks.lock().unwrap();
            let response = json!({
                "status": "ONLINE",
                "chain": st.chain_id,
                "block_height": blk.len() - 1,
                "latest_block_hash": blk.last().map(|b| b.hash.clone()).unwrap_or_default(),
                "total_supply_gold": st.total_supply_gold,
                "vault_reserve_usdt": st.vault_reserve_usdt,
                "floor_price_usdt": st.current_floor_price_usdt,
                "marginal_price_usdt": st.current_marginal_price_usdt
            });
            warp::reply::json(&response)
        });

    println!("⚡ Sovereign L1 Node Server initialized on http://127.0.0.1:8080/rpc/info");
    warp::serve(info_route).run(([127, 0, 0, 1], 8080)).await;
}
