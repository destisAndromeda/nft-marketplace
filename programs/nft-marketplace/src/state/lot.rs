use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Lot {
    /// Address of marketplace domain
    pub marketplace: Pubkey,
    /// NFT Owner
    pub owner: Pubkey,
    /// NFT mint account
    pub mint: Pubkey,
    /// Current NFT price
    pub currency: Pubkey,
    /// Bump for lot PDA seed
    pub bump: u8,
}