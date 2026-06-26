"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAccount } from "wagmi";
import { CHAIN_ID } from "@/contracts";
import { checkInvite, type InviteCheckStatus } from "./api";

export type GateState =
  | "loading"           // initial fetch in flight
  | "no-wallet"         // no wallet connected
  | "none"              // wallet connected but no invite record
  | "pending"           // request pending review
  | "approved"          // approved — full access
  | "rejected";         // request rejected

interface InviteGateValue {
  state: GateState;
  address: string | null;
  email: string | null;
  telegram: string | null;
  /** Force a re-check (e.g. after the user submits a fresh request). */
  refresh: () => Promise<void>;
}

const InviteGateContext = createContext<InviteGateValue | null>(null);
export const INVITE_GATE_DISABLED = CHAIN_ID === 11155111;

export function InviteGateProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { address, isConnecting, isReconnecting } = useAccount();
  const [state, setState] = useState<GateState>(
    INVITE_GATE_DISABLED ? "approved" : "loading",
  );
  const [email, setEmail] = useState<string | null>(null);
  const [telegram, setTelegram] = useState<string | null>(null);
  const inFlight = useRef<string | null>(null);

  const lower = address ? address.toLowerCase() : null;

  const runCheck = useCallback(async (addr: string | null) => {
    if (INVITE_GATE_DISABLED) {
      setState("approved");
      setEmail(null);
      setTelegram(null);
      return;
    }
    if (!addr) {
      setState("no-wallet");
      setEmail(null);
      setTelegram(null);
      return;
    }
    inFlight.current = addr;
    setState((prev) => (prev === "approved" ? prev : "loading"));
    try {
      const result = await checkInvite(addr);
      // Discard if the wallet changed mid-flight
      if (inFlight.current !== addr) return;
      setEmail(result.email ?? null);
      setTelegram(result.telegram ?? null);
      setState(mapStatus(result.status));
    } catch {
      if (inFlight.current !== addr) return;
      // Network failure — don't lock people out; treat as transient
      setState("loading");
    }
  }, []);

  useEffect(() => {
    if (INVITE_GATE_DISABLED) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      if (isConnecting || isReconnecting) {
        setState("loading");
        return;
      }
      void runCheck(lower);
    });
    return () => {
      cancelled = true;
    };
  }, [lower, isConnecting, isReconnecting, runCheck]);

  const refresh = useCallback(async () => {
    await runCheck(lower);
  }, [lower, runCheck]);

  const value = useMemo<InviteGateValue>(
    () => ({
      state,
      address: lower,
      email,
      telegram,
      refresh,
    }),
    [state, lower, email, telegram, refresh],
  );

  return (
    <InviteGateContext.Provider value={value}>
      {children}
    </InviteGateContext.Provider>
  );
}

function mapStatus(s: InviteCheckStatus): GateState {
  return s === "none" || s === "pending" || s === "approved" || s === "rejected"
    ? s
    : "none";
}

export function useInviteGate(): InviteGateValue {
  const ctx = useContext(InviteGateContext);
  if (!ctx) throw new Error("useInviteGate must be used inside InviteGateProvider");
  return ctx;
}

// Only campaign creation is invite-gated. Browsing, investing, staking, harvest
// claims and producer profiles stay open — anyone can see and participate.
const GATED_PATH_PREFIXES = ["/create"];

export function isGatedPath(pathname: string): boolean {
  return GATED_PATH_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}
