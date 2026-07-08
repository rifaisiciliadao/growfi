"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWriteContract,
} from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import type { Address } from "viem";
import { formatUnits } from "viem";
import { useCampaignData } from "@/contracts/hooks";
import { abis, CHAIN_ID, getAddresses } from "@/contracts";
import {
  campaignTokenConfigAbi,
  readCampaignTokenConfig,
} from "@/contracts/campaign";
import { getEnabledTokens, resolveTokenAddress } from "@/contracts/tokens";
import { erc20Abi } from "@/contracts/erc20";
import {
  isSocialVerificationActive,
  useSubgraphCampaign,
  useSubgraphProducer,
} from "@/lib/subgraph";
import { useTxNotify } from "@/lib/useTxNotify";
import { useProducerProfile, useResolvedCampaignMetadata } from "@/lib/metadata";
import { productUnitLabel } from "@/lib/productUnit";
import { useLocalizedProductDisplay } from "@/lib/useLocalizedProductDisplay";
import { uploadImage, uploadMetadata } from "@/lib/api";
import type { CampaignDmrvMetadata } from "@/lib/dmrv";
import { BuyPanel } from "@/components/BuyPanel";
import { StakingPanel } from "@/components/StakingPanel";
import { HarvestPanel } from "@/components/HarvestPanel";
import { ProducerManagePanel } from "@/components/ProducerManagePanel";
import { ProductiveAssetCard } from "@/components/ProductiveAssetCard";
import { RefundPanel, TriggerBuybackCta } from "@/components/RefundPanel";
import { SellBackPanel } from "@/components/SellBackPanel";
import { RepaymentPanel } from "@/components/RepaymentPanel";
import { EcommerceShopPanel } from "@/components/EcommerceShopPanel";
import { InvestorList } from "@/components/InvestorList";
import { ProjectUpdatesPanel } from "@/components/ProjectUpdatesPanel";
import { ActivateCtaBanner } from "@/components/ActivateCtaBanner";
import { SocialVerificationBadge } from "@/components/SocialVerificationBadge";
import { Spinner } from "@/components/Spinner";
import { RichTextEditor } from "@/components/RichTextEditor";
import { RichTextContent } from "@/components/RichTextContent";
import { waitForTx } from "@/lib/waitForTx";
import { prepareRichTextForStorage } from "@/lib/richText";
import { ECOMMERCE_MODULE_TYPE } from "@/contracts/ecommerce";
import { campaignModuleHostAbi } from "@/contracts/repayment";

const STATE_LABELS = ["funding", "active", "buyback", "ended"] as const;
const WAGMI_CHAIN_ID = CHAIN_ID as never;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;
const PAYMENT_TOKEN_FALLBACK_ADDRESSES = getEnabledTokens(CHAIN_ID).map(
  (token) => resolveTokenAddress(token, CHAIN_ID),
);

type Tab = "invest" | "shop" | "updates" | "silvi" | "stake" | "harvest" | "info" | "manage";
// Manage tab is appended dynamically when the connected wallet is the producer.

function isTabParam(value: string | null): value is Tab {
  return (
    value === "invest" ||
    value === "shop" ||
    value === "updates" ||
    value === "silvi" ||
    value === "stake" ||
    value === "harvest" ||
    value === "info" ||
    value === "manage"
  );
}

