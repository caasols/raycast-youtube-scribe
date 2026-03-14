export function normalizeInput(input?: string): string {
  return (input ?? "").trim();
}

export function normalizeLanguage(input?: string): string {
  return normalizeInput(input).toLowerCase();
}

export function extractYoutubeUrlFromText(text?: string): string | null {
  const value = normalizeInput(text);
  if (!value) return null;

  const match = value.match(
    /https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\/[^\s)]+/i,
  );
  return match?.[0] ?? null;
}

export function extractVideoId(input: string): string {
  const value = normalizeInput(input);

  if (/^[a-zA-Z0-9_-]{11}$/.test(value)) return value;

  try {
    const url = new URL(value);

    if (url.hostname.includes("youtu.be")) return url.pathname.replace("/", "");

    if (url.hostname.includes("youtube.com")) {
      const watchId = url.searchParams.get("v");
      if (watchId) return watchId;

      const shortsMatch = url.pathname.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
      if (shortsMatch?.[1]) return shortsMatch[1];
    }
  } catch {
    // ignore parse issues
  }

  throw new Error("Please provide a valid YouTube URL or video ID.");
}

export function makeFetchKey(
  videoId: string,
  requestedLanguage?: string,
): string {
  const normalizedLanguage = normalizeLanguage(requestedLanguage);
  return `${videoId}::${normalizedLanguage || "auto"}`;
}
