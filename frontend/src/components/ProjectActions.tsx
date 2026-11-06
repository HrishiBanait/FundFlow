"use client";
import { useState } from "react";
import { useAccount } from "wagmi";
import { formatEther, parseEther } from "viem";
import { contractBase, TARGET_CHAIN } from "@/lib/contract";
import { useTx } from "@/lib/useTx";
import type { DisplayStatus, Project } from "@/lib/utils";

const btn =
  "rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50";
const btnOutline =
  "rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-50";

/** Parses "1.5" into wei. Returns null for empty, zero, negative or invalid input. */
function toWei(s: string): bigint | null {
  try {
    const w = parseEther(s.trim());
    return w > BigInt(0) ? w : null;
  } catch {
    return null;
  }
}

type Props = {
  id: bigint;
  project: Project;
  status: DisplayStatus;
  myContribution: bigint;
  onChanged: () => void;
};

export function ProjectActions({ id, project, status, myContribution, onChanged }: Props) {
  const { address, isConnected, chainId } = useAccount();
  const ready = isConnected && chainId === TARGET_CHAIN.id;
  const isCreator = !!address && address.toLowerCase() === project.creator.toLowerCase();

  const [amount, setAmount] = useState("");
  const tx = useTx(() => {
    setAmount("");
    onChanged(); // refresh the page data right after confirmation
  });

  const remaining = project.goal - project.raised;
  const wei = toWei(amount);
  const accepted = wei === null ? BigInt(0) : wei > remaining ? remaining : wei;
  const refund = wei === null ? BigInt(0) : wei - accepted;

  const act = (label: string, send: () => void) => {
    tx.label.current = label;
    send();
  };
  const disabled = !ready || tx.busy;

  return (
    <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold">Actions</h2>

      {!isConnected && (
        <p className="text-sm text-slate-500">Connect your wallet to take part in this campaign.</p>
      )}
      {isConnected && !ready && (
        <p className="text-sm text-amber-700">Switch your wallet to {TARGET_CHAIN.name} to continue.</p>
      )}

      {/* ───── Active: contribute ───── */}
      {status === "Active" && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Contribute (ETH)</label>
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.5"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              className={btn}
              disabled={disabled || wei === null}
              onClick={() =>
                act("Contribution", () =>
                  tx.writeContract({
                    ...contractBase,
                    functionName: "fundProject",
                    args: [id],
                    value: wei ?? BigInt(0),
                  }),
                )
              }
            >
              {tx.busy ? "Working…" : "Contribute"}
            </button>
          </div>
          <p className="text-xs text-slate-500">{formatEther(remaining)} ETH still needed to reach the goal.</p>
          {wei !== null && refund > BigInt(0) && (
            <p className="text-xs text-amber-700">
              Only {formatEther(accepted)} ETH is needed. The other {formatEther(refund)} ETH will be refunded
              to you automatically.
            </p>
          )}
        </div>
      )}

      {/* ───── Active: withdraw ───── */}
      {status === "Active" && myContribution > BigInt(0) && (
        <div className="space-y-2 border-t border-slate-100 pt-4">
          <p className="text-sm">
            You have contributed <b>{formatEther(myContribution)} ETH</b>. You can take it back until the deadline.
          </p>
          <button
            className={btnOutline}
            disabled={disabled}
            onClick={() =>
              act("Withdrawal", () =>
                tx.writeContract({ ...contractBase, functionName: "withdrawContribution", args: [id] }),
              )
            }
          >
            Withdraw my contribution
          </button>
        </div>
      )}

      {/* ───── Expired: finalize ───── */}
      {status === "Expired" && (
        <div className="space-y-2">
          <p className="text-sm text-slate-600">
            The deadline passed before the goal was reached. Anyone can finalize the campaign to record it
            as failed, which unlocks refunds for contributors.
          </p>
          <button
            className={btn}
            disabled={disabled}
            onClick={() =>
              act("Finalize", () =>
                tx.writeContract({ ...contractBase, functionName: "finalizeProject", args: [id] }),
              )
            }
          >
            Finalize campaign
          </button>
        </div>
      )}

      {/* ───── Failed: refund ───── */}
      {status === "Failed" && (
        <div className="space-y-2">
          {myContribution > BigInt(0) ? (
            <>
              <p className="text-sm text-slate-600">
                This campaign failed. You can reclaim <b>{formatEther(myContribution)} ETH</b>.
              </p>
              <button
                className={btn}
                disabled={disabled}
                onClick={() =>
                  act("Refund", () =>
                    tx.writeContract({ ...contractBase, functionName: "claimRefund", args: [id] }),
                  )
                }
              >
                Claim refund
              </button>
            </>
          ) : (
            <p className="text-sm text-slate-500">This campaign failed. You have nothing to refund here.</p>
          )}
        </div>
      )}

      {/* ───── Funded: creator claim ───── */}
      {status === "Funded" && (
        <div className="space-y-2">
          {isCreator && !project.claimed ? (
            <>
              <p className="text-sm text-slate-600">
                Your campaign reached its goal. Collect <b>{formatEther(project.raised)} ETH</b>.
              </p>
              <button
                className={btn}
                disabled={disabled}
                onClick={() =>
                  act("Claim funds", () =>
                    tx.writeContract({ ...contractBase, functionName: "claimFunds", args: [id] }),
                  )
                }
              >
                Claim funds
              </button>
            </>
          ) : (
            <p className="text-sm text-slate-500">
              {project.claimed
                ? "The creator has already claimed the funds."
                : "Goal reached 🎉 The creator can now claim the funds."}
            </p>
          )}
        </div>
      )}
    </section>
  );
}