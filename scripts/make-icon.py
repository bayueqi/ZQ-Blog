"""生成站点图标。

用法：python scripts/make-icon.py <源图路径>

以源图背景色为画布，按图形边界裁成正方形并输出 public/ 下的全部图标。
"""

from __future__ import annotations

import base64
import io
import sys
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"

PADDING = 0.085  # 图形四周留白比例（相对图形最长边）
PALETTE_COLORS = 64  # 源图是 JPEG，压成调色板可去掉噪点并显著减小体积
SVG_EMBED_SIZE = 256
ICO_SIZES = [(64, 64), (48, 48), (32, 32), (16, 16)]


def detect_background(image: Image.Image) -> tuple[int, int, int]:
    width, height = image.size
    corners = [
        image.getpixel((0, 0)),
        image.getpixel((width - 1, 0)),
        image.getpixel((0, height - 1)),
        image.getpixel((width - 1, height - 1)),
    ]
    return tuple(sum(channel) // len(corners) for channel in zip(*corners))


def content_box(image: Image.Image, background: tuple[int, int, int], threshold: int = 12) -> tuple[int, int, int, int]:
    width, height = image.size
    pixels = image.load()
    left, top, right, bottom = width, height, 0, 0
    for y in range(height):
        for x in range(width):
            pixel = pixels[x, y]
            if max(abs(pixel[i] - background[i]) for i in range(3)) > threshold:
                left = min(left, x)
                right = max(right, x)
                top = min(top, y)
                bottom = max(bottom, y)
    if right <= left or bottom <= top:
        raise SystemExit("源图里没有识别到图形")
    return left, top, right, bottom


def square_canvas(image: Image.Image, background: tuple[int, int, int]) -> Image.Image:
    left, top, right, bottom = content_box(image, background)
    center_x = (left + right) / 2
    center_y = (top + bottom) / 2
    side = max(right - left + 1, bottom - top + 1) * (1 + PADDING * 2)
    half = side / 2
    canvas = Image.new("RGB", (round(side), round(side)), background)
    box = (
        round(center_x - half),
        round(center_y - half),
        round(center_x - half) + canvas.width,
        round(center_y - half) + canvas.height,
    )
    canvas.paste(image.crop(box), (0, 0))
    return canvas


def save_png(canvas: Image.Image, name: str, size: int) -> None:
    icon = canvas.resize((size, size), Image.LANCZOS)
    icon.quantize(colors=PALETTE_COLORS, method=Image.MEDIANCUT).save(
        PUBLIC / name, format="PNG", optimize=True
    )


def png_bytes(image: Image.Image) -> bytes:
    buffer = io.BytesIO()
    image.quantize(colors=PALETTE_COLORS, method=Image.MEDIANCUT).save(
        buffer, format="PNG", optimize=True
    )
    return buffer.getvalue()


def write_svg(canvas: Image.Image, title: str) -> None:
    embed = canvas.resize((SVG_EMBED_SIZE, SVG_EMBED_SIZE), Image.LANCZOS)
    embed = embed.filter(ImageFilter.MedianFilter(3))
    encoded = base64.b64encode(png_bytes(embed)).decode("ascii")
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" '
        'width="512" height="512" role="img" aria-label="' + title + '">\n'
        '  <image width="512" height="512" '
        'href="data:image/png;base64,' + encoded + '"/>\n'
        "</svg>\n"
    )
    (PUBLIC / "favicon.svg").write_text(svg, encoding="utf-8")


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit("用法：python scripts/make-icon.py <源图路径>")
    source = Image.open(sys.argv[1]).convert("RGB")
    background = detect_background(source)
    canvas = square_canvas(source, background)

    save_png(canvas, "favicon-96x96.png", 96)
    save_png(canvas, "apple-touch-icon.png", 180)
    save_png(canvas, "web-app-manifest-192x192.png", 192)
    save_png(canvas, "web-app-manifest-512x512.png", 512)

    canvas.resize((64, 64), Image.LANCZOS).save(
        PUBLIC / "favicon.ico", format="ICO", sizes=ICO_SIZES
    )
    write_svg(canvas, "琪光掠影")
    print("图标已生成：", canvas.size, "背景", "#%02x%02x%02x" % background)


if __name__ == "__main__":
    main()
