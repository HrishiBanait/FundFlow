"use client";
import { useReadContracts } from "wagmi";
import { contractBase } from "@/lib/contract";
import { ProjectCard } from "@/components/ProjectCard";
import { POLL_MS, useChainNow, useProjects } from "@/lib/hooks";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}

export default function Home() {
  const { projects, isLoading, error } = useProjects();
  const now = useChainNow();

  const stats = useReadContracts({
    contracts: [
      { ...contractBase, functionName: "totalProjectsCreated" },
      { ...contractBase, functionName: "getSuccessfulProjectsCount" },
      { ...contractBase, functionName: "getFailedProjectsCount" },
    ],
    query: { refetchInterval: POLL_MS },
  });
  const val = (i: number) => (stats.data?.[i]?.result as bigint | undefined)?.toString() ?? "–";

  return (
    <div className="space-y-8">
      <section className="grid grid-cols-3 gap-3">
        <Stat label="Campaigns created" value={val(0)} />
        <Stat label="Successfully funded" value={val(1)} />
        <Stat label="Failed" value={val(2)} />
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold">Campaigns</h2>

        {error && (
          <p className="rounded-lg bg-red-100 p-4 text-sm text-red-800">
            Could not read the contract. Is Anvil running, and is the address in
            src/lib/contract.ts correct?
          </p>
        )}
        {isLoading && <p className="text-slate-500">Loading campaigns…</p>}
        {!isLoading && !error && projects.length === 0 && (
          <p className="text-slate-500">No campaigns yet.</p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {[...projects].reverse().map(({ id, project, bps }) => (
            <ProjectCard key={id} id={id} project={project} bps={bps} now={now} />
          ))}
        </div>
      </section>
    </div>
  );
}