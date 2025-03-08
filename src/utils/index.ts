import { PublicKey } from "@solana/web3.js";
import Decimal from "decimal.js";

export * from "./anchor";
export * from "./wait";

export const TOKEN_2022_PROGRAM_ID = new PublicKey(
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
);
export const isMobile = () =>
  typeof window !== "undefined" && window.screen && window.screen.width <= 480;

// shorten the checksummed version of the input address to have 4 characters at start and end
export function shortenAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export const numberFormatter = new Intl.NumberFormat("en-US", {
  style: "decimal",
  minimumFractionDigits: 0,
  maximumFractionDigits: 9,
});

export const formatNumber = {
  format: (value?: number | string, precision: number = 2) => {
    if (!value && value !== 0) {
      return "--";
    }

    const valInNumber = Number(value);
    return numberFormatter.format(
      precision !== undefined
        ? Number(valInNumber.toFixed(precision))
        : valInNumber
    );
  },

  formatNumberToReadingUnit: (value: Decimal, decimal = 2) => {
    if (value.greaterThan(999) && value.lessThan(1_000_000)) {
      return `${value.div(1_000).div(10 ** decimal)}k`; // convert to K for number from > 1000 < 1 million
    }
    if (value.greaterThan(1_000_000)) {
      return `${value.div(1_000_000).div(10 ** decimal)}m`; // convert to M for number from > 1 million
    }

    return value.toDP(decimal).toFixed();
  },
};