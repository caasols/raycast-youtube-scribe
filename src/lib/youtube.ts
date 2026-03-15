export function normalizeInput(input?: string): string {
  return (input ?? "").trim();
}

export function normalizeLanguage(input?: string): string {
  return normalizeInput(input).toLowerCase();
}

export function detectYoutubeContentKind(
  input?: string,
): "video" | "short" | null {
  const value = normalizeInput(input);
  if (!value) return null;

  if (isValidVideoId(value)) {
    return "video";
  }

  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();

    if (hostname === "youtu.be" || hostname === "www.youtu.be") {
      const id = url.pathname.replace(/^\/+/, "").split("/")[0];
      return isValidVideoId(id) ? "video" : null;
    }

    if (hostname === "youtube.com" || hostname === "www.youtube.com") {
      const watchId = url.searchParams.get("v");
      if (url.pathname === "/watch" && isValidVideoId(watchId ?? "")) {
        return "video";
      }

      const shortsMatch = url.pathname.match(/^\/shorts\/([a-zA-Z0-9_-]{11})/);
      if (isValidVideoId(shortsMatch?.[1] ?? "")) {
        return "short";
      }
    }
  } catch {
    return null;
  }

  return null;
}

function isValidVideoId(value: string): boolean {
  return /^[a-zA-Z0-9_-]{11}$/.test(value);
}

export function normalizeYoutubeVideoUrl(input?: string): string | null {
  const value = normalizeInput(input);
  if (!value) return null;

  if (isValidVideoId(value)) {
    return `https://www.youtube.com/watch?v=${value}`;
  }

  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();

    if (hostname === "youtu.be" || hostname === "www.youtu.be") {
      const id = url.pathname.replace(/^\/+/, "").split("/")[0];
      if (isValidVideoId(id)) {
        return `https://www.youtube.com/watch?v=${id}`;
      }
      return null;
    }

    if (hostname === "youtube.com" || hostname === "www.youtube.com") {
      const watchId = url.searchParams.get("v");
      if (url.pathname === "/watch" && isValidVideoId(watchId ?? "")) {
        return `https://www.youtube.com/watch?v=${watchId}`;
      }

      const shortsMatch = url.pathname.match(/^\/shorts\/([a-zA-Z0-9_-]{11})/);
      if (isValidVideoId(shortsMatch?.[1] ?? "")) {
        return `https://www.youtube.com/watch?v=${shortsMatch?.[1]}`;
      }
    }
  } catch {
    return null;
  }

  return null;
}

export function extractYoutubeUrlFromText(text?: string): string | null {
  const value = normalizeInput(text);
  if (!value) return null;

  const matches = value.match(
    /https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\/[^\s)]+/gi,
  );

  for (const match of matches ?? []) {
    const normalized = normalizeYoutubeVideoUrl(match);
    if (normalized) return normalized;
  }

  return null;
}

export function extractVideoId(input: string): string {
  const normalizedUrl = normalizeYoutubeVideoUrl(input);
  if (normalizedUrl) {
    const url = new URL(normalizedUrl);
    const watchId = url.searchParams.get("v");
    if (watchId) return watchId;
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
