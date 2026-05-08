"use client";

import { useMemo, useState } from "react";
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWriteContract,
} from "wagmi";
import {
  formatUnits,
  isAddress,
  parseUnits,
  type Address,
} from "viem";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { abis, getAddresses } from "@/contracts";
import { erc20Abi } from "@/contracts/erc20";
import { useSubgraphCampaigns } from "@/lib/subgraph";
import { Spinner } from "@/components/Spinner";
import { useTxNotify } from "@/lib/useTxNotify";
import { waitForTx } from "@/lib/waitForTx";

const factoryAbi = abis.CampaignFactory as never;
const treasuryAbi = abis.GrowTreasury as never;
const tokenAbi = abis.GrowToken as never;
const campaignAbi = abis.Campaign as never;

const STATE_LABELS = ["Funding", "Active", "Buyback", "Ended"] as const;

/**
 * /grow/admin — multisig-only operations panel.
 *
 * Gated on `factory.owner()`. Non-owner connected wallets see a read-only
 * view (with a banner telling them to switch). Anonymous visits show the
 * connect-wallet prompt. Every write goes through the factory's onlyOwner
 * forwarders, never directly to the underlying GROW contracts.
 */
export default function GrowAdmin() {
  const t = useTranslations("grow.admin");
  const a = getAddresses();
  const { address: connected, isConnected } = useAccount();

  const { data: factoryOwner } = useReadContract({
    abi: factoryAbi,
    address: a.factory,
    functionName: "owner",
    query: { enabled: Boolean(a.factory), refetchInterval: 30_000 },
  });

  const isOwner =
    !!connected &&
    !!factoryOwner &&
    (connected as string).toLowerCase() ===
      (factoryOwner as string).toLowerCase();

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 pt-28 md:px-8">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-[0.2em] text-emerald-700">
          {t("eyebrow")}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900 md:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-600 md:text-base">
          {t("subtitle")}
        </p>
      </header>

      <AccessBanner
        isConnected={isConnected}
        isOwner={isOwner}
        factoryOwner={factoryOwner as Address | undefined}
      />

      <div className="mt-8 grid grid-cols-1 gap-6">
        <TreasuryOverview />
        <AutomationToggle isOwner={isOwner} />
        <TrackedCampaigns isOwner={isOwner} />
        <Allocate isOwner={isOwner} />
        <ReleaseReserve isOwner={isOwner} />
        <SaleControls isOwner={isOwner} />
      </div>
    </div>
  );
}

// ============================================================
// Access banner
// ============================================================

function AccessBanner({
  isConnected,
  isOwner,
  factoryOwner,
}: {
  isConnected: boolean;
  isOwner: boolean;
  factoryOwner?: Address;
}) {
  const t = useTranslations("grow.admin");
  if (!isConnected) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        {t("connectPrompt")}
      </div>
    );
  }
  if (!isOwner) {
    return (
      <div className="rounded-lg border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900">
        <p className="font-semibold">{t("notOwner")}</p>
        <p className="mt-1 text-xs">
          {t("expectedOwner")}{" "}
          <span className="font-mono">{factoryOwner ?? "—"}</span>
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
      {t("ownerConfirmed")}
    </div>
  );
}

// ============================================================
// Treasury overview
// ============================================================

