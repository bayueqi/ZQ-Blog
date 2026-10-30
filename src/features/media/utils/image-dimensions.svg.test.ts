import { describe, expect, it } from "vitest";
import { getImageDimensions } from "./image-dimensions";

const encode = (svg: string) => new TextEncoder().encode(svg).buffer;

describe("getImageDimensions for SVG", () => {
  it("reads absolute width and height off the root element", () => {
    expect(
      getImageDimensions(
        encode(
          '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"></svg>',
        ),
      ),
    ).toEqual({ width: 320, height: 180 });
  });

  it("accepts a px suffix and rounds fractional values", () => {
    expect(
      getImageDimensions(encode('<svg width="100.5px" height="50px"></svg>')),
    ).toEqual({ width: 101, height: 50 });
  });

  it("falls back to the viewBox when width and height are relative", () => {
    // A percentage describes how much of its container the drawing fills, not
    // how big the drawing is, so the viewBox is the only real size here.
    expect(
      getImageDimensions(
        encode('<svg width="100%" height="100%" viewBox="0 0 640 480"></svg>'),
      ),
    ).toEqual({ width: 640, height: 480 });
  });

  it("falls back to the viewBox when width and height are absent", () => {
    expect(
      getImageDimensions(encode('<svg viewBox="0 0 24 24"></svg>')),
    ).toEqual({ width: 24, height: 24 });
  });

  it("skips an xml declaration and a comment before the root element", () => {
    expect(
      getImageDimensions(
        encode(
          '<?xml version="1.0"?>\n<!-- drawn by hand -->\n<svg width="12" height="8"></svg>',
        ),
      ),
    ).toEqual({ width: 12, height: 8 });
  });

  it("returns null when there is nothing to measure", () => {
    expect(getImageDimensions(encode("<svg></svg>"))).toBeNull();
    expect(getImageDimensions(encode("not an image at all"))).toBeNull();
    expect(
      getImageDimensions(encode('<svg viewBox="0 0 0 0"></svg>')),
    ).toBeNull();
  });
});
