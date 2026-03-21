use anchor_lang::prelude::*;

use crate::state::*;
use crate::seeds::*;
use crate::error::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct MarketplaceCreateArgs {
    pub creator_key: Pubkey,

    pub fee_percentage: u64,
}

#[derive(Accounts)]
pub struct MarketplaceCreate<'info> {
    #[account(
        mut,
        address = program_config.marketplace_deploy_authority @
            CustomError::Unauthorized,
    )]
    pub owner: Signer<'info>,

    #[account(
        init,
        payer = owner,
        space = 8 + Marketplace::INIT_SPACE,
        seeds = [
            PROGRAM_PREFIX,
            program_config.marketplace_deploy_authority.key().as_ref(),
            MARKETPLACE,
            &program_config.transaction_index.to_le_bytes(),
        ],
        bump,
    )]
    pub marketplace: Account<'info, Marketplace>,

    #[account(
        mut,
        seeds = [PROGRAM_PREFIX, PROGRAM_CONFIG],
        bump  = program_config.bump,
    )]
    pub program_config: Account<'info, ProgramConfig>,


    pub system_program: Program<'info, System>,
}

impl<'info> MarketplaceCreate<'info> {
    pub fn marketplace_create(ctx: Context<Self>, args: MarketplaceCreateArgs) -> Result<()> {
        let marketplace = &mut ctx.accounts.marketplace;

        marketplace.multisig_owner = ctx.accounts.owner.key();
        marketplace.creator_key    = args.creator_key;

        marketplace.fee_percentage = args.fee_percentage;
        marketplace.bump = ctx.bumps.marketplace;

        marketplace.transaction_index = 0;
        ctx.accounts.program_config.transaction_index = 
        ctx.accounts.program_config.transaction_index.checked_add(1).unwrap();

        Ok(())
    }
}