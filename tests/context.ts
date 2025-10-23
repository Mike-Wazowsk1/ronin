import { startAnchor } from "solana-bankrun";
import { PublicKey, SystemProgram } from "@solana/web3.js";

export const RONIN_NFT_BRIDGE_PROGRAM_ID = new PublicKey(
  "ApfDneee1WoxEEDK2vTxgUeD7FNwmg1Xw6Hn7eBHMwcS"
);

export const ENDPOINT_PROGRAM_ID = new PublicKey(
  "76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6"
);

export const MESSAGELIB_PROGRAM_ID = new PublicKey(
  "6GsmxMTHAAiFKfemuM4zBjumTjNSX5CAiw4xSSXM2Toy"
);

export const contextPromise = startAnchor(
  ".",
  [
    {
      name: "ronin_nft_bridge",
      programId: RONIN_NFT_BRIDGE_PROGRAM_ID,
    },
    {
      name: "endpoint_mock_bridge",
      programId: ENDPOINT_PROGRAM_ID,
    },
    {
      name: "simple_messagelib",
      programId: MESSAGELIB_PROGRAM_ID,
    },
  ],
  [
    // Pre-fund test accounts
    {
      address: new PublicKey("9eMjv1ZD7q1Kz1B1zQiC2sbKAxbnBdgouksreWisw3Te"),
      info: {
        data: new Uint8Array([]),
        owner: SystemProgram.programId,
        executable: false,
        lamports: 100_000_000_000, // 100 SOL
      },
    },
    {
      address: new PublicKey("4GF8vAApT9jEvMCz3JtXTjLfvqLeMieL9yoCSz5XxrMN"),
      info: {
        data: new Uint8Array([]),
        owner: SystemProgram.programId,
        executable: false,
        lamports: 100_000_000_000, // 100 SOL
      },
    },
  ]
);
