"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { TARGET_CHAIN } from "@/lib/contract";
import { useRole } from "@/lib/hooks";
import { shortAddr } from "@/lib/utils";

export function Header() {
  // Wallet state only exists in the browser, so render it after mount to avoid hydration mismatches.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { address, isConnected, chainId } = useAccount();
  const { connectors, connect, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const { isAdmin, isCreator } = useRole();
  const wrongNetwork = mounted && isConnected && chainId !== TARGET_CHAIN.id;

  const link = "text-sm text-slate-600 hover:text-indigo-600";

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4">
        <div className="flex items-center gap-5">
          <Link href="/" className="text-xl font-bold text-indigo-600">
            FundFlow
          </Link>
          {mounted && isConnected && (
            <nav className="flex items-center gap-4">
              <Link href="/dashboard" className={link}>Dashboard</Link>
              {isCreator && <Link href="/create" className={link}>Create</Link>}
              {isAdmin && <Link href="/admin" className={link}>Admin</Link>}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-3">
          {mounted && isConnected && address ? (
            <>
              <span className="rounded-full bg-slate-100 px-3 py-1 font-mono text-sm">
                {shortAddr(address)}
              </span>
              <button
                onClick={() => disconnect()}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100"
              >
                Disconnect
              </button>
            </>
          ) : (
            <button
              onClick={() => connect({ connector: connectors[0] })}
              disabled={!mounted || isPending}
              className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {isPending ? "Connecting…" : "Connect Wallet"}
            </button>
          )}
        </div>
      </div>

      {wrongNetwork && (
        <div className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-800">
          Wrong network.{" "}
          <button
            className="font-semibold underline"
            onClick={() => switchChain({ chainId: TARGET_CHAIN.id })}
          >
            Switch to {TARGET_CHAIN.name}
          </button>
        </div>
      )}
      {mounted && error && (
        <div className="bg-red-100 px-4 py-2 text-center text-sm text-red-800">{error.message}</div>
      )}
    </header>
  );
}