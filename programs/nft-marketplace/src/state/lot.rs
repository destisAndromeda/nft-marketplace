use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Lot {
    /// Address of marketplace domain
    pub marketplace: Pubkey,
    /// NFT Owner
    pub owner: Pubkey,
    /// NFT mint account
    pub asset: Pubkey,
    /// Current NFT price
    pub currency: Pubkey,
    /// NFT price in lamports
    pub price: u64,
    /// Lot status in the Marketplace
    pub status: LotStatus,
    /// Need for Token and lot connection
    pub is_listed: bool,
    /// Bump for lot PDA seed
    pub bump: u8,
}

#[derive(
    AnchorSerialize,
    AnchorDeserialize,
    Clone,
    Copy,
    PartialEq,
    Eq,
    InitSpace,
)] // Maybe copy not required
pub enum LotStatus {
    /// Lot was created but got neutral status
    Created                { timestamp: i64 },
    /// Lot was deployed on Marketplace
    Placed                 { timestamp: i64 },
    /// NFT is available for sale
    AvailableForSale       { timestamp: i64 },
    /// NFT was sold
    Sold                   { timestamp: i64 },
    /// Lot was cancelled by NFT owner
    CancelledByOwner       { timestamp: i64 },
    /// Lot was cancelled by Marketplace
    CancelledByMarketplace { timestamp: i64 },
}