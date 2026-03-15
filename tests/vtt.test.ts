import { describe, expect, it } from "vitest";
import { parseVtt } from "../src/lib/vtt";

describe("parseVtt", () => {
  it("parses cues, strips html, and removes duplicate text blocks", () => {
    const transcript = parseVtt(`WEBVTT

00:00:00.000 --> 00:00:01.000
<c.colorE5E5E5>Hello</c>

00:00:01.000 --> 00:00:02.000
Hello

00:00:02.000 --> 00:00:04.500
world
again
`);

    expect(transcript).toEqual([
      { text: "Hello", start_ms: 0, duration_ms: 1000 },
      { text: "world again", start_ms: 2000, duration_ms: 2500 },
    ]);
  });

  it("ignores malformed and empty cues", () => {
    expect(
      parseVtt(`WEBVTT

bad cue

00:00:01.000 --> 00:00:02.000

00:00:02.000 --> 00:00:03.000
 line one 
`),
    ).toEqual([{ text: "line one", start_ms: 2000, duration_ms: 1000 }]);
  });
});
