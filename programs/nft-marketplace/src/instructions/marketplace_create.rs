use anchor_lang::prelude::*;

use crate::state::*;
use crate::seeds::*;
use crate::error::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct MarketplaceCreateArgs {}

#[derive(Accounts)]
pub struct MarketplaceCreate<'info> {
    #[account(
        mut,
        address = program_config.marketplace_deploy_authority @
            CustomError::Unauthorized,
    )]
    pub payer: Signer<'info>,

    #[account(
        init,
        payer = payer,
        space = 8 + Marketplace::INIT_SPACE,
        seeds = [
            PROGRAM_PREFIX,
            program_config.marketplace_deploy_authority.key().as_ref(),
            MARKETPLACE,
            &program_config.marketplace_index.to_le_bytes(),
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

        Ok(())
    }
}