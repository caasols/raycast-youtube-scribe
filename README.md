# YouTube Transcribe

![Raycast](https://img.shields.io/badge/Raycast-black?logo=raycast&style=flat)
![React](https://img.shields.io/badge/React-black?logo=react&style=flat)
![TypeScript](https://img.shields.io/badge/TypeScript-black?logo=typescript&style=flat)

A Raycast extension for fetching, browsing, and exporting YouTube transcripts — with AI-powered summaries and Q&A built in. Auto-detects videos from your clipboard or focused browser tab, fetches captions via [yt-dlp](https://github.com/yt-dlp/yt-dlp), and keeps a searchable transcript history.

## Installation

### Option 1: Raycast Store

Install directly from the [Raycast Store](https://www.raycast.com/caasols/youtube-transcribe).

### Option 2: Manual Installation

```bash
git clone https://github.com/caasols/raycast-youtube-scribe.git
cd raycast-youtube-scribe
npm install && npm run dev
```

## Features

### Core Features

- **Auto-detection** — Picks up YouTube URLs from your clipboard or the focused browser tab
- **Transcript fetching** — Downloads captions in any available language via yt-dlp
- **Transcript history** — Caches transcripts per video + language for instant reuse
- **Full-text search** — Search across all cached transcripts with highlighted snippet previews

### AI Actions

- **Summarize** — Generate a structured summary of any transcript using Raycast AI
- **Ask AI** — Ask follow-up questions about a transcript in a conversational view
- **Custom prompt** — Configure your own summarize prompt template with variable placeholders

### Export & Output

- **Multiple formats** — Export transcripts as plain text, JSON, SRT, or VTT
- **Copy to clipboard** — One-click copy of full transcript or individual segments
- **Rich metadata** — Stored video info including channel, duration, tags, and thumbnail

## Commands

| Command | Description |
| --- | --- |
| **Transcribe YouTube Video** | Auto-detects a YouTube URL and fetches its transcript. Accepts an optional language code argument (e.g. `en`, `pt`, `es`). |
| **View Transcript History** | Browse all cached transcripts with search, preview, AI actions, and export. |

## Prerequisites

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) installed locally:
  ```bash
  brew install yt-dlp
  ```
- [Raycast](https://raycast.com) installed

## Configuration

Open **Raycast Preferences → Extensions → YouTube Transcribe** to customize:

| Preference | Description | Default |
| --- | --- | --- |
| **Summarize Prompt Template** | Custom prompt for AI summaries. Supports `{{title}}`, `{{url}}`, and `{{transcript}}` variables. | Built-in structured template |
| **History Limit** | Maximum number of transcript entries to keep in history. | 100 entries |
| **History Max Age** | Automatically remove entries older than this threshold. | Unlimited |

## Troubleshooting

1. Verify yt-dlp is installed and available in your `$PATH`:
   ```bash
   which yt-dlp
   ```
2. Ensure the YouTube video has captions available in the requested language.
3. Check Raycast logs for detailed error messages.

For persistent issues, [open an issue](https://github.com/caasols/raycast-youtube-scribe/issues) on GitHub with reproduction steps.

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b my-new-feature`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin my-new-feature`
5. Submit a pull request

Issues and pull requests are welcome. Please open a discussion first if you plan to work on a larger change so we can align on the approach.

## Support

If this extension saves you time:
- Star the [GitHub repository](https://github.com/caasols/raycast-youtube-scribe)
- Share it with coworkers who live in their command bar
- Report bugs or suggest enhancements via [GitHub Issues](https://github.com/caasols/raycast-youtube-scribe/issues)

## License

Released under the [MIT License](./LICENSE).
