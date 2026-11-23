import type { Project, ServerEvent, Settings } from "./shared/types.ts";

export interface InitState {
  projects: Project[];
  settings: Settings;
  ai: string;
  platform: Record<string, { siap: boolean; akun?: string; catatan?: string; perluLogin: boolean }>;
  suara: { id: string; ket: string }[];
}

async function req<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body instanceof FormData || body === undefined ? undefined : { "content-type": "application/json" },
    body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Gagal (${res.status})`);
  return data as T;
}

export const api = {
  state: () => req<InitState>("GET", "/api/state"),
  create: (format: string, ide: string, gaya: string, rencanaPart = 1, sumberVisual = "ilustrasi") =>
    req<Project>("POST", "/api/projects", { format, ide, gaya, rencanaPart, sumberVisual }),
  remove: (id: string) => req<void>("DELETE", `/api/projects/${id}`),
  lanjut: (id: string) => req<Project>("POST", `/api/projects/${id}/lanjut`),
  ulang: (id: string, tahap: string) => req<Project>("POST", `/api/projects/${id}/ulang`, { tahap }),
  patch: (id: string, body: unknown) => req<Project>("PATCH", `/api/projects/${id}`, body),
  settings: (body: Partial<Settings>) => req<Settings>("PATCH", "/api/settings", body),
  upload: (url: string, form: FormData) => req<Project>("POST", url, form),
  post: <T = Project>(url: string, body?: unknown) => req<T>("POST", url, body ?? {}),
};

export function listen(onEvent: (e: ServerEvent) => void, onStatus: (online: boolean) => void) {
  const es = new EventSource("/api/events");
  es.onopen = () => onStatus(true);
  es.onerror = () => onStatus(false);
  es.onmessage = (m) => onEvent(JSON.parse(m.data));
  return es;
}
