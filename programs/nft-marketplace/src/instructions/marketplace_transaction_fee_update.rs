use anchor_lang::prelude::*;

use crate::state::*;
use crate::seeds::*;
use crate::error::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct MarketplaceTransactionFeeUpdateArgs {
    pub self_index: u64, // @TODO: rename self_index to transaction_index

    pub transaction_fee: u64,
}

#[derive(Accounts)]
#[instruction(args: MarketplaceTransactionFeeUpdateArgs)]
pub struct MarketplaceTransactionFeeUpdate<'info> {
    #[account(
        mut,
        has_one = multisig_owner @ CustomError::Unauthorized,
        seeds   = [
            SEED_PROGRAM_PREFIX,
            multisig_owner.key().as_ref(),
            SEED_MARKETPLACE,
            &args.self_index.to_le_bytes(),
        ],
        bump  = marketplace.bump,
    )]
    pub marketplace: Account<'info, Marketplace>,

    pub multisig_owner: Signer<'info>,

    #[account(
        seeds = [SEED_PROGRAM_PREFIX, SEED_PROGRAM_CONFIG],
        bump  = program_config.bump,
    )]
    pub program_config: Account<'info, ProgramConfig>,
}

impl<'info> MarketplaceTransactionFeeUpdate<'info> {
    pub fn marketplace_transaction_fee_update(ctx: Context<Self>, args: MarketplaceTransactionFeeUpdateArgs) -> Result<()> {
        let marketplace = &mut ctx.accounts.marketplace;
        if args.transaction_fee > 0 {
            marketplace.transaction_fee = args.transaction_fee;
        }

        Ok(())
    }
}