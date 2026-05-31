const KEY = "lista_compras_profile_id_v1";

export function getStoredProfileId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(KEY);
}

export function setStoredProfileId(id: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, id);
}

export function clearStoredProfileId() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}
