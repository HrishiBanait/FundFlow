import { sepolia } from "wagmi/chains";
import { fundFlowAbi } from "./abi";

export const TARGET_CHAIN = sepolia; // for local Anvil development, use `foundry` from "wagmi/chains" instead
export const CONTRACT_ADDRESS = "0x578A2bd5b7606FaEFD847C6C24b0E34C9bdd5B4C" as const;

export const contractBase = {
  abi: fundFlowAbi,
  address: CONTRACT_ADDRESS,
  chainId: TARGET_CHAIN.id,
} as const;