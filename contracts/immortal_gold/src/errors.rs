use anchor_lang::prelude::*;

#[error_code]
pub enum ImmortalGoldError {
    #[msg("Protocol is currently paused.")]
    ProtocolPaused,

    #[msg("Protocol must be paused for this operation.")]
    ProtocolNotPaused,

    #[msg("21,000,000 $GOLD supply cap exceeded.")]
    MaxSupplyReached,

    #[msg("Zero or invalid amount.")]
    InvalidAmount,

    #[msg("Math overflow or precision error.")]
    MathOverflow,

    #[msg("Slippage tolerance exceeded.")]
    SlippageExceeded,

    #[msg("Insufficient vault liquidity.")]
    InsufficientVaultLiquidity,

    #[msg("No dividend rewards available.")]
    NoDividendsAvailable,

    #[msg("Unauthorized — caller not a multisig signer.")]
    Unauthorized,

    #[msg("Invalid treasury account.")]
    UnauthorizedTreasury,

    #[msg("Invalid mint account.")]
    UnauthorizedMint,

    #[msg("Invalid mint decimals — must be 9.")]
    InvalidMintDecimals,

    #[msg("Invalid mint supply — must be zero at init.")]
    InvalidMintSupply,

    #[msg("Invalid mint authority PDA.")]
    InvalidMintAuthority,

    #[msg("Vault solvency breach detected.")]
    VaultSolvencyBreach,

    #[msg("Invalid multisig config — threshold > signer count.")]
    InvalidMultisigConfig,

    #[msg("Proposal has expired.")]
    ProposalExpired,

    #[msg("Proposal already executed.")]
    ProposalAlreadyExecuted,

    #[msg("Signer already approved this proposal.")]
    AlreadyApproved,

    #[msg("Insufficient multisig approvals.")]
    InsufficientApprovals,

    #[msg("48-hour governance timelock not expired.")]
    TimelockNotExpired,

    #[msg("Proposal not yet executed.")]
    ProposalNotExecuted,

    #[msg("Wrong proposal kind for this instruction.")]
    WrongProposalKind,

    /// NEW: Reserve ratio below 90% — dividends auto-suspend to protect principal
    #[msg("Reserve ratio below 90% — dividends suspended to protect reserve.")]
    ReserveTooLow,

    /// NEW: Guaranteed exit limit — 0.1% of supply per epoch
    #[msg("Guaranteed exit exceeds 0.1% of total supply limit.")]
    GuaranteedExitLimitExceeded,

    #[msg("No excess USDT above protocol reserve to rescue.")]
    NoExcessUsdtToRescue,

    #[msg("Rescue amount exceeds available excess USDT.")]
    ExceedsExcessUsdt,

    #[msg("Dividend holding period not met.")]
    HoldingPeriodNotMet,

    #[msg("Trade size too small.")]
    TradeTooSmall,

    #[msg("Maximum multisig approvals limit reached.")]
    TooManyApprovals,

    #[msg("Invalid oracle price.")]
    InvalidOraclePrice,

    #[msg("Oracle price is stale.")]
    OracleStale,
}
