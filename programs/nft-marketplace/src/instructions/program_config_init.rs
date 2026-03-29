use anchor_lang::prelude::*;

use crate::state::*;
use crate::seeds::*;
use crate::error::*;

#[cfg(not(feature = "testing"))]
const INITIALIZER: Pubkey = pubkey!("GtmrJehR49tXwFh7W4x2kGy61czbEboYSkHQDJw7Ggeb");

#[cfg(feature = "testing")]
const INITIALIZER: Pubkey = pubkey!("GAe1b8H1eUQhGuwAEJKstXLFdpaoHp9voszu1uw46Htm"); 

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
        seeds = [SEED_PROGRAM_PREFIX, SEED_PROGRAM_CONFIG],
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
    pub fn program_config_init(ctx: Context<Self>, args: ProgramConfigArgs) -> Result<()> {
            let authority = args.authority;
            let treasury  = args.treasury;
            let marketplace_deploy_authority = args.marketplace_deploy_authority;
            let bump = ctx.bumps.program_config;
            let transaction_index = 0;

            ctx.accounts.program_config.set_inner(ProgramConfig {
                authority,
                marketplace_deploy_authority,
                treasury,
                transaction_index,
                bump,
            });

        Ok(())
    }
}