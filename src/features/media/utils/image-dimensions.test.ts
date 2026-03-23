import { describe, expect, it } from "vitest";
import { getImageDimensions } from "./image-dimensions";

/** 构造最小合法 PNG (1x1 像素) */
function createPngBuffer(width: number, height: number): ArrayBuffer {
  // PNG signature + IHDR chunk (width and height in big-endian at offset 16/20)
  const buf = new Uint8Array(33);
  // PNG signature
  buf.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  // IHDR chunk length (13 bytes)
  buf.set([0x00, 0x00, 0x00, 0x0d], 8);
  // "IHDR"
  buf.set([0x49, 0x48, 0x44, 0x52], 12);
  // Width (big-endian 32-bit)
  writeUint32BE(buf, 16, width);
  // Height (big-endian 32-bit)
  writeUint32BE(buf, 20, height);
  return buf.buffer;
}

/** 构造最小合法 GIF 头部 */
function createGifBuffer(width: number, height: number): ArrayBuffer {
  const buf = new Uint8Array(10);
  // "GIF89a"
  buf.set([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
  // Width (little-endian 16-bit)
  buf[6] = width & 0xff;
  buf[7] = (width >> 8) & 0xff;
  // Height (little-endian 16-bit)
  buf[8] = height & 0xff;
  buf[9] = (height >> 8) & 0xff;
  return buf.buffer;
}

/** 构造最小合法 JPEG (带 SOF0 marker) */
function createJpegBuffer(width: number, height: number): ArrayBuffer {
  const buf = new Uint8Array(20);
  // SOI
  buf[0] = 0xff;
  buf[1] = 0xd8;
  // SOF0 marker
  buf[2] = 0xff;
  buf[3] = 0xc0;
  // Segment length (11 bytes)
  buf[4] = 0x00;
  buf[5] = 0x0b;
  // Precision
  buf[6] = 0x08;
  // Height (big-endian 16-bit)
  buf[7] = (height >> 8) & 0xff;
  buf[8] = height & 0xff;
  // Width (big-endian 16-bit)
  buf[9] = (width >> 8) & 0xff;
  buf[10] = width & 0xff;
  return buf.buffer;
}

/**
 * 构造最小合法 WebP VP8X 头部
 * VP8X 尺寸以 24-bit little-endian (value - 1) 存储
 */
function createWebpVP8XBuffer(width: number, height: number): ArrayBuffer {
  const buf = new Uint8Array(30);
  // "RIFF"
  buf.set([0x52, 0x49, 0x46, 0x46]);
  // File size placeholder
  buf.set([0x00, 0x00, 0x00, 0x00], 4);
  // "WEBP"
  buf.set([0x57, 0x45, 0x42, 0x50], 8);
  // "VP8X"
  buf.set([0x56, 0x50, 0x38, 0x58], 12);
  // Chunk size (10 bytes)
  buf.set([0x0a, 0x00, 0x00, 0x00], 16);
  // Flags
  buf.set([0x00, 0x00, 0x00, 0x00], 20);
  // Canvas width - 1 (24-bit LE)
  const w = width - 1;
  buf[24] = w & 0xff;
  buf[25] = (w >> 8) & 0xff;
  buf[26] = (w >> 16) & 0xff;
  // Canvas height - 1 (24-bit LE)
  const h = height - 1;
  buf[27] = h & 0xff;
  buf[28] = (h >> 8) & 0xff;
  buf[29] = (h >> 16) & 0xff;
  return buf.buffer;
}

function writeUint32BE(buf: Uint8Array, offset: number, value: number) {
  buf[offset] = (value >> 24) & 0xff;
  buf[offset + 1] = (value >> 16) & 0xff;
  buf[offset + 2] = (value >> 8) & 0xff;
  buf[offset + 3] = value & 0xff;
}

describe("getImageDimensions", () => {
  it("应正确解析 PNG 尺寸", () => {
    const result = getImageDimensions(createPngBuffer(1920, 1080));
    expect(result).toEqual({ width: 1920, height: 1080 });
  });

  it("应正确解析 GIF 尺寸", () => {
    const result = getImageDimensions(createGifBuffer(320, 240));
    expect(result).toEqual({ width: 320, height: 240 });
  });

  it("应正确解析 JPEG 尺寸", () => {
    const result = getImageDimensions(createJpegBuffer(800, 600));
    expect(result).toEqual({ width: 800, height: 600 });
  });

  it("应正确解析 WebP VP8X 尺寸", () => {
    const result = getImageDimensions(createWebpVP8XBuffer(1280, 720));
    expect(result).toEqual({ width: 1280, height: 720 });
  });

  it("对无法识别的格式返回 null", () => {
    const buf = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04]).buffer;
    expect(getImageDimensions(buf)).toBeNull();
  });

  it("对过短的数据返回 null", () => {
    const buf = new Uint8Array([0x89, 0x50]).buffer;
    expect(getImageDimensions(buf)).toBeNull();
  });

  it("应处理大尺寸 PNG", () => {
    const result = getImageDimensions(createPngBuffer(4096, 2160));
    expect(result).toEqual({ width: 4096, height: 2160 });
  });

  it("应处理 1x1 像素的图片", () => {
    expect(getImageDimensions(createPngBuffer(1, 1))).toEqual({
      width: 1,
      height: 1,
    });
    expect(getImageDimensions(createGifBuffer(1, 1))).toEqual({
      width: 1,
      height: 1,
    });
    expect(getImageDimensions(createJpegBuffer(1, 1))).toEqual({
      width: 1,
      height: 1,
    });
  });

  describe("JPEG 边界情况", () => {
    it("应跳过 DHT (C4) 标记找到 SOF", () => {
      // FF D8 → FF C4 (DHT, skip) → FF C0 (SOF0, target)
      const buf = new Uint8Array(30);
      // SOI
      buf[0] = 0xff;
      buf[1] = 0xd8;
      // DHT marker (should be skipped)
      buf[2] = 0xff;
      buf[3] = 0xc4;
      // DHT segment length (5 bytes total including length field)
      buf[4] = 0x00;
      buf[5] = 0x05;
      buf[6] = 0x00;
      buf[7] = 0x00;
      buf[8] = 0x00;
      // SOF0 marker
      buf[9] = 0xff;
      buf[10] = 0xc0;
      // SOF segment length
      buf[11] = 0x00;
      buf[12] = 0x0b;
      // Precision
      buf[13] = 0x08;
      // Height: 480
      buf[14] = 0x01;
      buf[15] = 0xe0;
      // Width: 640
      buf[16] = 0x02;
      buf[17] = 0x80;

      const result = getImageDimensions(buf.buffer);
      expect(result).toEqual({ width: 640, height: 480 });
    });
  });
});
