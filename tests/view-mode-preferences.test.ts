import { describe, expect, it } from "vitest";
import {
  resolveViewModePreference,
  updateViewModePreferences,
} from "../src/lib/view-mode-preferences";
import type { OutputFormat } from "../src/types";

describe("view mode preferences", () => {
  it("defaults to text when there is no saved preference", () => {
    expect(resolveViewModePreference({}, "abc::auto")).toBe("text");
  });

  it("stores a mode per fetch key", () => {
    const next = updateViewModePreferences({}, "abc::auto", "json");

    expect(next).toEqual({
      "abc::auto": "json",
    });
    expect(resolveViewModePreference(next, "abc::auto")).toBe("json");
  });

  it("keeps different fetch keys isolated", () => {
    const initial: Record<string, OutputFormat> = {
      "abc::auto": "json",
    };

    expect(resolveViewModePreference(initial, "abc::en")).toBe("text");

    expect(updateViewModePreferences(initial, "abc::en", "json")).toEqual({
      "abc::auto": "json",
      "abc::en": "json",
    });
  });
});
