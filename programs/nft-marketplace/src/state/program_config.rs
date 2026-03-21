use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct ProgramConfig {
    /// Authority that can change ProgramConfig state
    pub authority: Pubkey,
    /// Authority that can deploy new marketplace
    pub marketplace_deploy_authority: Pubkey,
    /// For trading platform fee
    pub treasury: Pubkey,
    /// Needed for Marketplace PDA seed
    pub transaction_index: u64,
    /// Bump for ProgramConfig PDA seed
    pub bump: u8,
}