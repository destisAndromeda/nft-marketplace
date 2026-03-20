use anchor_lang::prelude::*;

#[acccount]
pub struct ProgramConfig {
	/// Authority that can change PorgramConfig state
	pub authority: Pubkey,
	/// For Marketplace deploying
	pub transaction_fee: u64,
	/// Treasury of Marketplace fee
	pub treasury: Pubkey,
	/// Needed for ProgramConfig PDA seeds
	pub bump: u8,
}

