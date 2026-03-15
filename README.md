# YouTube Scribe

Raycast extension for fetching YouTube transcripts from a URL, the clipboard, or the focused browser tab.

## Requirements

`yt-dlp` must be installed locally before the extension can fetch transcripts.

Recommended install methods:

```bash
brew install yt-dlp
```

```bash
pipx install yt-dlp
```

## Supported Browsers

- Google Chrome
- Google Chrome Canary
- Chromium
- Brave Browser
- Microsoft Edge
- Safari
- Safari Technology Preview
- Arc
- Vivaldi
- Opera

The extension can auto-detect the focused YouTube tab in those browsers and, when possible, reuse that browser for `yt-dlp --cookies-from-browser`.

## How It Works

1. Run `Transcribe YouTube Video`.
2. Leave the URL blank to auto-detect a YouTube link from the clipboard first, then the focused browser tab.
3. Optionally provide a language code such as `en`, `pt`, or `es`.
4. Choose `text` or `json`.
5. The transcript is copied to the clipboard and saved in `Transcript History`.

## Development

```bash
npm install
npm run dev
```

Useful commands:

```bash
npm test
npm run test:watch
npm run build
npm run lint
```

Optional real-provider smoke test:

```bash
npm run test:smoke
```

## Troubleshooting

If you see `yt-dlp is not installed`:

- install `yt-dlp` with Homebrew or `pipx`
- reopen Raycast and run the command again

If the extension says no transcript is available:

- the video may not have captions
- the requested language may not exist
- try leaving the language field blank to let `yt-dlp` fall back

If the extension says the video requires cookies or sign-in:

- open the video in a supported browser
- make sure you are signed in there if the video needs access
- retry from the history view or rerun the command

If focused-tab detection fails:

- paste the YouTube URL manually
- or copy the URL to the clipboard and rerun the command

## Notes

- Transcript availability depends on YouTube captions, not the extension alone.
- Some restricted videos may still fail if browser cookies cannot be reused by `yt-dlp`.
