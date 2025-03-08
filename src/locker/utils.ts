import { AnchorProvider, Program, Wallet, web3 } from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Connection, PublicKey, SystemProgram, TransactionInstruction } from "@solana/web3.js";

import { IDL } from "./idl";
import { LockerType } from "./types";

export function createLockerProgram(wallet: Wallet, connection: Connection): Program<LockerType> {
  const provider = new AnchorProvider(connection, wallet as any, {
    maxRetries: 3,
  });
  const program = new Program<LockerType>(IDL, provider);
  return program;
}

export const getCurrentBlockTime = async (connection: web3.Connection) => {
  const currentSlot = await connection.getSlot();
  const currentBlockTime = await connection.getBlockTime(currentSlot);
  return currentBlockTime;
};

export function deriveEscrow(base: web3.PublicKey, programId: web3.PublicKey) {
  return web3.PublicKey.findProgramAddressSync([Buffer.from("escrow"), base.toBuffer()], programId);
}

export async function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

export function deriveEscrowMetadata(escrow: web3.PublicKey, programId: web3.PublicKey) {
  return web3.PublicKey.findProgramAddressSync([Buffer.from("escrow_metadata"), escrow.toBuffer()], programId);
}

export const wrapSOLInstruction = (from: PublicKey, to: PublicKey, amount: bigint): TransactionInstruction[] => {
  return [
    SystemProgram.transfer({
      fromPubkey: from,
      toPubkey: to,
      lamports: amount,
    }),
    new TransactionInstruction({
      keys: [
        {
          pubkey: to,
          isSigner: false,
          isWritable: true,
        },
      ],
      data: Buffer.from(new Uint8Array([17])),
      programId: TOKEN_PROGRAM_ID,
    }),
  ];
};
