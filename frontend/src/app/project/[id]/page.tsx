"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense } from "react";
import { useAccount, useReadContracts } from "wagmi";
import { formatEther, zeroAddress } from "viem";
import { contractBase } from "@/lib/contract";
import { POLL_MS, useChainNow } from "@/lib/hooks";
import { STATUS_STYLES, displayStatus, shortAddr, timeLeft, type Project } from "@/lib/utils";
import { ProjectActions } from "@/components/ProjectActions";

function Box({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}

function ProjectDetailContent() {
  const { id: idParam } = useParams<{ id: string }>();
  const valid = /^\d+$/.test(idParam);
  const id = valid ? BigInt(idParam) : BigInt(0);

  const { address } = useAccount();
  const now = useChainNow();

  const { data, isLoading, refetch } = useReadContracts({
    contracts: [
      { ...contractBase, functionName: "getProject", args: [id] },
      { ...contractBase, functionName: "getFundingPercentage", args: [id] },
      { ...contractBase, functionName: "contributions", args: [id, address ?? zeroAddress] },
    ],
    query: { enabled: valid, refetchInterval: POLL_MS },
  });

  const backLink = (
    <Link href="/" className="text-sm text-indigo-600 hover:underline">
      ← All campaigns
    </Link>
  );

  if (!valid || data?.[0]?.status === "failure") {
    return (
      <div className="space-y-4">
        {backLink}
        <p className="rounded-lg bg-red-100 p-4 text-sm text-red-800">
          Could not load this campaign. Does it exist, and is Anvil running?
        </p>
      </div>
    );
  }
  if (isLoading || !data) return <p className="text-slate-500">Loading campaign…</p>;

  const project = data[0].result as unknown as Project;
  const bps = Number(data[1].result as unknown as bigint);
  const myContribution = (data[2].result as unknown as bigint | undefined) ?? BigInt(0);

  const status = displayStatus(project, now);
  const pct = Math.min(bps / 100, 100);
  const remaining = project.goal - project.raised;

  return (
    <div className="space-y-6">
      {backLink}

      <div>
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{project.title}</h1>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>
            {status}
          </span>
        </div>
        <p className="whitespace-pre-line text-slate-600">{project.description}</p>
        <p className="mt-2 text-xs text-slate-400">
          by {shortAddr(project.creator)} · ends {new Date(Number(project.deadline) * 1000).toLocaleString()}
        </p>
      </div>

      <div>
        <div className="mb-2 h-3 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="text-sm font-medium">{pct.toFixed(2)}% funded</div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Box label="Raised" value={`${formatEther(project.raised)} ETH`} />
        <Box label="Goal" value={`${formatEther(project.goal)} ETH`} />
        <Box label="Remaining" value={`${formatEther(remaining)} ETH`} />
        <Box label="Time" value={timeLeft(project.deadline, now)} />
      </div>

      {myContribution > BigInt(0) && (
        <p className="rounded-lg bg-indigo-50 p-3 text-sm text-indigo-800">
          Your contribution: <b>{formatEther(myContribution)} ETH</b>
        </p>
      )}

      <ProjectActions
        id={id}
        project={project}
        status={status}
        myContribution={myContribution}
        onChanged={() => refetch()}
      />
    </div>
  );
}

export default function ProjectPage() {
  return (
    <Suspense fallback={<p className="text-slate-500">Loading campaign…</p>}>
      <ProjectDetailContent />
    </Suspense>
  );
}