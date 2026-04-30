export type InviteStatus = "pending" | "approved" | "rejected";

export interface Invite {
  id: number;
  address: string;
  email: string;
  telegram: string;
  status: InviteStatus;
  notes?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface ListResult {
  total: number;
  items: Invite[];
}

export interface ActionResult {
  invite: Invite;
  emailDelivered: boolean;
  emailError?: string;
}

const KEY_STORAGE = "growfi:admin:key";

export function getAdminKey(): string | null {
  return localStorage.getItem(KEY_STORAGE);
}
export function setAdminKey(key: string): void {
  localStorage.setItem(KEY_STORAGE, key);
}
export function clearAdminKey(): void {
  localStorage.removeItem(KEY_STORAGE);
}

async function call<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const key = getAdminKey();
  if (!key) throw new Error("Admin key missing");
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Key": key,
      ...(init.headers ?? {}),
    },
  });
  if (res.status === 401) {
    clearAdminKey();
    throw new Error("Unauthorized — chiave admin non valida");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      (data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : null) || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data as T;
}

export async function fetchInvites(
  status: InviteStatus | "all" = "all",
): Promise<ListResult> {
  const qs = status === "all" ? "" : `?status=${status}`;
  return call<ListResult>(`/api/admin/invites${qs}`, { method: "GET" });
}

export async function approveInvite(address: string): Promise<ActionResult> {
  return call<ActionResult>(`/api/admin/invites/${address}/approve`, {
    method: "POST",
    body: "{}",
  });
}

export async function rejectInvite(
  address: string,
  body: { notes?: string; notify?: boolean } = {},
): Promise<ActionResult> {
  return call<ActionResult>(`/api/admin/invites/${address}/reject`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function deleteInvite(address: string): Promise<{ ok: boolean }> {
  return call<{ ok: boolean }>(`/api/admin/invites/${address}`, {
    method: "DELETE",
  });
}
