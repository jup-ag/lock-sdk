import { AnchorProvider, IdlAccounts, Program, ProgramAccount, Wallet as AnchorWallet, web3 } from "@coral-xyz/anchor";
import { ASSOCIATED_TOKEN_PROGRAM_ID, NATIVE_MINT, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token-0.4";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import BN from "bn.js";

import { getOrCreateATAInstruction } from "../utils/anchor";
import { p } from "../utils/p-flat";

import { LockerType as LockerType } from "./types";
import { createLockerProgram, deriveEscrow, deriveEscrowMetadata, wrapSOLInstruction } from "./utils";
import { IDL } from "./idl";
import { WalletContextState } from "@jup-ag/wallet-adapter";

// const NodeWallet = require("@project-serum/anchor/dist/cjs/nodewallet");

export type Escrow = IdlAccounts<LockerType>["vestingEscrow"];
export type EscrowMetadata = IdlAccounts<LockerType>["vestingEscrowMetadata"];
export type EscrowWithMetadata = ProgramAccount<Escrow> & {
  escrowMetadata?: EscrowMetadata;
  mint: PublicKey;
};

export const UpdateRecipientMode = {
  NONE: "none",
  CREATOR_ONLY: "creator",
  RECIPIENT_ONLY: "recipient",
  CREATOR_RECIPIENT: "creator-recipient",
} as const;
export type UpdateRecipientMode = (typeof UpdateRecipientMode)[keyof typeof UpdateRecipientMode];
export function getUpdateRecipientModeValue(mode: UpdateRecipientMode): number {
  switch (mode) {
    case UpdateRecipientMode.NONE:
      return 0;
    case UpdateRecipientMode.CREATOR_ONLY:
      return 1;
    case UpdateRecipientMode.RECIPIENT_ONLY:
      return 2;
    case UpdateRecipientMode.CREATOR_RECIPIENT:
      return 3;
  }
}
export function getUpdateRecipientModeFromValue(raw: number): UpdateRecipientMode | undefined {
  if (raw < 0 || raw > 3) {
    return;
  }
  if (raw === 0) {
    return UpdateRecipientMode.NONE;
  }
  if (raw === 1) {
    return UpdateRecipientMode.CREATOR_ONLY;
  }
  if (raw === 2) {
    return UpdateRecipientMode.RECIPIENT_ONLY;
  }
  if (raw === 3) {
    return UpdateRecipientMode.CREATOR_RECIPIENT;
  }
}

export const CancelMode = {
  NONE: "none",
  CREATOR_ONLY: "creator",
  RECIPIENT_ONLY: "recipient",
  CREATOR_RECIPIENT: "creator-recipient",
} as const;
export type CancelMode = (typeof CancelMode)[keyof typeof CancelMode];
export function getCancelModeValue(mode: CancelMode): number {
  switch (mode) {
    case CancelMode.NONE:
      return 0;
    case CancelMode.CREATOR_ONLY:
      return 1;
    case CancelMode.RECIPIENT_ONLY:
      return 2;
    case CancelMode.CREATOR_RECIPIENT:
      return 3;
  }
}
export function getCancelModeFromValue(raw: number): CancelMode | undefined {
  if (raw < 0 || raw > 3) {
    return;
  }
  if (raw === 0) {
    return CancelMode.NONE;
  }
  if (raw === 1) {
    return CancelMode.CREATOR_ONLY;
  }
  if (raw === 2) {
    return CancelMode.RECIPIENT_ONLY;
  }
  if (raw === 3) {
    return CancelMode.CREATOR_RECIPIENT;
  }
}

export function getTokenProgramFromFlag(flag: number): PublicKey | undefined {
  switch (flag) {
    case 0:
      return TOKEN_PROGRAM_ID;
    case 1:
      return TOKEN_2022_PROGRAM_ID;
  }
}

export type CreateVestingPlanParams = {
  connection: Connection;
  title: string;
  owner: PublicKey;
  tokenMintAddress: PublicKey;
  vestingStartTime: BN;
  frequency: BN;
  cliffUnlockAmount: BN;
  amountPerPeriod: BN;
  numberOfPeriod: BN;
  recipient: PublicKey;
  cliffTime: BN;
  updateRecipientMode: UpdateRecipientMode;
  cancelMode: CancelMode;
  tokenProgram: PublicKey;
};

type CancelVestingPlanParams = {
  escrow: EscrowWithMetadata;
  signer: PublicKey;
};
export class Locker {
  program: Program<LockerType>;

  constructor(private provider: AnchorProvider) {
    this.provider = provider;
    this.program = createLockerProgram(provider.wallet as AnchorWallet, provider.connection);
  }

  public static async createVestingPlan({
    connection,
    owner,
    title,
    tokenMintAddress,
    vestingStartTime,
    frequency,
    cliffUnlockAmount,
    amountPerPeriod,
    numberOfPeriod,
    recipient,
    cliffTime,
    updateRecipientMode,
    cancelMode,
    tokenProgram,
  }: CreateVestingPlanParams): Promise<{
    tx: Transaction;
    signers: Keypair[];
  }> {
    const provider = new AnchorProvider(connection, {} as any, AnchorProvider.defaultOptions());

    const program = new Program<LockerType>(IDL, provider);

    const baseKP = Keypair.generate();

    let [escrow] = deriveEscrow(baseKP.publicKey, program.programId);

    let preInstructions: TransactionInstruction[] = [];

    let postInstructions: TransactionInstruction[] = [];

    const [userATA, createUserATA] = await getOrCreateATAInstruction(tokenMintAddress, owner, connection, owner);

    createUserATA && preInstructions.push(createUserATA);

    const [, createEscrowATA] = await getOrCreateATAInstruction(tokenMintAddress, escrow, connection, owner);

    const [escrowMetadata] = deriveEscrowMetadata(escrow, program.programId);

    createEscrowATA && preInstructions.push(createEscrowATA);

    const metaDataIx = await program.methods
      .createVestingEscrowMetadata({
        name: title,
        description: "",
        creatorEmail: "",
        recipientEmail: "",
      })
      .accountsStrict({
        escrow,
        payer: owner,
        systemProgram: web3.SystemProgram.programId,
        creator: owner,
        escrowMetadata,
      })
      .instruction();

    postInstructions.push(metaDataIx);

    if (tokenMintAddress.equals(NATIVE_MINT)) {
      const totalAmount = cliffUnlockAmount.add(amountPerPeriod.mul(numberOfPeriod));

      const wrapSOLIx = wrapSOLInstruction(owner, userATA, BigInt(totalAmount.toNumber()));

      preInstructions.push(...wrapSOLIx);
    }

    // Get raw number values of modes
    const updateRecipientModeRaw = getUpdateRecipientModeValue(updateRecipientMode);
    const cancelModeRaw = getCancelModeValue(cancelMode);

    // Generate vesting plan
    const [vestingPlanTxId, err] = await p(
      program.methods
        .createVestingEscrowV2(
          {
            amountPerPeriod,
            cliffUnlockAmount,
            updateRecipientMode: updateRecipientModeRaw,
            frequency,
            cliffTime,
            vestingStartTime,
            cancelMode: cancelModeRaw,
            numberOfPeriod,
          },
          { slices: [] }
        )
        .accounts({
          base: baseKP.publicKey,
          senderToken: userATA,
          recipient,
          sender: owner,
          tokenProgram,
          program: program.programId,
          tokenMint: tokenMintAddress,
        })
        .preInstructions(preInstructions)
        .postInstructions(postInstructions)
        .transaction()
    );

    if (err != null) {
      console.error("createVestingEscrowV2: failed with error: ", { err });
    }

    return {
      tx: vestingPlanTxId,
      signers: [baseKP],
    };
  }

  static async getEscrowsWithMetadataByRecipient(
    connection: Connection,
    recipient: PublicKey
  ): Promise<EscrowWithMetadata[]> {
    const provider = new AnchorProvider(connection, {} as any, AnchorProvider.defaultOptions());

    const program = new Program<LockerType>(IDL, provider);

    const escrows = await program.account.vestingEscrow.all([
      {
        memcmp: {
          bytes: recipient.toBase58(),
          offset: 8,
        },
      },
    ]);

    const escrowPubkeyToEscrowMetadataPubkeyMap = escrows.reduce(
      (map, escrow) =>
        map.set(escrow.publicKey.toString(), deriveEscrowMetadata(escrow.publicKey, program.programId)[0]),
      new Map()
    );

    const escrowMetadataPubkeys = Array.from(escrowPubkeyToEscrowMetadataPubkeyMap.values());
    const escrowMetadatas: (EscrowMetadata | null)[] = await program.account.vestingEscrowMetadata.fetchMultiple(
      escrowMetadataPubkeys
    );

    const escrowWithMetadatas: EscrowWithMetadata[] = [];
    escrows.forEach((escrow, index) => {
      const escrowMint = escrows[index]?.account?.tokenMint;
      if (!escrowMint) {
        console.error(`Escrow mint not found for escrow ${escrows[index].publicKey.toBase58()}`);
        return;
      }
      const escrowMetadata = escrowMetadatas[index];
      escrowWithMetadatas.push({
        publicKey: escrow.publicKey,
        account: escrow.account,
        escrowMetadata: escrowMetadata ?? undefined,
        mint: escrowMint,
      });
    });

    return escrowWithMetadatas;
  }
}

// 0.1.x @solana/spl-token does not have the version without the rent sysvar
// Source: https://github.com/solana-labs/solana-program-library/blob/dc5684445f0b42ba36a0157f06c561d967a7cb34/associated-token-account/program/src/instruction.rs#L16-L25
export function createAssociatedTokenAccountIdempotentInstruction(
  payer: PublicKey,
  associatedToken: PublicKey,
  owner: PublicKey,
  mint: PublicKey,
  programId: PublicKey,
  associatedTokenProgramId = ASSOCIATED_TOKEN_PROGRAM_ID
): TransactionInstruction {
  const keys = [
    { pubkey: payer, isSigner: true, isWritable: true },
    { pubkey: associatedToken, isSigner: false, isWritable: true },
    { pubkey: owner, isSigner: false, isWritable: false },
    { pubkey: mint, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: programId, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({
    keys,
    programId: associatedTokenProgramId,
    data: Buffer.from([1]),
  });
}
