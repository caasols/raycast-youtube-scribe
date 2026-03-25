/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Default AI Action - Choose which AI action is triggered by default when pressing Enter on a transcript. */
  "defaultAIAction": "summarize" | "ask",
  /** Summarize Prompt Template - Custom prompt template for transcript summaries. Supported variables: {{title}}, {{url}}, {{transcript}} */
  "summarizePromptTemplate": string,
  /** History Limit - Maximum number of transcript entries to keep in history. */
  "historyLimit": "50" | "100" | "200" | "500",
  /** AI Response Language - Language for AI summaries and answers. Uses the transcript's language by default. */
  "aiResponseLanguage": "auto" | "English" | "Spanish" | "Portuguese" | "French" | "German" | "Italian" | "Japanese" | "Korean" | "Chinese",
  /** AI Chat Max Age - Automatically remove cached AI summaries and answers older than this. */
  "aiChatMaxAgeDays": "7" | "30" | "90" | "365" | "0",
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
  /** Preferences accessible in the `search-ai-chats` command */
  export type SearchAiChats = ExtensionPreferences & {}
  /** Preferences accessible in the `fetch-youtube-transcript-worker` command */
  export type FetchYoutubeTranscriptWorker = ExtensionPreferences & {}
  /** Preferences accessible in the `ai-summarize-worker` command */
  export type AiSummarizeWorker = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `get-youtube-transcript` command */
  export type GetYoutubeTranscript = {
  /** Language code, e.g. en, pt, es (optional) */
  "language": string
}
  /** Arguments passed to the `transcript-history` command */
  export type TranscriptHistory = {}
  /** Arguments passed to the `search-ai-chats` command */
  export type SearchAiChats = {}
  /** Arguments passed to the `fetch-youtube-transcript-worker` command */
  export type FetchYoutubeTranscriptWorker = {}
  /** Arguments passed to the `ai-summarize-worker` command */
  export type AiSummarizeWorker = {}
}

