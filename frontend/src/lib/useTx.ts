"use client";
import { useEffect, useRef } from "react";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { BaseError, ContractFunctionRevertedError, UserRejectedRequestError } from "viem";
import { useToast } from "@/components/Toast";

// Messages for every custom error defined in FundFlow.sol
const ERROR_TEXT: Record<string, string> = {
  NotAdmin: "Only the admin can do that.",
  NotCreator: "Only approved creators can do that.",
  InvalidProject: "This campaign does not exist.",
  InvalidInput: "Invalid input.",
  NotActive: "This campaign is no longer active.",
  DeadlinePassed: "The deadline has passed.",
  NothingToWithdraw: "You have nothing to withdraw here.",
  InsufficientBalance: "The contract has insufficient funds.",
  TransferFailed: "The ETH transfer failed.",
  Reentrancy: "Reentrant call blocked.",
  NotProjectCreator: "Only this campaign's creator can do that.",
  NotFinalizable: "This campaign cannot be finalized yet.",
  NotFailed: "This campaign has not been marked as failed.",
  NotFunded: "This campaign has not reached its goal.",
  AlreadyClaimed: "The funds were already claimed.",
};

export function parseError(e: unknown): string {
  if (e instanceof BaseError) {
    if (e.walk((x) => x instanceof UserRejectedRequestError)) return "You rejected the transaction.";
    const reverted = e.walk((x) => x instanceof ContractFunctionRevertedError);
    if (reverted instanceof ContractFunctionRevertedError && reverted.data?.errorName) {
      return ERROR_TEXT[reverted.data.errorName] ?? reverted.data.errorName;
    }
    return e.shortMessage;
  }
  return "Unknown error.";
}

/** Wraps useWriteContract and reports every stage as a toast. `onDone` runs after confirmation. */
export function useTx(onDone?: () => void) {
  const { notify } = useToast();
  const label = useRef("Transaction"); // set by the caller right before sending
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (error) notify("error", `${label.current} failed: ${parseError(error)}`);
  }, [error, notify]);

  useEffect(() => {
    if (hash) notify("info", `${label.current}: submitted, waiting for confirmation…`);
  }, [hash, notify]);

  useEffect(() => {
    if (!receipt.data) return;
    if (receipt.data.status === "success") {
      notify("success", `${label.current} confirmed ✔`);
      doneRef.current?.();
    } else {
      notify("error", `${label.current} reverted on-chain.`);
    }
  }, [receipt.data, notify]);

  useEffect(() => {
    if (receipt.error) notify("error", `${label.current}: ${parseError(receipt.error)}`);
  }, [receipt.error, notify]);

  return { writeContract, label, busy: isPending || (!!hash && receipt.isLoading) };
}