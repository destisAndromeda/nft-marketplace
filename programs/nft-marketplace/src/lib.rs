use anchor_lang::prelude::*;

mod state;
mod seeds;
mod error;
mod instructions;

use crate::instructions::*;

declare_id!("3xypSWG2NbT5Sx3htRgtqy87AEtyu61tvTp1sJab5o2X");

#[program]
pub mod nft_marketplace {
    use super::*;
    pub fn program_config_init(ctx: Context<ProgramConfigInit>, args: ProgramConfigArgs) -> Result<()> {
        ProgramConfigInit::program_config_init(ctx, args)
    }

    pub fn program_config_update(ctx: Context<ProgramConfigUpdate>, args: ProgramConfigUpdateArgs) -> Result<()> {
        ProgramConfigUpdate::program_config_update(ctx, args)
    }

    pub fn marketplace_create(ctx: Context<MarketplaceCreate>, args: MarketplaceCreateArgs) -> Result<()> {
        MarketplaceCreate::marketplace_create(ctx, args)
    }

    pub fn marketplace_fee_percentage_update(ctx: Context<MarketplaceFeePercentageUpdate>, args: MarketplaceFeePercentageUpdateArgs) -> Result<()> {
        MarketplaceFeePercentageUpdate::marketplace_fee_percentage_update(ctx, args)
    }
}