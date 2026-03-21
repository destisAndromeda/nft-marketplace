import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { NftMarketplace } from "../target/types/nft_marketplace";
import { expect } from "chai";

describe("nft-marketplace", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.NftMarketplace as Program<NftMarketplace>;

  const [programConfigPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("marketplace"), Buffer.from("program_config")],
    program.programId
  );

  const initialAuthority = anchor.web3.Keypair.generate();
  const initialMarketplaceDeployAuthority = anchor.web3.Keypair.generate().publicKey;
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
    const marketplaceIndex = programConfigAccountBefore.marketplaceIndex;

    const [marketplacePda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("marketplace"),
        programConfigAccountBefore.marketplaceDeployAuthority.toBuffer(),
        Buffer.from("marketplace"),
        marketplaceIndex.toArrayLike(Buffer, "le", 8),
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
    expect(marketplaceAccount.lotIndex.toNumber()).to.equal(0);

    const programConfigAccountAfter = await program.account.programConfig.fetch(programConfigPda);
    expect(programConfigAccountAfter.marketplaceIndex.toNumber()).to.equal(marketplaceIndex.toNumber() + 1);
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