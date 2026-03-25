use anchor_lang::prelude::*;

use crate::state::*;
use crate::seeds::*;
use crate::error::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct CancelByMarketplaceArgs {
    pub marketplace_index: u64,

    pub lot_index: u64,

    pub lot_owner: Pubkey,
}

#[derive(Accounts)]
#[instruction(args: CancelByMarketplaceArgs)]
pub struct CancelByMarketplace<'info> {
    // Looks like i need this for cancel only
    pub creator_key: Signer<'info>,

    #[account(
        seeds = [
            PROGRAM_PREFIX,
            marketplace.key().as_ref(),
            TRANSACTION,
            &args.lot_owner.key().as_ref(),
            LOT,
            &args.lot_index.to_le_bytes(),
        ],
        bump  = lot.bump,
    )]
    pub lot: Account<'info, Lot>,

    #[account(
        has_one = creator_key 
            @ CustomError::Unauthorized,
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

impl<'info> CancelByMarketplace<'info> {
    pub fn cancel_by_marketplace(ctx: Context<Self>, _args: CancelByMarketplaceArgs) -> Result<()> {

        Ok(())
    }
}