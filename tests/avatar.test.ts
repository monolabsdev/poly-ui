import React from "react";
import {
  AVATAR_COLOR_PALETTE,
  getAvatarColor,
  getAvatarColorSeed,
} from "../src/components/ui/avatar";

describe("avatar colors", () => {
  it("selects a stable palette color from fallback text", () => {
    const color = getAvatarColor("AL");

    expect(AVATAR_COLOR_PALETTE).toContain(color);
    expect(getAvatarColor("AL")).toBe(color);
  });

  it("extracts fallback text from nested avatar children", () => {
    const children = React.createElement(
      "span",
      null,
      React.createElement("strong", null, "AL"),
    );

    expect(getAvatarColorSeed(children)).toBe("AL");
  });
});
