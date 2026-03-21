use anchor_lang::prelude::*;

use crate::state::*;
use crate::seeds::*;
use crate::error::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct MarketplaceFeePercentageUpdateArgs {
    pub self_index: u64, // @TODO: rename self_index to transaction_index

    pub fee_percentage: u64,
}

#[derive(Accounts)]
#[instruction(args: MarketplaceFeePercentageUpdateArgs)]
pub struct MarketplaceFeePercentageUpdate<'info> {
    #[account(
        mut,
        has_one = multisig_owner @ CustomError::Unauthorized,
        seeds   = [
            PROGRAM_PREFIX,
            multisig_owner.key().as_ref(),
            MARKETPLACE,
            &args.self_index.to_le_bytes(),
        ],
        bump  = marketplace.bump,
    )]
    pub marketplace: Account<'info, Marketplace>,

    pub multisig_owner: Signer<'info>,

    #[account(
        seeds = [PROGRAM_PREFIX, PROGRAM_CONFIG],
        bump  = program_config.bump,
    )]
    pub program_config: Account<'info, ProgramConfig>,
}

impl<'info> MarketplaceFeePercentageUpdate<'info> {
    pub fn marketplace_fee_percentage_update(ctx: Context<Self>, args: MarketplaceFeePercentageUpdateArgs) -> Result<()> {
        let marketplace = &mut ctx.accounts.marketplace;
        if args.fee_percentage > 0 {
            marketplace.fee_percentage = args.fee_percentage;
        }

        Ok(())
    }
}