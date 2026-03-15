import { describe, expect, it } from "vitest";

describe("yt-dlp metadata normalization", () => {
  it("normalizes upload date and creator/channel fields", async () => {
    const { normalizeVideoMetadata } =
      await import("../src/lib/ytdlp-metadata");

    expect(
      normalizeVideoMetadata({
        title: "Never Gonna Give You Up",
        channel: "Rick Astley",
        uploader_id: "@RickAstleyYT",
        uploader_url: "https://www.youtube.com/@RickAstleyYT",
        channel_id: "channel-123",
        channel_url: "https://www.youtube.com/channel/channel-123",
        upload_date: "20091025",
        duration: 213,
        duration_string: "3:33",
        thumbnail: "https://i.ytimg.com/example.jpg",
        description: "A description",
        tags: ["music", "pop"],
        channel_is_verified: true,
      }),
    ).toEqual({
      title: "Never Gonna Give You Up",
      channelName: "Rick Astley",
      creatorHandle: "@RickAstleyYT",
      creatorUrl: "https://www.youtube.com/@RickAstleyYT",
      channelId: "channel-123",
      channelUrl: "https://www.youtube.com/channel/channel-123",
      uploadDate: "2009-10-25",
      durationSeconds: 213,
      durationText: "3:33",
      thumbnailUrl: "https://i.ytimg.com/example.jpg",
      description: "A description",
      tags: ["music", "pop"],
      channelVerified: true,
    });
  });

  it("returns undefined when the payload has no usable metadata", async () => {
    const { normalizeVideoMetadata } =
      await import("../src/lib/ytdlp-metadata");

    expect(normalizeVideoMetadata({})).toBeUndefined();
  });

  it("prefers fulltitle over title when both are present", async () => {
    const { normalizeVideoMetadata } =
      await import("../src/lib/ytdlp-metadata");

    const result = normalizeVideoMetadata({
      title: "Short Title",
      fulltitle: "Full Long Title of the Video",
      channel: "Test",
    });

    expect(result?.title).toBe("Full Long Title of the Video");
  });

  it("falls back from channel to uploader and keeps engagement metadata", async () => {
    const { normalizeVideoMetadata } =
      await import("../src/lib/ytdlp-metadata");

    expect(
      normalizeVideoMetadata({
        uploader: "Uploader Name",
        uploader_id: "@uploader",
        view_count: 123,
        like_count: 45,
        comment_count: 6,
      }),
    ).toEqual({
      title: undefined,
      channelName: "Uploader Name",
      creatorHandle: "@uploader",
      creatorUrl: undefined,
      channelId: undefined,
      channelUrl: undefined,
      uploadDate: undefined,
      durationSeconds: undefined,
      durationText: undefined,
      thumbnailUrl: undefined,
      description: undefined,
      tags: undefined,
      viewCount: 123,
      likeCount: 45,
      commentCount: 6,
      channelVerified: undefined,
    });
  });
});
