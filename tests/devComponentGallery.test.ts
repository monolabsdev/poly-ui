import { describe, expect, it } from "vitest";
import { getDevComponentGalleryAction } from "@/features/dev/componentGalleryAction";

describe("getDevComponentGalleryAction", () => {
  it("only returns the component gallery action in dev mode", () => {
    expect(getDevComponentGalleryAction(false, true)).toBeNull();
    expect(getDevComponentGalleryAction(true, false)).toBeNull();

    const action = getDevComponentGalleryAction(true, true);

    expect(action?.id).toBe("action:component-gallery");
  });
});
