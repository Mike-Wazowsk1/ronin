import { publicKey, Signer, Umi, PublicKey as UmiPublicKey } from "@metaplex-foundation/umi";
import { instructions, myoapp } from "../../lib/client";
import { PublicKey } from "@solana/web3.js";

type RoninNftBridge = myoapp.RoninNftBridge;

const STORE_SEED = Buffer.from("Store");
const LZ_RECEIVE_TYPES_SEED = Buffer.from("LzReceiveTypes");

export async function initStore(
  umi: Umi,
  client: RoninNftBridge,
  admin: UmiPublicKey,
  endpointProgram: UmiPublicKey
) {
  const [storePDA] = client.pda.oapp();
  const [lzReceiveTypesAccountsPDA] = PublicKey.findProgramAddressSync(
    [LZ_RECEIVE_TYPES_SEED, PublicKey.from(storePDA).toBuffer()],
    PublicKey.from(client.programId)
  );

  const builder = instructions.initStore(
    { payer: umi.identity, programs: client.programRepo },
    {
      store: storePDA,
      lzReceiveTypesAccounts: publicKey(lzReceiveTypesAccountsPDA),
      admin,
      endpoint: endpointProgram,
    }
  );

  const tx = await builder.sendAndConfirm(umi);
  return { storePDA, lzReceiveTypesAccountsPDA: publicKey(lzReceiveTypesAccountsPDA), signature: tx.signature };
}

export function getStorePDA(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([STORE_SEED], programId);
}
