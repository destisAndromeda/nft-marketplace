use anchor_lang::prelude::*;

use crate::state::*;
use crate::seeds::*;
use crate::error::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct AttachNftArgs {
    pub marketplace_index: u64,

    pub lot_index: u64,
}

#[derive(Accounts)]
#[instruction(args: AttachNftArgs)]
pub struct AttachNft<'info> {
    pub owner: Signer<'info>,

    #[account(
        seeds = [
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
    program_config: Account<'info, ProgramConfig>,
}