export default function CampaignDetail({
  address,
}: {
  address: string;
}) {
  const t = useTranslations("detail");
  const tHome = useTranslations("home");
  const { assetProductLabel } = useLocalizedProductDisplay();
  const searchParams = useSearchParams();
  const initialTab = ((): Tab => {
    const q = searchParams.get("tab");
    return isTabParam(q) ? q : "invest";
  })();
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  useEffect(() => {
    const q = searchParams.get("tab");
    if (isTabParam(q)) {
      setActiveTab(q);
    }
  }, [searchParams]);

  const campaignAddress = address as Address;
  const isValidAddress = /^0x[a-fA-F0-9]{40}$/.test(campaignAddress);

  // Read campaign state on-chain
  const { data: campaignData } = useCampaignData(
    isValidAddress ? campaignAddress : undefined,
  );

  // campaignData order: producer, pricePerToken, minCap, maxCap, currentSupply,
  // fundingDeadline, state, campaignToken, stakingVault, harvestManager
  type MaybeResult = { result?: unknown };
  const cd = campaignData as readonly MaybeResult[] | undefined;
  // Off-chain metadata: subgraph → registry URI → fetch JSON.
  const { data: sgCampaign } = useSubgraphCampaign(
    isValidAddress ? campaignAddress : undefined,
  );

  const sgStateIdx =
    sgCampaign?.state === "Active"
      ? 1
      : sgCampaign?.state === "Buyback"
        ? 2
        : sgCampaign?.state === "Ended"
          ? 3
          : 0;
  const producerAddress =
    (cd?.[0]?.result as Address | undefined) ??
    (sgCampaign?.producer as Address | undefined);
  const pricePerToken =
    (cd?.[1]?.result as bigint | undefined) ??
    (sgCampaign ? BigInt(sgCampaign.pricePerToken) : 0n);
  const minCap =
    (cd?.[2]?.result as bigint | undefined) ??
    (sgCampaign ? BigInt(sgCampaign.minCap) : 0n);
  const maxCap =
    (cd?.[3]?.result as bigint | undefined) ??
    (sgCampaign ? BigInt(sgCampaign.maxCap) : 0n);
  const currentSupply =
    (cd?.[4]?.result as bigint | undefined) ??
    (sgCampaign ? BigInt(sgCampaign.currentSupply) : 0n);
  const fundingDeadline =
    (cd?.[5]?.result as bigint | undefined) ??
    (sgCampaign ? BigInt(sgCampaign.fundingDeadline) : 0n);
  const stateIdx = (cd?.[6]?.result as number | undefined) ?? sgStateIdx;
  const campaignTokenAddr =
    (cd?.[7]?.result as Address | undefined) ??
    (sgCampaign?.campaignToken as Address | undefined);
  const stakingVaultAddr =
    (cd?.[8]?.result as Address | undefined) ??
    (sgCampaign?.stakingVault as Address | undefined);
  const harvestManagerAddr =
    (cd?.[9]?.result as Address | undefined) ??
    (sgCampaign?.harvestManager as Address | undefined);
  const yieldTokenAddr = sgCampaign?.yieldToken as Address | undefined;
  const hasOnChainData = !!cd?.[0]?.result;
  const hasIndexedData = !!sgCampaign;
  const hasCampaignData = hasOnChainData || hasIndexedData;
  const hasBuyData =
    hasCampaignData &&
    !!campaignTokenAddr &&
    pricePerToken > 0n &&
    maxCap > 0n;
  const panelCampaignToken = campaignTokenAddr ?? ZERO_ADDRESS;
  const stateKey = STATE_LABELS[stateIdx] ?? "funding";

  // Direct on-chain read of Treasury's CT balance — used as a fallback when the
  // subgraph isn't indexing yet (local anvil, fresh deploy). The funding bar
  // splits direct backers vs Treasury auto-alloc using whichever is fresher.
  const { growTreasury } = getAddresses();
  const { data: treasuryCtBalance } = useReadContract({
    abi: erc20Abi,
    address: campaignTokenAddr,
    chainId: WAGMI_CHAIN_ID,
    functionName: "balanceOf",
    args: growTreasury ? [growTreasury] : undefined,
    query: {
      enabled: Boolean(campaignTokenAddr && growTreasury),
      refetchInterval: 15_000,
    },
  });
  const { data: metadata } = useResolvedCampaignMetadata(
    isValidAddress ? campaignAddress : undefined,
    sgCampaign?.metadataURI,
    sgCampaign?.metadataVersion,
  );

  // Producer-only recovery: show the "Link metadata" banner when the
  // CampaignRegistry has no URI for this campaign. Happens when the create
  // flow's setMetadata step was rejected or missed before we made it mandatory.
  const { address: connected } = useAccount();
  const isProducerViewing =
    !!connected &&
    !!producerAddress &&
    connected.toLowerCase() === producerAddress.toLowerCase();
  const metadataMissing =
    !!sgCampaign &&
    !metadata &&
    (!sgCampaign.metadataURI || sgCampaign.metadataURI === "");

  const { data: ecommerceSlotData } = useReadContract({
    address: isValidAddress ? campaignAddress : undefined,
    abi: campaignModuleHostAbi,
    chainId: WAGMI_CHAIN_ID,
    functionName: "moduleSlot",
    args: [ECOMMERCE_MODULE_TYPE],
    query: { enabled: isValidAddress, refetchInterval: 20_000 },
  });
  const ecommerceSlot = ecommerceSlotData as
    | readonly [Address, `0x${string}`, string, bigint, boolean]
    | undefined;
  const hasEcommerce =
    Boolean(ecommerceSlot?.[4]) &&
    ecommerceSlot?.[0] !== ZERO_ADDRESS;
  const visibleTabs: Tab[] = [
    "invest",
    "info",
    "updates",
    ...(hasEcommerce ? (["shop"] as Tab[]) : []),
    ...(metadata?.dmrv ? (["silvi"] as Tab[]) : []),
    "stake",
    "harvest",
    ...(isProducerViewing ? (["manage"] as Tab[]) : []),
  ];
  const effectiveTab = visibleTabs.includes(activeTab) ? activeTab : "invest";

  const displayName =
    metadata?.name ||
    (isValidAddress
      ? `Campaign ${campaignAddress.slice(0, 6)}…${campaignAddress.slice(-4)}`
      : "Campaign");
  const displayLocation = metadata?.location ?? "";
  const displayAssetProduct = assetProductLabel(metadata?.productType);
  const heroImage = metadata?.image || null;
  const heroStyle = heroImage
    ? { backgroundImage: `url('${heroImage}')` }
    : {
        backgroundImage:
          "linear-gradient(135deg, #bde4b7 0%, #7bc17a 50%, #2d6a2e 100%)",
      };

  return (
    <>
      <section
        className="relative flex h-72 w-full items-end overflow-hidden bg-cover bg-center px-4 pb-8 md:h-[22rem] md:px-8 md:pb-12 lg:px-16"
        style={heroStyle}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/82 via-black/44 to-black/12" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_76%_18%,rgba(127,252,151,0.18),transparent_28rem)]" />
        <div className="relative z-10 w-full max-w-7xl mx-auto flex flex-col gap-3 md:gap-4">
          <nav className="flex min-h-[32px] items-center text-xs font-bold uppercase tracking-[0.14em] text-white/72">
            <Link href="/" className="inline-flex items-center min-h-[32px] hover:text-white transition-colors">
              {t("breadcrumb")}
            </Link>
            <span className="mx-2">/</span>
            <span className="text-white truncate">{displayName}</span>
          </nav>
          <div className="flex items-start justify-between flex-wrap gap-3 md:gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="max-w-5xl break-words text-4xl font-extrabold leading-[0.98] tracking-[-0.055em] text-white sm:text-5xl md:text-7xl">
                {displayName}
              </h1>
              {(displayLocation || displayAssetProduct) && (
                <p className="mt-3 text-sm font-medium text-white/88 md:text-base">
                  {[displayAssetProduct, displayLocation]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </div>
            <span className="inline-flex shrink-0 items-center rounded-full bg-primary-fixed px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-on-primary-fixed-variant shadow-[0_16px_40px_-24px_rgba(127,252,151,0.9)] backdrop-blur-md md:px-4 md:py-2 md:text-xs">
              {tHome(
                stateKey === "buyback"
                  ? "state.ended"
                  : (`state.${stateKey}` as "state.funding" | "state.active" | "state.ended"),
              )}
            </span>
          </div>
        </div>
      </section>

      <div className="sticky top-20 z-40 bg-surface/82 backdrop-blur-xl border-b border-outline-variant/15">
        <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-16 flex gap-3 md:gap-5 overflow-x-auto no-scrollbar">
          {visibleTabs.map((key) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`app-control py-4 text-sm md:text-base font-bold tracking-[-0.01em] transition-colors border-b-2 whitespace-nowrap ${
                effectiveTab === key
                  ? "text-primary border-primary"
                  : "text-on-surface-variant border-transparent hover:text-on-surface"
              } ${key === "manage" ? "text-primary" : ""}`}
            >
              {t(`tabs.${key}`)}
            </button>
          ))}
        </div>
      </div>

      {isProducerViewing && hasCampaignData && (
        <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-16 pt-4">
          <ActivateCtaBanner
            campaignAddress={campaignAddress}
            currentState={stateIdx}
            currentSupply={currentSupply}
            minCap={minCap}
            isProducerViewing={isProducerViewing}
          />
        </div>
      )}

      {isProducerViewing && metadataMissing && (
        <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-16 pt-4">
          <LinkMetadataBanner
            campaignAddress={campaignAddress}
            currentName={displayName}
          />
        </div>
      )}

      {isProducerViewing && hasOnChainData && sgCampaign && (
        <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-16 pt-4">
          <CollateralMissingBanner
            currentState={stateIdx}
            annualHarvestUsd18={BigInt(
              sgCampaign.expectedAnnualHarvestUsd ?? "0",
            )}
            coverageHarvests={BigInt(sgCampaign.coverageHarvests ?? "0")}
            collateralLocked6={BigInt(sgCampaign.collateralLocked ?? "0")}
            onGoToManage={() => setActiveTab("manage")}
          />
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-16 pb-5 pt-4 md:pb-8 md:pt-5 flex flex-col lg:flex-row gap-8 md:gap-12 items-start">
        <div className="w-full lg:w-[65%] flex flex-col gap-6">
          {effectiveTab === "invest" && (
            <>
              <FundingProgressCard
                currentSupply={currentSupply}
                maxCap={maxCap}
                minCap={minCap}
                pricePerToken={pricePerToken}
                fundingDeadline={fundingDeadline}
                treasuryTokensOut={
                  sgCampaign?.treasuryTokensOut
                    ? BigInt(sgCampaign.treasuryTokensOut)
                    : ((treasuryCtBalance as bigint | undefined) ?? 0n)
                }
                hasOnChainData={hasCampaignData}
              />

              {hasCampaignData && (
                <TriggerBuybackCta
                  campaignAddress={campaignAddress}
                  currentState={stateIdx}
                  currentSupply={currentSupply}
                  minCap={minCap}
                  fundingDeadline={fundingDeadline}
                />
              )}

              {!hasBuyData ? (
                <div className="app-card rounded-[1.35rem] p-8 text-center text-sm text-on-surface-variant">
                  {t("buy.loadingCampaign")}
                </div>
              ) : stateIdx === 2 ? (
                <RefundPanel
                  campaignAddress={campaignAddress}
                  campaignToken={panelCampaignToken}
                  currentState={stateIdx}
                />
              ) : (
                <>
                  <BuyPanel
                    campaignAddress={campaignAddress}
                    campaignToken={panelCampaignToken}
                    pricePerToken={pricePerToken}
                    currentSupply={currentSupply}
                    maxCap={maxCap}
                    currentState={stateIdx}
                    annualHarvestUsd18={
                      sgCampaign
                        ? BigInt(sgCampaign.expectedAnnualHarvestUsd ?? "0")
                        : 0n
                    }
                    annualHarvest18={
                      sgCampaign
                        ? BigInt(sgCampaign.expectedAnnualHarvest ?? "0")
                        : 0n
                    }
                    productUnit={productUnitLabel(metadata?.productType)}
                    firstHarvestYear={
                      sgCampaign
                        ? BigInt(sgCampaign.firstHarvestYear ?? "0")
                        : 0n
                    }
                  />
                  <SellBackPanel
                    campaignAddress={campaignAddress}
                    campaignToken={panelCampaignToken}
                    currentState={stateIdx}
                  />
                  <RepaymentPanel
                    campaignAddress={campaignAddress}
                    campaignToken={panelCampaignToken}
                    currentState={stateIdx}
                    repaymentPool={sgCampaign?.repaymentPool ?? null}
                  />
                </>
              )}

              {hasCampaignData && campaignTokenAddr && (
                <InvestorList
                  campaignAddress={campaignAddress}
                  campaignToken={campaignTokenAddr}
                  currentSupply={currentSupply}
                />
              )}
            </>
          )}

          {effectiveTab === "shop" && hasCampaignData && hasEcommerce && (
            <EcommerceShopPanel
              campaignAddress={campaignAddress}
              currentState={stateIdx}
              campaignName={displayName}
            />
          )}

          {effectiveTab === "updates" && hasCampaignData && (
            <ProjectUpdatesPanel campaignAddress={campaignAddress} />
          )}

          {effectiveTab === "silvi" && metadata?.dmrv && (
            <SilviProtocolPanel dmrv={metadata.dmrv} />
          )}

          {effectiveTab === "stake" &&
            hasCampaignData &&
            stakingVaultAddr &&
            campaignTokenAddr &&
            yieldTokenAddr && (
            <StakingPanel
              campaignAddress={campaignAddress}
              campaignToken={campaignTokenAddr}
              stakingVault={stakingVaultAddr}
              yieldToken={yieldTokenAddr}
              seasonDuration={sgCampaign ? BigInt(sgCampaign.seasonDuration) : 0n}
            />
          )}
          {effectiveTab === "harvest" &&
            hasCampaignData &&
            harvestManagerAddr &&
            yieldTokenAddr && (
            <HarvestPanel
              campaignAddress={campaignAddress}
              harvestManager={harvestManagerAddr}
              yieldToken={yieldTokenAddr}
            />
          )}
          {effectiveTab === "info" && (
            <InfoPanel
              address={address}
              description={metadata?.description}
              location={displayLocation}
              createdAtBlock={sgCampaign?.createdAtBlock}
            />
          )}
          {effectiveTab === "manage" &&
            isProducerViewing &&
            hasCampaignData &&
            sgCampaign &&
            stakingVaultAddr &&
            harvestManagerAddr && (
              <ProducerManagePanel
                campaignAddress={campaignAddress}
                harvestManager={harvestManagerAddr}
                stakingVault={stakingVaultAddr}
                metadata={metadata ?? null}
                currentState={stateIdx}
                minProductClaim={BigInt(sgCampaign.minProductClaim)}
                seasonDuration={BigInt(sgCampaign.seasonDuration)}
              />
            )}
        </div>

        <aside className="w-full lg:w-[35%] sticky top-40 flex flex-col gap-4">
          <StatsCard
            pricePerToken={pricePerToken}
            maxCap={maxCap}
            currentSupply={currentSupply}
            totalStaked={
              sgCampaign ? BigInt(sgCampaign.totalStaked) : 0n
            }
            currentYieldRate={
              sgCampaign ? BigInt(sgCampaign.currentYieldRate) : 0n
            }
          />
          {sgCampaign && (
            <ProductiveAssetCard
              annualHarvestUsd18={BigInt(sgCampaign.expectedAnnualHarvestUsd ?? "0")}
              annualHarvest18={BigInt(sgCampaign.expectedAnnualHarvest ?? "0")}
              productUnit={productUnitLabel(metadata?.productType)}
              firstHarvestYear={BigInt(sgCampaign.firstHarvestYear ?? "0")}
              coverageHarvests={BigInt(sgCampaign.coverageHarvests ?? "0")}
              maxCap18={maxCap}
              pricePerToken18={pricePerToken}
              collateralLocked6={BigInt(sgCampaign.collateralLocked ?? "0")}
              collateralDrawn6={BigInt(sgCampaign.collateralDrawn ?? "0")}
            />
          )}
          <TokensAcceptedCard
            campaignAddress={isValidAddress ? campaignAddress : undefined}
          />
          <ProducerCard
            producer={producerAddress}
          />
        </aside>
      </div>
    </>
  );
}

/**
 * CollateralMissingBanner — producer-only nudge that appears when the
 * campaign committed coverageHarvests > 0 in the v3 fields but
 * collateralLocked is below the required floor. Hidden once funded, hidden
 * post-Funding/Active (the contract refuses lockCollateral in Buyback or
 * Ended state, so nudging there would be a dead-end). CTA flips the active
 * tab to "manage" — same single-page state, no navigation, so the producer
 * lands directly on the CollateralSection inside ProducerManagePanel.
 */
function CollateralMissingBanner({
  currentState,
  annualHarvestUsd18,
  coverageHarvests,
  collateralLocked6,
  onGoToManage,
}: {
  currentState: number;
  annualHarvestUsd18: bigint;
  coverageHarvests: bigint;
  collateralLocked6: bigint;
  onGoToManage: () => void;
}) {
  const t = useTranslations("detail.collateralMissing");

  // Required = annualHarvestUsd × coverageHarvests, rescaled from 18-dec
  // (subgraph store) to 6-dec (USDC actually deposited via lockCollateral).
  // Collateral has no commitment to fund → banner hidden.
  if (coverageHarvests === 0n || annualHarvestUsd18 === 0n) return null;
  // Banner only meaningful while collateral can still be locked.
  // Campaign.lockCollateral guards Funding (0) | Active (1) only.
  if (currentState !== 0 && currentState !== 1) return null;

  const required18 = annualHarvestUsd18 * coverageHarvests;
  // 18-dec USD → 6-dec USDC: divide by 1e12.
  const required6 = required18 / 10n ** 12n;
  if (collateralLocked6 >= required6) return null;

  const missing6 = required6 - collateralLocked6;
  const requiredUsd = Number(required6) / 1e6;
  const missingUsd = Number(missing6) / 1e6;
  const lockedUsd = Number(collateralLocked6) / 1e6;
  const fmt$ = (n: number) =>
    `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  return (
    <div className="rounded-2xl border border-amber-300/40 bg-amber-50 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-10 h-10 rounded-full bg-amber-200/60 flex items-center justify-center text-amber-800">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-amber-900 mb-0.5">
            {t("title")}
          </h3>
          <p className="text-xs text-amber-800 leading-snug">
            {t("body", {
              locked: fmt$(lockedUsd),
              required: fmt$(requiredUsd),
              missing: fmt$(missingUsd),
              coverage: coverageHarvests.toString(),
            })}
          </p>
        </div>
      </div>
      <button
        onClick={onGoToManage}
        className="shrink-0 bg-amber-900 text-white text-xs font-bold px-4 py-2.5 rounded-full hover:bg-amber-800 transition whitespace-nowrap"
      >
        {t("cta")}
      </button>
    </div>
  );
}

/**
 * Recovery UI: producer forgot to (or failed to) sign `setMetadata` during
 * the create flow, so the CampaignRegistry has no URI → card + hero show
 * the raw address. Here the producer re-uploads the image + metadata JSON
 * and signs setMetadata; on confirmation we invalidate the subgraph query
 * so the page re-renders with the new name/image.
 */
function LinkMetadataBanner({
  campaignAddress,
  currentName,
}: {
  campaignAddress: Address;
  currentName: string;
}) {
  const t = useTranslations("detail.linkMetadata");
  const tx = useTranslations("tx");
  const notify = useTxNotify();
  const { registry } = getAddresses();
  const queryClient = useQueryClient();
  const { writeContractAsync } = useWriteContract();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [stage, setStage] = useState<
    | { kind: "idle" }
    | { kind: "uploading" }
    | { kind: "signing" }
    | { kind: "confirming" }
    | { kind: "indexing" }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  const handleImage = (file: File) => {
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setStage({ kind: "error", message: t("nameRequired") });
      return;
    }
    try {
      setStage({ kind: "uploading" });
      let imageUrl: string | undefined;
      if (imageFile) {
        const up = await uploadImage(imageFile);
        imageUrl = up.url;
      }
      const meta = await uploadMetadata({
        name: name.trim(),
        description: prepareRichTextForStorage(description),
        location: location.trim(),
        productType: "",
        imageUrl,
      });

      setStage({ kind: "signing" });
      const hash = await writeContractAsync({
        address: registry,
        abi: abis.CampaignRegistry as never,
        functionName: "setMetadata",
        args: [campaignAddress, meta.url],
      });
      setStage({ kind: "confirming" });
      const r = await waitForTx(hash);
      if (r.status !== "success") throw new Error("setMetadata reverted");
      notify.success(tx("setMetadataConfirmed"), hash);

      // Poll subgraph until it picks up the new metadataURI, then close.
      setStage({ kind: "indexing" });
      const start = Date.now();
      while (Date.now() - start < 60_000) {
        await queryClient.invalidateQueries({
          queryKey: ["subgraph", "campaign", campaignAddress.toLowerCase()],
        });
        await new Promise((r) => setTimeout(r, 3_000));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/user (rejected|denied)/i.test(msg)) {
        setStage({ kind: "idle" });
      } else {
        setStage({ kind: "error", message: msg });
        notify.error(tx("setMetadataFailed"), err);
      }
    }
  };

  const busy =
    stage.kind === "uploading" ||
    stage.kind === "signing" ||
    stage.kind === "confirming" ||
    stage.kind === "indexing";

  const statusText =
    stage.kind === "uploading"
      ? t("uploading")
      : stage.kind === "signing"
        ? t("signing")
        : stage.kind === "confirming"
          ? t("confirming")
          : stage.kind === "indexing"
            ? t("indexing")
            : t("submit");

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
      <div className="flex items-start gap-3 mb-4">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="text-amber-600 shrink-0 mt-0.5"
        >
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
        </svg>
        <div>
          <h3 className="font-bold text-amber-900 mb-1">{t("title")}</h3>
          <p className="text-sm text-amber-800">
            {t("body", { name: currentName })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("namePlaceholder")}
          disabled={busy}
          className="px-3 py-2 rounded-lg border border-amber-300 bg-white text-sm focus:outline-none focus:border-amber-500 disabled:opacity-50"
        />
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder={t("locationPlaceholder")}
          disabled={busy}
          className="px-3 py-2 rounded-lg border border-amber-300 bg-white text-sm focus:outline-none focus:border-amber-500 disabled:opacity-50"
        />
      </div>

      <RichTextEditor
        value={description}
        onChange={setDescription}
        placeholder={t("descriptionPlaceholder")}
        disabled={busy}
        className="mb-4"
      />

      <label className="block mb-4">
        <span className="block text-xs font-semibold text-amber-900 mb-1 uppercase tracking-wider">
          {t("image")}
        </span>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleImage(f);
          }}
          disabled={busy}
          className="text-sm"
        />
        {imagePreview && (
          <img
            src={imagePreview}
            alt=""
            className="mt-2 h-24 rounded-lg object-cover border border-amber-200"
          />
        )}
      </label>

      {stage.kind === "error" && (
        <div className="mb-3 text-sm text-error break-words">
          {stage.message}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={busy || !name.trim()}
        className="regen-gradient text-white px-6 py-2.5 rounded-full font-semibold text-sm hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      >
        {busy && <Spinner size={16} />}
        {statusText}
      </button>
    </div>
  );
}

function FundingProgressCard({
  currentSupply,
  maxCap,
  minCap,
  pricePerToken,
  fundingDeadline,
  treasuryTokensOut,
  hasOnChainData,
}: {
  currentSupply: bigint;
  maxCap: bigint;
  minCap: bigint;
  pricePerToken: bigint;
  fundingDeadline: bigint;
  /** Tokens minted to the GROW Treasury via auto-allocation (subgraph-tracked). */
  treasuryTokensOut: bigint;
  hasOnChainData: boolean;
}) {
  const t = useTranslations("detail.funding");

  let raisedNum = 0;
  let targetNum = 0;
  let minCapNum = 0;
  let directRaisedNum = 0;
  let treasuryRaisedNum = 0;
  let pct = 0;
  let minCapPct = 0;
  let directPct = 0;
  let treasuryPct = 0;
  let daysLeft = 0;
  let softCapReached = false;

  if (hasOnChainData && maxCap > 0n) {
    // tokens × pricePerToken / 1e18 = USD (both 18 dec)
    const raisedUsd =
      (currentSupply * pricePerToken) / 10n ** 18n / 10n ** 18n;
    const targetUsd = (maxCap * pricePerToken) / 10n ** 18n / 10n ** 18n;
    const minCapUsd = (minCap * pricePerToken) / 10n ** 18n / 10n ** 18n;
    // Treasury portion (clamp at currentSupply — defensive against subgraph drift).
    const treasuryTokens =
      treasuryTokensOut > currentSupply ? currentSupply : treasuryTokensOut;
    const directTokens = currentSupply - treasuryTokens;
    const treasuryUsd =
      (treasuryTokens * pricePerToken) / 10n ** 18n / 10n ** 18n;
    const directUsd =
      (directTokens * pricePerToken) / 10n ** 18n / 10n ** 18n;
    raisedNum = Number(raisedUsd);
    targetNum = Number(targetUsd);
    minCapNum = Number(minCapUsd);
    treasuryRaisedNum = Number(treasuryUsd);
    directRaisedNum = Number(directUsd);
    pct = maxCap > 0n ? Number((currentSupply * 100n) / maxCap) : 0;
    minCapPct = maxCap > 0n ? Number((minCap * 100n) / maxCap) : 0;
    directPct = maxCap > 0n ? Number((directTokens * 100n) / maxCap) : 0;
    treasuryPct = maxCap > 0n ? Number((treasuryTokens * 100n) / maxCap) : 0;
    softCapReached = currentSupply >= minCap;
    const now = Math.floor(Date.now() / 1000);
    const delta = Number(fundingDeadline) - now;
    daysLeft = delta > 0 ? Math.ceil(delta / 86400) : 0;
  }

  return (
    <div className="app-card rounded-[1.35rem] p-8">
      <h2 className="text-base font-semibold text-on-surface mb-6">
        {t("title")}
      </h2>
      <div className="flex justify-between items-end mb-4">
        <div>
          <span className="font-mono text-3xl font-bold tracking-[-0.04em] tabular-nums text-on-surface">
            ${raisedNum.toLocaleString()}
          </span>
          <span className="text-base text-on-surface-variant ml-2">
            {t("raised")}
          </span>
        </div>
        <div className="text-right">
          <span className="text-sm text-on-surface-variant">
            {t("target", { amount: `$${targetNum.toLocaleString()}` })}
          </span>
        </div>
      </div>
      {/*
        Three-layer progress bar:
          • dark green: direct backers (regular wallets buying CampaignTokens)
          • light green: GROW Treasury auto-allocation (the protocol itself)
          • vertical tick at the soft cap so investors see how close the
            campaign is to being viable.
        The Treasury segment sits ON TOP of direct (i.e. left-anchored at
        directPct%) so the visual order matches the tooltip math.
      */}
      <div className="relative w-full h-2 bg-surface-container-high rounded-full overflow-hidden">
        {directPct > 0 && (
          <div
            className="absolute left-0 top-0 h-full bg-primary transition-all duration-700"
            style={{ width: `${Math.min(directPct, 100)}%` }}
            title={`Direct backers $${directRaisedNum.toLocaleString()}`}
          />
        )}
        {treasuryPct > 0 && (
          <div
            className="absolute top-0 h-full transition-all duration-700"
            style={{
              left: `${Math.min(directPct, 100)}%`,
              width: `${Math.min(treasuryPct, 100 - directPct)}%`,
              backgroundColor: "#7BB68A",
            }}
            title={`Treasury auto-alloc $${treasuryRaisedNum.toLocaleString()}`}
          />
        )}
        {minCapNum > 0 && minCapPct < 100 && (
          <div
            className="absolute top-[-3px] bottom-[-3px] w-0.5"
            style={{
              left: `${minCapPct}%`,
              backgroundColor: softCapReached ? "#006b2c" : "#3e4a3d",
              opacity: 0.7,
            }}
            title={`min cap $${minCapNum.toLocaleString()}`}
          />
        )}
      </div>
      {treasuryRaisedNum > 0 && (
        <div className="mt-2 flex items-center gap-3 text-[10px] uppercase tracking-wider text-on-surface-variant">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-sm bg-primary" />
            Direct ${directRaisedNum.toLocaleString()}
          </span>
          <span className="flex items-center gap-1">
            <span
              className="inline-block w-2 h-2 rounded-sm"
              style={{ backgroundColor: "#7BB68A" }}
            />
            Treasury ${treasuryRaisedNum.toLocaleString()}
          </span>
        </div>
      )}
      {minCapNum > 0 && (
        <div
          className="relative mt-1 h-3 text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant"
          aria-hidden="true"
        >
          <span
            className="absolute -translate-x-1/2 whitespace-nowrap"
            style={{
              left: `${Math.max(4, Math.min(96, minCapPct))}%`,
              color: softCapReached ? "#006b2c" : undefined,
            }}
          >
            {softCapReached ? "✓ " : ""}
            {t("minCapMarker", {
              amount: `$${minCapNum.toLocaleString()}`,
            })}
          </span>
        </div>
      )}
      <div className="mt-4 flex justify-between items-center">
        <span className="text-xs font-semibold uppercase tracking-wider text-primary">
          {t("completed", { pct })}
        </span>
        <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
          {t("daysLeft", { days: daysLeft })}
        </span>
      </div>
    </div>
  );
}

function InfoPanel({
  address,
  description,
  location,
  createdAtBlock,
}: {
  address: string;
  description?: string;
  location?: string;
  createdAtBlock?: string;
}) {
  const t = useTranslations("detail.info");
  return (
    <div className="app-card rounded-[1.35rem] p-8">
      <h2 className="text-2xl font-bold tracking-tight text-on-surface mb-6">
        {t("title")}
      </h2>
      <div className="space-y-4 text-sm text-on-surface-variant leading-relaxed">
        <RichTextContent value={description} fallback={<p>{t("about")}</p>} />
        {location && (
          <p className="text-on-surface font-semibold">{location}</p>
        )}
        <p>{t("tokens")}</p>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-outline-variant/15">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1">
              {t("contract")}
            </div>
            <div className="font-mono text-xs text-on-surface break-all">
              {address}
            </div>
          </div>
          {createdAtBlock && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1">
                {t("block")}
              </div>
              <div className="text-sm text-on-surface">
                {Number(createdAtBlock).toLocaleString()}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SilviProtocolPanel({ dmrv }: { dmrv: CampaignDmrvMetadata }) {
  const t = useTranslations("detail.silvi");
  const [loaded, setLoaded] = useState(false);

  return (
    <section className="app-card rounded-[1.35rem] p-6 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-primary mb-1">
            {t("eyebrow")}
          </p>
          <h2 className="text-2xl font-bold tracking-tight text-on-surface">
            {t("title", { projectId: dmrv.projectId })}
          </h2>
          <p className="mt-1 text-xs text-on-surface-variant leading-relaxed">
            {t("body")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <a
            href={dmrv.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-full bg-primary text-on-primary px-4 py-2 text-xs font-semibold hover:opacity-90 transition"
          >
            {t("open")}
          </a>
          <a
            href={dmrv.geojsonUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-full border border-outline-variant/30 px-4 py-2 text-xs font-semibold text-on-surface hover:bg-surface-container-high transition"
          >
            {t("geojson")}
          </a>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-outline-variant/20 bg-surface-container-low h-[420px] md:h-[560px]">
        {!loaded && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-surface-container-low">
            <div className="flex flex-col items-center gap-3 text-center px-6">
              <Spinner />
              <p className="text-sm font-semibold text-on-surface">
                {t("loading")}
              </p>
              <p className="text-xs text-on-surface-variant max-w-sm">
                {t("loadingHint")}
              </p>
            </div>
          </div>
        )}
        <iframe
          src={dmrv.embedUrl}
          title={t("iframeTitle", { projectId: dmrv.projectId })}
          className="absolute inset-0 h-full w-full border-0"
          loading="lazy"
          sandbox="allow-scripts allow-same-origin allow-popups"
          onLoad={() => setLoaded(true)}
        />
      </div>
    </section>
  );
}

function StatsCard({
  pricePerToken,
  maxCap,
  currentSupply,
  totalStaked,
  currentYieldRate,
}: {
  pricePerToken: bigint;
  maxCap: bigint;
  currentSupply: bigint;
  totalStaked: bigint;
  currentYieldRate: bigint;
}) {
  const t = useTranslations("detail.sidebar");

  const priceUsd = Number(formatUnits(pricePerToken, 18));
  const maxCapNum = Number(formatUnits(maxCap, 18));
  const soldNum = Number(formatUnits(currentSupply, 18));
  const yieldRate =
    Math.round(Number(formatUnits(currentYieldRate, 18)) * 10) / 10;
  const stakedPct =
    maxCap > 0n ? Number((totalStaked * 10000n) / maxCap) / 100 : 0;

  const fmtNum = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toFixed(0);
  };

  return (
    <div className="app-card rounded-[1.35rem] p-6">
      <h3 className="text-sm font-semibold text-on-surface mb-4">
        {t("stats")}
      </h3>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <Stat
          label={t("tokenPrice")}
          value={priceUsd > 0 ? `$${priceUsd.toFixed(3)}` : "—"}
        />
        <Stat
          label={t("maxSupply")}
          value={maxCapNum > 0 ? `${fmtNum(maxCapNum)} $CAMP` : "—"}
        />
        <Stat
          label={t("tokensSold")}
          value={soldNum > 0 ? fmtNum(soldNum) : "0"}
        />
      </div>

      <div className="pt-4 border-t border-outline-variant/15">
        <div className="flex justify-between items-end mb-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
            {t("yieldRate")}
          </span>
          <span className="font-mono text-2xl font-bold tabular-nums text-primary">
            {yieldRate > 0 ? `${yieldRate}x` : "—"}
          </span>
        </div>
        <p className="text-[11px] text-on-surface-variant mb-3">
          {t("yieldStakedShare", {
            pct: stakedPct.toLocaleString(undefined, {
              maximumFractionDigits: 1,
            }),
          })}
        </p>

        <YieldRateCurve stakedPct={stakedPct} currentRate={yieldRate} />

        <p className="text-xs text-on-surface-variant mt-3">{t("yieldHint")}</p>
      </div>
    </div>
  );
}

/**
 * Inline SVG chart of `rate = 5 - 4 * (totalStaked / maxSupply)` — the
 * stake-yield decay curve mandated by StakingVault.currentYieldRate().
 *
 * Visual design: solid green line from (0%, 5x) top-left to (100%, 1x)
 * bottom-right, filled underneath with a downward gradient that fades to
 * transparent. Y-axis labels (5x/3x/1x) + gridlines inside the chart area;
 * the current staked-% position is marked with a filled primary dot plus a
 * pulsing halo so the viewer's eye lands on it immediately. Zero deps
 * (no charting library).
 */
function YieldRateCurve({
  stakedPct,
  currentRate,
}: {
  stakedPct: number;
  currentRate: number;
}) {
  const t = useTranslations("detail.sidebar");
  const W = 280;
  const H = 120;
  const PAD_L = 22;
  const PAD_R = 10;
  const PAD_TOP = 10;
  const PAD_BOTTOM = 18;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_TOP - PAD_BOTTOM;

  // Map pct [0,100] → x, rate [1,5] → y (5x at top).
  const xFor = (pct: number) =>
    PAD_L + (innerW * Math.min(100, Math.max(0, pct))) / 100;
  const yFor = (rate: number) => {
    const clamped = Math.min(5, Math.max(1, rate));
    return PAD_TOP + (innerH * (5 - clamped)) / 4;
  };

  const curX = xFor(stakedPct);
  const curY = yFor(currentRate);
  const baseY = PAD_TOP + innerH;
  const x0 = xFor(0);
  const x100 = xFor(100);
  const y5 = yFor(5);
  const y1 = yFor(1);
  const y3 = yFor(3);

  const gridRates = [5, 4, 3, 2, 1];

  return (
    <div>
      <svg
        width="100%"
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={t("yieldCurveAria", {
          rate: currentRate.toLocaleString(undefined, {
            maximumFractionDigits: 1,
          }),
          pct: stakedPct.toLocaleString(undefined, {
            maximumFractionDigits: 1,
          }),
        })}
      >
        <defs>
          <linearGradient id="growfi-yield-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00873a" stopOpacity="0.45" />
            <stop offset="60%" stopColor="#00873a" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#00873a" stopOpacity="0" />
          </linearGradient>
          <filter id="growfi-yield-glow">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
        </defs>

        {/* Horizontal grid lines at each integer rate */}
        {gridRates.map((r) => {
          const y = yFor(r);
          return (
            <g key={r}>
              <line
                x1={PAD_L}
                y1={y}
                x2={W - PAD_R}
                y2={y}
                stroke="currentColor"
                strokeWidth="0.5"
                opacity={r === 3 ? 0.25 : 0.08}
              />
              {(r === 5 || r === 3 || r === 1) && (
                <text
                  x={PAD_L - 4}
                  y={y + 3}
                  fontSize="9"
                  textAnchor="end"
                  fill="currentColor"
                  opacity="0.55"
                  fontFamily="inherit"
                >
                  {r}x
                </text>
              )}
            </g>
          );
        })}

        {/* Filled area beneath the decay line */}
        <path
          d={`M ${x0} ${y5} L ${x100} ${y1} L ${x100} ${baseY} L ${x0} ${baseY} Z`}
          fill="url(#growfi-yield-fill)"
        />
        {/* Solid decay line */}
        <line
          x1={x0}
          y1={y5}
          x2={x100}
          y2={y1}
          stroke="#006b2c"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* Drop line from marker to x-axis */}
        <line
          x1={curX}
          y1={curY}
          x2={curX}
          y2={baseY}
          stroke="#006b2c"
          strokeWidth="1"
          strokeDasharray="2 3"
          opacity="0.4"
        />

        {/* Pulsing halo */}
        <circle
          cx={curX}
          cy={curY}
          r="12"
          fill="#00873a"
          filter="url(#growfi-yield-glow)"
          opacity="0.45"
        >
          <animate
            attributeName="r"
            values="8;14;8"
            dur="2.4s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.5;0.15;0.5"
            dur="2.4s"
            repeatCount="indefinite"
          />
        </circle>
        {/* Solid marker */}
        <circle cx={curX} cy={curY} r="4.5" fill="#006b2c" stroke="#fff" strokeWidth="1.5" />

        {/* Y=3 midline label to anchor the scale */}
        <text
          x={W - PAD_R}
          y={y3 - 3}
          fontSize="8"
          textAnchor="end"
          fill="currentColor"
          opacity="0.35"
          fontFamily="inherit"
        >
          3x
        </text>
      </svg>
      <div className="flex justify-between text-[10px] text-on-surface-variant -mt-1">
        <span className="pl-[22px]">{t("yieldCurveStart")}</span>
        <span>{t("yieldCurveEnd")}</span>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1">
        {label}
      </div>
      <div className="font-mono text-base font-semibold tabular-nums text-on-surface">{value}</div>
    </div>
  );
}

function TokensAcceptedCard({
  campaignAddress,
}: {
  campaignAddress: Address | undefined;
}) {
  const t = useTranslations("detail.sidebar");
  const campaignAbi = abis.Campaign as never;

  const { data: acceptedTokens } = useReadContracts({
    contracts: campaignAddress
      ? [
          {
            address: campaignAddress,
            abi: campaignAbi,
            chainId: WAGMI_CHAIN_ID,
            functionName: "getAcceptedTokens",
          },
        ]
      : [],
    query: { enabled: !!campaignAddress },
  });

  const tokens = (acceptedTokens?.[0]?.result as Address[] | undefined) ?? [];
  const tokenCandidates =
    tokens.length > 0 ? tokens : PAYMENT_TOKEN_FALLBACK_ADDRESSES;

  return (
    <div className="app-card rounded-[1.35rem] p-6">
      <h3 className="text-sm font-semibold text-on-surface mb-4">
        {t("acceptedTokens")}
      </h3>
      {tokenCandidates.length === 0 ? (
        <div className="text-xs text-on-surface-variant py-2">
          {t("noTokens")}
        </div>
      ) : (
        <div className="space-y-3">
          {tokenCandidates.map((addr) => (
            <TokenRow
              key={addr}
              tokenAddress={addr}
              campaignAddress={campaignAddress!}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TokenRow({
  tokenAddress,
  campaignAddress,
}: {
  tokenAddress: Address;
  campaignAddress: Address;
}) {
  const t = useTranslations("detail.sidebar");

  const { data } = useReadContracts({
    contracts: [
      {
        address: tokenAddress,
        abi: erc20Abi,
        chainId: WAGMI_CHAIN_ID,
        functionName: "symbol",
      },
      {
        address: campaignAddress,
        abi: campaignTokenConfigAbi,
        chainId: WAGMI_CHAIN_ID,
        functionName: "tokenConfig",
        args: [tokenAddress],
      },
    ],
  });

  const symbol = (data?.[0]?.result as string | undefined) ?? "—";
  const cfg = readCampaignTokenConfig(data?.[1]?.result);
  if (cfg && !cfg.active) return null;
  const isOracle = cfg ? cfg.pricingMode === 1 : false;
  const live = isOracle;

  return (
    <div className="flex items-center justify-between rounded-2xl bg-surface-container-low p-3">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-primary-fixed flex items-center justify-center">
          <span className="text-xs font-bold text-on-primary-fixed-variant">
            {symbol.slice(0, 2)}
          </span>
        </div>
        <div>
          <div className="text-sm font-semibold text-on-surface">{symbol}</div>
          <div className="text-xs text-on-surface-variant">
            {isOracle ? t("oracleRate") : t("fixedRate")}
          </div>
        </div>
      </div>
      {live && (
        <div className="text-xs text-primary font-semibold flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          {t("live")}
        </div>
      )}
    </div>
  );
}

function ProducerCard({ producer }: { producer?: Address }) {
  const t = useTranslations("detail.sidebar");
  const { data: sgProducer } = useSubgraphProducer(producer);
  const { data: profile } = useProducerProfile(
    sgProducer?.profileURI,
    sgProducer?.version,
  );

  const name = profile?.name;
  const location = profile?.location;
  const avatar = profile?.avatar;
  const short = producer
    ? `${producer.slice(0, 6)}…${producer.slice(-4)}`
    : "";

  const initials = (name ?? short).slice(0, 2).toUpperCase();

  return (
    <div className="app-card rounded-[1.35rem] p-6">
      <h3 className="text-sm font-semibold text-on-surface mb-4">
        {t("grower")}
      </h3>
      <div className="flex items-center gap-4 mb-4">
        {avatar ? (
          <img
            src={avatar}
            alt={name ?? short}
            className="w-12 h-12 rounded-full object-cover shrink-0"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white font-bold shrink-0">
            {initials}
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-on-surface truncate">
              {name ?? short}
            </span>
            <SocialVerificationBadge
              verified={isSocialVerificationActive(sgProducer)}
              size={16}
            />
          </div>
          {location && (
            <div className="text-sm text-on-surface-variant mt-0.5 truncate">
              {location}
            </div>
          )}
        </div>
      </div>
      {producer && (
        <Link
          href={`/grower/${producer}`}
          className="w-full py-2 flex items-center justify-center gap-2 text-primary text-sm font-semibold hover:bg-surface-container-low rounded-lg transition"
        >
          {t("viewProfile")} →
        </Link>
      )}
    </div>
  );
}
