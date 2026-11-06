"use client";
import { useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { isAddress } from "viem";
import { contractBase, TARGET_CHAIN } from "@/lib/contract";
import { POLL_MS, useRole } from "@/lib/hooks";
import { useTx } from "@/lib/useTx";
import { shortAddr } from "@/lib/utils";

export default function AdminPage() {
  const { address, isConnected, chainId } = useAccount();
  const { admin, isAdmin } = useRole();
  const [target, setTarget] = useState("");

  const valid = isAddress(target);
  const check = useReadContract({
    ...contractBase,
    functionName: "isCreator",
    args: [valid ? target : "0x0000000000000000000000000000000000000000"],
    query: { enabled: valid, refetchInterval: POLL_MS },
  });
  const tx = useTx(() => check.refetch());

  if (!isConnected) return <p className="text-slate-500">Connect your wallet.</p>;
  if (!isAdmin) {
    return (
      <p className="rounded-lg bg-amber-100 p-4 text-sm text-amber-800">
        Only the admin{admin ? ` (${shortAddr(admin)})` : ""} can manage creators.
      </p>
    );
  }

  const ready = chainId === TARGET_CHAIN.id;
  const isCreator = check.data === true;

  const send = (fn: "addCreator" | "removeCreator", label: string) => {
    if (!isAddress(target)) return;
    tx.label.current = label;
    tx.writeContract({ ...contractBase, functionName: fn, args: [target] });
  };

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <h1 className="text-2xl font-bold">Manage creators</h1>
      <p className="text-sm text-slate-600">
        Only approved creators can launch campaigns. Removing a creator does not cancel campaigns they already
        launched.
      </p>

      <div className="space-y-2">
        <label className="text-sm font-medium">Wallet address</label>
        <input
          className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
          value={target}
          onChange={(e) => setTarget(e.target.value.trim())}
          placeholder="0x…"
        />
        <button
          type="button"
          className="text-xs text-indigo-600 hover:underline"
          onClick={() => address && setTarget(address)}
        >
          Use my address
        </button>
      </div>

      {target && !valid && <p className="text-sm text-red-700">That is not a valid address.</p>}
      {valid && (
        <p className="text-sm">
          Status:{" "}
          <b className={isCreator ? "text-green-700" : "text-slate-600"}>
            {check.isLoading ? "checking…" : isCreator ? "Approved creator" : "Not a creator"}
          </b>
        </p>
      )}

      <div className="flex gap-3">
        <button
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          disabled={!ready || !valid || isCreator || tx.busy}
          onClick={() => send("addCreator", "Add creator")}
        >
          Add creator
        </button>
        <button
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-50"
          disabled={!ready || !valid || !isCreator || tx.busy}
          onClick={() => send("removeCreator", "Remove creator")}
        >
          Remove creator
        </button>
      </div>
    </div>
  );
}