/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Summarize Prompt Template - Custom prompt template for transcript summaries. Supported variables: {{title}}, {{url}}, {{transcript}} */
  "summarizePromptTemplate": string,
  /** History Limit - Maximum number of transcript entries to keep in history. */
  "historyLimit": "50" | "100" | "200" | "500",
  /** History Max Age - Automatically remove entries older than this. Set to 'Unlimited' to keep all entries. */
  "historyMaxAgeDays": "7" | "30" | "90" | "365" | "0"
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `get-youtube-transcript` command */
  export type GetYoutubeTranscript = ExtensionPreferences & {}
  /** Preferences accessible in the `transcript-history` command */
  export type TranscriptHistory = ExtensionPreferences & {}
  /** Preferences accessible in the `fetch-youtube-transcript-worker` command */
  export type FetchYoutubeTranscriptWorker = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `get-youtube-transcript` command */
  export type GetYoutubeTranscript = {
  /** Language code, e.g. en, pt, es (optional) */
  "language": string
}
  /** Arguments passed to the `transcript-history` command */
  export type TranscriptHistory = {}
  /** Arguments passed to the `fetch-youtube-transcript-worker` command */
  export type FetchYoutubeTranscriptWorker = {}
}

