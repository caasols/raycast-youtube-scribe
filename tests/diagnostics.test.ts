import { describe, expect, it } from "vitest";
import { buildDiagnosticReport } from "../src/lib/diagnostics";
import type { HistoryEntry } from "../src/types";

const errorEntry: HistoryEntry = {
  id: "test-1",
  fetchKey: "key-1",
  createdAt: "2026-01-01T00:00:00Z",
  videoId: "abc123",
  url: "https://youtube.com/watch?v=abc123",
  title: "Test Video",
  segmentCount: 0,
  status: "error",
  errorKind: "timeout",
  errorLog: "Process timed out",
  statusMessage: "yt-dlp timed out",
  contentKind: "video",
  diagnostics: {
    ytDlpPath: "/opt/homebrew/bin/yt-dlp",
    ytDlpSource: "homebrew",
    cookieBrowser: "chrome",
    requestedLanguage: "en",
    effectiveLanguage: "en",
  },
  debugLog: '{"phase":"error"}',
};

const finishedEntry: HistoryEntry = {
  id: "test-2",
  fetchKey: "key-2",
  createdAt: "2026-01-01T00:00:00Z",
  videoId: "def456",
  url: "https://youtube.com/watch?v=def456",
  title: "Good Video",
  segmentCount: 10,
  status: "finished",
};

describe("buildDiagnosticReport", () => {
  it("includes entry status and metadata", () => {
    const report = buildDiagnosticReport(errorEntry);
    expect(report).toContain("## Diagnostic Report");
    expect(report).toContain("**Status:** error (timeout)");
    expect(report).toContain("**Video:** Test Video");
    expect(report).toContain("**Video ID:** abc123");
    expect(report).toContain("**Content Kind:** video");
  });

  it("includes environment diagnostics", () => {
    const report = buildDiagnosticReport(errorEntry);
    expect(report).toContain("### Environment");
    expect(report).toContain("/opt/homebrew/bin/yt-dlp");
    expect(report).toContain("homebrew");
    expect(report).toContain("chrome");
    expect(report).toContain("en → en");
  });

  it("includes error info for error entries", () => {
    const report = buildDiagnosticReport(errorEntry);
    expect(report).toContain("### Error");
    expect(report).toContain("Process timed out");
    expect(report).toContain("### Status Message");
  });

  it("includes debug log", () => {
    const report = buildDiagnosticReport(errorEntry);
    expect(report).toContain("### Debug Log");
    expect(report).toContain('{"phase":"error"}');
  });

  it("handles entries without diagnostics", () => {
    const report = buildDiagnosticReport(finishedEntry);
    expect(report).toContain("## Diagnostic Report");
    expect(report).toContain("**Status:** finished");
    expect(report).not.toContain("### Environment");
    expect(report).not.toContain("### Error");
  });

  it("omits error section for finished entries", () => {
    const report = buildDiagnosticReport(finishedEntry);
    expect(report).not.toContain("### Error");
    expect(report).not.toContain("### Status Message");
  });
});
