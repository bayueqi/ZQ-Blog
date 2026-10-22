import { describe, expect, it } from "vitest";
import {
  getOptimizedImageUrl,
  getOriginalImageUrl,
  getPublicImageSrc,
  getPublicImageSrcSet,
  getTransformSourceUrl,
  parseImageTransform,
  PUBLIC_IMAGE_WIDTH,
} from "./media.utils";

describe("image URLs", () => {
  it("keeps admin originals off the transform query", () => {
    expect(getOriginalImageUrl("abc.png")).toBe("/images/abc.png");
  });

  it("opts into a public transform with quality and width", () => {
    expect(getOptimizedImageUrl("abc.png", PUBLIC_IMAGE_WIDTH.cover)).toBe(
      "/images/abc.png?quality=80&width=800",
    );
  });

  it("does not transform gifs", () => {
    expect(getOptimizedImageUrl("loop.gif", 800)).toBe(
      "/images/loop.gif?original=true",
    );
  });

  it("rewrites public src from a stored original and keeps cache-busting", () => {
    expect(
      getPublicImageSrc(
        "/images/home-bg.webp?v=177",
        PUBLIC_IMAGE_WIDTH.banner,
      ),
    ).toBe("/images/home-bg.webp?quality=80&width=1600&v=177");
  });

  it("leaves external src unchanged", () => {
    expect(getPublicImageSrc("https://cdn.example/pic.png", 800)).toBe(
      "https://cdn.example/pic.png",
    );
  });

  it.each([
    ["width=400&quality=80", 400],
    ["quality=80&width=800", 800],
    ["width=1600&quality=80&v=177", 1600],
    ["width=2560", 2560],
  ])("transforms the allowed request %s", (query, width) => {
    expect(
      parseImageTransform(new URLSearchParams(query), "image/avif,image/webp"),
    ).toEqual({ width, quality: 80, format: "avif" });
  });

  it.each([
    "",
    "v=1",
    "original=true",
    "quality=80",
    "width=799&quality=80",
    "width=800&quality=90",
    "width=800&height=600",
    "width=800&fit=cover",
    "width=800&original=true",
  ])("serves the original for %s", (query) => {
    expect(parseImageTransform(new URLSearchParams(query), "")).toBeNull();
  });

  it("negotiates webp when avif is not accepted", () => {
    expect(
      parseImageTransform(new URLSearchParams("width=800"), "image/webp"),
    ).toEqual({ width: 800, quality: 80, format: "webp" });
  });

  it("offers a 1x and 2x source set for public images", () => {
    expect(getPublicImageSrcSet("/images/abc.png?v=3", [800, 1600])).toBe(
      "/images/abc.png?quality=80&width=800&v=3 800w, /images/abc.png?quality=80&width=1600&v=3 1600w",
    );
    expect(
      getPublicImageSrcSet("/images/loop.gif", [800, 1600]),
    ).toBeUndefined();
    expect(
      getPublicImageSrcSet("https://cdn.example/pic.png", [800, 1600]),
    ).toBeUndefined();
  });

  it("fetches the transform source at the requested version", () => {
    expect(
      getTransformSourceUrl(
        new URL(
          "https://blog.example/images/asset/themes/fuwari/home-bg.webp?quality=80&width=1600&v=177",
        ),
        "asset/themes/fuwari/home-bg.webp",
      ),
    ).toBe(
      "https://blog.example/images/asset/themes/fuwari/home-bg.webp?original=true&v=177",
    );
    expect(
      getTransformSourceUrl(
        new URL("https://blog.example/images/abc.png?quality=80&width=800"),
        "abc.png",
      ),
    ).toBe("https://blog.example/images/abc.png?original=true");
  });
});
