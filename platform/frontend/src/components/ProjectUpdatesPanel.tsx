"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount, useSignMessage } from "wagmi";
import type { Address } from "viem";
import {
  buildProjectUpdateReactionMessage,
  getProjectUpdateReactions,
  PROJECT_UPDATE_REACTION_EMOJIS,
  saveProjectUpdateReaction,
  type ProjectUpdateReactionSummary,
} from "@/lib/api";
import {
  useProjectUpdates,
  type SubgraphProjectUpdate,
} from "@/lib/subgraph";
import { txUrl } from "@/lib/explorer";
import { RichTextContent } from "@/components/RichTextContent";
import { Spinner } from "@/components/Spinner";

export function ProjectUpdatesPanel({
  campaignAddress,
}: {
  campaignAddress: Address;
}) {
  const t = useTranslations("detail.updates");
  const updates = useProjectUpdates(campaignAddress);

  return (
    <div className="app-card rounded-[1.35rem] p-6 md:p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-[-0.04em] text-on-surface mb-2">
          {t("title")}
        </h2>
        <p className="text-sm text-on-surface-variant">{t("subtitle")}</p>
      </div>

      {updates.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-on-surface-variant">
          <Spinner size={16} />
          {t("loading")}
        </div>
      ) : updates.data && updates.data.length > 0 ? (
        <div className="space-y-5">
          {updates.data.map((update) => (
            <ProjectUpdateCard
              key={update.id}
              campaignAddress={campaignAddress}
              update={update}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl bg-surface-container-low p-6 text-center text-sm text-on-surface-variant">
          {t("empty")}
        </div>
      )}
    </div>
  );
}

function ProjectUpdateCard({
  campaignAddress,
  update,
}: {
  campaignAddress: Address;
  update: SubgraphProjectUpdate;
}) {
  const t = useTranslations("detail.updates");
  const queryClient = useQueryClient();
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [busyEmoji, setBusyEmoji] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const updateId = update.updateId;
  const reactionsKey = [
    "project-update-reactions",
    campaignAddress.toLowerCase(),
    updateId,
    address?.toLowerCase() ?? "",
  ] as const;
  const reactions = useQuery<ProjectUpdateReactionSummary>({
    queryKey: reactionsKey,
    queryFn: () =>
      getProjectUpdateReactions({
        campaign: campaignAddress,
        updateId,
        address,
      }),
    refetchInterval: 20_000,
  });

  const metadata = update.metadata;
  const date = new Date(Number(update.postedAt) * 1000);
  const title = metadata?.title || t("untitled");
  const body = metadata?.body || "";
  const image = metadata?.image || null;
  const canReact = Boolean(address);

  const react = async (emoji: string) => {
    if (!address) return;
    setError(null);
    const current = reactions.data?.viewerEmoji;
    const nextEmoji = current === emoji ? "" : emoji;
    try {
      const issuedAt = new Date().toISOString();
      const nonce = crypto.randomUUID();
      const message = buildProjectUpdateReactionMessage({
        campaign: campaignAddress,
        updateId,
        address: address.toLowerCase(),
        emoji: nextEmoji,
        issuedAt,
        nonce,
      });
      setBusyEmoji(emoji);
      const signature = await signMessageAsync({ message });
      await saveProjectUpdateReaction({
        campaign: campaignAddress,
        updateId,
        address: address.toLowerCase(),
        emoji: nextEmoji,
        issuedAt,
        nonce,
        signature,
      });
      await queryClient.invalidateQueries({ queryKey: reactionsKey });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/user (rejected|denied)/i.test(msg)) setError(msg);
    } finally {
      setBusyEmoji(null);
    }
  };

  return (
    <article className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-5 shadow-[0_1px_0_rgba(255,255,255,0.7)_inset]">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-lg font-bold leading-snug tracking-[-0.025em] text-on-surface">
            {title}
          </h3>
          <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
            {date.toLocaleDateString()} · #{updateId}
          </div>
        </div>
        <a
          href={txUrl(update.transactionHash)}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-semibold text-primary hover:underline"
        >
          {t("proof")}
        </a>
      </div>

      {image && (
        <img
          src={image}
          alt=""
          className="mb-4 aspect-video w-full rounded-lg object-cover border border-outline-variant/15"
        />
      )}

      {body ? (
        <RichTextContent value={body} />
      ) : (
        <p className="text-sm text-on-surface-variant">{t("metadataMissing")}</p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-outline-variant/15 pt-4">
        {PROJECT_UPDATE_REACTION_EMOJIS.map((emoji) => {
          const selected = reactions.data?.viewerEmoji === emoji;
          const count = reactions.data?.counts[emoji] ?? 0;
          return (
            <button
              key={emoji}
              type="button"
              onClick={() => react(emoji)}
              disabled={!canReact || busyEmoji !== null}
              title={canReact ? t("react") : t("connectToReact")}
              className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
                selected
                  ? "border-primary bg-primary-fixed/40 text-on-surface"
                  : "border-outline-variant/20 bg-surface-container-lowest text-on-surface-variant hover:border-primary/30"
              }`}
            >
              <span>{emoji}</span>
              {busyEmoji === emoji ? (
                <Spinner size={12} />
              ) : count > 0 ? (
                <span className="text-xs font-semibold">{count}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-error">
          {error}
        </div>
      )}
    </article>
  );
}
