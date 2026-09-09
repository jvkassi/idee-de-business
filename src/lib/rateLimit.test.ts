import { describe, expect, it } from "vitest";
import { checkAudioSize, formatWindow, MAX_AUDIO_BYTES } from "./rateLimit";

describe("checkAudioSize", () => {
  it("accepts a size under the limit", () => {
    expect(checkAudioSize(1024)).toEqual({ ok: true });
  });

  it("accepts a size exactly at the limit", () => {
    expect(checkAudioSize(MAX_AUDIO_BYTES)).toEqual({ ok: true });
  });

  it("rejects a size over the limit", () => {
    const result = checkAudioSize(MAX_AUDIO_BYTES + 1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Enregistrement trop volumineux (max 20 Mo).");
    }
  });
});

describe("formatWindow", () => {
  it("formats an exact multiple of 60 minutes as hours", () => {
    expect(formatWindow(60)).toBe("1 h");
    expect(formatWindow(24 * 60)).toBe("24 h");
  });

  it("formats a non-multiple of 60 as minutes", () => {
    expect(formatWindow(30)).toBe("30 min");
    expect(formatWindow(90)).toBe("90 min");
  });

  it("formats zero minutes as 0 h (0 is a multiple of 60)", () => {
    expect(formatWindow(0)).toBe("0 h");
  });
});
