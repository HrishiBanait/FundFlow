"use client";
import { useAccount, useReadContracts } from "wagmi";
import { formatEther, zeroAddress } from "viem";
import { contractBase } from "@/lib/contract";
import { POLL_MS, useChainNow, useProjects } from "@/lib/hooks";
import { displayStatus, type DisplayStatus, type Project } from "@/lib/utils";
import { ProjectCard } from "@/components/ProjectCard";

function creatorHint(p: Project, s: DisplayStatus): string {
  if (s === "Funded") return p.claimed ? "Funds claimed." : `Ready to claim ${formatEther(p.raised)} ETH, open the campaign.`;
  if (s === "Expired") return "Deadline passed. Open the campaign to finalize it.";
  if (s === "Failed") return "Failed. Contributors can claim refunds.";
  return "Active.";
}

function contributorHint(s: DisplayStatus): string {
  if (s === "Active") return "You can withdraw until the deadline.";
  if (s === "Funded") return "Goal reached. Your contribution is locked in.";
  if (s === "Expired") return "Waiting to be finalized. Open the campaign to finalize it.";
  return "Failed. Open the campaign to claim your refund.";
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
      <div className="text-xl font-bold">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}

export default function Dashboard() {
  const { address, isConnected } = useAccount();
  const now = useChainNow();
  const { projects, isLoading } = useProjects();

  const contribs = useReadContracts({
    contracts: projects.map(({ id }) => ({
      ...contractBase,
      functionName: "contributions" as const,
      args: [BigInt(id), address ?? zeroAddress] as const,
    })),
    query: { enabled: !!address && projects.length > 0, refetchInterval: POLL_MS },
  });

  if (!isConnected || !address) return <p className="text-slate-500">Connect your wallet to see your dashboard.</p>;
  if (isLoading) return <p className="text-slate-500">Loading…</p>;

  const me = address.toLowerCase();
  const mine = projects.filter((x) => x.project.creator.toLowerCase() === me);
  const backed = projects
    .map((x, i) => ({ ...x, amount: (contribs.data?.[i]?.result as bigint | undefined) ?? BigInt(0) }))
    .filter((x) => x.amount > BigInt(0));

  const totalRaised = mine.reduce((sum, x) => sum + x.project.raised, BigInt(0));
  const toClaim = mine
    .filter((x) => x.project.status === 1 && !x.project.claimed)
    .reduce((sum, x) => sum + x.project.raised, BigInt(0));
  const totalBacked = backed.reduce((sum, x) => sum + x.amount, BigInt(0));

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">My campaigns</h2>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Campaigns" value={String(mine.length)} />
          <Stat label="Total raised" value={`${formatEther(totalRaised)} ETH`} />
          <Stat label="Ready to claim" value={`${formatEther(toClaim)} ETH`} />
        </div>
        {mine.length === 0 && <p className="text-sm text-slate-500">You have not created any campaigns.</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          {mine.map(({ id, project, bps }) => (
            <div key={id} className="space-y-1">
              <ProjectCard id={id} project={project} bps={bps} now={now} />
              <p className="px-1 text-xs text-slate-500">{creatorHint(project, displayStatus(project, now))}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">My contributions</h2>
        <Stat label="Currently backed" value={`${formatEther(totalBacked)} ETH`} />
        {backed.length === 0 && (
          <p className="text-sm text-slate-500">
            No active contributions. Refunded or withdrawn campaigns no longer appear here.
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {backed.map(({ id, project, bps, amount }) => (
            <div key={id} className="space-y-1">
              <ProjectCard id={id} project={project} bps={bps} now={now} />
              <p className="px-1 text-xs text-slate-600">
                You contributed <b>{formatEther(amount)} ETH</b>. {contributorHint(displayStatus(project, now))}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}