import { useEffect, useMemo, useRef, useState } from "react";
import {
  approveInvite,
  clearAdminKey,
  deleteInvite,
  fetchInvites,
  getAdminKey,
  rejectInvite,
  setAdminKey,
  type Invite,
  type InviteStatus,
} from "./api";

type Tab = InviteStatus | "all";

function formatTs(ts: number): string {
  return new Date(ts).toLocaleString();
}

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function App() {
  const [hasKey, setHasKey] = useState<boolean>(() => Boolean(getAdminKey()));
  const [keyInput, setKeyInput] = useState("");
  const [keyErr, setKeyErr] = useState<string | null>(null);

  const [tab, setTab] = useState<Tab>("pending");
  const [items, setItems] = useState<Invite[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Invite | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [rejectNotify, setRejectNotify] = useState(true);

  async function refresh() {
    if (!hasKey) return;
    setLoading(true);
    setErr(null);
    try {
      const r = await fetchInvites(tab);
      setItems(r.items);
      setTotal(r.total);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "load failed";
      setErr(msg);
      if (msg.toLowerCase().includes("unauth")) {
        setHasKey(false);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, hasKey]);

  useEffect(() => {
    if (!success) return;
    const t = window.setTimeout(() => setSuccess(null), 3500);
    return () => window.clearTimeout(t);
  }, [success]);

  const counts = useMemo(() => {
    return {
      pending: items.filter((i) => i.status === "pending").length,
      approved: items.filter((i) => i.status === "approved").length,
      rejected: items.filter((i) => i.status === "rejected").length,
    };
  }, [items]);

  function submitKey(e: React.FormEvent) {
    e.preventDefault();
    setKeyErr(null);
    if (keyInput.trim().length < 8) {
      setKeyErr("Chiave troppo corta");
      return;
    }
    setAdminKey(keyInput.trim());
    setKeyInput("");
    setHasKey(true);
  }

  async function onApprove(invite: Invite) {
    try {
      const r = await approveInvite(invite.address);
      setSuccess(
        `Invito ${invite.email} approvato.` +
          (r.emailDelivered ? "" : " (email non inviata)"),
      );
      void refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "approve failed");
    }
  }

  function openReject(invite: Invite) {
    setRejectTarget(invite);
    setRejectNote("");
    setRejectNotify(true);
    dialogRef.current?.showModal();
  }
  function closeReject() {
    dialogRef.current?.close();
    setRejectTarget(null);
  }
  async function confirmReject() {
    if (!rejectTarget) return;
    try {
      await rejectInvite(rejectTarget.address, {
        notes: rejectNote || undefined,
        notify: rejectNotify,
      });
      setSuccess(`Invito ${rejectTarget.email} rifiutato.`);
      closeReject();
      void refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "reject failed");
    }
  }

  async function onDelete(invite: Invite) {
    if (!confirm(`Eliminare definitivamente la richiesta di ${invite.email}?`))
      return;
    try {
      await deleteInvite(invite.address);
      setSuccess("Richiesta eliminata.");
      void refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "delete failed");
    }
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text).catch(() => {});
    setSuccess(`Copiato: ${text}`);
  }

  if (!hasKey) {
    return (
      <div className="shell">
        <div className="brand">
          <h1>GrowFi · Invite admin</h1>
          <small>local-only</small>
        </div>
        <form className="gate" onSubmit={submitKey}>
          <h2>Admin key</h2>
          <p>
            Incolla la chiave condivisa con il backend (env <code>ADMIN_API_KEY</code>).
            Resta solo nel localStorage del tuo browser.
          </p>
          <input
            autoFocus
            type="password"
            spellCheck={false}
            placeholder="ADMIN_API_KEY"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
          />
          {keyErr && <div className="error">{keyErr}</div>}
          <button type="submit" className="btn primary full">
            Sblocca
          </button>
          <div className="tip">
            Suggerimento: genera la chiave con{" "}
            <code>openssl rand -hex 24</code> e mettila nel <code>.env</code> del
            backend come <code>ADMIN_API_KEY</code>.
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="shell">
      <div className="brand">
        <h1>GrowFi · Invite admin</h1>
        <small>local-only · {total} totali</small>
        <span className="spacer" />
        <button
          className="btn ghost"
          onClick={() => {
            clearAdminKey();
            setHasKey(false);
          }}
        >
          esci
        </button>
      </div>

      {err && <div className="error">{err}</div>}
      {success && <div className="success">{success}</div>}

      <div className="toolbar">
        <div className="tabs">
          {(["pending", "approved", "rejected", "all"] as Tab[]).map((t) => (
            <button
              key={t}
              className={t === tab ? "active" : ""}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <span className="spacer" />
        <button className="btn" onClick={() => void refresh()} disabled={loading}>
          {loading ? "…" : "Refresh"}
        </button>
      </div>

      <div className="list">
        <div className="row head">
          <span>id</span>
          <span>email</span>
          <span>eth</span>
          <span>telegram</span>
          <span>status</span>
          <span style={{ textAlign: "right" }}>actions</span>
        </div>
        {items.length === 0 && !loading && (
          <div className="empty">Nessuna richiesta in {tab}.</div>
        )}
        {items.map((row) => (
          <div className="row" key={row.id}>
            <span style={{ color: "#6b7d6f" }}>#{row.id}</span>
            <div>
              <div className="email">{row.email}</div>
              <small style={{ color: "#6b7d6f" }}>{formatTs(row.createdAt)}</small>
              {row.notes && (
                <div style={{ color: "#7c2d20", marginTop: 4 }}>
                  note: {row.notes}
                </div>
              )}
            </div>
            <span
              className="eth"
              title={row.address}
              onClick={() => copy(row.address)}
              style={{ cursor: "copy" }}
            >
              {shortAddr(row.address)}
            </span>
            <span className="tg">{row.telegram}</span>
            <span>
              <span className={`badge ${row.status}`}>{row.status}</span>
            </span>
            <div className="actions">
              {row.status === "pending" && (
                <>
                  <button className="btn primary" onClick={() => void onApprove(row)}>
                    Approva
                  </button>
                  <button className="btn danger" onClick={() => openReject(row)}>
                    Rifiuta
                  </button>
                </>
              )}
              {row.status === "approved" && (
                <button
                  className="btn"
                  onClick={() => void onApprove(row)}
                  title="reinvia email di approvazione"
                >
                  Re-invia email
                </button>
              )}
              {row.status === "rejected" && (
                <button
                  className="btn"
                  onClick={() => void onDelete(row)}
                  title="elimina definitivamente"
                >
                  Elimina
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="tip">
        Non versionato. Avvia con <code>npm run dev</code> in{" "}
        <code>platform/admin</code> dopo aver attivato il backend con{" "}
        <code>ADMIN_API_KEY</code> e <code>RESEND_API_KEY</code> impostate.
      </p>

      <dialog ref={dialogRef}>
        <h3>Rifiuta invito</h3>
        <p>
          {rejectTarget?.email} — {rejectTarget && shortAddr(rejectTarget.address)}
        </p>
        <label>
          <small>Note (visibili nell'email):</small>
          <textarea
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            placeholder="(facoltativo)"
          />
        </label>
        <label
          style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 13 }}
        >
          <input
            type="checkbox"
            checked={rejectNotify}
            onChange={(e) => setRejectNotify(e.target.checked)}
          />
          Invia email di rifiuto
        </label>
        <div className="row-actions">
          <button className="btn" onClick={closeReject}>
            Annulla
          </button>
          <button className="btn danger" onClick={() => void confirmReject()}>
            Rifiuta
          </button>
        </div>
      </dialog>
    </div>
  );
}
