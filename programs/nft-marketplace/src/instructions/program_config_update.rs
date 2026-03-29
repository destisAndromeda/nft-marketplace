use anchor_lang::prelude::*;

use crate::state::*;
use crate::seeds::*;
use crate::error::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct ProgramConfigUpdateArgs {
    pub authority: Option<Pubkey>,

    pub marketplace_deploy_authority: Option<Pubkey>,

    pub treasury: Option<Pubkey>,
}

#[derive(Accounts)]
pub struct ProgramConfigUpdate<'info> {
    #[account(
        mut,
        has_one = authority @ CustomError::Unauthorized,
        seeds   = [SEED_PROGRAM_PREFIX, SEED_PROGRAM_CONFIG],
        bump,
    )]
    pub program_config: Account<'info, ProgramConfig>,

    pub authority: Signer<'info>,
}

impl<'info> ProgramConfigUpdate<'info> {
    pub fn program_config_update(ctx: Context<Self>, args: ProgramConfigUpdateArgs) -> Result<()> {
        let program_config = &mut ctx.accounts.program_config;

        match args.authority {
            None => (),
            Some(new) => program_config.authority = new,
        };

        match args.marketplace_deploy_authority {
            None => (),
            Some(new) => program_config.marketplace_deploy_authority = new,
        };

        match args.treasury {
            None => (),
            Some(new) => program_config.treasury = new,
        };

        Ok(())
    }
}