/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Auto-Summarize on Fetch - Automatically generate an AI summary in the background whenever a new transcript is fetched. */
  "autoSummarize": boolean,
  /** Default AI Action - Choose which AI action is triggered by default when pressing Enter on a transcript. */
  "defaultAIAction": "summarize" | "ask",
  /** Summarize Prompt Template - Custom prompt template for transcript summaries. Supported variables: {{title}}, {{url}}, {{transcript}} */
  "summarizePromptTemplate": string,
  /** History Limit - Maximum number of transcript entries to keep in history. */
  "historyLimit": "50" | "100" | "200" | "500",
  /** AI Response Language - Language for AI summaries and answers. Uses the transcript's language by default. */
  "aiResponseLanguage": "auto" | "English" | "Spanish" | "Portuguese" | "French" | "German" | "Italian" | "Japanese" | "Korean" | "Chinese",
  /** AI Model - Choose which AI model to use for summaries and questions. */
  "aiModel": "auto" | "anthropic-claude-sonnet-4-5" | "anthropic-claude-4-5-haiku" | "openai-gpt-4o" | "openai-gpt-4o-mini" | "openai-gpt-4.1" | "google-gemini-2.5-flash" | "google-gemini-3-flash" | "groq-llama-3.3-70b-versatile" | "together-deepseek-ai/DeepSeek-R1" | "xai-grok-4",
  /** Custom AI Action 1 — Name - Display name for the first custom AI action (e.g., "Extract Key Quotes"). Leave empty to disable. */
  "customAction1Name": string,
  /** Custom AI Action 1 — Prompt - Prompt template for the first custom AI action. Supports: {{title}}, {{url}}, {{channel}}, {{transcript}}, {{language}}, {{tags}}, {{duration}}, {{contentKind}} */
  "customAction1Prompt": string,
  /** Custom AI Action 2 — Name - Display name for the second custom AI action (e.g., "Extract Action Items"). Leave empty to disable. */
  "customAction2Name": string,
  /** Custom AI Action 2 — Prompt - Prompt template for the second custom AI action. Supports: {{title}}, {{url}}, {{channel}}, {{transcript}}, {{language}}, {{tags}}, {{duration}}, {{contentKind}} */
  "customAction2Prompt": string,
  /** History Sort Order - Choose how transcript history is sorted. */
  "historySortOrder": "newest" | "oldest" | "title-asc" | "title-desc" | "channel",
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
  /** Preferences accessible in the `fetch-playlist-worker` command */
  export type FetchPlaylistWorker = ExtensionPreferences & {}
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
  /** Arguments passed to the `fetch-playlist-worker` command */
  export type FetchPlaylistWorker = {}
}

