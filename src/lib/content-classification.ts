import type { YoutubeContentKind, VideoMetadata } from "../types";

export function classifyContentKind(
  urlKind: YoutubeContentKind,
  metadata?: VideoMetadata,
): YoutubeContentKind {
  if (!metadata?.liveStatus) return urlKind;

  switch (metadata.liveStatus) {
    case "is_upcoming":
      return "premiere";
    case "is_live":
    case "was_live":
      return "live";
    default:
      return urlKind;
  }
}
