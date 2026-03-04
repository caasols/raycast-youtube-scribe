# YouTube Scribe (Raycast Extension)

Starter scaffold for a Raycast extension that fetches YouTube transcripts.

## What is included

- Raycast extension metadata (`package.json`)
- TypeScript + ESLint base setup
- First command: **Get YouTube Transcript**
  - Accepts a YouTube URL or video ID
  - Fetches transcript text
  - Copies transcript to clipboard
  - Shows transcript preview inside Raycast

## Run locally

```bash
npm install
npm run dev
```

Then open Raycast and run **Get YouTube Transcript**.

## Next steps

- Move your existing script logic into `src/get-youtube-transcript.tsx`
- Add language selection and transcript formatting
- Add output options (plain text, timestamps, markdown)
- Add caching/history for recent videos
