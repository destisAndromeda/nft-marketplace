use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Marketplace {
    /// Owners of marketplace
    pub multisig_owner: Pubkey,
    /// Account key for lots PDA
    pub creator_key: Pubkey,
    /// Marketplace trading fee
    pub fee_percentage: u64,
    /// For lot PDA compute
    pub transaction_index: u64,
    // Bump for marketplace PDA seed
    pub bump: u8,
}