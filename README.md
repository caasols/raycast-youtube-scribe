# YouTube Transcribe

![Raycast](https://img.shields.io/badge/Raycast-black?logo=raycast&style=flat)
![React](https://img.shields.io/badge/React-black?logo=react&style=flat)
![TypeScript](https://img.shields.io/badge/TypeScript-black?logo=typescript&style=flat)

Fetch and browse YouTube transcripts without leaving Raycast. Auto-detects videos from your clipboard or focused browser tab, fetches captions with [yt-dlp](https://github.com/yt-dlp/yt-dlp), and adds AI-powered summaries and Q&A directly inside Raycast.

## ✨ Features

- Auto-detection from clipboard and focused browser tabs
- Transcript history with reuse per video + language
- Full-text transcript search with highlighted snippets
- AI actions for summarizing transcripts and asking questions
- Export to text, JSON, SRT, and VTT
- Stored video metadata (channel, duration, tags, thumbnail)
- Configurable history retention and summarize prompt

## 🧭 Commands

| Command | Description |
| --- | --- |
| `Transcribe YouTube Video` | Detects a YouTube URL automatically and fetches its transcript |
| `View Transcript History` | Browse cached transcripts with search, preview, AI actions, and export |

## 📋 Requirements

[yt-dlp](https://github.com/yt-dlp/yt-dlp) must be installed locally:

```bash
brew install yt-dlp
```

## 🚀 Getting Started

```bash
git clone https://github.com/caasols/raycast-youtube-scribe.git
cd raycast-youtube-scribe
npm install
npm run dev
```

## 🤝 Contributing

Issues and pull requests are welcome! Please open a discussion if you plan to work on a larger change so we can align on the approach.

## ⭐ Support

If this extension saves you time:
- Star the [GitHub repository](https://github.com/caasols/raycast-youtube-scribe)
- Share it with coworkers who live in their command bar
- Report bugs or enhancements via GitHub issues

## 📄 License

Released under the [MIT License](./LICENSE).
