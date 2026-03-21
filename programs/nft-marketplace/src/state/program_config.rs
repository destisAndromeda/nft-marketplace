use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct ProgramConfigOld {
    /// Authority that can change PorgramConfig state
    pub authority: Pubkey,
    /// For Marketplace deploying
    pub marketplace_creation_fee: u64,
    /// Treasury of Marketplace fee
    pub treasury: Pubkey,
}

#[account]
#[derive(InitSpace)]
pub struct ProgramConfig {
    /// Authority that can change ProgramConfig state
    pub authority: Pubkey,
    /// Authority that can deploy new marketplace
    pub marketplace_deploy_authority: Pubkey,
    /// For trading platform fee
    pub treasury: Pubkey,
}