use anchor_lang::prelude::*;

#[error_code]
pub enum CustomError {
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Overflow")]
    Overflow,
    #[msg("Lot Is Placed")]
    LotIsPlaced,
    #[msg("Cancelled By Owner")]
    CancelledByOwner,
    #[msg("Cancelled By Marketplace")]
    CancelledByMarketplace,
    #[msg("Was Sold")]
    WasSold,
    #[msg("Unavailable For Sale")]
    UnavailableForSale,
    #[msg("Already Listed")]
    AlreadyListed,
}