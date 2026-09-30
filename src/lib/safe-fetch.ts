export async function fetchJsonSafely<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      console.warn(`[SafeFetch] ${url} -> ${res.status}`);
      return fallback;
    }
    return (await res.json())?? fallback;
  } catch (err) {
    console.error(`[SafeFetch] ${url}`, err);
    return fallback;
  }
}