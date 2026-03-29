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

    pub fn program_config_init(
        ctx: Context<ProgramConfigInit>,
        args: ProgramConfigArgs
    ) -> Result<()> {
        ProgramConfigInit::program_config_init(ctx, args)
    }

    pub fn program_config_update(
        ctx: Context<ProgramConfigUpdate>,
        args: ProgramConfigUpdateArgs
    ) -> Result<()> {
        ProgramConfigUpdate::program_config_update(ctx, args)
    }

    pub fn marketplace_create(
        ctx: Context<MarketplaceCreate>,
        args: MarketplaceCreateArgs
    ) -> Result<()> {
        MarketplaceCreate::marketplace_create(ctx, args)
    }

    pub fn marketplace_transaction_fee_update(
        ctx: Context<MarketplaceTransactionFeeUpdate>,
        args: MarketplaceTransactionFeeUpdateArgs
    ) -> Result<()> {
        MarketplaceTransactionFeeUpdate::marketplace_transaction_fee_update(ctx, args)
    }

    pub fn lot_create(
        ctx: Context<LotCreate>,
        args: LotCreateArgs,
    ) -> Result<()> {
        LotCreate::lot_create(ctx, args)
    }

    pub fn place_lot(
        ctx: Context<ChangeLotStatus>,
        args: ChangeLotStatusArgs,
    ) -> Result<()> {
        ChangeLotStatus::place_lot(ctx, args)
    }

    pub fn make_lot_available_for_sale(
        ctx: Context<ChangeLotStatus>,
        args: ChangeLotStatusArgs,
    ) -> Result<()> {
        ChangeLotStatus::make_lot_available_for_sale(ctx, args)
    }

    pub fn buy_nft_in_sol(
        ctx: Context<BuyNftInSol>,
        args: BuyNftInSolArgs,
    ) -> Result<()> {
        BuyNftInSol::buy_nft_in_sol(ctx, args)
    }

    pub fn list_nft(
        ctx: Context<ListNft>,
        args: ListNftArgs,
    ) -> Result<()> {
        ListNft::list_nft(ctx, args)
    }

    pub fn cancel_by_marketplace(
        ctx: Context<CancelByMarketplace>,
        args: CancelByMarketplaceArgs,
    ) -> Result<()> {
        CancelByMarketplace::cancel_by_marketplace(ctx, args)
    }

    pub fn cancel_by_owner(
        ctx: Context<CancelByOwner>,
        args: CancelByOwnerArgs,
    ) -> Result<()> {
        CancelByOwner::cancel_by_owner(ctx, args)
    }
}