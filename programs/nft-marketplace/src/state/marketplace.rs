use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Marketplace {
    /// Owners of marketplace
    pub multisig_owner: Pubkey,
    /// Account key for lots PDA
    pub local_admin: Pubkey,
    /// Marketplace trading fee
    pub transaction_fee: u64,
    /// For lot PDA compute
    pub transaction_index: u64,
    // Bump for marketplace PDA seed
    pub bump: u8,
}