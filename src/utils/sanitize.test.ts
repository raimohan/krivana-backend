import path from "node:path";

import { describe, expect, it } from "vitest";

import { safePath } from "./sanitize";

describe("safePath", () => {
  it("keeps paths inside the project root", () => {
    const root = path.resolve("/tmp/project");
    expect(safePath(root, "src/index.ts")).toBe(path.resolve(root, "src/index.ts"));
  });

  it("rejects traversal paths", () => {
    const root = path.resolve("/tmp/project");
    expect(() => safePath(root, "../secret.txt")).toThrowError();
  });
});
