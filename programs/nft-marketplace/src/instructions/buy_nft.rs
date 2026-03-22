use anchor_lang::prelude::*;
use mpl_core::instructions::TransferV1CpiBuilder;

use crate::state::*;
use crate::seeds::*;
use crate::error::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct BuyNftArgs {
    pub marketplace_index: u64,

    pub lot_index: u64,

    pub salesperson: Pubkey,
}

#[derive(Accounts)]
#[instruction(args: BuyNftArgs)]
pub struct BufNft<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(
        init,
        payer = buyer,
        space = 8 + Lot::INIT_SPACE,
        seeds = [
            PROGRAM_PREFIX,
            marketplace.key().as_ref(),
            TRANSACTION,
            buyer.key().as_ref(),
            LOT,
            &marketplace.transaction_index.to_le_bytes(),
        ],
        bump,
    )]
    pub new_lot: Account<'info, Lot>,

    #[account(
        mut,
        seeds = [
            PROGRAM_PREFIX,
            marketplace.key().as_ref(),
            TRANSACTION,
            &args.salesperson.key().as_ref(),
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

    pub system_program: Program<'info, System>,
}

impl<'info> BufNft<'info> {
    pub fn buy_nft(ctx: Context<Self>, args: BuyNftArgs) -> Result<()> {

        Ok(())
    }
}