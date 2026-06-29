"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAccount, useDisconnect, useReadContract, useWriteContract } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import type { Address } from "viem";
import { useTxNotify } from "@/lib/useTxNotify";
import {
  useSubgraphProducer,
  useProducerCampaigns,
  useProducerIndexed,
  isSocialVerificationActive,
  SOCIAL_VERIFICATION_ENABLED,
  type SubgraphCampaign,
  type SubgraphProducer,
} from "@/lib/subgraph";
import {
  useProducerProfile,
  useResolvedCampaignMetadata,
} from "@/lib/metadata";
import { uploadImage, uploadProducerProfile } from "@/lib/api";
import { abis, getAddresses } from "@/contracts";
import { Spinner } from "@/components/Spinner";
import { ProducerAggregateDashboard } from "@/components/ProducerAggregateDashboard";
import { NotificationsSection } from "@/components/NotificationsSection";
import { SocialVerificationBadge } from "@/components/SocialVerificationBadge";
import { SocialVerificationPanel } from "@/components/SocialVerificationPanel";
import { useEnsName } from "@/lib/ens";
import { waitForTx } from "@/lib/waitForTx";
import { getProtocolLabel, protocolInitials } from "@/lib/protocolLabels";

export default function ProducerPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address: raw } = use(params);
  const t = useTranslations("grower");
  const { address: connected } = useAccount();
  const { producerRegistry } = getAddresses();

  const producerAddress = (raw?.toLowerCase() ?? "") as Address;
  const isValid = /^0x[a-fA-F0-9]{40}$/.test(producerAddress);
  const isSelfProfile =
    !!connected && connected.toLowerCase() === producerAddress.toLowerCase();
  const protocolLabel = getProtocolLabel(producerAddress);

  const { data: producer, isLoading: producerLoading } = useSubgraphProducer(
    isValid ? producerAddress : undefined,
  );
  const { data: profile, isLoading: profileLoading } = useProducerProfile(
    producer?.profileURI,
    producer?.version,
  );
  const { data: campaigns, isLoading: campaignsLoading } =
    useProducerCampaigns(isValid ? producerAddress : undefined);
  // ENS reverse-lookup against mainnet — cheap, cached. Used as the
  // display name when there's no internal profile but the wallet has a
  // public ENS identity (e.g. turinglabs.eth). Social verification is NOT
  // promoted by ENS; only the on-chain social attestation triggers the badge.
  const { data: ensName } = useEnsName(isValid ? producerAddress : undefined);
  const { data: onchainSocialActive } = useReadContract({
    address: producerRegistry,
    abi: abis.ProducerRegistry as never,
    functionName: "hasActiveSocialAttestation",
    args: [producerAddress],
    query: {
      enabled: SOCIAL_VERIFICATION_ENABLED && isValid && !protocolLabel,
      refetchInterval: 20_000,
    },
  }) as { data: boolean | undefined };

  /**
   * While the subgraph+JSON is loading we don't know yet whether the
   * producer has a profile — showing "anonymous" immediately would be
   * misleading. Only flip that switch once we've actually fetched and
   * gotten nothing back.
   */
  const profileLoadingCombined =
    producerLoading || (!!producer?.profileURI && profileLoading);
  const displayName =
    protocolLabel || profile?.name || ensName || t("anonymous");

  const [editing, setEditing] = useState(false);

  if (!isValid) {
    return (
      <div className="max-w-7xl mx-auto px-4 md:px-8 pt-32 text-center">
        <p className="text-on-surface-variant">{t("invalidAddress")}</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 pt-28 pb-20">
      {isSelfProfile && (
        <ProducerAggregateDashboard producerAddress={producerAddress} />
      )}

      {profile?.cover && (
        <div
          className="w-full h-48 md:h-60 rounded-2xl bg-cover bg-center mb-8"
          style={{ backgroundImage: `url('${profile.cover}')` }}
        />
      )}

      <div className="flex items-start justify-between flex-wrap gap-4 mb-8">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          {profile?.avatar ? (
            <img
              src={profile.avatar}
              alt={profile.name ?? ""}
              className="w-16 h-16 md:w-20 md:h-20 rounded-full object-cover border border-outline-variant/15 shrink-0"
            />
          ) : (
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-primary-fixed flex items-center justify-center text-on-primary-fixed-variant font-bold text-2xl shrink-0">
              {protocolLabel
                ? protocolInitials(protocolLabel)
                : (profile?.name ?? producerAddress).slice(2, 4).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-on-surface break-words flex items-center gap-2 flex-wrap">
              {profileLoadingCombined ? (
                <span className="inline-block h-8 w-48 rounded-md bg-surface-container-high animate-pulse" />
              ) : (
                <>
                  <span className="break-words">
                    {displayName}
                  </span>
                  <SocialVerificationBadge
                    verified={
                      protocolLabel
                        ? false
                        : isSocialVerificationActive(producer) ||
                          Boolean(onchainSocialActive)
                    }
                    size={20}
                  />
                </>
              )}
            </h1>
            <p className="text-xs md:text-sm text-on-surface-variant font-mono break-all">
              {producerAddress}
            </p>
            <SocialProfileLinks
              producer={producer}
              active={
                !protocolLabel &&
                (isSocialVerificationActive(producer) || Boolean(onchainSocialActive))
              }
            />
            {profile?.location && (
              <p className="text-sm text-on-surface-variant mt-1">
                📍 {profile.location}
              </p>
            )}
          </div>
        </div>

        {isSelfProfile && profile && !editing && !profileLoadingCombined && (
          <button
            onClick={() => setEditing(true)}
            className="bg-primary text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:opacity-90 transition"
          >
            {t("editProfile")}
          </button>
        )}
      </div>

      {profile?.bio && (
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 p-6 mb-10">
          <p className="text-sm text-on-surface leading-relaxed whitespace-pre-line">
            {profile.bio}
          </p>
          {profile.website && (
            <a
              href={profile.website}
              target="_blank"
              rel="noreferrer"
              className="inline-block mt-3 text-primary text-sm hover:underline"
            >
              {profile.website} →
            </a>
          )}
        </div>
      )}

      {profileLoadingCombined ? (
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 p-8 mb-10">
          <div className="space-y-3">
            <div className="h-4 w-3/4 rounded bg-surface-container-high animate-pulse" />
            <div className="h-4 w-1/2 rounded bg-surface-container-high animate-pulse" />
          </div>
        </div>
      ) : (
        !profile &&
        !protocolLabel &&
        !editing && (
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 p-8 mb-10 text-center">
            <p className="text-sm font-semibold text-on-surface">
              {t("noProfileYet")}
            </p>
            <p className="mt-2 text-sm text-on-surface-variant">
              {isSelfProfile ? t("profileSelfHint") : t("profileConnectHint")}
            </p>
            {isSelfProfile && (
              <button
                onClick={() => setEditing(true)}
                className="mt-5 inline-flex items-center justify-center bg-primary text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:opacity-90 transition"
              >
                {t("createProfile")}
              </button>
            )}
          </div>
        )
      )}

      {editing && (
        <ProfileForm
          onDone={() => setEditing(false)}
          current={profile}
          producerAddress={producerAddress}
          previousVersion={producer?.version}
          producer={producer}
          showSocialVerification={SOCIAL_VERIFICATION_ENABLED && !protocolLabel}
        />
      )}

      {isSelfProfile && <NotificationsSection address={producerAddress} />}

      {isSelfProfile && <DisconnectLink />}

      <section>
        <h2 className="text-xl font-bold text-on-surface mb-4">
          {t("campaignsTitle")}
        </h2>
        {campaignsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 overflow-hidden"
              >
                <div className="h-32 bg-surface-container-high animate-pulse" />
                <div className="p-4 space-y-2">
                  <div className="h-4 w-2/3 rounded bg-surface-container-high animate-pulse" />
                  <div className="h-3 w-1/3 rounded bg-surface-container-high animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : !campaigns || campaigns.length === 0 ? (
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 p-8 text-center text-sm text-on-surface-variant">
            {t("noCampaigns")}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {campaigns.map((c) => (
              <CampaignThumb key={c.id} campaign={c} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SocialProfileLinks({
  producer,
  active,
}: {
  producer: SubgraphProducer | null | undefined;
  active: boolean;
}) {
  const t = useTranslations("grower.social");
  if (!active || !producer) return null;

  const link = socialProfileLink(producer);
  if (!link) return null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <a
        href={link.href}
        target="_blank"
        rel="noreferrer"
        title={t("verifiedProfileLink", { handle: link.label })}
        aria-label={t("verifiedProfileLink", { handle: link.label })}
        className="inline-flex h-8 max-w-full items-center gap-2 rounded-full border border-primary/[0.15] bg-primary/[0.08] px-3 text-xs font-semibold text-primary transition hover:border-primary/[0.3] hover:bg-primary/[0.12] focus:outline-none focus:ring-2 focus:ring-primary/[0.3]"
      >
        <SocialPlatformIcon platform={producer.socialPlatform} />
        <span className="truncate">{link.label}</span>
        <ExternalIcon />
      </a>
    </div>
  );
}

function socialProfileLink(producer: SubgraphProducer): { href: string; label: string } | null {
  const rawHandle = producer.socialHandle?.trim();
  const cleanHandle = rawHandle?.replace(/^@+/, "");
  const label = cleanHandle ? `@${cleanHandle}` : producer.socialPlatform?.trim();
  if (!label) return null;

  const profileUrl = normalizeSocialUrl(producer.socialProfileUrl);
  if (profileUrl) return { href: profileUrl, label };

  const platform = producer.socialPlatform?.toLowerCase().trim();
  if ((platform === "x" || platform === "twitter") && cleanHandle) {
    return {
      href: `https://x.com/${encodeURIComponent(cleanHandle)}`,
      label,
    };
  }

  const proofUrl = normalizeSocialUrl(producer.socialProofUrl);
  return proofUrl ? { href: proofUrl, label } : null;
}

function normalizeSocialUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function SocialPlatformIcon({ platform }: { platform: string | null | undefined }) {
  const normalized = platform?.toLowerCase().trim();
  if (normalized === "x" || normalized === "twitter") {
    return (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
        className="shrink-0"
      >
        <path d="M17.53 3h3.31l-7.24 8.27L22.12 21h-6.67l-5.22-6.82L4.25 21H.94l7.74-8.85L.5 3h6.84l4.72 6.24L17.53 3Zm-1.16 16.28h1.83L6.34 4.63H4.37l12 14.65Z" />
      </svg>
    );
  }
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.5 2.8 3.8 5.8 3.8 9S14.5 18.2 12 21" />
      <path d="M12 3C9.5 5.8 8.2 8.8 8.2 12S9.5 18.2 12 21" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0 opacity-70"
    >
      <path d="M7 17 17 7" />
      <path d="M9 7h8v8" />
    </svg>
  );
}

function DisconnectLink() {
  const t = useTranslations("grower");
  const { disconnect } = useDisconnect();
  return (
    <div className="text-right mb-10 -mt-6">
      <button
        onClick={() => disconnect()}
        className="text-xs text-on-surface-variant hover:text-error transition-colors underline-offset-4 hover:underline"
      >
        {t("disconnect")}
      </button>
    </div>
  );
}

function CampaignThumb({ campaign }: { campaign: SubgraphCampaign }) {
  const { data: meta } = useResolvedCampaignMetadata(
    campaign.id,
    campaign.metadataURI,
    campaign.metadataVersion,
  );
  return (
    <Link
      href={`/campaign/${campaign.id}`}
      className="block bg-surface-container-lowest rounded-2xl border border-outline-variant/15 overflow-hidden hover:-translate-y-1 transition-transform"
    >
      {meta?.image && (
        <div
          className="h-32 bg-surface-container-low bg-cover bg-center"
          style={{ backgroundImage: `url('${meta.image}')` }}
        />
      )}
      <div className="p-4">
        <div className="font-semibold text-on-surface truncate">
          {meta?.name || `Campaign ${campaign.id.slice(0, 8)}…`}
        </div>
        <div className="text-xs text-on-surface-variant mt-1">
          {campaign.state}
        </div>
      </div>
    </Link>
  );
}

function ProfileForm({
  current,
  onDone,
  producerAddress,
  previousVersion,
  producer,
  showSocialVerification,
}: {
  current?: { name?: string; bio?: string; avatar?: string | null; cover?: string | null; website?: string | null; location?: string | null } | null;
  onDone: () => void;
  producerAddress: Address;
  /** Subgraph version at the moment the form opened. Undefined if the producer has no profile yet. */
  previousVersion: string | undefined;
  producer: SubgraphProducer | null | undefined;
  showSocialVerification: boolean;
}) {
  const t = useTranslations("grower.form");
  const { producerRegistry } = getAddresses();
  const queryClient = useQueryClient();

  const [name, setName] = useState(current?.name ?? "");
  const [bio, setBio] = useState(current?.bio ?? "");
  const [website, setWebsite] = useState(current?.website ?? "");
  const [location, setLocation] = useState(current?.location ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(current?.avatar ?? null);
  const [coverUrl, setCoverUrl] = useState<string | null>(current?.cover ?? null);

  const [busy, setBusy] = useState<
    null | "uploading" | "profile" | "sig" | "chain" | "indexing"
  >(null);
  const [error, setError] = useState<string | null>(null);

  const { writeContractAsync } = useWriteContract();
  const tx = useTranslations("tx");
  const notify = useTxNotify();

  const pollEnabled = busy === "indexing";
  const indexed = useProducerIndexed(
    producerAddress,
    previousVersion,
    pollEnabled,
  );

  useEffect(() => {
    if (!pollEnabled || !indexed.data) return;
    // Subgraph caught up — invalidate the parent's producer query so the
    // page re-renders with the new name/avatar, then close the form.
    queryClient.invalidateQueries({
      queryKey: ["subgraph", "producer", producerAddress.toLowerCase()],
    });
    onDone();
  }, [pollEnabled, indexed.data, queryClient, producerAddress, onDone]);

  const handleImage = async (
    e: React.ChangeEvent<HTMLInputElement>,
    setUrl: (u: string | null) => void,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setBusy("uploading");
      const up = await uploadImage(file);
      setUrl(up.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const handleSave = async () => {
    setError(null);
    try {
      setBusy("profile");
      const profile = await uploadProducerProfile({
        name,
        bio,
        avatar: avatarUrl,
        cover: coverUrl,
        website: website || null,
        location: location || null,
      });
      setBusy("sig");
      const hash = await writeContractAsync({
        address: producerRegistry,
        abi: abis.ProducerRegistry as never,
        functionName: "setProfile",
        args: [profile.url],
      });
      setBusy("chain");
      const r = await waitForTx(hash);
      if (r.status !== "success") throw new Error("setProfile reverted");
      // Now wait for subgraph to index the new version
      setBusy("indexing");
      notify.success(tx("setProfileConfirmed"), hash);
    } catch (err) {
      setBusy(null);
      const msg = err instanceof Error ? err.message : String(err);
      if (!/user (rejected|denied)/i.test(msg)) {
        setError(msg);
        notify.error(tx("setProfileFailed"), err);
      }
    }
  };

  return (
    <>
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 p-6 mb-6 space-y-4">
        <h3 className="font-semibold text-on-surface mb-2">{t("title")}</h3>

        <Field label={t("name")}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
            placeholder={t("namePlaceholder")}
          />
        </Field>

        <Field label={t("bio")}>
          <textarea
            rows={4}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="input"
            placeholder={t("bioPlaceholder")}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label={t("avatar")}>
            {avatarUrl && (
              <img src={avatarUrl} alt="" className="w-16 h-16 rounded-full object-cover mb-2" />
            )}
            <input type="file" accept="image/*" onChange={(e) => handleImage(e, setAvatarUrl)} className="text-sm" />
          </Field>
          <Field label={t("cover")}>
            {coverUrl && (
              <img src={coverUrl} alt="" className="w-full h-20 rounded-lg object-cover mb-2" />
            )}
            <input type="file" accept="image/*" onChange={(e) => handleImage(e, setCoverUrl)} className="text-sm" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label={t("location")}>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="input"
              placeholder={t("locationPlaceholder")}
            />
          </Field>
          <Field label={t("website")}>
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="input"
              placeholder="https://"
            />
          </Field>
        </div>

        {error && (
          <div className="bg-red-50 text-error border border-red-200 rounded-lg p-3 text-sm">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onDone}
            disabled={busy !== null}
            className="px-4 py-2 text-sm text-on-surface-variant hover:text-on-surface transition"
          >
            {t("cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={!name || busy !== null}
            className="regen-gradient text-white px-6 py-2.5 rounded-full text-sm font-semibold hover:opacity-90 transition disabled:opacity-50 flex items-center gap-2"
          >
            {busy !== null && <Spinner size={14} />}
            {busy === "uploading"
              ? t("uploading")
              : busy === "profile"
                ? t("savingJson")
                : busy === "sig"
                  ? t("awaitingSignature")
                  : busy === "chain"
                    ? t("confirmingTx")
                    : busy === "indexing"
                      ? t("indexing")
                      : t("save")}
          </button>
        </div>

        <style jsx global>{`
          .input {
            width: 100%;
            padding: 0.625rem 0.875rem;
            background: var(--color-surface-container-low);
            border: 1px solid rgb(189 202 186 / 0.15);
            border-radius: 0.625rem;
            color: var(--color-on-surface);
            font-size: 0.875rem;
            outline: none;
            transition: all 0.15s;
          }
          .input:focus {
            border-color: var(--color-primary);
          }
        `}</style>
      </div>

      {showSocialVerification && (
        <SocialVerificationPanel
          producerAddress={producerAddress}
          producer={producer}
        />
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}
