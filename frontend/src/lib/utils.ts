export type Project = {
    creator: `0x${string}`;
    title: string;
    description: string;
    goal: bigint;
    raised: bigint;
    deadline: bigint;
    status: number; // 0 Active, 1 Funded, 2 Failed (on-chain)
    claimed: boolean;
  };
  
  export type DisplayStatus = "Active" | "Funded" | "Expired" | "Failed";
  
  /** "Expired" = still Active on-chain, deadline passed, nobody has called finalizeProject yet. */
  export function displayStatus(p: Project, nowSec: number): DisplayStatus {
    if (p.status === 1) return "Funded";
    if (p.status === 2) return "Failed";
    return nowSec >= Number(p.deadline) ? "Expired" : "Active";
  }
  
  export const STATUS_STYLES: Record<DisplayStatus, string> = {
    Active: "bg-blue-100 text-blue-700",
    Funded: "bg-green-100 text-green-700",
    Expired: "bg-amber-100 text-amber-700",
    Failed: "bg-red-100 text-red-700",
  };
  
  export function timeLeft(deadline: bigint, nowSec: number): string {
    const s = Number(deadline) - nowSec;
    if (s <= 0) return "Ended";
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (d > 0) return `${d}d ${h}h left`;
    if (h > 0) return `${h}h ${m}m left`;
    return `${m}m left`;
  }
  
  export const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;