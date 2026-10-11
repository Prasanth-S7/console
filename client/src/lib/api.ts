export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export async function apiFetch(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
  });

  if (res.status === 401) {
    window.location.replace("/login");

    return new Promise<Response>(() => {});
  }

  return res;
}