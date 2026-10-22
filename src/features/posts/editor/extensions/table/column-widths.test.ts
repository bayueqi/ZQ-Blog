import { describe, expect, it } from "vitest";
import { resizeColumn } from "./column-widths";

describe("resizeColumn", () => {
  it("takes the dragged width from the column to the right", () => {
    expect(resizeColumn([200, 300, 400], 0, 250, 48)).toEqual([250, 250, 400]);
    expect(resizeColumn([200, 300, 400], 1, 200, 48)).toEqual([200, 200, 500]);
  });

  it("stops where either column would get narrower than the minimum", () => {
    expect(resizeColumn([200, 300, 400], 0, 600, 48)).toEqual([452, 48, 400]);
    expect(resizeColumn([200, 300, 400], 0, 10, 48)).toEqual([48, 452, 400]);
  });
});
