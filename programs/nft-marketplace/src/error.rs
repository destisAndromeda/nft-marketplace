use anchor_lang::prelude::*;

#[error_code]
pub enum CustomError {
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Overflow")]
    Overflow,
    #[msg("LotIsPlaced")]
    LotIsPlaced,
    #[msg("Cancelled By Owner")]
    CancelledByOwner,
    #[msg("Cancelled By Marketplace")]
    CancelledByMarketplace,

}