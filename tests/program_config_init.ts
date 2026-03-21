import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { NftMarketplace } from "../target/types/nft_marketplace";
import { expect } from "chai";

describe("program_config_init", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.NftMarketplace as Program<NftMarketplace>;

  const [programConfigPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("marketplace"), Buffer.from("program_config")],
    program.programId
  );

  it("Initializes the program config", async () => {
    const authority = anchor.web3.Keypair.generate().publicKey;
    const marketplaceDeployAuthority = anchor.web3.Keypair.generate().publicKey;
    const treasury = anchor.web3.Keypair.generate().publicKey;

    const args = {
      authority,
      marketplaceDeployAuthority,
      treasury,
    };

    try {
      await program.methods
        .programConfigInit(args)
        .accounts({
          programConfig: programConfigPda,
          initializer: provider.wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
    } catch (err) {
      console.error(err);
      throw err;
    }

    const programConfigAccount = await program.account.programConfig.fetch(programConfigPda);

    expect(programConfigAccount.authority.toBase58()).to.equal(authority.toBase58());
    expect(programConfigAccount.marketplaceDeployAuthority.toBase58()).to.equal(marketplaceDeployAuthority.toBase58());
    expect(programConfigAccount.treasury.toBase58()).to.equal(treasury.toBase58());
  });
});
