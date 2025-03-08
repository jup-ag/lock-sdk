import { AnchorProvider } from "@coral-xyz/anchor";
import { WalletContextState } from "@jup-ag/wallet-adapter";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import {
  Connection,
  ConnectionConfig,
  PublicKey,
  TransactionInstruction,
} from "@solana/web3.js";

export const createProvider = (
  wallet: WalletContextState,
  connection: Connection,
  config: ConnectionConfig
) => {
  //@ts-ignore
  const provider = new AnchorProvider(connection, wallet, config);
  return provider;
};

type Params = {
  tokenMint: PublicKey;
  owner: PublicKey;
  connection: Connection;
  allowOwnerOffCurve?: boolean;
  payer: PublicKey;
  tokenProgram: PublicKey;
};

export const getAssociatedTokenAccount = (tokenMint: PublicKey, owner: PublicKey) => {
  return getAssociatedTokenAddressSync(tokenMint, owner, true, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
};

export const getOrCreateATAInstruction = async (
  tokenMint: PublicKey,
  owner: PublicKey,
  connection: Connection,
  payer?: PublicKey,
): Promise<[PublicKey, TransactionInstruction?]> => {
  let toAccount;
  try {
    toAccount = await getAssociatedTokenAccount(tokenMint, owner);
    const account = await connection.getAccountInfo(toAccount);
    if (!account) {
      const ix = createAssociatedTokenAccountInstruction(
        payer || owner,
        toAccount,
        owner,
        tokenMint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      );
      return [toAccount, ix];
    }
    return [toAccount, undefined];
  } catch (e) {
    /* handle error */
    console.error('Error::getOrCreateATAInstruction', e);
    throw e;
  }
};