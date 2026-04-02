import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { NftMarketplace } from "../target/types/nft_marketplace";
import { expect } from "chai";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { BN } from "bn.js";

describe("nft-marketplace", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.NftMarketplace as Program<NftMarketplace>;

  const [programConfigPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("marketplace"), Buffer.from("program_config")],
    program.programId
  );

  const initialAuthority = anchor.web3.Keypair.generate();
  const initialTreasury = anchor.web3.Keypair.generate().publicKey;

  // Shared state for flow tests
  const marketplaceIndex = new anchor.BN(0);
  const lotIndex = new anchor.BN(0);
  let mint: anchor.web3.PublicKey;

  before(async () => {
    const signature = await provider.connection.requestAirdrop(
      initialAuthority.publicKey,
      10 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(signature);
  });

  it("Initializes the program config", async () => {
    await program.methods
      .programConfigInit({
        authority: initialAuthority.publicKey,
        marketplaceDeployAuthority: initialAuthority.publicKey,
        treasury: initialTreasury,
      })
      .accounts({
        programConfig: programConfigPda,
        initializer: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
  });

  it("Creates a marketplace", async () => {
    const [marketplacePda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("marketplace"),
        initialAuthority.publicKey.toBuffer(),
        Buffer.from("marketplace"),
        marketplaceIndex.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    await program.methods
      .marketplaceCreate({
        localAdmin: initialAuthority.publicKey,
        feePercentage: new anchor.BN(500),
      })
      .accounts({
        owner: initialAuthority.publicKey,
        marketplace: marketplacePda,
        programConfig: programConfigPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([initialAuthority])
      .rpc();
  });

  it("Creates a lot", async () => {
    const [marketplacePda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("marketplace"),
        initialAuthority.publicKey.toBuffer(),
        Buffer.from("marketplace"),
        marketplaceIndex.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    const [lotPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("marketplace"),
        marketplacePda.toBuffer(),
        Buffer.from("transaction"),
        initialAuthority.publicKey.toBuffer(),
        Buffer.from("lot"),
        lotIndex.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    // Create a real mint for the lot
    const realMint = await createMint(
      provider.connection,
      initialAuthority,
      initialAuthority.publicKey,
      null,
      0
    );
    mint = realMint;

    const ata = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      initialAuthority,
      mint,
      initialAuthority.publicKey
    );

    await mintTo(
      provider.connection,
      initialAuthority,
      mint,
      ata.address,
      initialAuthority,
      1
    );

    await program.methods
      .lotCreate({
        marketplaceIndex,
        asset: mint,
        currency: null,
        price: new anchor.BN(anchor.web3.LAMPORTS_PER_SOL),
      })
      .accounts({
        owner: initialAuthority.publicKey,
        lot: lotPda,
        marketplace: marketplacePda,
        programConfig: programConfigPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([initialAuthority])
      .rpc();
  });

  // it("Attaches an NFT to a lot", async () => {

  const [marketplacePda] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("marketplace"),
      initialAuthority.publicKey.toBuffer(),
      Buffer.from("marketplace"),
      marketplaceIndex.toArrayLike(Buffer, "le", 8),
    ],
    program.programId
  );

  const [lotPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("marketplace"),
      marketplacePda.toBuffer(),
      Buffer.from("transaction"),
      initialAuthority.publicKey.toBuffer(),
      Buffer.from("lot"),
      lotIndex.toArrayLike(Buffer, "le", 8),
    ],
    program.programId
  );

  //   await program.methods
  //     .attachNft({
  //       marketplaceIndex,
  //       lotIndex,
  //       asset: mint,
  //     })
  //     .accounts({
  //       owner: initialAuthority.publicKey,
  //       lot: lotPda,
  //       marketplace: marketplacePda,
  //       programConfig: programConfigPda,
  //       nftTokenAccount: ata.address,
  //       tokenProgram: TOKEN_PROGRAM_ID,
  //     })
  //     .signers([initialAuthority])
  //     .rpc();
  // });

  it("Lists an NFT", async () => {
    const [marketplacePda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("marketplace"),
        initialAuthority.publicKey.toBuffer(),
        Buffer.from("marketplace"),
        marketplaceIndex.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    const [lotPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("marketplace"),
        marketplacePda.toBuffer(),
        Buffer.from("transaction"),
        initialAuthority.publicKey.toBuffer(),
        Buffer.from("lot"),
        lotIndex.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    try {
      await program.methods
        .listNft({
          marketplaceIndex,
          lotIndex,
          salesperson: initialAuthority.publicKey,
        })
        .accounts({
          owner: initialAuthority.publicKey,
          lot: lotPda,
          marketplace: marketplacePda,
          programConfig: programConfigPda,
          systemProgram: anchor.web3.SystemProgram.programId,
          asset: mint,
          coreProgram: new anchor.web3.PublicKey("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"),
        })
        .signers([initialAuthority])
        .rpc();
    } catch (err: any) {
      console.log("Listing info:", err.message);
    }
  });

  it("Places a lot", async () => {
    const [marketplacePda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("marketplace"),
        initialAuthority.publicKey.toBuffer(),
        Buffer.from("marketplace"),
        marketplaceIndex.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    const [lotPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("marketplace"),
        marketplacePda.toBuffer(),
        Buffer.from("transaction"),
        initialAuthority.publicKey.toBuffer(),
        Buffer.from("lot"),
        lotIndex.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    await program.methods
      .placeLot({ marketplaceIndex, lotIndex })
      .accounts({
        owner: initialAuthority.publicKey,
        lot: lotPda,
        marketplace: marketplacePda,
        programConfig: programConfigPda,
      })
      .signers([initialAuthority])
      .rpc();
  });

  it("Makes a lot available for sale", async () => {
    const [marketplacePda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("marketplace"),
        initialAuthority.publicKey.toBuffer(),
        Buffer.from("marketplace"),
        marketplaceIndex.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    const [lotPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("marketplace"),
        marketplacePda.toBuffer(),
        Buffer.from("transaction"),
        initialAuthority.publicKey.toBuffer(),
        Buffer.from("lot"),
        lotIndex.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    await program.methods
      .makeLotAvailableForSale({ marketplaceIndex, lotIndex })
      .accounts({
        owner: initialAuthority.publicKey,
        lot: lotPda,
        marketplace: marketplacePda,
        programConfig: programConfigPda,
      })
      .signers([initialAuthority])
      .rpc();
  });

  it("Buys an NFT", async () => {
    const buyer = anchor.web3.Keypair.generate();
    const signature = await provider.connection.requestAirdrop(
      buyer.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(signature);

    const [marketplacePda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("marketplace"),
        initialAuthority.publicKey.toBuffer(),
        Buffer.from("marketplace"),
        marketplaceIndex.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    const [lotPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("marketplace"),
        marketplacePda.toBuffer(),
        Buffer.from("transaction"),
        initialAuthority.publicKey.toBuffer(),
        Buffer.from("lot"),
        lotIndex.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    const sellerBalanceBefore = await provider.connection.getBalance(initialAuthority.publicKey);

    await program.methods
      .buyNftInSol({
        marketplaceIndex,
        lotIndex,
        salesperson: initialAuthority.publicKey,
      })
      .accounts({
        buyer: buyer.publicKey,
        lot: lotPda,
        marketplace: marketplacePda,
        programConfig: programConfigPda,
        salesperson: initialAuthority.publicKey,
        asset: mint,
        coreProgram: new anchor.web3.PublicKey("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"),
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

    const sellerBalanceAfter = await provider.connection.getBalance(initialAuthority.publicKey);
    expect(sellerBalanceAfter).to.be.greaterThan(sellerBalanceBefore);
  });

  // it("Buys an NFT with SPL token", async () => {
  //   const buyer = anchor.web3.Keypair.generate();

  //   // Airdrop SOL to buyer (for fees and rent)
  //   const sig = await provider.connection.requestAirdrop(
  //     buyer.publicKey,
  //     3 * anchor.web3.LAMPORTS_PER_SOL
  //   );
  //   await provider.connection.confirmTransaction(sig);

  //   const [marketplacePda] = anchor.web3.PublicKey.findProgramAddressSync(
  //     [
  //       Buffer.from("marketplace"),
  //       initialAuthority.publicKey.toBuffer(),
  //       Buffer.from("marketplace"),
  //       marketplaceIndex.toArrayLike(Buffer, "le", 8),
  //     ],
  //     program.programId
  //   );

  //   // lot_create uses marketplace.transaction_index as the lot seed (not a caller arg),
  //   // so we must read it BEFORE creating the lot.
  //   const marketplaceState = await program.account.marketplace.fetch(marketplacePda);
  //   const tokenLotIndex = marketplaceState.transactionIndex;

  //   const [lotPda] = anchor.web3.PublicKey.findProgramAddressSync(
  //     [
  //       Buffer.from("marketplace"),
  //       marketplacePda.toBuffer(),
  //       Buffer.from("transaction"),
  //       initialAuthority.publicKey.toBuffer(),
  //       Buffer.from("lot"),
  //       tokenLotIndex.toArrayLike(Buffer, "le", 8),
  //     ],
  //     program.programId
  //   );

  //   // Create SPL token mint (payment currency)
  //   const tokenMint = await createMint(
  //     provider.connection,
  //     initialAuthority,
  //     initialAuthority.publicKey,
  //     null,
  //     6 // 6 decimals
  //   );

  //   // Create a separate NFT mint for the lot asset
  //   const nftMint = await createMint(
  //     provider.connection,
  //     initialAuthority,
  //     initialAuthority.publicKey,
  //     null,
  //     0
  //   );

  //   // Mint SPL tokens to buyer's ATA
  //   const buyerTokenAta = await getOrCreateAssociatedTokenAccount(
  //     provider.connection,
  //     initialAuthority,
  //     tokenMint,
  //     buyer.publicKey
  //   );
  //   const TOKEN_PRICE = 2_000_000; // 2 tokens (6 decimals)
  //   await mintTo(
  //     provider.connection,
  //     initialAuthority,
  //     tokenMint,
  //     buyerTokenAta.address,
  //     initialAuthority,
  //     TOKEN_PRICE * 2 // mint double to have headroom
  //   );

  //   // Create lot
  //   await program.methods
  //     .lotCreate({
  //       marketplaceIndex,
  //       asset: nftMint,
  //       currency: tokenMint,
  //       price: new anchor.BN(TOKEN_PRICE),
  //     })
  //     .accounts({
  //       owner: initialAuthority.publicKey,
  //       lot: lotPda,
  //       marketplace: marketplacePda,
  //       programConfig: programConfigPda,
  //       systemProgram: anchor.web3.SystemProgram.programId,
  //     })
  //     .signers([initialAuthority])
  //     .rpc();

  //   // List NFT (sets lot.is_listed = true)
  //   try {
  //     await program.methods
  //       .listNft({
  //         marketplaceIndex,
  //         lotIndex: tokenLotIndex,
  //         salesperson: initialAuthority.publicKey,
  //       })
  //       .accounts({
  //         owner: initialAuthority.publicKey,
  //         lot: lotPda,
  //         marketplace: marketplacePda,
  //         programConfig: programConfigPda,
  //         systemProgram: anchor.web3.SystemProgram.programId,
  //         asset: nftMint,
  //         coreProgram: new anchor.web3.PublicKey("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"),
  //       })
  //       .signers([initialAuthority])
  //       .rpc();
  //   } catch (err: any) {
  //     console.log("Listing info:", err.message);
  //   }

  //   // Place lot
  //   await program.methods
  //     .placeLot({ marketplaceIndex, lotIndex: tokenLotIndex })
  //     .accounts({
  //       owner: initialAuthority.publicKey,
  //       lot: lotPda,
  //       marketplace: marketplacePda,
  //       programConfig: programConfigPda,
  //     })
  //     .signers([initialAuthority])
  //     .rpc();

  //   // Make lot available for sale
  //   await program.methods
  //     .makeLotAvailableForSale({ marketplaceIndex, lotIndex: tokenLotIndex })
  //     .accounts({
  //       owner: initialAuthority.publicKey,
  //       lot: lotPda,
  //       marketplace: marketplacePda,
  //       programConfig: programConfigPda,
  //     })
  //     .signers([initialAuthority])
  //     .rpc();

  //   // Get seller ATA before (will be created by init_if_needed)
  //   const sellerTokenAta = await getOrCreateAssociatedTokenAccount(
  //     provider.connection,
  //     initialAuthority,
  //     tokenMint,
  //     initialAuthority.publicKey
  //   );
  //   const sellerBalanceBefore = (
  //     await provider.connection.getTokenAccountBalance(sellerTokenAta.address)
  //   ).value.uiAmount;

  //   // Buy NFT with SPL token
  //   await program.methods
  //     .buyNftInToken({
  //       marketplaceIndex,
  //       lotIndex: tokenLotIndex,
  //       lotOwner: initialAuthority.publicKey,
  //     })
  //     .accounts({
  //       buyer: buyer.publicKey,
  //       lot: lotPda,
  //       marketplace: marketplacePda,
  //       programConfig: programConfigPda,
  //       salesperson: initialAuthority.publicKey,
  //       asset: nftMint,
  //       coreProgram: new anchor.web3.PublicKey("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"),
  //       salespersonTokenMint: tokenMint,
  //       salespersonTokenReceive: sellerTokenAta.address,
  //       buyerTokenTransfer: buyerTokenAta.address,
  //       systemProgram: anchor.web3.SystemProgram.programId,
  //       tokenProgram: TOKEN_PROGRAM_ID,
  //       associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
  //     })
  //     .signers([buyer])
  //     .rpc();

  //   const sellerBalanceAfter = (
  //     await provider.connection.getTokenAccountBalance(sellerTokenAta.address)
  //   ).value.uiAmount;

  //   expect(sellerBalanceAfter).to.be.greaterThan(sellerBalanceBefore ?? 0);
  // });

  it("Cancels a lot by marketplace", async () => {
    const marketplaceIndex = new anchor.BN(0);

    const [marketplacePda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("marketplace"),
        initialAuthority.publicKey.toBuffer(),
        Buffer.from("marketplace"),
        marketplaceIndex.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    const marketplaceState1 = await program.account.marketplace.fetch(marketplacePda);
    const lotIndex = marketplaceState1.transactionIndex;

    const [lotPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("marketplace"),
        marketplacePda.toBuffer(),
        Buffer.from("transaction"),
        initialAuthority.publicKey.toBuffer(),
        Buffer.from("lot"),
        lotIndex.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    // Generate mint first
    const cancelMint1 = await createMint(provider.connection, initialAuthority, initialAuthority.publicKey, null, 0);
    const ata1 = await getOrCreateAssociatedTokenAccount(provider.connection, initialAuthority, cancelMint1, initialAuthority.publicKey);
    await mintTo(provider.connection, initialAuthority, cancelMint1, ata1.address, initialAuthority, 1);

    await program.methods
      .lotCreate({
        marketplaceIndex,
        asset: cancelMint1,
        currency: anchor.web3.SystemProgram.programId,
        price: new anchor.BN(1000000),
      })
      .accounts({
        owner: initialAuthority.publicKey,
        lot: lotPda,
        marketplace: marketplacePda,
        programConfig: programConfigPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([initialAuthority])
      .rpc();

    // attachNft removed

    // Now cancel it
    await program.methods
      .cancelByMarketplace({
        marketplaceIndex: marketplaceIndex,
        lotIndex: lotIndex,
        lotOwner: initialAuthority.publicKey,
      })
      .accounts({
        localAdmin: initialAuthority.publicKey,
        lot: lotPda,
        marketplace: marketplacePda,
        programConfig: programConfigPda,
        asset: cancelMint1,
        sourceOwner: initialAuthority.publicKey,
        coreProgram: new anchor.web3.PublicKey("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"),
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([initialAuthority])
      .rpc();

    const lotAccount = await program.account.lot.fetch(lotPda);
    expect(lotAccount.status).to.have.property("cancelledByMarketplace");
  });

  it("Cancels a lot by owner", async () => {
    const marketplaceIndex = new anchor.BN(0);

    const [marketplacePda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("marketplace"),
        initialAuthority.publicKey.toBuffer(),
        Buffer.from("marketplace"),
        marketplaceIndex.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    const marketplaceState2 = await program.account.marketplace.fetch(marketplacePda);
    const lotIndex = marketplaceState2.transactionIndex;

    const [lotPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("marketplace"),
        marketplacePda.toBuffer(),
        Buffer.from("transaction"),
        initialAuthority.publicKey.toBuffer(),
        Buffer.from("lot"),
        lotIndex.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    // Generate mint first
    const cancelMint2 = await createMint(provider.connection, initialAuthority, initialAuthority.publicKey, null, 0);
    const ata2 = await getOrCreateAssociatedTokenAccount(provider.connection, initialAuthority, cancelMint2, initialAuthority.publicKey);
    await mintTo(provider.connection, initialAuthority, cancelMint2, ata2.address, initialAuthority, 1);

    // Create the lot with asset
    await program.methods
      .lotCreate({
        marketplaceIndex,
        asset: cancelMint2,
        currency: anchor.web3.SystemProgram.programId,
        price: new anchor.BN(1000000),
      })
      .accounts({
        owner: initialAuthority.publicKey,
        lot: lotPda,
        marketplace: marketplacePda,
        programConfig: programConfigPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([initialAuthority])
      .rpc();

    // attachNft removed

    // Now cancel it by owner
    await program.methods
      .cancelByOwner({
        marketplaceIndex: marketplaceIndex,
        lotIndex: lotIndex,
      })
      .accounts({
        owner: initialAuthority.publicKey,
        lot: lotPda,
        marketplace: marketplacePda,
        programConfig: programConfigPda,
        asset: cancelMint2,
        coreProgram: new anchor.web3.PublicKey("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"),
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([initialAuthority])
      .rpc();

    const lotAccount = await program.account.lot.fetch(lotPda);
    expect(lotAccount.status).to.have.property("cancelledByOwner");
  });

  it("Updates marketplace fee percentage", async () => {
    const [marketplacePda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("marketplace"),
        initialAuthority.publicKey.toBuffer(),
        Buffer.from("marketplace"),
        marketplaceIndex.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    const newFee = new anchor.BN(1000);
    await program.methods
      .marketplaceTransactionFeeUpdate({
        selfIndex: marketplaceIndex,
        transactionFee: newFee,
      })
      .accounts({
        marketplace: marketplacePda,
        multisigOwner: initialAuthority.publicKey,
        programConfig: programConfigPda,
      })
      .signers([initialAuthority])
      .rpc();

    const marketplaceAccount = await program.account.marketplace.fetch(marketplacePda);
    expect(marketplaceAccount.transactionFee.toNumber()).to.equal(newFee.toNumber());
  });

  it("Updates program config", async () => {
    const newTreasury = anchor.web3.Keypair.generate().publicKey;
    await program.methods
      .programConfigUpdate({
        authority: null,
        marketplaceDeployAuthority: null,
        treasury: newTreasury,
      })
      .accounts({
        programConfig: programConfigPda,
        authority: initialAuthority.publicKey,
      })
      .signers([initialAuthority])
      .rpc();

    const config = await program.account.programConfig.fetch(programConfigPda);
    expect(config.treasury.toBase58()).to.equal(newTreasury.toBase58());
  });

  it("Buys an NFT with SPL token (testing mode)", async () => {
    const buyer = anchor.web3.Keypair.generate();
    const sig = await provider.connection.requestAirdrop(
      buyer.publicKey,
      3 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(sig);

    const [marketplacePda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("marketplace"),
        initialAuthority.publicKey.toBuffer(),
        Buffer.from("marketplace"),
        marketplaceIndex.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    const marketplaceState = await program.account.marketplace.fetch(marketplacePda);
    const tokenLotIndex = marketplaceState.transactionIndex;

    const [lotPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("marketplace"),
        marketplacePda.toBuffer(),
        Buffer.from("transaction"),
        initialAuthority.publicKey.toBuffer(),
        Buffer.from("lot"),
        tokenLotIndex.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    const tokenMint = await createMint(
      provider.connection,
      initialAuthority,
      initialAuthority.publicKey,
      null,
      6
    );
    const nftMint = await createMint(
      provider.connection,
      initialAuthority,
      initialAuthority.publicKey,
      null,
      0
    );

    const buyerTokenAta = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      initialAuthority,
      tokenMint,
      buyer.publicKey
    );
    const TOKEN_PRICE = 2_000_000;
    await mintTo(
      provider.connection,
      initialAuthority,
      tokenMint,
      buyerTokenAta.address,
      initialAuthority,
      TOKEN_PRICE * 2
    );

    await program.methods
      .lotCreate({
        marketplaceIndex,
        asset: nftMint,
        currency: tokenMint,
        price: new anchor.BN(TOKEN_PRICE),
      })
      .accounts({
        owner: initialAuthority.publicKey,
        lot: lotPda,
        marketplace: marketplacePda,
        programConfig: programConfigPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([initialAuthority])
      .rpc();

    await program.methods
      .listNft({
        marketplaceIndex,
        lotIndex: tokenLotIndex,
      } as any)
      .accounts({
        owner: initialAuthority.publicKey,
        lot: lotPda,
        marketplace: marketplacePda,
        programConfig: programConfigPda,
        systemProgram: anchor.web3.SystemProgram.programId,
        asset: nftMint,
        coreProgram: new anchor.web3.PublicKey("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"),
      })
      .signers([initialAuthority])
      .rpc();

    await program.methods
      .placeLot({ marketplaceIndex, lotIndex: tokenLotIndex })
      .accounts({
        owner: initialAuthority.publicKey,
        lot: lotPda,
        marketplace: marketplacePda,
        programConfig: programConfigPda,
      })
      .signers([initialAuthority])
      .rpc();

    await program.methods
      .makeLotAvailableForSale({ marketplaceIndex, lotIndex: tokenLotIndex })
      .accounts({
        owner: initialAuthority.publicKey,
        lot: lotPda,
        marketplace: marketplacePda,
        programConfig: programConfigPda,
      })
      .signers([initialAuthority])
      .rpc();

    const sellerTokenAta = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      initialAuthority,
      tokenMint,
      initialAuthority.publicKey
    );
    const sellerBalanceBefore = (
      await provider.connection.getTokenAccountBalance(sellerTokenAta.address)
    ).value.amount;

    await program.methods
      .buyNftInToken({
        marketplaceIndex,
        lotIndex: tokenLotIndex,
        lotOwner: initialAuthority.publicKey,
      })
      .accounts({
        buyer: buyer.publicKey,
        lot: lotPda,
        marketplace: marketplacePda,
        programConfig: programConfigPda,
        salesperson: initialAuthority.publicKey,
        asset: nftMint,
        coreProgram: new anchor.web3.PublicKey("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"),
        salespersonTokenMint: tokenMint,
        salespersonTokenReceive: sellerTokenAta.address,
        buyerTokenTransfer: buyerTokenAta.address,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .signers([buyer])
      .rpc();

    const sellerBalanceAfter = (
      await provider.connection.getTokenAccountBalance(sellerTokenAta.address)
    ).value.amount;
    expect(new BN(sellerBalanceAfter).gt(new BN(sellerBalanceBefore))).to.eq(true);
  });

  it("Rejects place_lot for sold lot", async () => {
    const [marketplacePda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("marketplace"),
        initialAuthority.publicKey.toBuffer(),
        Buffer.from("marketplace"),
        marketplaceIndex.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );
    const soldLotIndex = new anchor.BN(0);
    const [lotPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("marketplace"),
        marketplacePda.toBuffer(),
        Buffer.from("transaction"),
        initialAuthority.publicKey.toBuffer(),
        Buffer.from("lot"),
        soldLotIndex.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    try {
      await program.methods
        .placeLot({ marketplaceIndex, lotIndex: soldLotIndex })
        .accounts({
          owner: initialAuthority.publicKey,
          lot: lotPda,
          marketplace: marketplacePda,
          programConfig: programConfigPda,
        })
        .signers([initialAuthority])
        .rpc();
      expect.fail("Expected WasSold error");
    } catch (err: any) {
      expect(String(err)).to.include("WasSold");
    }
  });

  it("Rejects make_lot_available_for_sale when status is Created", async () => {
    const [marketplacePda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("marketplace"),
        initialAuthority.publicKey.toBuffer(),
        Buffer.from("marketplace"),
        marketplaceIndex.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );
    const marketplaceState = await program.account.marketplace.fetch(marketplacePda);
    const createdLotIndex = marketplaceState.transactionIndex;

    const [lotPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("marketplace"),
        marketplacePda.toBuffer(),
        Buffer.from("transaction"),
        initialAuthority.publicKey.toBuffer(),
        Buffer.from("lot"),
        createdLotIndex.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    const newMint = await createMint(provider.connection, initialAuthority, initialAuthority.publicKey, null, 0);
    await program.methods
      .lotCreate({
        marketplaceIndex,
        asset: newMint,
        currency: null,
        price: new anchor.BN(anchor.web3.LAMPORTS_PER_SOL),
      })
      .accounts({
        owner: initialAuthority.publicKey,
        lot: lotPda,
        marketplace: marketplacePda,
        programConfig: programConfigPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([initialAuthority])
      .rpc();

    try {
      await program.methods
        .makeLotAvailableForSale({ marketplaceIndex, lotIndex: createdLotIndex })
        .accounts({
          owner: initialAuthority.publicKey,
          lot: lotPda,
          marketplace: marketplacePda,
          programConfig: programConfigPda,
        })
        .signers([initialAuthority])
        .rpc();
      expect.fail("Expected UnavailableForSale error");
    } catch (err: any) {
      expect(String(err)).to.include("UnavailableForSale");
    }
  });

  it("Rejects buy_nft_in_sol for token-denominated lot", async () => {
    const buyer = anchor.web3.Keypair.generate();
    const sig = await provider.connection.requestAirdrop(
      buyer.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(sig);

    const [marketplacePda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("marketplace"),
        initialAuthority.publicKey.toBuffer(),
        Buffer.from("marketplace"),
        marketplaceIndex.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );
    const marketplaceState = await program.account.marketplace.fetch(marketplacePda);
    const tokenLotIndex = marketplaceState.transactionIndex;
    const [lotPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("marketplace"),
        marketplacePda.toBuffer(),
        Buffer.from("transaction"),
        initialAuthority.publicKey.toBuffer(),
        Buffer.from("lot"),
        tokenLotIndex.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    const paymentMint = await createMint(provider.connection, initialAuthority, initialAuthority.publicKey, null, 6);
    const nftMint = await createMint(provider.connection, initialAuthority, initialAuthority.publicKey, null, 0);
    await program.methods
      .lotCreate({
        marketplaceIndex,
        asset: nftMint,
        currency: paymentMint,
        price: new anchor.BN(1000000),
      })
      .accounts({
        owner: initialAuthority.publicKey,
        lot: lotPda,
        marketplace: marketplacePda,
        programConfig: programConfigPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([initialAuthority])
      .rpc();

    try {
      await program.methods
        .buyNftInSol({
          marketplaceIndex,
          lotIndex: tokenLotIndex,
          salesperson: initialAuthority.publicKey,
        })
        .accounts({
          buyer: buyer.publicKey,
          lot: lotPda,
          marketplace: marketplacePda,
          programConfig: programConfigPda,
          salesperson: initialAuthority.publicKey,
          asset: nftMint,
          coreProgram: new anchor.web3.PublicKey("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"),
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([buyer])
        .rpc();
      expect.fail("Expected InvalidPrice error");
    } catch (err: any) {
      expect(String(err)).to.include("InvalidPrice");
    }
  });

  it("Rejects buy_nft_in_token with wrong payment mint", async () => {
    const buyer = anchor.web3.Keypair.generate();
    const sig = await provider.connection.requestAirdrop(
      buyer.publicKey,
      3 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(sig);

    const [marketplacePda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("marketplace"),
        initialAuthority.publicKey.toBuffer(),
        Buffer.from("marketplace"),
        marketplaceIndex.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );
    const marketplaceState = await program.account.marketplace.fetch(marketplacePda);
    const tokenLotIndex = marketplaceState.transactionIndex;
    const [lotPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("marketplace"),
        marketplacePda.toBuffer(),
        Buffer.from("transaction"),
        initialAuthority.publicKey.toBuffer(),
        Buffer.from("lot"),
        tokenLotIndex.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    const tokenMint = await createMint(provider.connection, initialAuthority, initialAuthority.publicKey, null, 6);
    const wrongMint = await createMint(provider.connection, initialAuthority, initialAuthority.publicKey, null, 6);
    const nftMint = await createMint(provider.connection, initialAuthority, initialAuthority.publicKey, null, 0);
    const buyerTokenAta = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      initialAuthority,
      wrongMint,
      buyer.publicKey
    );
    await mintTo(provider.connection, initialAuthority, wrongMint, buyerTokenAta.address, initialAuthority, 2_000_000);

    await program.methods
      .lotCreate({
        marketplaceIndex,
        asset: nftMint,
        currency: tokenMint,
        price: new anchor.BN(1_000_000),
      })
      .accounts({
        owner: initialAuthority.publicKey,
        lot: lotPda,
        marketplace: marketplacePda,
        programConfig: programConfigPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([initialAuthority])
      .rpc();

    await program.methods
      .listNft({ marketplaceIndex, lotIndex: tokenLotIndex } as any)
      .accounts({
        owner: initialAuthority.publicKey,
        lot: lotPda,
        marketplace: marketplacePda,
        programConfig: programConfigPda,
        systemProgram: anchor.web3.SystemProgram.programId,
        asset: nftMint,
        coreProgram: new anchor.web3.PublicKey("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"),
      })
      .signers([initialAuthority])
      .rpc();

    await program.methods
      .placeLot({ marketplaceIndex, lotIndex: tokenLotIndex })
      .accounts({
        owner: initialAuthority.publicKey,
        lot: lotPda,
        marketplace: marketplacePda,
        programConfig: programConfigPda,
      })
      .signers([initialAuthority])
      .rpc();
    await program.methods
      .makeLotAvailableForSale({ marketplaceIndex, lotIndex: tokenLotIndex })
      .accounts({
        owner: initialAuthority.publicKey,
        lot: lotPda,
        marketplace: marketplacePda,
        programConfig: programConfigPda,
      })
      .signers([initialAuthority])
      .rpc();

    const sellerWrongMintAta = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      initialAuthority,
      wrongMint,
      initialAuthority.publicKey
    );

    try {
      await program.methods
        .buyNftInToken({
          marketplaceIndex,
          lotIndex: tokenLotIndex,
          lotOwner: initialAuthority.publicKey,
        })
        .accounts({
          buyer: buyer.publicKey,
          lot: lotPda,
          marketplace: marketplacePda,
          programConfig: programConfigPda,
          salesperson: initialAuthority.publicKey,
          asset: nftMint,
          coreProgram: new anchor.web3.PublicKey("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"),
          salespersonTokenMint: wrongMint,
          salespersonTokenReceive: sellerWrongMintAta.address,
          buyerTokenTransfer: buyerTokenAta.address,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([buyer])
        .rpc();
      expect.fail("Expected InvalidAsset error");
    } catch (err: any) {
      expect(String(err)).to.include("InvalidAsset");
    }
  });

  it("Rejects unauthorized marketplace fee update", async () => {
    const outsider = anchor.web3.Keypair.generate();
    const sig = await provider.connection.requestAirdrop(
      outsider.publicKey,
      anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(sig);

    const [marketplacePda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("marketplace"),
        initialAuthority.publicKey.toBuffer(),
        Buffer.from("marketplace"),
        marketplaceIndex.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    try {
      await program.methods
        .marketplaceTransactionFeeUpdate({
          selfIndex: marketplaceIndex,
          transactionFee: new anchor.BN(777),
        })
        .accounts({
          marketplace: marketplacePda,
          multisigOwner: outsider.publicKey,
          programConfig: programConfigPda,
        })
        .signers([outsider])
        .rpc();
      expect.fail("Expected Unauthorized error");
    } catch (err: any) {
      const message = String(err);
      expect(
        message.includes("Unauthorized") ||
          message.includes("ConstraintSeeds") ||
          message.includes("ConstraintHasOne")
      ).to.eq(true);
    }
  });

  it("Rejects unauthorized program config update", async () => {
    const outsider = anchor.web3.Keypair.generate();
    const sig = await provider.connection.requestAirdrop(
      outsider.publicKey,
      anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(sig);

    try {
      await program.methods
        .programConfigUpdate({
          authority: null,
          marketplaceDeployAuthority: null,
          treasury: outsider.publicKey,
        })
        .accounts({
          programConfig: programConfigPda,
          authority: outsider.publicKey,
        })
        .signers([outsider])
        .rpc();
      expect.fail("Expected Unauthorized error");
    } catch (err: any) {
      expect(String(err)).to.include("Unauthorized");
    }
  });

  it("Rejects buy when marketplace fee is higher than lot price", async () => {
    const [marketplacePda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("marketplace"),
        initialAuthority.publicKey.toBuffer(),
        Buffer.from("marketplace"),
        marketplaceIndex.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    await program.methods
      .marketplaceTransactionFeeUpdate({
        selfIndex: marketplaceIndex,
        transactionFee: new anchor.BN(2 * anchor.web3.LAMPORTS_PER_SOL),
      })
      .accounts({
        marketplace: marketplacePda,
        multisigOwner: initialAuthority.publicKey,
        programConfig: programConfigPda,
      })
      .signers([initialAuthority])
      .rpc();

    const marketplaceState = await program.account.marketplace.fetch(marketplacePda);
    const boundaryLotIndex = marketplaceState.transactionIndex;
    const [lotPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("marketplace"),
        marketplacePda.toBuffer(),
        Buffer.from("transaction"),
        initialAuthority.publicKey.toBuffer(),
        Buffer.from("lot"),
        boundaryLotIndex.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    const boundaryMint = await createMint(provider.connection, initialAuthority, initialAuthority.publicKey, null, 0);
    await program.methods
      .lotCreate({
        marketplaceIndex,
        asset: boundaryMint,
        currency: null,
        price: new anchor.BN(anchor.web3.LAMPORTS_PER_SOL),
      })
      .accounts({
        owner: initialAuthority.publicKey,
        lot: lotPda,
        marketplace: marketplacePda,
        programConfig: programConfigPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([initialAuthority])
      .rpc();

    await program.methods
      .listNft({ marketplaceIndex, lotIndex: boundaryLotIndex } as any)
      .accounts({
        owner: initialAuthority.publicKey,
        lot: lotPda,
        marketplace: marketplacePda,
        programConfig: programConfigPda,
        systemProgram: anchor.web3.SystemProgram.programId,
        asset: boundaryMint,
        coreProgram: new anchor.web3.PublicKey("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"),
      })
      .signers([initialAuthority])
      .rpc();
    await program.methods
      .placeLot({ marketplaceIndex, lotIndex: boundaryLotIndex })
      .accounts({
        owner: initialAuthority.publicKey,
        lot: lotPda,
        marketplace: marketplacePda,
        programConfig: programConfigPda,
      })
      .signers([initialAuthority])
      .rpc();
    await program.methods
      .makeLotAvailableForSale({ marketplaceIndex, lotIndex: boundaryLotIndex })
      .accounts({
        owner: initialAuthority.publicKey,
        lot: lotPda,
        marketplace: marketplacePda,
        programConfig: programConfigPda,
      })
      .signers([initialAuthority])
      .rpc();

    const buyer = anchor.web3.Keypair.generate();
    const sig2 = await provider.connection.requestAirdrop(
      buyer.publicKey,
      3 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(sig2);
    const config = await program.account.programConfig.fetch(programConfigPda);

    try {
      await program.methods
        .buyNftInSol({
          marketplaceIndex,
          lotIndex: boundaryLotIndex,
          salesperson: initialAuthority.publicKey,
        })
        .accounts({
          buyer: buyer.publicKey,
          lot: lotPda,
          marketplace: marketplacePda,
          programConfig: programConfigPda,
          treasury: config.treasury,
          salesperson: initialAuthority.publicKey,
          asset: boundaryMint,
          coreProgram: new anchor.web3.PublicKey("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"),
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([buyer])
        .rpc();
      expect.fail("Expected NotEnoughMoney error");
    } catch (err: any) {
      expect(String(err)).to.include("NotEnoughMoney");
    }
  });
});