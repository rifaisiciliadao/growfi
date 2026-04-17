"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import type { Address } from "viem";
import {
  useSubgraphProducer,
  useProducerCampaigns,
  type SubgraphCampaign,
} from "@/lib/subgraph";
import {
  useProducerProfile,
  useCampaignMetadata,
} from "@/lib/metadata";
import { uploadImage, uploadProducerProfile } from "@/lib/api";
import { abis, getAddresses } from "@/contracts";

export default function ProducerPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address: raw } = use(params);
  const t = useTranslations("producer");
  const { address: connected } = useAccount();

  const producerAddress = (raw?.toLowerCase() ?? "") as Address;
  const isValid = /^0x[a-fA-F0-9]{40}$/.test(producerAddress);
  const isOwner =
    !!connected && connected.toLowerCase() === producerAddress.toLowerCase();

  const { data: producer } = useSubgraphProducer(
    isValid ? producerAddress : undefined,
  );
  const { data: profile } = useProducerProfile(
    producer?.profileURI,
    producer?.version,
  );
  const { data: campaigns } = useProducerCampaigns(
    isValid ? producerAddress : undefined,
  );

  const [editing, setEditing] = useState(false);

  if (!isValid) {
    return (
      <div className="max-w-7xl mx-auto px-8 pt-32 text-center">
        <p className="text-on-surface-variant">{t("invalidAddress")}</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-8 pt-28 pb-20">
      {profile?.cover && (
        <div
          className="w-full h-48 md:h-60 rounded-2xl bg-cover bg-center mb-8"
          style={{ backgroundImage: `url('${profile.cover}')` }}
        />
      )}

      <div className="flex items-start justify-between flex-wrap gap-4 mb-8">
        <div className="flex items-center gap-4">
          {profile?.avatar ? (
            <img
              src={profile.avatar}
              alt={profile.name ?? ""}
              className="w-20 h-20 rounded-full object-cover border border-outline-variant/15"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-primary-fixed flex items-center justify-center text-on-primary-fixed-variant font-bold text-2xl">
              {(profile?.name ?? producerAddress).slice(2, 4).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-on-surface">
              {profile?.name || t("anonymous")}
            </h1>
            <p className="text-sm text-on-surface-variant font-mono">
              {producerAddress}
            </p>
            {profile?.location && (
              <p className="text-sm text-on-surface-variant mt-1">
                📍 {profile.location}
              </p>
            )}
          </div>
        </div>

        {isOwner && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="bg-primary text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:opacity-90 transition"
          >
            {profile ? t("editProfile") : t("createProfile")}
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

      {!profile && !editing && (
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 p-8 mb-10 text-center text-sm text-on-surface-variant">
          {t("noProfileYet")}
        </div>
      )}

      {editing && <ProfileForm onDone={() => setEditing(false)} current={profile} />}

      <section>
        <h2 className="text-xl font-bold text-on-surface mb-4">
          {t("campaignsTitle")}
        </h2>
        {!campaigns || campaigns.length === 0 ? (
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

function CampaignThumb({ campaign }: { campaign: SubgraphCampaign }) {
  const { data: meta } = useCampaignMetadata(
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
}: {
  current?: { name?: string; bio?: string; avatar?: string | null; cover?: string | null; website?: string | null; location?: string | null } | null;
  onDone: () => void;
}) {
  const t = useTranslations("producer.form");
  const { producerRegistry } = getAddresses();

  const [name, setName] = useState(current?.name ?? "");
  const [bio, setBio] = useState(current?.bio ?? "");
  const [website, setWebsite] = useState(current?.website ?? "");
  const [location, setLocation] = useState(current?.location ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(current?.avatar ?? null);
  const [coverUrl, setCoverUrl] = useState<string | null>(current?.cover ?? null);

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { writeContractAsync } = useWriteContract();
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const receipt = useWaitForTransactionReceipt({ hash: txHash });

  if (receipt.isSuccess && txHash) {
    setTimeout(() => onDone(), 200);
  }

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
      setBusy("tx");
      const hash = await writeContractAsync({
        address: producerRegistry,
        abi: abis.ProducerRegistry as never,
        functionName: "setProfile",
        args: [profile.url],
      });
      setTxHash(hash);
    } catch (err) {
      setBusy(null);
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 p-6 mb-10 space-y-4">
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
          className="regen-gradient text-white px-6 py-2.5 rounded-full text-sm font-semibold hover:opacity-90 transition disabled:opacity-50"
        >
          {busy === "uploading"
            ? t("uploading")
            : busy === "profile"
              ? t("savingJson")
              : busy === "tx"
                ? t("confirmingTx")
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
