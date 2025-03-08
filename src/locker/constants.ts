import { web3 } from "@coral-xyz/anchor";

import { IDL } from "./idl";

export const LOCKER_PROGRAM_ID = new web3.PublicKey(IDL.address);
export const MEMO_PROGRAM = new web3.PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
);

// Staging
// export const LOCKER_PROGRAM_ID = new web3.PublicKey('sLovrBvGxvyvBniMxj8uUt9CdD7CV4PhnBnBD6cPSXo');
