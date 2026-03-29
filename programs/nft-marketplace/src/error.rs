use anchor_lang::prelude::*;

#[error_code]
pub enum CustomError {
    #[msg("Already Cancelled")]
    AlreadyCancelled,

    #[msg("Already Listed")]
    AlreadyListed,

    #[msg("Cancelled By Marketplace")]
    CancelledByMarketplace,

    #[msg("Cancelled By Owner")]
    CancelledByOwner,

    #[msg("Incorrect Account For Refund")]
    IncorrectAccountForRefund,

    #[msg("Invalid Asset")]
    InvalidAsset,

    #[msg("Invalid Lot Status")]
    InvalidLotStatus,

    #[msg("Lot Is Placed")]
    LotIsPlaced,

    #[msg("Not Enough Money")]
    NotEnoughMoney,

    #[msg("Not Nft Owner")]
    NotNftOwner,

    #[msg("Not Yet Listed")]
    NotYetListed,

    #[msg("Overflow")]
    Overflow,

    #[msg("Unavailable For Sale")]
    UnavailableForSale,

    #[msg("Unauthorized")]
    Unauthorized,

    #[msg("Was Sold")]
    WasSold,
}