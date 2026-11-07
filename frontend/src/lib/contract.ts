import { sepolia } from "wagmi/chains";
import { fundFlowAbi } from "./abi";

export const TARGET_CHAIN = sepolia; // for local Anvil development, use `foundry` from "wagmi/chains" instead
export const CONTRACT_ADDRESS = "0x4ca96ACFcD922B47af3a784a14a0EB495b1729fC" as const;

export const contractBase = {
  abi: fundFlowAbi,
  address: CONTRACT_ADDRESS,
  chainId: TARGET_CHAIN.id,
} as const;