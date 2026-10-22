import { describe, expect, it } from "vitest";
import {
  SITE_ASSET_MAX_FILE_SIZE,
  SITE_ASSET_MAX_FILE_SIZE_MB,
  parseSiteAssetUploadInput,
} from "./config.asset.schema";
import { m } from "@/paraglide/messages";

function uploadForm(size: number) {
  const formData = new FormData();
  formData.set(
    "file",
    new File([new Uint8Array(size)], "avatar.png", { type: "image/png" }),
  );
  formData.set("assetPath", "themes/fuwari/avatar.png");
  return formData;
}

describe("parseSiteAssetUploadInput", () => {
  it("accepts a file at the size limit", () => {
    const parsed = parseSiteAssetUploadInput(
      uploadForm(SITE_ASSET_MAX_FILE_SIZE),
      m,
    );
    expect(parsed.assetPath).toBe("themes/fuwari/avatar.png");
  });

  it("names the enforced limit when a file is too large", () => {
    expect(() =>
      parseSiteAssetUploadInput(uploadForm(SITE_ASSET_MAX_FILE_SIZE + 1), m),
    ).toThrow(`${SITE_ASSET_MAX_FILE_SIZE_MB}MB`);
  });
});
