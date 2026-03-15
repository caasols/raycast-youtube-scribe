/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `get-youtube-transcript` command */
  export type GetYoutubeTranscript = ExtensionPreferences & {}
  /** Preferences accessible in the `transcript-history` command */
  export type TranscriptHistory = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `get-youtube-transcript` command */
  export type GetYoutubeTranscript = {
  /** Language code, e.g. en, pt, es (optional) */
  "language": string
}
  /** Arguments passed to the `transcript-history` command */
  export type TranscriptHistory = {}
}

