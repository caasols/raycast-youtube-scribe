<p align="center">
  <img src="assets/extension-icon.png" height="128">
  <h1 align="center">YouTube Transcribe</h1>
</p>

<p align="center">
  <a aria-label="License" href="./LICENSE">
    <img alt="MIT License" src="https://img.shields.io/badge/License-MIT-black.svg?style=for-the-badge">
  </a>
  <a aria-label="Raycast" href="https://www.raycast.com/">
    <img alt="Built for Raycast" src="https://img.shields.io/badge/Built%20for-Raycast-black.svg?style=for-the-badge">
  </a>
  <a aria-label="yt-dlp" href="https://github.com/yt-dlp/yt-dlp">
    <img alt="Powered by yt-dlp" src="https://img.shields.io/badge/Powered%20by-yt--dlp-black.svg?style=for-the-badge">
  </a>
</p>

Raycast extension for finding and extracting transcripts from YouTube videos. It auto-detects videos from the clipboard or your focused browser tab, fetches captions with `yt-dlp`, stores transcript history, and adds AI-powered summary and question workflows directly inside Raycast.

## Commands

### Transcribe YouTube Video

- auto-detects a YouTube URL from the clipboard or the focused browser tab
- falls back to a manual form when nothing is detected
- optionally accepts a language argument
- copies the transcript on success
- opens the transcript detail view directly when a cached transcript already exists

### View Transcript History

- browses all cached transcripts
- opens a transcript preview with thumbnail, metadata pills, and readable transcript formatting
- supports transcript search
- supports retrying failed fetches
- includes AI actions for asking questions about a transcript and summarizing it

## Features

- auto-detection from clipboard and focused browser tabs
- `yt-dlp`-based caption fetching with timeout protection
- history reuse per `videoId + language`
- direct transcript detail opening for cached videos
- readable transcript rendering built from subtitle segments
- native Raycast AI actions for transcript Q&A and summaries
- stored YouTube metadata when available, including creator info, upload date, thumbnail, and tags

## Requirements

`yt-dlp` must be installed locally.

Recommended:

```bash
brew install yt-dlp
```

Alternative:

```bash
pipx install yt-dlp
```

## Supported Browsers

- Google Chrome
- Google Chrome Canary
- Chromium
- Brave Browser
- Microsoft Edge
- Arc
- Vivaldi
- Opera
- Safari
- Safari Technology Preview

The extension tries to reuse the focused browser for cookie access when `yt-dlp` needs it.

## How It Works

1. Run `Transcribe YouTube Video`.
2. The extension looks for a YouTube source in this order:
   - clipboard
   - focused browser tab
   - manual form fallback
3. It fetches captions and video metadata with `yt-dlp`.
4. It stores transcripts as structured segment data.
5. It renders a readable text view for humans while keeping canonical transcript data internally.
6. It stores transcript history per `videoId + language`.

## AI Workflows

### Summarize Transcript

- runs inside the extension with Raycast AI
- uses a customizable prompt template from extension preferences
- supports `{{title}}`, `{{url}}`, and `{{transcript}}`
- falls back to the built-in prompt when the preference is blank

### Send to AI Chat

- opens a Quick-AI-style transcript question screen
- lets you ask follow-up questions about the current transcript
- stores recent questions locally for faster reuse

## Troubleshooting

### `yt-dlp is not installed`

- install `yt-dlp`
- restart Raycast or reload the extension

### No transcript available

- the video may not have captions
- the requested language may not exist
- leave the language blank to allow automatic fallback

### Cookies or sign-in required

- open the video in a supported browser
- make sure the browser session has access
- retry the fetch from history or rerun the command

### Fetch timed out

- retry from history
- if it keeps failing, inspect the debug log from the history actions

## Development

Install dependencies:

```bash
npm install
```

Run in Raycast development mode:

```bash
npm run dev
```

Full verification:

```bash
RUN_YTDLP_SMOKE=1 npm test
npm run build
npm run lint
```

Smoke test only:

```bash
npm run test:smoke
```

## License

[MIT](./LICENSE)