function TreasuryOverview() {
  const t = useTranslations("grow.admin");
  const a = getAddresses();

  const { data: reads } = useReadContracts({
    query: {
      enabled: Boolean(a.growToken && a.growTreasury),
      refetchInterval: 15_000,
    },
    contracts: [
      {
        abi: treasuryAbi,
        address: a.growTreasury as Address,
        functionName: "intrinsicFloorPrice",
      },
      {
        abi: tokenAbi,
        address: a.growToken as Address,
        functionName: "totalSupply",
      },
      {
        abi: tokenAbi,
        address: a.growToken as Address,
        functionName: "balanceOf",
        args: [a.growTreasury as Address],
      },
      {
        abi: treasuryAbi,
        address: a.growTreasury as Address,
        functionName: "automationEnabled",
      },
      {
        abi: treasuryAbi,
        address: a.growTreasury as Address,
        functionName: "trackedCampaignsLength",
      },
      {
        abi: treasuryAbi,
        address: a.growTreasury as Address,
        functionName: "acceptedStablecoinsLength",
      },
      {
        abi: tokenAbi,
        address: a.growToken as Address,
        functionName: "saleActive",
      },
      {
        abi: tokenAbi,
        address: a.growToken as Address,
        functionName: "markupBps",
      },
    ],
  });

  const floor = (reads?.[0]?.result as bigint | undefined) ?? 0n;
  const totalSupply = (reads?.[1]?.result as bigint | undefined) ?? 0n;
  const treasuryGrow = (reads?.[2]?.result as bigint | undefined) ?? 0n;
  const automationOn = (reads?.[3]?.result as boolean | undefined) ?? false;
  const trackedLen = Number((reads?.[4]?.result as bigint | undefined) ?? 0n);
  const stableLen = Number((reads?.[5]?.result as bigint | undefined) ?? 0n);
  const saleActive = (reads?.[6]?.result as boolean | undefined) ?? false;
  const markupBps = (reads?.[7]?.result as bigint | undefined) ?? 1_000n;
  const circulating = totalSupply > treasuryGrow ? totalSupply - treasuryGrow : 0n;

  return (
    <Card title={t("overview.title")}>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat
          label={t("overview.floor")}
          value={
            floor === 0n
              ? "—"
              : `$${Number(formatUnits(floor, 18)).toFixed(4)}`
          }
        />
        <Stat
          label={t("overview.circulating")}
          value={Number(formatUnits(circulating, 18)).toFixed(0)}
          hint={t("overview.totalSupply", {
            total: Number(formatUnits(totalSupply, 18)).toFixed(0),
          })}
        />
        <Stat
          label={t("overview.reserve")}
          value={Number(formatUnits(treasuryGrow, 18)).toFixed(0)}
        />
        <Stat
          label={t("overview.markup")}
          value={`${(Number(markupBps) / 100).toFixed(1)}%`}
        />
      </div>
      <div className="mt-4 flex flex-wrap gap-3 text-xs text-zinc-600">
        <Pill
          label={t("overview.tracked")}
          value={String(trackedLen)}
          tone="neutral"
        />
        <Pill
          label={t("overview.stables")}
          value={String(stableLen)}
          tone="neutral"
        />
        <Pill
          label={t("overview.automation")}
          value={automationOn ? t("overview.on") : t("overview.off")}
          tone={automationOn ? "ok" : "warn"}
        />
        <Pill
          label={t("overview.sale")}
          value={saleActive ? t("overview.on") : t("overview.off")}
          tone={saleActive ? "ok" : "warn"}
        />
      </div>
    </Card>
  );
}

// ============================================================
// Automation toggle
// ============================================================

