import Link from "next/link";
import { formatEther } from "viem";
import { STATUS_STYLES, displayStatus, shortAddr, timeLeft, type Project } from "@/lib/utils";
const now = Math.floor(Date.now() / 1000);

export function ProjectCard({ id, project, bps , now }: { id: number; project: Project; bps: number; now: number }) {
  
  const status = displayStatus(project, now);
  const pct = Math.min(bps / 100, 100); // bps = basis points from getFundingPercentage (10000 = 100%)
  const remaining = project.goal - project.raised;

  return (
    <Link
      href={`/project/${id}`}
      className="block rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="text-lg font-semibold">{project.title}</h3>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>
          {status}
        </span>
      </div>
      <p className="mb-4 line-clamp-2 text-sm text-slate-600">{project.description}</p>

      <div className="mb-2 h-2 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="mb-3 flex justify-between text-sm">
        <span className="font-medium">{pct.toFixed(2)}% funded</span>
        <span className="text-slate-500">{timeLeft(project.deadline, now)}</span>
      </div>

      <div className="flex justify-between text-xs text-slate-500">
        <span>
          {formatEther(project.raised)} / {formatEther(project.goal)} ETH
        </span>
        <span>{formatEther(remaining)} ETH to go</span>
      </div>
      <div className="mt-2 text-xs text-slate-400">by {shortAddr(project.creator)}</div>
    </Link>
  );
}
