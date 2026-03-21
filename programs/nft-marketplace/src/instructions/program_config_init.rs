use anchor_lang::prelude::*;

use crate::state::*;
use crate::seeds::*;
use crate::error::*;

#[cfg(not(feature = "testing"))]
const INITIALIZER: Pubkey = pubkey!("GtmrJehR49tXwFh7W4x2kGy61czbEboYSkHQDJw7Ggeb");

#[cfg(feature = "testing")]
const INITIALIZER: Pubkey = pubkey!("GtmrJehR49tXwFh7W4x2kGy61czbEboYSkHQDJw7Ggeb"); 

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct ProgramConfigArgs {
    pub authority: Pubkey,

    pub marketplace_deploy_authority: Pubkey,

    pub treasury:  Pubkey,
}

#[derive(Accounts)]
pub struct ProgramConfigInit<'info> {
    #[account(
        init,
        payer = initializer,
        seeds = [PROGRAM_PREFIX, PROGRAM_CONFIG],
        space = 8 + ProgramConfig::INIT_SPACE,
        bump,
    )]
    pub program_config: Account<'info, ProgramConfig>,

    #[account(
        mut,
        address = INITIALIZER @ CustomError::Unauthorized,
    )]
    pub initializer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

impl<'info> ProgramConfigInit<'info> {
    pub fn init(ctx: Context<Self>, args: ProgramConfigArgs) -> Result<()> {
        let program_config = &mut ctx.accounts.program_config;

        program_config.authority = args.authority;
        program_config.treasury  = args.treasury;
        program_config.marketplace_deploy_authority = args.marketplace_deploy_authority;

        Ok(())
    }
}