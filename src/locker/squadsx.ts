import { Wallet } from "@jup-ag/wallet-adapter";

export function hasEphemeralSignersFeature<T extends Wallet["adapter"]>(
  adapter: T
): adapter is T extends {
  standard: true;
}
  ? T & {
      wallet: {
        features: FuseGetEphemeralSignersFeature;
      };
    }
  : never {
  const hasFeature =
    adapter &&
    "standard" in adapter &&
    "fuse:getEphemeralSigners" in adapter.wallet.features;
  return hasFeature;
}

// Definitions below from
// https://www.npmjs.com/package/@sqds/fuse-wallet?activeTab=readme
export const FuseGetEphemeralSignersFeatureIdentifier =
  "fuse:getEphemeralSigners" as const;

export type FuseGetEphemeralSignersFeature = {
  readonly [FuseGetEphemeralSignersFeatureIdentifier]: {
    /** Version of the feature API. */
    version: FuseGetEphemeralSignersVersion;

    /**
     * Get any number of addresses of ephemeral accounts that can be used as signers for the next transaction.
     */
    getEphemeralSigners: FuseGetEphemeralSignersMethod;
  };
};

export type FuseGetEphemeralSignersVersion = "1.0.0";

export type FuseGetEphemeralSignersMethod = (num: number) => Promise<string[]>;
