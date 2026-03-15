import type { HistoryEntry } from "../types";

export function buildDiagnosticReport(entry: HistoryEntry): string {
  const sections: string[] = [];

  sections.push("## Diagnostic Report\n");

  // Entry info
  const statusLine = entry.errorKind
    ? `${entry.status} (${entry.errorKind})`
    : entry.status;
  sections.push(
    [
      `**Status:** ${statusLine}`,
      `**Video:** ${entry.title} (${entry.url})`,
      `**Video ID:** ${entry.videoId}`,
      entry.contentKind ? `**Content Kind:** ${entry.contentKind}` : undefined,
      `**Created:** ${entry.createdAt}`,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  // Environment
  const diag = entry.diagnostics;
  if (diag) {
    const envLines = [
      diag.ytDlpPath
        ? `- **yt-dlp:** ${diag.ytDlpPath} (${diag.ytDlpSource ?? "unknown source"})`
        : undefined,
      diag.cookieBrowser
        ? `- **Cookie browser:** ${diag.cookieBrowser}`
        : undefined,
      diag.browserApp ? `- **Browser app:** ${diag.browserApp}` : undefined,
      diag.requestedLanguage
        ? `- **Language:** ${diag.requestedLanguage} → ${diag.effectiveLanguage ?? "auto"}`
        : undefined,
    ].filter(Boolean);

    if (envLines.length > 0) {
      sections.push(`### Environment\n${envLines.join("\n")}`);
    }
  }

  // Error info
  if (entry.status === "error") {
    if (entry.errorLog) {
      sections.push(`### Error\n\`\`\`\n${entry.errorLog}\n\`\`\``);
    }
    if (entry.statusMessage) {
      sections.push(`### Status Message\n${entry.statusMessage}`);
    }
  }

  // Debug log
  if (entry.debugLog) {
    sections.push(`### Debug Log\n\`\`\`json\n${entry.debugLog}\n\`\`\``);
  }

  return sections.join("\n\n");
}
