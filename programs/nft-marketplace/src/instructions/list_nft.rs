use anchor_lang::prelude::*;

use crate::state::*;
use crate::seeds::*;
use crate::error::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct ListNftArgs {
	marketplace_index: u64,

	lot_index: u64,
}

#[derive(Accounts)]
#[instruction(args: ListNftArgs)]
pub struct ListNft<'info> {
	pub owner: Signer<'info>,

	#[account(
		mut,
		has_one = owner @ CustomError::Unauthorized,
		seeds = [
			PROGRAM_PREFIX,
			marketplace.key().as_ref(),
			TRANSACTION,
			&args.lot_index.to_le_bytes(),
			LOT,
		],
		bump  = lot.bump,
	)]
	pub lot: Account<'info, Lot>,

	#[account(
		seeds = [
			PROGRAM_PREFIX,
			program_config.marketplace_deploy_authority.key().as_ref(),
			MARKETPLACE,
			&args.marketplace_index.to_le_bytes(),
		],
		bump  = marketplace.bump,
	)]
	pub marketplace: Account<'info, Marketplace>,

	#[account(
		seeds = [PROGRAM_PREFIX, PROGRAM_CONFIG],
		bump  = program_config.bump,
	)]
	pub program_config: Account<'info, ProgramConfig>,
}

// impl<'info> ListNft<'info> {}