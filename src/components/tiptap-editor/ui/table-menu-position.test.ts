import { describe, expect, it } from "vitest";
import { tableMenuAnchor } from "./table-menu-position";

const rect = (left: number, top: number, width: number, height: number) => ({
  left,
  top,
  right: left + width,
  bottom: top + height,
});

describe("tableMenuAnchor", () => {
  it("sits above the table while there is room below the visible top", () => {
    const table = rect(344, 400, 974, 160);
    expect(
      tableMenuAnchor({
        table,
        cell: rect(1000, 460, 318, 44),
        visibleTop: 160,
      }),
    ).toBe(table);
  });

  it("falls back to the active cell once the table top has scrolled away", () => {
    const cell = rect(344, 500, 318, 44);
    expect(
      tableMenuAnchor({
        table: rect(344, 40, 974, 900),
        cell,
        visibleTop: 160,
      }),
    ).toBe(cell);
    expect(
      tableMenuAnchor({
        table: rect(344, 200, 974, 900),
        cell,
        visibleTop: 160,
      }),
    ).toBe(cell);
  });
});
