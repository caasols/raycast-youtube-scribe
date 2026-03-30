# YouTube Transcribe

![Raycast](https://img.shields.io/badge/Raycast-black?logo=raycast&style=flat)
![React](https://img.shields.io/badge/React-black?logo=react&style=flat)
![TypeScript](https://img.shields.io/badge/TypeScript-black?logo=typescript&style=flat)

A Raycast extension for fetching, browsing, and exporting YouTube transcripts with AI-powered summaries and Q&A. Auto-detects videos from your clipboard or focused browser tab, fetches captions via [yt-dlp](https://github.com/yt-dlp/yt-dlp), and keeps a searchable transcript history.

![YouTube Transcribe Screenshot](./metadata/youtube-scribe-1.png)

## Installation

### Raycast Store

Install directly from the [Raycast Store](https://www.raycast.com/caasols/youtube-transcribe).

### Manual

```bash
git clone https://github.com/caasols/raycast-youtube-scribe.git
cd raycast-youtube-scribe
npm install && npm run dev
```

## Prerequisites

- [Raycast](https://raycast.com)
- [yt-dlp](https://github.com/yt-dlp/yt-dlp):
  ```bash
  brew install yt-dlp
  ```

## Features

### Transcription

- **Auto-detection** — picks up YouTube URLs from your clipboard or focused browser tab
- **Playlist support** — paste a playlist URL to queue all videos for batch transcription in the background
- **Language selection** — fetch captions in any available language
- **Background fetching** — exit Raycast while a transcript is being fetched; it continues in the background and notifies you when ready
- **One fetch at a time** — to avoid YouTube rate limits, the extension processes one transcript at a time. A clear message is shown if you try to start a second fetch while one is in progress
- **Retry with backoff** — transient failures (timeouts, rate limits) are retried automatically with exponential delays

### AI

- **Summarize Transcript with AI** — generate a structured summary using Raycast AI
- **Ask AI About This Transcript** — ask questions about the transcript content
- **Follow-up chains** — ask follow-up questions with full conversation context preserved
- **Custom AI actions** — define up to 2 custom prompt templates in preferences (e.g., "Extract Key Quotes", "List Action Items") that appear as menu actions
- **Auto-summarize on fetch** — optionally generate a summary automatically whenever a new transcript is fetched
- **AI response language** — choose which language AI responds in, regardless of transcript language
- **Configurable AI model** — choose between Claude, GPT, Gemini, Llama, DeepSeek, Grok, and more

### History

- **Transcript history** — all fetched transcripts are cached for instant reuse
- **Full-text search** — search across all transcripts with highlighted snippet previews
- **Pin transcripts** — pin important transcripts to the top of the history list
- **Sort options** — sort by date, title, or channel (with per-channel grouping)
- **AI chat history** — browse all cached summaries and Q&A answers per transcript
- **Search AI chats** — search across all AI responses from every transcript
- **Rich detail pane** — shows thumbnail, metadata (channel, duration, views, likes, comments, word count, reading time), AI summary preview, and full transcript
- **AI chat retention policy** — auto-expire cached AI responses older than a configurable threshold

### Export

- **Plain text, JSON, SRT, Markdown** — export transcripts in multiple formats
- **Markdown export** — includes metadata header, AI summary, and timestamped transcript
- **Copy as rich text** — copy formatted transcript with clickable timestamps to clipboard (`⌘⇧.`)
- **Copy individual segments** — copy a specific segment with its timestamp from the search view
- **Export AI chats** — export all AI summaries and answers for a transcript as a single Markdown file

## Commands

| Command | Description |
| --- | --- |
| **Transcribe YouTube Video** | Auto-detects a YouTube URL and fetches its transcript. Accepts an optional language argument. |
| **View Transcript History** | Browse cached transcripts with search, AI actions, and export. |
| **Search AI Chats** | Search across all AI summaries and answers from every transcript. |

## Configuration

Open **Raycast Preferences > Extensions > YouTube Transcribe** to customize:

| Preference | Description | Default |
| --- | --- | --- |
| Auto-Summarize on Fetch | Generate an AI summary automatically when a transcript is fetched | Off |
| Default AI Action | Which AI action appears first in menus | Summarize |
| Summarize Prompt Template | Custom prompt for summaries. Supports `{{title}}`, `{{url}}`, `{{channel}}`, `{{transcript}}`, `{{language}}`, `{{tags}}`, `{{duration}}`, `{{contentKind}}` | Built-in template |
| Custom AI Action 1/2 — Name | Display name for custom actions. Leave empty to disable. | — |
| Custom AI Action 1/2 — Prompt | Prompt template for custom actions. Same variables as above. | — |
| AI Model | Choose which AI model to use | Auto |
| AI Response Language | Language for AI responses | Auto |
| History Limit | Max transcript entries to keep | 100 |
| History Max Age | Auto-remove entries older than threshold | Unlimited |
| AI Chat Max Age | Auto-remove AI responses older than threshold | Unlimited |
| History Sort Order | Default sort for transcript history | Newest First |

## Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `⌘⇧S` | Summarize Transcript with AI |
| `⌘⇧A` | Ask AI About This Transcript |
| `⌘⇧C` | View AI Chats |
| `⌘⇧P` | Pin / Unpin transcript |
| `⌘⇧F` | Ask Follow-Up |
| `⌘⇧.` | Copy as Rich Text |
| `⌘⇧E` | Export All AI Chats |
| `⌘F` | Search in Transcript |
| `⌘O` | Open Video in Browser |

## Troubleshooting

1. **yt-dlp not found** — verify it's installed:
   ```bash
   which yt-dlp
   ```
   Install via `brew install yt-dlp` or `pip3 install yt-dlp`.
2. **SSL certificate errors after installing Python** — if you installed Python from python.org, run the certificate installer:
   ```bash
   open "/Applications/Python 3.14/Install Certificates.command"
   ```
   (Replace `3.14` with your Python version.)
3. **No captions found** — ensure the video has captions available in the requested language.
4. **Age-restricted content** — make sure a supported browser is open so yt-dlp can use its cookies.
5. **Rate limiting (429 errors)** — the extension retries automatically with backoff. If fetches keep failing, wait a moment before trying again. Avoid fetching multiple videos in rapid succession.
6. **Python deprecation warnings** — if you see warnings about Python 3.9, upgrade Python from [python.org](https://www.python.org/downloads/).

For persistent issues, [open an issue](https://github.com/caasols/raycast-youtube-scribe/issues) with reproduction steps.

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b my-new-feature`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin my-new-feature`
5. Submit a pull request

Please open a discussion first if you plan to work on a larger change so we can align on the approach.

## License

Released under the [MIT License](./LICENSE).
