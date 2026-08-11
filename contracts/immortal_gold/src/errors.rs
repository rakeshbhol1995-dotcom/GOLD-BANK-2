use anchor_lang::prelude::*;

#[error_code]
pub enum ImmortalGoldError {
    #[msg("Protocol is currently paused by admin.")]
    ProtocolPaused,

    #[msg("Minting limit reached! Maximum 21,000,000 $IMG supply cap exceeded.")]
    MaxSupplyReached,

    #[msg("Zero or invalid token/deposit amount requested.")]
    InvalidAmount,

    #[msg("Math overflow or precision calculation error.")]
    MathOverflow,

    #[msg("Slippage tolerance exceeded during transaction.")]
    SlippageExceeded,

    #[msg("Insufficient vault liquidity to process withdrawal payout.")]
    InsufficientVaultLiquidity,

    #[msg("No dividend rewards available to claim.")]
    NoDividendsAvailable,

    #[msg("Unauthorized access or invalid admin authority.")]
    Unauthorized,

    #[msg("Invalid treasury account! Must match protocol configured admin treasury.")]
    UnauthorizedTreasury,

    #[msg("Invalid mint account! Must match protocol configured $IMG mint.")]
    UnauthorizedMint,

    #[msg("Invalid mint decimals! Must be 9 decimals.")]
    InvalidMintDecimals,

    #[msg("Invalid mint supply! Supply must be zero at initialization.")]
    InvalidMintSupply,

    #[msg("Invalid mint authority! Authority must be set to protocol mint_authority PDA.")]
    InvalidMintAuthority,

    #[msg("Price floor breach detected. Transaction aborted to maintain non-decreasing price floor.")]
    PriceFloorBreach,

    #[msg("Vault solvency breach detected. Physical vault balance is less than protocol liabilities.")]
    VaultSolvencyBreach,
}


