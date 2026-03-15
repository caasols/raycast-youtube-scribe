import type { VideoMetadata } from "../types";

export type YtDlpVideoMetadataPayload = {
  title?: string;
  fulltitle?: string;
  channel?: string;
  uploader?: string;
  uploader_id?: string;
  uploader_url?: string;
  channel_id?: string;
  channel_url?: string;
  upload_date?: string;
  duration?: number;
  duration_string?: string;
  thumbnail?: string;
  description?: string;
  tags?: string[];
  view_count?: number;
  like_count?: number;
  comment_count?: number;
  channel_is_verified?: boolean;
  live_status?: string;
};

export function normalizeUploadDate(uploadDate?: string): string | undefined {
  if (!uploadDate || !/^\d{8}$/.test(uploadDate)) return undefined;

  return `${uploadDate.slice(0, 4)}-${uploadDate.slice(4, 6)}-${uploadDate.slice(6, 8)}`;
}

export function normalizeVideoMetadata(
  payload: YtDlpVideoMetadataPayload,
): VideoMetadata | undefined {
  const metadata: VideoMetadata = {
    title: payload.fulltitle ?? payload.title,
    channelName: payload.channel ?? payload.uploader,
    creatorHandle: payload.uploader_id,
    creatorUrl: payload.uploader_url,
    channelId: payload.channel_id,
    channelUrl: payload.channel_url,
    uploadDate: normalizeUploadDate(payload.upload_date),
    durationSeconds: payload.duration,
    durationText: payload.duration_string,
    thumbnailUrl: payload.thumbnail,
    description: payload.description,
    tags: payload.tags,
    viewCount: payload.view_count,
    likeCount: payload.like_count,
    commentCount: payload.comment_count,
    channelVerified: payload.channel_is_verified,
    liveStatus: payload.live_status,
  };

  return Object.values(metadata).some((value) =>
    Array.isArray(value) ? value.length > 0 : value !== undefined,
  )
    ? metadata
    : undefined;
}
