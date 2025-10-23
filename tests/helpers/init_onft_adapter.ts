import { publicKey, PublicKey as UmiPublicKey, Umi } from "@metaplex-foundation/umi";
import { instructions, myoapp } from "../../lib/client";
import { PublicKey, SystemProgram } from "@solana/web3.js";

type RoninNftBridge = myoapp.RoninNftBridge;

const ONFT_SEED = Buffer.from("ONFT");

export async function initOnftAdapter(
  umi: Umi,
  client: RoninNftBridge,
  tokenMint: UmiPublicKey
) {
  const [storePda] = client.pda.oapp();
  const [onftPda] = PublicKey.findProgramAddressSync(
    [ONFT_SEED],
    PublicKey.from(client.programId)
  );

  const builder = instructions.initOnftAdapter(
    { payer: umi.identity, programs: client.programRepo },
    {
      store: storePda,
      mint: tokenMint,
      tokenMint: tokenMint,
      onftConfig: publicKey(onftPda),
      associatedTokenProgram: publicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'),
      tokenProgram: publicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
      systemProgram: publicKey(SystemProgram.programId),
    }
  );

  const tx = await builder.sendAndConfirm(umi);
  return { onftConfigPDA: publicKey(onftPda), signature: tx.signature };
}

export function getOnftConfigPDA(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([ONFT_SEED], programId);
}