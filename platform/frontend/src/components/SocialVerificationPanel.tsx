"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { useReadContract, useWriteContract } from "wagmi";
import type { Address } from "viem";
import { abis, getAddresses } from "@/contracts";
import {
  requestSocialVerificationChallenge,
  verifySocialPost,
  type SocialVerificationChallenge,
} from "@/lib/api";
import {
  isSocialVerificationActive,
  type SubgraphProducer,
} from "@/lib/subgraph";
import { useTxNotify } from "@/lib/useTxNotify";
import { waitForTx } from "@/lib/waitForTx";
import { Spinner } from "@/components/Spinner";

type Busy = null | "challenge" | "verify" | "sig" | "chain";

export function SocialVerificationPanel({
  producerAddress,
  producer,
}: {
  producerAddress: Address;
  producer: SubgraphProducer | null | undefined;
}) {
  const t = useTranslations("grower.social");
  const tx = useTranslations("tx");
  const notify = useTxNotify();
  const queryClient = useQueryClient();
  const { producerRegistry } = getAddresses();
  const { writeContractAsync } = useWriteContract();

  const [platform, setPlatform] = useState("x");
  const [handle, setHandle] = useState("");
  const [profileUrl, setProfileUrl] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [challenge, setChallenge] = useState<SocialVerificationChallenge | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: nonceRaw, refetch: refetchNonce } = useReadContract({
    address: producerRegistry,
    abi: abis.ProducerRegistry as never,
    functionName: "socialNonce",
    args: [producerAddress],
    query: { refetchInterval: 20_000 },
  }) as { data: bigint | undefined; refetch: () => void };

  const { data: activeRaw, refetch: refetchActive } = useReadContract({
    address: producerRegistry,
    abi: abis.ProducerRegistry as never,
    functionName: "hasActiveSocialAttestation",
    args: [producerAddress],
    query: { refetchInterval: 20_000 },
  }) as { data: boolean | undefined; refetch: () => void };

  const active = isSocialVerificationActive(producer) || Boolean(activeRaw);
  const expiresLabel = useMemo(() => {
    if (!producer?.socialExpiresAt) return null;
    return new Date(Number(producer.socialExpiresAt) * 1000).toLocaleDateString();
  }, [producer?.socialExpiresAt]);
  const suggestedPost = useMemo(() => {
    if (!challenge) return "";
    return t("postTemplate", { code: challenge.code });
  }, [challenge, t]);
  const isXChallenge = challenge
    ? challenge.platform === "x" || challenge.platform === "twitter"
    : false;
  const xPostUrl = useMemo(() => {
    if (!suggestedPost) return "";
    return `https://x.com/intent/post?text=${encodeURIComponent(suggestedPost)}`;
  }, [suggestedPost]);

  const copySuggestedPost = async () => {
    if (!suggestedPost) return;
    try {
      await navigator.clipboard.writeText(suggestedPost);
    } catch {
      setError(t("copyFailed"));
    }
  };

  const requestChallenge = async () => {
    setError(null);
    try {
      setBusy("challenge");
      const next = await requestSocialVerificationChallenge({
        wallet: producerAddress,
        platform,
        handle,
        profileUrl,
      });
      setChallenge(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const verifyAndClaim = async () => {
    if (!challenge) return;
    if (typeof nonceRaw !== "bigint") {
      setError(t("nonceUnavailable"));
      return;
    }
    setError(null);
    try {
      setBusy("verify");
      const result = await verifySocialPost({
        wallet: producerAddress,
        platform: challenge.platform,
        handle: challenge.handle,
        profileUrl: challenge.profileUrl,
        proofUrl,
        nonce: challenge.nonce,
        issuedAt: challenge.issuedAt,
        expiresAt: challenge.expiresAt,
        code: challenge.code,
        message: challenge.message,
        challenge: challenge.challenge,
        onchainNonce: nonceRaw.toString(),
      });
      if (result.registry?.txHash) {
        setBusy("chain");
        notify.success(tx("socialVerificationConfirmed"), result.registry.txHash);
        setChallenge(null);
        setProofUrl("");
        await Promise.all([
          refetchNonce(),
          refetchActive(),
          queryClient.invalidateQueries({
            queryKey: ["subgraph", "producer", producerAddress.toLowerCase()],
          }),
        ]);
        return;
      }

      if (!result.authorizationReady || !result.signature) {
        throw new Error(t("verifierNotConfigured"));
      }

      setBusy("sig");
      const hash = await writeContractAsync({
        address: producerRegistry,
        abi: abis.ProducerRegistry as never,
        functionName: "claimSocialAttestation",
        args: [
          {
            ...result.attestation,
            issuedAt: BigInt(result.attestation.issuedAt),
            expiresAt: BigInt(result.attestation.expiresAt),
            nonce: BigInt(result.attestation.nonce),
          },
          result.signature,
        ],
      });

      setBusy("chain");
      const receipt = await waitForTx(hash);
      if (receipt.status !== "success") {
        throw new Error("claimSocialAttestation reverted");
      }
      notify.success(tx("socialVerificationConfirmed"), hash);
      setChallenge(null);
      setProofUrl("");
      await Promise.all([
        refetchNonce(),
        refetchActive(),
        queryClient.invalidateQueries({
          queryKey: ["subgraph", "producer", producerAddress.toLowerCase()],
        }),
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/user (rejected|denied)/i.test(msg)) {
        setError(msg);
        notify.error(tx("socialVerificationFailed"), err);
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 p-6 mb-10 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-on-surface">{t("title")}</h3>
          <p className="text-xs text-on-surface-variant mt-1">
            {active && expiresLabel
              ? t("activeUntil", { date: expiresLabel })
              : t("inactive")}
          </p>
        </div>
        <span
          className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
            active
              ? "bg-primary-fixed text-on-primary-fixed"
              : "bg-surface-container-high text-on-surface-variant"
          }`}
        >
          {active ? t("statusVerified") : t("statusMissing")}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label={t("platform")}>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="social-input"
            disabled={busy !== null}
          >
            <option value="x">X</option>
            <option value="instagram">Instagram</option>
            <option value="tiktok">TikTok</option>
            <option value="linkedin">LinkedIn</option>
            <option value="website">Website</option>
          </select>
        </Field>
        <Field label={t("handle")}>
          <input
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            className="social-input"
            placeholder="@grower"
            disabled={busy !== null}
          />
        </Field>
        <Field label={t("profileUrl")}>
          <input
            value={profileUrl}
            onChange={(e) => setProfileUrl(e.target.value)}
            className="social-input"
            placeholder="https://"
            disabled={busy !== null}
          />
        </Field>
      </div>

      <button
        onClick={requestChallenge}
        disabled={busy !== null}
        className="bg-primary text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:opacity-90 transition disabled:opacity-50 inline-flex items-center gap-2"
      >
        {busy === "challenge" && <Spinner size={14} />}
        {t("createChallenge")}
      </button>

      {challenge && (
        <div className="space-y-4 border-t border-outline-variant/10 pt-4">
          <Field label={t("message")}>
            <textarea
              readOnly
              rows={6}
              className="social-input text-sm leading-relaxed"
              value={suggestedPost}
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copySuggestedPost}
              className="bg-surface-container-high text-on-surface px-4 py-2 rounded-full text-xs font-semibold hover:opacity-90 transition disabled:opacity-50"
              disabled={busy !== null}
            >
              {t("copyPost")}
            </button>
            {isXChallenge && (
              <a
                href={xPostUrl}
                target="_blank"
                rel="noreferrer"
                className="bg-on-surface text-surface px-4 py-2 rounded-full text-xs font-semibold hover:opacity-90 transition"
              >
                {t("openXPost")}
              </a>
            )}
          </div>
          <Field label={t("proofUrl")}>
            <input
              value={proofUrl}
              onChange={(e) => setProofUrl(e.target.value)}
              className="social-input"
              placeholder="https://"
              disabled={busy !== null}
            />
          </Field>
          <button
            onClick={verifyAndClaim}
            disabled={!proofUrl || busy !== null || typeof nonceRaw !== "bigint"}
            className="regen-gradient text-white px-6 py-2.5 rounded-full text-sm font-semibold hover:opacity-90 transition disabled:opacity-50 inline-flex items-center gap-2"
          >
            {busy !== null && busy !== "challenge" && <Spinner size={14} />}
            {busy === "verify"
              ? t("verifying")
              : busy === "sig"
                ? t("awaitingSignature")
                : busy === "chain"
                  ? t("confirmingTx")
                  : t("verifyAndClaim")}
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-error border border-red-200 rounded-lg p-3 text-sm">
          {error}
        </div>
      )}

      <style jsx global>{`
        .social-input {
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
        .social-input:focus {
          border-color: var(--color-primary);
        }
        .social-input::placeholder {
          color: var(--color-on-surface-variant);
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}
