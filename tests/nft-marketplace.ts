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

  before(async () => {
    // Airdrop SOL to initialAuthority to pay for marketplace creation
    const signature = await provider.connection.requestAirdrop(
      initialAuthority.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(signature);
  });

  it("Initializes the program config", async () => {
    await program.methods
      .programConfigInit({
        authority: initialAuthority.publicKey,
        marketplaceDeployAuthority: initialAuthority.publicKey, // Use initialAuthority as deployer for tests
        treasury: initialTreasury,
      })
      .accounts({
        programConfig: programConfigPda,
        initializer: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const programConfigAccount = await program.account.programConfig.fetch(programConfigPda);
    expect(programConfigAccount.authority.toBase58()).to.equal(initialAuthority.publicKey.toBase58());
    expect(programConfigAccount.marketplaceDeployAuthority.toBase58()).to.equal(initialAuthority.publicKey.toBase58());
  });

  it("Creates a marketplace", async () => {
    const creatorKey = anchor.web3.Keypair.generate().publicKey;
    const feePercentage = new anchor.BN(500); // 5%

    const programConfigAccountBefore = await program.account.programConfig.fetch(programConfigPda);
    const transactionIndex = programConfigAccountBefore.transactionIndex;

    const [marketplacePda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("marketplace"),
        programConfigAccountBefore.marketplaceDeployAuthority.toBuffer(),
        Buffer.from("marketplace"),
        transactionIndex.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    await program.methods
      .marketplaceCreate({
        creatorKey: creatorKey,
        feePercentage: feePercentage,
      })
      .accounts({
        owner: initialAuthority.publicKey,
        marketplace: marketplacePda,
        programConfig: programConfigPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([initialAuthority])
      .rpc();

    const marketplaceAccount = await program.account.marketplace.fetch(marketplacePda);
    expect(marketplaceAccount.multisigOwner.toBase58()).to.equal(initialAuthority.publicKey.toBase58());
    expect(marketplaceAccount.creatorKey.toBase58()).to.equal(creatorKey.toBase58());
    expect(marketplaceAccount.feePercentage.toNumber()).to.equal(feePercentage.toNumber());
    expect(marketplaceAccount.transactionIndex.toNumber()).to.equal(0);

    const programConfigAccountAfter = await program.account.programConfig.fetch(programConfigPda);
    expect(programConfigAccountAfter.transactionIndex.toNumber()).to.equal(transactionIndex.toNumber() + 1);
  });

  it("Creates a lot", async () => {
    const mint = anchor.web3.Keypair.generate().publicKey;
    const currency = anchor.web3.Keypair.generate().publicKey;
    const price = new anchor.BN(1000000); // 0.001 SOL (if currency is SOL)

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

    const marketplaceAccountBefore = await program.account.marketplace.fetch(marketplacePda);
    const lotTransactionIndex = marketplaceAccountBefore.transactionIndex;

    const [lotPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("marketplace"),
        marketplacePda.toBuffer(),
        Buffer.from("transaction"),
        initialAuthority.publicKey.toBuffer(),
        Buffer.from("lot"),
        lotTransactionIndex.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    await program.methods
      .lotCreate({
        marketplaceIndex: marketplaceIndex,
        asset: mint,
        currency: currency,
        price: price,
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

    const lotAccount = await program.account.lot.fetch(lotPda);
    expect(lotAccount.marketplace.toBase58()).to.equal(marketplacePda.toBase58());
    expect(lotAccount.owner.toBase58()).to.equal(initialAuthority.publicKey.toBase58());
    expect(lotAccount.asset.toBase58()).to.equal(mint.toBase58());
    expect(lotAccount.currency.toBase58()).to.equal(currency.toBase58());
    expect(lotAccount.price.toNumber()).to.equal(price.toNumber());

    const marketplaceAccountAfter = await program.account.marketplace.fetch(marketplacePda);
    expect(marketplaceAccountAfter.transactionIndex.toNumber()).to.equal(lotTransactionIndex.toNumber() + 1);
  });

  it("Attaches an NFT to a lot", async () => {
    const marketplaceIndex = new anchor.BN(0);
    const lotIndex = new anchor.BN(0);

    const programConfigAccount = await program.account.programConfig.fetch(programConfigPda);

    const [marketplacePda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("marketplace"),
        programConfigAccount.marketplaceDeployAuthority.toBuffer(),
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

    // Create a mint
    const mint = await createMint(
      provider.connection,
      initialAuthority,
      initialAuthority.publicKey,
      null,
      0 // 0 decimals for NFT
    );

    // Create associated token account for initialAuthority
    const ata = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      initialAuthority,
      mint,
      initialAuthority.publicKey
    );

    // Mint 1 token to the ATA
    await mintTo(
      provider.connection,
      initialAuthority,
      mint,
      ata.address,
      initialAuthority,
      1
    );

    await program.methods
      .attachNft({
        marketplaceIndex: marketplaceIndex,
        lotIndex: lotIndex,
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

    const lotAccount = await program.account.lot.fetch(lotPda);
    expect(lotAccount.asset.toBase58()).to.equal(mint.toBase58());
  });
  // list_nft and buy_nft require the Metaplex Core program to be present in the environment for the CPIs to succeed.
  // it("Lists an NFT", async () => {
  //   const marketplaceIndex = new anchor.BN(0);
  //   const salesperson = anchor.web3.Keypair.generate().publicKey;
  //   const asset = anchor.web3.Keypair.generate(); // Mock asset
  //   const currency = anchor.web3.Keypair.generate().publicKey;
  //   const price = new anchor.BN(1000000);

  //   const programConfigAccount = await program.account.programConfig.fetch(programConfigPda);

  //   const [marketplacePda] = anchor.web3.PublicKey.findProgramAddressSync(
  //     [
  //       Buffer.from("marketplace"),
  //       programConfigAccount.marketplaceDeployAuthority.toBuffer(),
  //       Buffer.from("marketplace"),
  //       marketplaceIndex.toArrayLike(Buffer, "le", 8),
  //     ],
  //     program.programId
  //   );

  //   const marketplaceAccount = await program.account.marketplace.fetch(marketplacePda);
  //   const lotIndex = marketplaceAccount.transactionIndex;

  //   const [lotPda] = anchor.web3.PublicKey.findProgramAddressSync(
  //     [
  //       Buffer.from("marketplace"),
  //       marketplacePda.toBuffer(),
  //       Buffer.from("transaction"),
  //       initialAuthority.publicKey.toBuffer(),
  //       Buffer.from("lot"),
  //       lotIndex.toArrayLike(Buffer, "le", 8),
  //     ],
  //     program.programId
  //   );

  //   // Create the lot first
  //   await program.methods
  //     .lotCreate({
  //       marketplaceIndex: marketplaceIndex,
  //       asset: asset.publicKey,
  //       currency: currency,
  //       price: price,
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

  //   // Now list the NFT
  //   await program.methods
  //     .listNft({
  //       marketplaceIndex: marketplaceIndex,
  //       lotIndex: lotIndex,
  //       salesperson: salesperson,
  //     })
  //     .accounts({
  //       owner: initialAuthority.publicKey,
  //       lot: lotPda,
  //       marketplace: marketplacePda,
  //       programConfig: programConfigPda,
  //       systemProgram: anchor.web3.SystemProgram.programId,
  //       asset: asset.publicKey,
  //       coreProgram: new anchor.web3.PublicKey("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"),
  //     })
  //     .signers([initialAuthority])
  //     .rpc();

  //   const lotAccount = await program.account.lot.fetch(lotPda);
  //   expect(lotAccount.isListed).to.be.true;
  // });

  it("Places a lot", async () => {
    const marketplaceIndex = new anchor.BN(0);
    const lotIndex = new anchor.BN(0); // The lot created in the previous test had index 0

    const programConfigAccount = await program.account.programConfig.fetch(programConfigPda);

    const [marketplacePda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("marketplace"),
        programConfigAccount.marketplaceDeployAuthority.toBuffer(),
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
      .placeLot({
        marketplaceIndex: marketplaceIndex,
        lotIndex: lotIndex,
      })
      .accounts({
        owner: initialAuthority.publicKey,
        lot: lotPda,
        marketplace: marketplacePda,
        programConfig: programConfigPda,
      })
      .signers([initialAuthority])
      .rpc();

    const lotAccount = await program.account.lot.fetch(lotPda);
    expect(lotAccount.status).to.have.property("placed");
  });

  it("Makes a lot available for sale", async () => {
    const marketplaceIndex = new anchor.BN(0);
    const lotIndex = new anchor.BN(0);

    const programConfigAccount = await program.account.programConfig.fetch(programConfigPda);

    const [marketplacePda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("marketplace"),
        programConfigAccount.marketplaceDeployAuthority.toBuffer(),
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
      .makeLotAvailableForSale({
        marketplaceIndex: marketplaceIndex,
        lotIndex: lotIndex,
      })
      .accounts({
        owner: initialAuthority.publicKey,
        lot: lotPda,
        marketplace: marketplacePda,
        programConfig: programConfigPda,
      })
      .signers([initialAuthority])
      .rpc();

    const lotAccount = await program.account.lot.fetch(lotPda);
    expect(lotAccount.status).to.have.property("availableForSale");
  });
  //  list_nft and buy_nft require the Metaplex Core program to be present in the environment for the CPIs to succeed.
  // it("Buys an NFT", async () => {
  //   const marketplaceIndex = new anchor.BN(0);
  //   const salesperson = initialAuthority;
  //   const lotIndex = new anchor.BN(0);
  //   const buyer = anchor.web3.Keypair.generate();

  //   // Airdrop SOL to buyer
  //   const signature = await provider.connection.requestAirdrop(
  //     buyer.publicKey,
  //     2 * anchor.web3.LAMPORTS_PER_SOL
  //   );
  //   await provider.connection.confirmTransaction(signature);

  //   const programConfigAccount = await program.account.programConfig.fetch(programConfigPda);

  //   const [marketplacePda] = anchor.web3.PublicKey.findProgramAddressSync(
  //     [
  //       Buffer.from("marketplace"),
  //       programConfigAccount.marketplaceDeployAuthority.toBuffer(),
  //       Buffer.from("marketplace"),
  //       marketplaceIndex.toArrayLike(Buffer, "le", 8),
  //     ],
  //     program.programId
  //   );

  //   const [lotPda] = anchor.web3.PublicKey.findProgramAddressSync(
  //     [
  //       Buffer.from("marketplace"),
  //       marketplacePda.toBuffer(),
  //       Buffer.from("transaction"),
  //       salesperson.publicKey.toBuffer(),
  //       Buffer.from("lot"),
  //       lotIndex.toArrayLike(Buffer, "le", 8),
  //     ],
  //     program.programId
  //   );

  //   const lotAccountBefore = await program.account.lot.fetch(lotPda);

  //   await program.methods
  //     .buyNft({
  //       marketplaceIndex: marketplaceIndex,
  //       lotIndex: lotIndex,
  //       salesperson: salesperson.publicKey,
  //     })
  //     .accounts({
  //       buyer: buyer.publicKey,
  //       lot: lotPda,
  //       marketplace: marketplacePda,
  //       programConfig: programConfigPda,
  //       asset: lotAccountBefore.asset,
  //       coreProgram: new anchor.web3.PublicKey("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"),
  //       systemProgram: anchor.web3.SystemProgram.programId,
  //     })
  //     .signers([buyer])
  //     .rpc();

  //   const lotAccountAfter = await program.account.lot.fetch(lotPda);
  //   expect(lotAccountAfter.status).to.have.property("sold");
  // });

  it("Updates marketplace fee percentage", async () => {
    const newFee = new anchor.BN(1000); // 10%
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

  it("Updates only the marketplace deploy authority", async () => {
    const newMarketplaceDeployAuthority = anchor.web3.Keypair.generate().publicKey;

    await program.methods
      .programConfigUpdate({
        authority: null,
        marketplaceDeployAuthority: newMarketplaceDeployAuthority,
        treasury: null,
      })
      .accounts({
        programConfig: programConfigPda,
        authority: initialAuthority.publicKey,
      })
      .signers([initialAuthority])
      .rpc();

    const programConfigAccount = await program.account.programConfig.fetch(programConfigPda);
    expect(programConfigAccount.marketplaceDeployAuthority.toBase58()).to.equal(newMarketplaceDeployAuthority.toBase58());
    expect(programConfigAccount.authority.toBase58()).to.equal(initialAuthority.publicKey.toBase58());
    expect(programConfigAccount.treasury.toBase58()).to.equal(initialTreasury.toBase58());
  });

  it("Updates treasury", async () => {
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

    const programConfigAccount = await program.account.programConfig.fetch(programConfigPda);
    expect(programConfigAccount.treasury.toBase58()).to.equal(newTreasury.toBase58());
  });

  it("Fails when updated by non-authority", async () => {
    const maliciousActor = anchor.web3.Keypair.generate();

    try {
      await program.methods
        .programConfigUpdate({
          authority: null,
          marketplaceDeployAuthority: null,
          treasury: null,
        })
        .accounts({
          programConfig: programConfigPda,
          authority: maliciousActor.publicKey,
        })
        .signers([maliciousActor])
        .rpc();
      expect.fail("Should have failed with CustomError::Unauthorized");
    } catch (err: any) {
      expect(err.error.errorCode.code).to.equal("Unauthorized");
    }
  });

  it("Updates everything at once including authority", async () => {
    const newAuthority = anchor.web3.Keypair.generate();
    const newMarketplaceDeployAuthority = anchor.web3.Keypair.generate().publicKey;
    const newTreasury = anchor.web3.Keypair.generate().publicKey;

    await program.methods
      .programConfigUpdate({
        authority: newAuthority.publicKey,
        marketplaceDeployAuthority: newMarketplaceDeployAuthority,
        treasury: newTreasury,
      })
      .accounts({
        programConfig: programConfigPda,
        authority: initialAuthority.publicKey,
      })
      .signers([initialAuthority])
      .rpc();

    const programConfigAccount = await program.account.programConfig.fetch(programConfigPda);
    expect(programConfigAccount.authority.toBase58()).to.equal(newAuthority.publicKey.toBase58());
  });

});