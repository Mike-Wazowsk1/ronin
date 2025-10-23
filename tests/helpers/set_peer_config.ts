import { PublicKey as UmiPublicKey, Umi, transactionBuilder } from "@metaplex-foundation/umi";
import { myoapp } from "../../lib/client";
import { PublicKey } from "@solana/web3.js";

type RoninNftBridge = myoapp.RoninNftBridge;

const PEER_SEED = Buffer.from("Peer");

export async function setPeerAddress(
  umi: Umi,
  client: RoninNftBridge,
  remoteEid: number,
  peerHex: string
) {
  // Convert hex string to bytes32
  const hex = peerHex.replace(/^0x/, '');
  if (hex.length !== 64) throw new Error('peer must be bytes32 (64 hex chars)');
  const peerBytes = Uint8Array.from(Buffer.from(hex, 'hex'));

  const ix = client.setPeerConfig(
    { admin: umi.identity },
    { __kind: 'PeerAddress', peer: peerBytes, remote: remoteEid }
  );

  const tx = await transactionBuilder().add(ix).sendAndConfirm(umi);
  return { signature: tx.signature };
}

export function getPeerPDA(
  programId: PublicKey,
  storeKey: PublicKey,
  remoteEid: number
): [PublicKey, number] {
  const eidBuffer = Buffer.alloc(4);
  eidBuffer.writeUInt32BE(remoteEid, 0);
  
  return PublicKey.findProgramAddressSync(
    [PEER_SEED, storeKey.toBuffer(), eidBuffer],
    programId
  );
}