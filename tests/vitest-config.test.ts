import { describe, expect, it } from "vitest";

import config from "../vitest.config";

describe("vitest config", () => {
  it("limits test discovery to repo tests and excludes local worktrees", () => {
    expect(config.test?.include).toEqual(["tests/**/*.test.ts"]);
    expect(config.test?.exclude).toContain(".worktrees/**");
  });
});
