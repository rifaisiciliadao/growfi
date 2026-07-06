import { useEffect, useMemo, useState } from "react";

type Hex = `0x${string}`;

type EthereumProvider = {
  request(args: { method: string; params?: unknown[] | Record<string, unknown> }): Promise<unknown>;
  on?(event: string, handler: (...args: unknown[]) => void): void;
  removeListener?(event: string, handler: (...args: unknown[]) => void): void;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

const MAINNET_CHAIN_ID = "0x1";
const USDC_DECIMALS = 6;

const DEFAULT_ADMIN_WALLETS = [
  "0x2dc077446182287f1d79847074893cdb559d41f4",
  "0xe6c30ad5aee7ad22e9f39d51d67667587cdd05a1",
  "0xa229f3c9851e26fc9ea18157b88cd1cda6f90e55",
];

const CONFIG = {
  feeSplitter:
    (import.meta.env.VITE_GROW_FEE_SPLITTER as Hex | undefined) ??
    "0x18b1E79F7b7a802f75e7F2261a9f7f2Bfbcd831f",
  usdc:
    (import.meta.env.VITE_USDC_ADDRESS as Hex | undefined) ??
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  treasury:
    (import.meta.env.VITE_GROW_TREASURY as Hex | undefined) ??
    "0x47ea5710ea674f5D653A59c96836E2d20288813a",
  explorer: import.meta.env.VITE_EXPLORER_URL ?? "https://etherscan.io",
  adminWallets: (
    (import.meta.env.VITE_ADMIN_WALLETS as string | undefined)?.split(",") ??
    DEFAULT_ADMIN_WALLETS
  )
    .map((address) => address.trim().toLowerCase())
    .filter(Boolean),
};

type Snapshot = {
  splitterBalance: bigint;
  operationsBalance: bigint;
  treasuryBalance: bigint;
  previewBalance: bigint;
  toTreasury: bigint;
  toOperations: bigint;
  treasuryBps: bigint;
  contractTreasury: Hex;
  contractOperations: Hex;
};

function provider(): EthereumProvider | undefined {
  return window.ethereum;
}

function normalize(address?: string | null): string {
  return (address ?? "").toLowerCase();
}

function short(address?: string | null): string {
  if (!address) return "-";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function padAddress(address: string): string {
  return address.toLowerCase().replace(/^0x/, "").padStart(64, "0");
}

function balanceOfData(address: string): Hex {
  return `0x70a08231${padAddress(address)}`;
}

function previewFlushData(token: string): Hex {
  return `0xfe2c5174${padAddress(token)}`;
}

function flushTokenData(token: string): Hex {
  return `0x9cee789f${padAddress(token)}`;
}

function hexToBigInt(hex: unknown): bigint {
  if (typeof hex !== "string" || !hex.startsWith("0x")) return 0n;
  return BigInt(hex);
}

function decodeAddress(hex: unknown): Hex {
  if (typeof hex !== "string" || !hex.startsWith("0x")) return "0x0000000000000000000000000000000000000000";
  return `0x${hex.slice(-40)}` as Hex;
}

function decodePreview(hex: unknown): [bigint, bigint, bigint] {
  if (typeof hex !== "string" || !hex.startsWith("0x")) return [0n, 0n, 0n];
  const data = hex.slice(2).padEnd(64 * 3, "0");
  return [
    BigInt(`0x${data.slice(0, 64)}`),
    BigInt(`0x${data.slice(64, 128)}`),
    BigInt(`0x${data.slice(128, 192)}`),
  ];
}

function formatUnits(value: bigint, decimals: number): string {
  const sign = value < 0n ? "-" : "";
  const raw = value < 0n ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = raw / base;
  const fraction = (raw % base).toString().padStart(decimals, "0");
  const trimmed = fraction.replace(/0+$/, "");
  return `${sign}${whole.toString()}${trimmed ? `.${trimmed}` : ""}`;
}

function formatUsd(value: bigint): string {
  return `${formatUnits(value, USDC_DECIMALS)} USDC`;
}

async function ethCall(to: Hex, data: Hex): Promise<unknown> {
  const p = provider();
  if (!p) throw new Error("No wallet provider found");
  return p.request({
    method: "eth_call",
    params: [{ to, data }, "latest"],
  });
}

async function switchToMainnet() {
  const p = provider();
  if (!p) throw new Error("No wallet provider found");
  const chainId = (await p.request({ method: "eth_chainId" })) as string;
  if (chainId === MAINNET_CHAIN_ID) return;
  await p.request({
    method: "wallet_switchEthereumChain",
    params: [{ chainId: MAINNET_CHAIN_ID }],
  });
}

export function App() {
  const [account, setAccount] = useState<Hex | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState<"connect" | "read" | "flush" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const isAdmin = useMemo(
    () => Boolean(account && CONFIG.adminWallets.includes(normalize(account))),
    [account],
  );
  const onMainnet = chainId === MAINNET_CHAIN_ID;
  const canFlush =
    isAdmin && onMainnet && Boolean(snapshot && snapshot.splitterBalance > 0n);

  useEffect(() => {
    const p = provider();
    if (!p?.on) return;
    const accountsChanged = (accounts: unknown) => {
      const next = Array.isArray(accounts) ? (accounts[0] as Hex | undefined) : undefined;
      setAccount(next ?? null);
      setSnapshot(null);
    };
    const chainChanged = (next: unknown) => {
      setChainId(typeof next === "string" ? next : null);
      setSnapshot(null);
    };
    p.on("accountsChanged", accountsChanged);
    p.on("chainChanged", chainChanged);
    return () => {
      p.removeListener?.("accountsChanged", accountsChanged);
      p.removeListener?.("chainChanged", chainChanged);
    };
  }, []);

  async function connect() {
    setBusy("connect");
    setError(null);
    try {
      const p = provider();
      if (!p) throw new Error("Install a wallet browser extension or open with a Safe-compatible wallet.");
      await switchToMainnet();
      const accounts = (await p.request({ method: "eth_requestAccounts" })) as Hex[];
      const currentChain = (await p.request({ method: "eth_chainId" })) as string;
      setAccount(accounts[0] ?? null);
      setChainId(currentChain);
      await refresh();
    } catch (err) {
      setError((err as Error).message || "Wallet connection failed");
    } finally {
      setBusy(null);
    }
  }

  async function refresh() {
    setBusy("read");
    setError(null);
    try {
      const p = provider();
      if (!p) throw new Error("No wallet provider found");
      const currentChain = (await p.request({ method: "eth_chainId" })) as string;
      setChainId(currentChain);
      if (currentChain !== MAINNET_CHAIN_ID) {
        setSnapshot(null);
        return;
      }

      const [
        splitterBalance,
        preview,
        treasuryBps,
        contractTreasury,
        contractOperations,
      ] = await Promise.all([
        ethCall(CONFIG.usdc, balanceOfData(CONFIG.feeSplitter)),
        ethCall(CONFIG.feeSplitter, previewFlushData(CONFIG.usdc)),
        ethCall(CONFIG.feeSplitter, "0x4dc10ea1"),
        ethCall(CONFIG.feeSplitter, "0x61d027b3"),
        ethCall(CONFIG.feeSplitter, "0x8b33b4b2"),
      ]);
      const [previewBalance, toTreasury, toOperations] = decodePreview(preview);
      const contractTreasuryAddress = decodeAddress(contractTreasury);
      const contractOperationsAddress = decodeAddress(contractOperations);
      const [operationsBalance, treasuryBalance] = await Promise.all([
        ethCall(CONFIG.usdc, balanceOfData(contractOperationsAddress)),
        ethCall(CONFIG.usdc, balanceOfData(contractTreasuryAddress)),
      ]);
      setSnapshot({
        splitterBalance: hexToBigInt(splitterBalance),
        operationsBalance: hexToBigInt(operationsBalance),
        treasuryBalance: hexToBigInt(treasuryBalance),
        previewBalance,
        toTreasury,
        toOperations,
        treasuryBps: hexToBigInt(treasuryBps),
        contractTreasury: contractTreasuryAddress,
        contractOperations: contractOperationsAddress,
      });
    } catch (err) {
      setError((err as Error).message || "Read failed");
    } finally {
      setBusy(null);
    }
  }

  async function flush() {
    if (!account || !canFlush) return;
    setBusy("flush");
    setError(null);
    setTxHash(null);
    try {
      const p = provider();
      if (!p) throw new Error("No wallet provider found");
      const hash = (await p.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: account,
            to: CONFIG.feeSplitter,
            data: flushTokenData(CONFIG.usdc),
            value: "0x0",
          },
        ],
      })) as string;
      setTxHash(hash);
      window.setTimeout(() => void refresh(), 5_000);
    } catch (err) {
      const message = (err as Error).message || "Flush failed";
      if (!/user rejected|user denied/i.test(message)) setError(message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">GrowFi Admin</p>
          <h1>Fee operations</h1>
        </div>
        <div className="wallet">
          {account ? (
            <>
              <span className={isAdmin ? "dot ok" : "dot bad"} />
              <span>{short(account)}</span>
            </>
          ) : (
            <span>Not connected</span>
          )}
        </div>
      </header>

      <section className="panel hero">
        <div>
          <h2>FeeSplitter flush</h2>
          <p>
            Connect an admin wallet, review the pending USDC balance, then route it
            to Treasury and operations with one on-chain transaction.
          </p>
        </div>
        <button className="primary" onClick={connect} disabled={busy === "connect"}>
          {account ? "Reconnect wallet" : "Login with wallet"}
        </button>
      </section>

      {error && <div className="notice error">{error}</div>}
      {txHash && (
        <a className="notice success" href={`${CONFIG.explorer}/tx/${txHash}`} target="_blank">
          Transaction submitted: {short(txHash)}
        </a>
      )}
      {account && !isAdmin && (
        <div className="notice warn">
          Connected wallet is not in the admin allowlist.
        </div>
      )}
      {account && !onMainnet && (
        <div className="notice warn">
          Switch wallet network to Ethereum mainnet.
        </div>
      )}

      <section className="grid">
        <Metric title="FeeSplitter balance" value={snapshot ? formatUsd(snapshot.splitterBalance) : "-"} />
        <Metric title="To Treasury" value={snapshot ? formatUsd(snapshot.toTreasury) : "-"} />
        <Metric title="To Operations" value={snapshot ? formatUsd(snapshot.toOperations) : "-"} />
      </section>

      <section className="panel">
        <div className="rows">
          <Row label="FeeSplitter" value={CONFIG.feeSplitter} />
          <Row label="Token" value={CONFIG.usdc} />
          <Row label="Treasury" value={snapshot?.contractTreasury ?? CONFIG.treasury} />
          <Row label="Operations" value={snapshot?.contractOperations ?? "-"} />
          <Row
            label="Split"
            value={
              snapshot
                ? `${Number(snapshot.treasuryBps) / 100}% Treasury / ${
                    100 - Number(snapshot.treasuryBps) / 100
                  }% Operations`
                : "-"
            }
          />
          <Row label="Operations USDC balance" value={snapshot ? formatUsd(snapshot.operationsBalance) : "-"} />
          <Row label="Treasury USDC balance" value={snapshot ? formatUsd(snapshot.treasuryBalance) : "-"} />
        </div>

        <div className="actions">
          <button className="secondary" onClick={() => void refresh()} disabled={!account || busy !== null}>
            {busy === "read" ? "Refreshing..." : "Refresh"}
          </button>
          <button className="primary" onClick={() => void flush()} disabled={!canFlush || busy !== null}>
            {busy === "flush" ? "Confirming..." : "Flush USDC"}
          </button>
        </div>
      </section>
    </main>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div className="metric">
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const isAddress = value.startsWith("0x") && value.length >= 42;
  return (
    <div className="row">
      <span>{label}</span>
      {isAddress ? (
        <a href={`${CONFIG.explorer}/address/${value}`} target="_blank">
          {value}
        </a>
      ) : (
        <strong>{value}</strong>
      )}
    </div>
  );
}
