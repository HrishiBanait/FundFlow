import { foundry } from "wagmi/chains";
import { fundFlowAbi } from "./abi";

export const TARGET_CHAIN = foundry; // switched to sepolia in Milestone 6
export const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3" as const;

export const contractBase = {
  abi: fundFlowAbi,
  address: CONTRACT_ADDRESS,
  chainId: TARGET_CHAIN.id,
} as const;