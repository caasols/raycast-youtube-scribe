# Metadata-Aware AI Prompts — Design Spec

## Goal

Enrich AI prompts (summary and question) with video metadata so the AI can produce more contextual, accurate responses.

## Current State

`interpolateTemplate` in `transcript-ai.ts` supports three placeholders: `{{title}}`, `{{url}}`, `{{transcript}}`. The default summary template and question prompt builder only include these. Rich metadata (channel, tags, duration, language, content kind) is available on `HistoryEntry` but unused in AI prompts.

## Design

### New Placeholders

Add five placeholders to `interpolateTemplate`:

| Placeholder | Source | Fallback |
|-------------|--------|----------|
| `{{channel}}` | `entry.videoMetadata?.channelName` | `"Unknown"` |
| `{{contentKind}}` | `entry.contentKind` | `"video"` |
| `{{language}}` | `entry.language` | `"Unknown"` |
| `{{tags}}` | `entry.videoMetadata?.tags?.join(", ")` | `"None"` |
| `{{duration}}` | `entry.videoMetadata?.durationText` | `"Unknown"` |

### Updated Default Summary Template

Add metadata lines to the source material section (before the Transcript line):

```
Title: {{title}}
Channel: {{channel}}
Type: {{contentKind}}
Duration: {{duration}}
Language: {{language}}
Tags: {{tags}}
URL: {{url}}
Transcript:
{{transcript}}
```

### Updated Question Prompt

Add metadata context to `buildTranscriptQuestionPrompt`:

```
Video: {title}
Channel: {channel}
Type: {contentKind}
Duration: {duration}
Language: {language}
Tags: {tags}
URL: {url}
```

### Backward Compatibility

Custom templates that don't include new placeholders will have them silently ignored — `replaceAll` on a string that doesn't contain the pattern is a no-op. Users who want metadata in custom templates can add the new `{{...}}` variables.

### Files Affected

| File | Change |
|------|--------|
| `src/commands/transcript-history/transcript-ai.ts` | Update `interpolateTemplate`, `DEFAULT_SUMMARIZE_PROMPT_TEMPLATE`, `buildTranscriptQuestionPrompt` |
| `tests/transcript-ai.test.ts` | New: test metadata interpolation and fallbacks |

### Testing

1. `interpolateTemplate` with full metadata — all placeholders resolved
2. `interpolateTemplate` with missing metadata — fallback values used
3. `buildTranscriptQuestionPrompt` includes metadata fields
4. Default template contains new placeholder variables
