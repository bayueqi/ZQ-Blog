import { describe, expect, it } from "vitest";
import { PLAIN_TEXT, isPlainTextLanguage } from "./code-languages";

describe("isPlainTextLanguage", () => {
  it.each([PLAIN_TEXT, "txt", "plaintext", "TXT", " Text ", "", null])(
    "treats %j as plain text",
    (name) => {
      expect(isPlainTextLanguage(name)).toBe(true);
    },
  );

  it.each(["ts", "typescript", "not-a-language"])(
    "does not treat %j as plain text",
    (name) => {
      expect(isPlainTextLanguage(name)).toBe(false);
    },
  );
});
