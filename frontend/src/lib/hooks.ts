"use client";
import { useEffect, useMemo, useState } from "react";
import { useAccount , useBlock, useReadContract, useReadContracts } from "wagmi";
import { TARGET_CHAIN, contractBase } from "./contract";
import type { Project } from "./utils";
import { zeroAddress } from "viem";

export const POLL_MS = 4000;

/** Current time in unix seconds, based on the latest block's timestamp and ticking every second. */
export function useChainNow() {
  const block = useBlock({ chainId: TARGET_CHAIN.id, query: { refetchInterval: POLL_MS } });
  const blockTs = block.data?.timestamp;
  // how far the chain clock is from this computer's clock
  const offsetMs = useMemo(
    () => (blockTs !== undefined ? Number(blockTs) * 1000 - Date.now() : 0),
    [blockTs],
  );
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return Math.floor((Date.now() + offsetMs) / 1000);
}

export function useProjects() {
  const count = useReadContract({
    ...contractBase,
    functionName: "totalProjectsCreated",
    query: { refetchInterval: POLL_MS },
  });
  const n = Number(count.data ?? BigInt(0));

  const calls = useReadContracts({
    contracts: Array.from({ length: n }).flatMap((_, i) => [
      { ...contractBase, functionName: "getProject" as const, args: [BigInt(i)] as const },
      { ...contractBase, functionName: "getFundingPercentage" as const, args: [BigInt(i)] as const },
    ]),
    query: { enabled: n > 0, refetchInterval: POLL_MS },
  });

  const projects = Array.from({ length: n }, (_, i) => {
    const project = calls.data?.[2 * i]?.result as unknown as Project | undefined;
    const bps = calls.data?.[2 * i + 1]?.result as unknown as bigint | undefined;
    return project && bps !== undefined ? { id: i, project, bps: Number(bps) } : null;
  }).filter((x) => x !== null);

  return {
    projects,
    isLoading: count.isLoading || (n > 0 && calls.isLoading),
    error: count.error ?? calls.error,
  };
}

/** Is the connected wallet the admin, and/or an approved creator? */
export function useRole() {
  const { address } = useAccount();
  const { data, refetch } = useReadContracts({
    contracts: [
      { ...contractBase, functionName: "admin" },
      { ...contractBase, functionName: "isCreator", args: [address ?? zeroAddress] },
    ],
    query: { refetchInterval: POLL_MS },
  });
  const admin = data?.[0]?.result as `0x${string}` | undefined;
  return {
    admin,
    isAdmin: !!address && !!admin && admin.toLowerCase() === address.toLowerCase(),
    isCreator: data?.[1]?.result === true,
    refetch,
  };
}