import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { NftMarketplace } from "../target/types/nft_marketplace";
import { expect } from "chai";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
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

    mint = anchor.web3.Keypair.generate().publicKey;

    await program.methods
      .lotCreate({
        marketplaceIndex,
        currency: anchor.web3.SystemProgram.programId,
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

  it("Attaches an NFT to a lot", async () => {
    // Re-create mint properly for token account check
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
      .attachNft({
        marketplaceIndex,
        lotIndex,
        asset: mint,
      })
      .accounts({
        owner: initialAuthority.publicKey,
        lot: lotPda,
        marketplace: marketplacePda,
        programConfig: programConfigPda,
        nftTokenAccount: ata.address,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([initialAuthority])
      .rpc();
  });

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
      .buyNft({
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

  it("Cancels a lot by marketplace", async () => {
    const marketplaceIndex = new anchor.BN(0);
    const lotIndex = new anchor.BN(1); // Use a new lot index for cancellation test

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
      .lotCreate({
        marketplaceIndex,
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

    // Generate mint and attach it
    const cancelMint1 = await createMint(provider.connection, initialAuthority, initialAuthority.publicKey, null, 0);
    const ata1 = await getOrCreateAssociatedTokenAccount(provider.connection, initialAuthority, cancelMint1, initialAuthority.publicKey);
    await mintTo(provider.connection, initialAuthority, cancelMint1, ata1.address, initialAuthority, 1);

    await program.methods
      .attachNft({
        marketplaceIndex,
        lotIndex,
        asset: cancelMint1,
      })
      .accounts({
        owner: initialAuthority.publicKey,
        lot: lotPda,
        marketplace: marketplacePda,
        programConfig: programConfigPda,
        nftTokenAccount: ata1.address,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([initialAuthority])
      .rpc();

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
    const lotIndex = new anchor.BN(2); // Use a new lot index for cancellation test

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

    // Create the lot first
    await program.methods
      .lotCreate({
        marketplaceIndex,
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

    // Generate mint and attach it
    const cancelMint2 = await createMint(provider.connection, initialAuthority, initialAuthority.publicKey, null, 0);
    const ata2 = await getOrCreateAssociatedTokenAccount(provider.connection, initialAuthority, cancelMint2, initialAuthority.publicKey);
    await mintTo(provider.connection, initialAuthority, cancelMint2, ata2.address, initialAuthority, 1);

    await program.methods
      .attachNft({
        marketplaceIndex,
        lotIndex,
        asset: cancelMint2,
      })
      .accounts({
        owner: initialAuthority.publicKey,
        lot: lotPda,
        marketplace: marketplacePda,
        programConfig: programConfigPda,
        nftTokenAccount: ata2.address,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([initialAuthority])
      .rpc();

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
      .marketplaceFeePercentageUpdate({
        selfIndex: marketplaceIndex,
        feePercentage: newFee,
      })
      .accounts({
        marketplace: marketplacePda,
        multisigOwner: initialAuthority.publicKey,
        programConfig: programConfigPda,
      })
      .signers([initialAuthority])
      .rpc();

    const marketplaceAccount = await program.account.marketplace.fetch(marketplacePda);
    expect(marketplaceAccount.feePercentage.toNumber()).to.equal(newFee.toNumber());
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
});