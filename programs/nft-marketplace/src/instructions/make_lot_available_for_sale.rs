use anchor_lang::prelude::*;

use crate::state::*;
use crate::seeds::*;
use crate::error::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct MakeLotAvailableForSaleArgs {
	pub marketplace_index: u64,

	pub lot_index: u64,
}

#[derive(Accounts)]
#[instruction(args: MakeLotAvailableForSaleArgs)]
pub struct MakeLotAvailableForSale<'info> {
	pub owner: Signer<'info>,

	#[account(
		mut,
		has_one = owner,
		seeds   = [
			PROGRAM_PREFIX,
			marketplace.key().as_ref(),
			TRANSACTION,
			owner.key().as_ref(),
			LOT,
			&args.lot_index.to_le_bytes(),
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

impl<'info> MakeLotAvailableForSale<'info> {
	fn validate(&self) -> Result<()> {
		let Self {
			lot,
			..
		} = self;

		require!(
			matches!(lot.status, LotStatus::Placed { .. }),
			CustomError::UnavailableForSale,
		);

		Ok(())
	}

	#[access_control(ctx.accounts.validate())]
	pub fn make_lot_available_for_sale(
		ctx: Context<Self>,
		_args: MakeLotAvailableForSaleArgs,
	) -> Result<()> {
		let lot = &mut ctx.accounts.lot;

		lot.status = LotStatus::AvailableForSale {
			timestamp: Clock::get()?.unix_timestamp,
		};

		Ok(())
	}
}