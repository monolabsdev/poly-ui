import {
  PRETEXT_FONTS,
  estimateLineClampHeight,
  estimateTextareaHeight,
  measureTextHeight,
} from "../src/lib/utils/pretext";
import {
  getPerformanceProfile,
  isLowEndProfile,
} from "../src/lib/performance/policy";

describe("performance primitives", () => {
  it("estimates textarea height with Pretext and clamps to min/max bounds", () => {
    expect(
      estimateTextareaHeight({
        text: "",
        width: 320,
        minHeight: 40,
        maxHeight: 169,
      }),
    ).toBe(40);

    expect(
      estimateTextareaHeight({
        text: Array.from({ length: 20 }, (_, index) => `line ${index}`).join(
          "\n",
        ),
        width: 320,
        minHeight: 40,
        maxHeight: 169,
      }),
    ).toBe(169);
  });

  it("returns stable clamped line heights for short labels", () => {
    expect(
      estimateLineClampHeight({
        text: "A short conversation title",
        font: PRETEXT_FONTS.sidebarItem,
        width: 180,
        lineHeightPx: 20,
        minHeight: 20,
        maxLines: 1,
      }),
    ).toBe(20);
  });

  it("falls back to deterministic line count when Pretext cannot measure", () => {
    expect(
      measureTextHeight("alpha\nbeta\ngamma", "bad font", 0, 1.5, {
        fallbackLineHeightPx: 18,
      }),
    ).toBe(54);
  });

  it("classifies old hardware hints as low-end", () => {
    const profile = getPerformanceProfile({
      hardwareConcurrency: 2,
      deviceMemory: 2,
      reducedMotion: false,
    });

    expect(profile.tier).toBe("low");
    expect(isLowEndProfile(profile)).toBe(true);
  });
});
