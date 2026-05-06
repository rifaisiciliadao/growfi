"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSignMessage } from "wagmi";
import type { Address } from "viem";
import {
  buildNotificationMessage,
  getNotificationStatus,
  saveNotificationSettings,
} from "@/lib/api";
import { Spinner } from "@/components/Spinner";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function NotificationsSection({ address }: { address: Address }) {
  const t = useTranslations("grower.notifications");
  const queryClient = useQueryClient();
  const lower = address.toLowerCase();
  const queryKey = ["notifications", "status", lower] as const;

  const status = useQuery({
    queryKey,
    queryFn: () => getNotificationStatus(lower),
    staleTime: 30_000,
  });

  const [optedIn, setOptedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<null | "sig" | "saving">(null);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Hydrate the form state from the server-side status the first time it
  // arrives. After that the user is the source of truth — don't reset what
  // they're typing if status refetches in the background.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (hydrated || status.isLoading || !status.data) return;
    setOptedIn(status.data.optedIn);
    setHydrated(true);
  }, [hydrated, status.isLoading, status.data]);

  const { signMessageAsync } = useSignMessage();

  const dirty =
    hydrated &&
    (optedIn !== (status.data?.optedIn ?? false) || email.trim().length > 0);

  const canSave =
    dirty &&
    busy === null &&
    (!optedIn || EMAIL_RE.test(email.trim()));

  const handleSave = async () => {
    setError(null);
    try {
      const trimmed = email.trim();
      const issuedAt = new Date().toISOString();
      const nonce = crypto.randomUUID();
      const message = buildNotificationMessage({
        address: lower,
        email: trimmed,
        optedIn,
        issuedAt,
        nonce,
      });
      setBusy("sig");
      const signature = await signMessageAsync({ message });
      setBusy("saving");
      await saveNotificationSettings({
        address: lower,
        email: trimmed,
        optedIn,
        issuedAt,
        nonce,
        signature,
      });
      setSavedAt(Date.now());
      // Don't clear the email locally — the user might want to confirm it's
      // still on file. Just refresh the server-side status.
      await queryClient.invalidateQueries({ queryKey });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/user (rejected|denied)/i.test(msg)) {
        setError(msg);
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 p-6 mb-10">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <h3 className="font-semibold text-on-surface text-base">{t("title")}</h3>
          <p className="text-sm text-on-surface-variant mt-1 max-w-xl">
            {t("description")}
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
          <input
            type="checkbox"
            checked={optedIn}
            onChange={(e) => setOptedIn(e.target.checked)}
            disabled={!hydrated || busy !== null}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-surface-container-high peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/30 rounded-full peer peer-checked:bg-primary transition" />
          <div className="absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-all peer-checked:translate-x-5" />
        </label>
      </div>

      {optedIn && (
        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1">
              {t("emailLabel")}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={
                status.data?.hasEmail
                  ? t("emailPlaceholderOnFile")
                  : t("emailPlaceholder")
              }
              disabled={busy !== null}
              className="w-full px-3 py-2.5 bg-surface-container-low border border-outline-variant/15 rounded-lg text-on-surface text-sm outline-none focus:border-primary transition"
            />
            {status.data?.hasEmail && (
              <p className="text-xs text-on-surface-variant mt-1.5">
                {t("emailOnFile")}
              </p>
            )}
          </div>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            {t("frequencyHint")}
          </p>
        </div>
      )}

      {error && (
        <div className="mt-4 bg-red-50 text-error border border-red-200 rounded-lg p-3 text-sm">
          {error}
        </div>
      )}

      {savedAt && !error && (
        <div className="mt-4 bg-primary/10 text-primary border border-primary/20 rounded-lg p-3 text-sm">
          {t("saved")}
        </div>
      )}

      <div className="flex justify-end mt-4">
        <button
          onClick={handleSave}
          disabled={!canSave}
          className="bg-primary text-white px-5 py-2 rounded-full text-sm font-semibold hover:opacity-90 transition disabled:opacity-50 flex items-center gap-2"
        >
          {busy !== null && <Spinner size={14} />}
          {busy === "sig"
            ? t("awaitingSignature")
            : busy === "saving"
              ? t("saving")
              : t("save")}
        </button>
      </div>
    </div>
  );
}
