"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { parseEther } from "viem";
import { contractBase, TARGET_CHAIN } from "@/lib/contract";
import { useChainNow, useRole } from "@/lib/hooks";
import { useTx } from "@/lib/useTx";

const MAX_TITLE = 80;
const MAX_DESC = 500;

const input = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";
const quick = "rounded-full border border-slate-300 px-3 py-1 text-xs hover:bg-slate-100";

function toWei(s: string): bigint | null {
  try {
    const w = parseEther(s.trim());
    return w > BigInt(0) ? w : null;
  } catch {
    return null;
  }
}

/** unix seconds -> value for <input type="datetime-local"> (local time) */
function toLocalInput(sec: number): string {
  const d = new Date(sec * 1000);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export default function CreatePage() {
  const router = useRouter();
  const { isConnected, chainId } = useAccount();
  const { isCreator } = useRole();
  const now = useChainNow();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [goal, setGoal] = useState("");
  const [deadline, setDeadline] = useState("");

  const tx = useTx(() => router.push("/dashboard"));

  const goalWei = toWei(goal);
  const deadlineSec = deadline ? Math.floor(new Date(deadline).getTime() / 1000) : 0;

  // Mirror of the contract's InvalidInput rules, so the user sees the problem before paying gas
  let problem = "";
  if (!title.trim()) problem = "Enter a title.";
  else if (goalWei === null) problem = "Enter a goal greater than 0 ETH.";
  else if (!deadline) problem = "Pick a deadline.";
  else if (deadlineSec <= now + 60) problem = "The deadline must be at least a minute in the future.";

  const ready = isConnected && chainId === TARGET_CHAIN.id;

  if (!isConnected) return <p className="text-slate-500">Connect your wallet to create a campaign.</p>;
  if (!isCreator) {
    return (
      <p className="rounded-lg bg-amber-100 p-4 text-sm text-amber-800">
        Your wallet is not an approved creator. Ask the admin to add your address.
      </p>
    );
  }

  const submit = () => {
    if (problem || goalWei === null) return;
    tx.label.current = "Create campaign";
    tx.writeContract({
      ...contractBase,
      functionName: "createProject",
      args: [title.trim(), description.trim(), goalWei, BigInt(deadlineSec)],
    });
  };

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <h1 className="text-2xl font-bold">Create a campaign</h1>

      <div className="space-y-1">
        <label className="text-sm font-medium">Title</label>
        <input
          className={input}
          maxLength={MAX_TITLE}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Community Garden"
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Description</label>
        <textarea
          className={input}
          rows={4}
          maxLength={MAX_DESC}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What are you raising money for?"
        />
        <p className="text-right text-xs text-slate-400">
          {description.length}/{MAX_DESC}
        </p>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Funding goal (ETH)</label>
        <input
          className={input}
          inputMode="decimal"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="10"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Deadline</label>
        <input
          type="datetime-local"
          className={input}
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-slate-500">Quick pick:</span>
          <button type="button" className={quick} onClick={() => setDeadline(toLocalInput(now + 3600))}>
            1 hour
          </button>
          <button type="button" className={quick} onClick={() => setDeadline(toLocalInput(now + 7 * 86400))}>
            7 days
          </button>
          <button type="button" className={quick} onClick={() => setDeadline(toLocalInput(now + 30 * 86400))}>
            30 days
          </button>
        </div>
      </div>

      {problem && (title || goal || deadline) && <p className="text-sm text-amber-700">{problem}</p>}

      <button
        onClick={submit}
        disabled={!ready || !!problem || tx.busy}
        className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {tx.busy ? "Creating…" : "Create campaign"}
      </button>
      {!ready && <p className="text-xs text-amber-700">Switch your wallet to {TARGET_CHAIN.name} first.</p>}
    </div>
  );
}