function AutomationToggle({ isOwner }: { isOwner: boolean }) {
  const t = useTranslations("grow.admin");
  const a = getAddresses();
  const notify = useTxNotify();
  const { writeContractAsync } = useWriteContract();
  const [busy, setBusy] = useState(false);

  const { data: enabled, refetch } = useReadContract({
    abi: treasuryAbi,
    address: a.growTreasury as Address,
    functionName: "automationEnabled",
    query: { enabled: Boolean(a.growTreasury), refetchInterval: 15_000 },
  });

  async function flip(target: boolean) {
    if (!isOwner) return;
    try {
      setBusy(true);
      const hash = await writeContractAsync({
        abi: factoryAbi,
        address: a.factory,
        functionName: "setGrowfiTreasuryAutomationEnabled",
        args: [target],
      });
      await waitForTx(hash);
      notify.success(target ? t("auto.enabled") : t("auto.disabled"), hash);
      refetch();
    } catch (err) {
      const msg =
        (err as Error).message?.split("\n")[0] ?? "Tx failed";
      if (!/user (rejected|denied)/i.test(msg)) {
        notify.error(t("auto.failed"), msg);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title={t("auto.title")} subtitle={t("auto.blurb")}>
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-700">
          {t("auto.current")}:{" "}
          <span
            className={`font-semibold ${
              enabled ? "text-emerald-700" : "text-rose-700"
            }`}
          >
            {enabled ? "ON" : "OFF"}
          </span>
        </p>
        <button
          type="button"
          onClick={() => flip(!enabled)}
          disabled={!isOwner || busy}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
        >
          {busy && <Spinner />}
          {enabled ? t("auto.turnOff") : t("auto.turnOn")}
        </button>
      </div>
    </Card>
  );
}

// ============================================================
// Tracked campaigns
// ============================================================

function TrackedCampaigns({ isOwner }: { isOwner: boolean }) {
  const t = useTranslations("grow.admin");
  const a = getAddresses();
  const notify = useTxNotify();
  const { writeContractAsync } = useWriteContract();

  const [busy, setBusy] = useState<string | null>(null);
  const [newAddr, setNewAddr] = useState<string>("");

  const { data: lenRes, refetch: refetchLen } = useReadContract({
    abi: treasuryAbi,
    address: a.growTreasury as Address,
    functionName: "trackedCampaignsLength",
    query: { enabled: Boolean(a.growTreasury), refetchInterval: 15_000 },
  });
  const trackedLen = Number((lenRes as bigint | undefined) ?? 0n);

  const idxs = useMemo(
    () => Array.from({ length: trackedLen }, (_, i) => BigInt(i)),
    [trackedLen],
  );

  const { data: addrReads, refetch: refetchAddrs } = useReadContracts({
    query: { enabled: trackedLen > 0 },
    contracts: idxs.map((i) => ({
      abi: treasuryAbi,
      address: a.growTreasury as Address,
      functionName: "trackedCampaignAt",
      args: [i],
    })),
  });

  const addresses = useMemo(
    () =>
      (addrReads ?? [])
        .map((r) => r?.result as Address | undefined)
        .filter((x): x is Address => Boolean(x)),
    [addrReads],
  );

  // Per-campaign on-chain reads: state, currentSupply, maxCap, pricePerToken,
  // campaignToken (so we can also read Treasury's CT balance per campaign).
  const { data: campReads, refetch: refetchCamps } = useReadContracts({
    query: { enabled: addresses.length > 0 },
    contracts: addresses.flatMap((addr) => [
      { abi: campaignAbi, address: addr, functionName: "state" },
      { abi: campaignAbi, address: addr, functionName: "currentSupply" },
      { abi: campaignAbi, address: addr, functionName: "maxCap" },
      { abi: campaignAbi, address: addr, functionName: "pricePerToken" },
      { abi: campaignAbi, address: addr, functionName: "campaignToken" },
    ]),
  });

  // Also load metadata via subgraph for human-friendly names.
  const { data: sgCampaigns } = useSubgraphCampaigns();
  const metadataByAddr = useMemo(() => {
    const map = new Map<string, string>();
    (sgCampaigns ?? []).forEach((c) => {
      if (c.metadataURI) map.set(c.id.toLowerCase(), c.metadataURI);
    });
    return map;
  }, [sgCampaigns]);

  async function track() {
    if (!isOwner) return;
    if (!isAddress(newAddr)) {
      notify.error(t("track.invalidAddress"), "");
      return;
    }
    try {
      setBusy("track");
      const hash = await writeContractAsync({
        abi: factoryAbi,
        address: a.factory,
        functionName: "addGrowfiTreasuryTrackedCampaign",
        args: [newAddr as Address],
      });
      await waitForTx(hash);
      notify.success(t("track.added"), hash);
      setNewAddr("");
      refetchLen();
      refetchAddrs();
      refetchCamps();
    } catch (err) {
      const msg = (err as Error).message?.split("\n")[0] ?? "Tx failed";
      if (!/user (rejected|denied)/i.test(msg)) {
        notify.error(t("track.failed"), msg);
      }
    } finally {
      setBusy(null);
    }
  }

  async function untrack(addr: Address) {
    if (!isOwner) return;
    try {
      setBusy(addr);
      const hash = await writeContractAsync({
        abi: factoryAbi,
        address: a.factory,
        functionName: "removeGrowfiTreasuryTrackedCampaign",
        args: [addr],
      });
      await waitForTx(hash);
      notify.success(t("track.removed"), hash);
      refetchLen();
      refetchAddrs();
      refetchCamps();
    } catch (err) {
      const msg = (err as Error).message?.split("\n")[0] ?? "Tx failed";
      if (!/user (rejected|denied)/i.test(msg)) {
        notify.error(t("track.failed"), msg);
      }
    } finally {
      setBusy(null);
    }
  }

  async function setHidden(addr: Address, hidden: boolean) {
    if (!isOwner) return;
    try {
      setBusy(addr + ":hide");
      const hash = await writeContractAsync({
        abi: factoryAbi,
        address: a.factory,
        functionName: "setCampaignHidden",
        args: [addr, hidden],
      });
      await waitForTx(hash);
      notify.success(hidden ? t("track.hidden") : t("track.unhidden"), hash);
    } catch (err) {
      const msg = (err as Error).message?.split("\n")[0] ?? "Tx failed";
      if (!/user (rejected|denied)/i.test(msg)) {
        notify.error(t("track.failed"), msg);
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card title={t("track.title")} subtitle={t("track.blurb")}>
      {addresses.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
          {t("track.empty")}
        </div>
      ) : (
        <ul className="divide-y divide-zinc-200">
          {addresses.map((addr, i) => {
            const state = campReads?.[i * 5]?.result as number | undefined;
            const supply = campReads?.[i * 5 + 1]?.result as bigint | undefined;
            const maxCap = campReads?.[i * 5 + 2]?.result as bigint | undefined;
            const price = campReads?.[i * 5 + 3]?.result as bigint | undefined;
            const stateLabel =
              state !== undefined && state < STATE_LABELS.length
                ? STATE_LABELS[state]
                : "?";
            const stateColor =
              state === 1
                ? "text-emerald-700"
                : state === 2
                  ? "text-rose-700"
                  : "text-zinc-500";
            const fillPct =
              maxCap && maxCap > 0n && supply
                ? Number((supply * 100n) / maxCap)
                : 0;
            return (
              <li key={addr} className="py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/campaign/${addr}`}
                      className="block truncate text-sm font-mono text-zinc-900 hover:text-emerald-700"
                    >
                      {addr.slice(0, 8)}…{addr.slice(-6)}
                    </Link>
                    <div className="mt-0.5 flex flex-wrap gap-3 text-[11px] uppercase tracking-wide text-zinc-500">
                      <span className={stateColor}>{stateLabel}</span>
                      <span>{fillPct}% filled</span>
                      <span>
                        {price !== undefined
                          ? `$${Number(formatUnits(price, 18)).toFixed(3)}/CT`
                          : "—"}
                      </span>
                      {metadataByAddr.has(addr.toLowerCase()) && (
                        <span className="text-emerald-600">metadata ✓</span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => setHidden(addr, true)}
                      disabled={!isOwner || busy === addr + ":hide"}
                      className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                      title="hide from public discovery"
                    >
                      {t("track.hide")}
                    </button>
                    <button
                      type="button"
                      onClick={() => untrack(addr)}
                      disabled={!isOwner || busy === addr}
                      className="flex items-center gap-1 rounded-md border border-rose-300 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busy === addr && <Spinner />}
                      {t("track.untrack")}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-5 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
        <label className="block text-xs uppercase tracking-wide text-zinc-500">
          {t("track.addLabel")}
        </label>
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={newAddr}
            onChange={(e) => setNewAddr(e.target.value)}
            placeholder="0x…"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono text-sm focus:border-emerald-600 focus:outline-none"
          />
          <button
            type="button"
            onClick={track}
            disabled={!isOwner || busy === "track" || !isAddress(newAddr)}
            className="flex shrink-0 items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            {busy === "track" && <Spinner />}
            {t("track.add")}
          </button>
        </div>
      </div>
    </Card>
  );
}

// ============================================================
// Allocate (manual + batch)
// ============================================================

function Allocate({ isOwner }: { isOwner: boolean }) {
  const t = useTranslations("grow.admin");
  const a = getAddresses();
  const notify = useTxNotify();
  const { writeContractAsync } = useWriteContract();

  const stableOptions = useMemo(() => {
    const out: { address: Address; symbol: string; decimals: number }[] = [];
    if (a.usdc) out.push({ address: a.usdc, symbol: "USDC", decimals: 6 });
    if (a.usdt) out.push({ address: a.usdt, symbol: "USDT", decimals: 6 });
    if (a.dai) out.push({ address: a.dai, symbol: "DAI", decimals: 18 });
    return out;
  }, [a.usdc, a.usdt, a.dai]);

  const [token, setToken] = useState(stableOptions[0]?.symbol ?? "USDC");
  const [amount, setAmount] = useState("");
  const [campaign, setCampaign] = useState("");
  const [busy, setBusy] = useState<"manual" | "batch" | null>(null);

  const selected =
    stableOptions.find((s) => s.symbol === token) ?? stableOptions[0];
  const amountRaw = useMemo(() => {
    if (!selected || !amount) return 0n;
    try {
      return parseUnits(amount, selected.decimals);
    } catch {
      return 0n;
    }
  }, [selected, amount]);

  // Treasury balance for the selected stable, so the multisig knows how much is available.
  const { data: balRes } = useReadContract({
    abi: erc20Abi,
    address: selected?.address,
    functionName: "balanceOf",
    args: [a.growTreasury as Address],
    query: { enabled: Boolean(selected && a.growTreasury), refetchInterval: 15_000 },
  });
  const treasuryBal = (balRes as bigint | undefined) ?? 0n;

  async function manual() {
    if (!isOwner || !selected || amountRaw === 0n || !isAddress(campaign)) {
      notify.error(t("alloc.invalidInput"), "");
      return;
    }
    try {
      setBusy("manual");
      const hash = await writeContractAsync({
        abi: factoryAbi,
        address: a.factory,
        functionName: "allocateGrowfiTreasury",
        args: [campaign as Address, selected.address, amountRaw],
      });
      await waitForTx(hash);
      notify.success(t("alloc.manualOk"), hash);
      setAmount("");
    } catch (err) {
      const msg = (err as Error).message?.split("\n")[0] ?? "Tx failed";
      if (!/user (rejected|denied)/i.test(msg)) {
        notify.error(t("alloc.failed"), msg);
      }
    } finally {
      setBusy(null);
    }
  }

  async function batch() {
    if (!isOwner || !selected || amountRaw === 0n) {
      notify.error(t("alloc.invalidInput"), "");
      return;
    }
    try {
      setBusy("batch");
      const hash = await writeContractAsync({
        abi: factoryAbi,
        address: a.factory,
        functionName: "allocateAcrossTrackedGrowfiTreasury",
        args: [selected.address, amountRaw],
      });
      await waitForTx(hash);
      notify.success(t("alloc.batchOk"), hash);
      setAmount("");
    } catch (err) {
      const msg = (err as Error).message?.split("\n")[0] ?? "Tx failed";
      if (!/user (rejected|denied)/i.test(msg)) {
        notify.error(t("alloc.failed"), msg);
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card title={t("alloc.title")} subtitle={t("alloc.blurb")}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <label className="text-xs uppercase tracking-wide text-zinc-500">
            {t("alloc.token")}
          </label>
          <div className="mt-1 flex gap-2">
            {stableOptions.map((s) => (
              <button
                key={s.symbol}
                type="button"
                onClick={() => setToken(s.symbol)}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  token === s.symbol
                    ? "bg-emerald-600 text-white"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                }`}
              >
                {s.symbol}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-zinc-500">
            {t("alloc.amount")}
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono text-sm focus:border-emerald-600 focus:outline-none"
          />
          <p className="mt-1 text-[11px] text-zinc-500">
            {t("alloc.balance")}:{" "}
            <span className="font-mono">
              {selected ? formatUnits(treasuryBal, selected.decimals) : "—"}
            </span>{" "}
            {selected?.symbol}
          </p>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-zinc-500">
            {t("alloc.campaignOptional")}
          </label>
          <input
            type="text"
            value={campaign}
            onChange={(e) => setCampaign(e.target.value)}
            placeholder="0x… (manual only)"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono text-xs focus:border-emerald-600 focus:outline-none"
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={manual}
          disabled={
            !isOwner ||
            busy !== null ||
            amountRaw === 0n ||
            !isAddress(campaign)
          }
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
        >
          {busy === "manual" && <Spinner />}
          {t("alloc.manual")}
        </button>
        <button
          type="button"
          onClick={batch}
          disabled={!isOwner || busy !== null || amountRaw === 0n}
          className="flex items-center gap-2 rounded-lg border border-emerald-600 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy === "batch" && <Spinner />}
          {t("alloc.batch")}
        </button>
      </div>
      <p className="mt-2 text-[11px] text-zinc-500">{t("alloc.note")}</p>
    </Card>
  );
}

// ============================================================
// Release reserve
// ============================================================

function ReleaseReserve({ isOwner }: { isOwner: boolean }) {
  const t = useTranslations("grow.admin");
  const a = getAddresses();
  const notify = useTxNotify();
  const { writeContractAsync } = useWriteContract();

  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: balRes, refetch } = useReadContract({
    abi: tokenAbi,
    address: a.growToken as Address,
    functionName: "balanceOf",
    args: [a.growTreasury as Address],
    query: { enabled: Boolean(a.growToken && a.growTreasury), refetchInterval: 15_000 },
  });
  const reserveBal = (balRes as bigint | undefined) ?? 0n;

  const amountRaw = useMemo(() => {
    if (!amount) return 0n;
    try {
      return parseUnits(amount, 18);
    } catch {
      return 0n;
    }
  }, [amount]);

  async function release() {
    if (!isOwner || !isAddress(to) || amountRaw === 0n || amountRaw > reserveBal) {
      notify.error(t("release.invalidInput"), "");
      return;
    }
    try {
      setBusy(true);
      const hash = await writeContractAsync({
        abi: factoryAbi,
        address: a.factory,
        functionName: "releaseGrowFromTreasury",
        args: [to as Address, amountRaw],
      });
      await waitForTx(hash);
      notify.success(t("release.ok"), hash);
      setAmount("");
      setTo("");
      refetch();
    } catch (err) {
      const msg = (err as Error).message?.split("\n")[0] ?? "Tx failed";
      if (!/user (rejected|denied)/i.test(msg)) {
        notify.error(t("release.failed"), msg);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title={t("release.title")} subtitle={t("release.blurb")}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="text-xs uppercase tracking-wide text-zinc-500">
            {t("release.to")}
          </label>
          <input
            type="text"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="0x…"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono text-sm focus:border-emerald-600 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-zinc-500">
            {t("release.amount")}
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono text-sm focus:border-emerald-600 focus:outline-none"
          />
          <p className="mt-1 text-[11px] text-zinc-500">
            {t("release.reserve")}:{" "}
            <span className="font-mono">
              {Number(formatUnits(reserveBal, 18)).toFixed(0)}
            </span>{" "}
            $GROW
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={release}
        disabled={
          !isOwner ||
          busy ||
          amountRaw === 0n ||
          amountRaw > reserveBal ||
          !isAddress(to)
        }
        className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
      >
        {busy && <Spinner />}
        {t("release.release")}
      </button>
      <p className="mt-2 text-[11px] text-amber-700">{t("release.warning")}</p>
    </Card>
  );
}

// ============================================================
// Sale controls (pause/unpause + markup)
// ============================================================

function SaleControls({ isOwner }: { isOwner: boolean }) {
  const t = useTranslations("grow.admin");
  const a = getAddresses();
  const notify = useTxNotify();
  const { writeContractAsync } = useWriteContract();

  const [busy, setBusy] = useState<"sale" | "markup" | null>(null);
  const [newMarkup, setNewMarkup] = useState("");

  const { data: reads, refetch } = useReadContracts({
    query: { enabled: Boolean(a.growToken), refetchInterval: 15_000 },
    contracts: [
      {
        abi: tokenAbi,
        address: a.growToken as Address,
        functionName: "saleActive",
      },
      {
        abi: tokenAbi,
        address: a.growToken as Address,
        functionName: "markupBps",
      },
    ],
  });
  const saleActive = (reads?.[0]?.result as boolean | undefined) ?? false;
  const markupBps = (reads?.[1]?.result as bigint | undefined) ?? 1_000n;

  async function flipSale() {
    if (!isOwner) return;
    try {
      setBusy("sale");
      const hash = await writeContractAsync({
        abi: factoryAbi,
        address: a.factory,
        functionName: "setGrowfiTokenSaleActive",
        args: [!saleActive],
      });
      await waitForTx(hash);
      notify.success(saleActive ? t("sale.paused") : t("sale.resumed"), hash);
      refetch();
    } catch (err) {
      const msg = (err as Error).message?.split("\n")[0] ?? "Tx failed";
      if (!/user (rejected|denied)/i.test(msg)) {
        notify.error(t("sale.failed"), msg);
      }
    } finally {
      setBusy(null);
    }
  }

  async function setMarkup() {
    if (!isOwner) return;
    const num = Number(newMarkup);
    if (!Number.isFinite(num) || num < 0 || num > 50) {
      notify.error(t("sale.markupRange"), "");
      return;
    }
    try {
      setBusy("markup");
      const bps = BigInt(Math.round(num * 100));
      const hash = await writeContractAsync({
        abi: factoryAbi,
        address: a.factory,
        functionName: "setGrowfiTokenMarkup",
        args: [bps],
      });
      await waitForTx(hash);
      notify.success(t("sale.markupOk"), hash);
      setNewMarkup("");
      refetch();
    } catch (err) {
      const msg = (err as Error).message?.split("\n")[0] ?? "Tx failed";
      if (!/user (rejected|denied)/i.test(msg)) {
        notify.error(t("sale.failed"), msg);
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card title={t("sale.title")} subtitle={t("sale.blurb")}>
      <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
        <p className="text-sm text-zinc-700">
          {t("sale.current")}:{" "}
          <span
            className={`font-semibold ${
              saleActive ? "text-emerald-700" : "text-rose-700"
            }`}
          >
            {saleActive ? "ACTIVE" : "PAUSED"}
          </span>
        </p>
        <button
          type="button"
          onClick={flipSale}
          disabled={!isOwner || busy !== null}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-zinc-300 ${
            saleActive
              ? "bg-rose-600 hover:bg-rose-700"
              : "bg-emerald-600 hover:bg-emerald-700"
          }`}
        >
          {busy === "sale" && <Spinner />}
          {saleActive ? t("sale.pause") : t("sale.resume")}
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label className="text-xs uppercase tracking-wide text-zinc-500">
            {t("sale.markupCurrent")}
          </label>
          <p className="mt-1 font-mono text-lg text-zinc-900">
            {(Number(markupBps) / 100).toFixed(2)}%
          </p>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-zinc-500">
            {t("sale.markupNew")}
          </label>
          <div className="mt-1 flex gap-2">
            <input
              type="text"
              inputMode="decimal"
              value={newMarkup}
              onChange={(e) => setNewMarkup(e.target.value)}
              placeholder="10.0"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono text-sm focus:border-emerald-600 focus:outline-none"
            />
            <button
              type="button"
              onClick={setMarkup}
              disabled={!isOwner || busy !== null || !newMarkup}
              className="flex shrink-0 items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
            >
              {busy === "markup" && <Spinner />}
              {t("sale.markupSave")}
            </button>
          </div>
          <p className="mt-1 text-[11px] text-zinc-500">{t("sale.markupHint")}</p>
        </div>
      </div>
    </Card>
  );
}

// ============================================================
// Shared UI
// ============================================================

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
        {subtitle && (
          <p className="mt-1 text-xs text-zinc-500">{subtitle}</p>
        )}
      </div>
      {children}
    </section>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
      <div className="text-[11px] uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className="mt-1 font-mono text-lg text-zinc-900">{value}</div>
      {hint && <div className="mt-0.5 text-[10px] text-zinc-500">{hint}</div>}
    </div>
  );
}

function Pill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "ok" | "warn" | "neutral";
}) {
  const cls =
    tone === "ok"
      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
      : tone === "warn"
        ? "border-amber-300 bg-amber-50 text-amber-800"
        : "border-zinc-300 bg-zinc-50 text-zinc-700";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 ${cls}`}
    >
      <span className="uppercase tracking-wide">{label}</span>
      <span className="font-mono font-semibold">{value}</span>
    </span>
  );
}
