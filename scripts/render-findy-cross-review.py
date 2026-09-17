#!/usr/bin/env python3
"""Render the frozen evaluation inputs as reviewable PNG architecture sheets.

Findy's architecture analysis form accepts only a PNG/JPG diagram and a cloud
choice.  These sheets therefore keep each component's frozen description next
to the topology so the independent reviewer sees the same design claims as the
Gemini evaluator.  Formal scenario requirements remain a separate comparison
artifact; they are not smuggled into the candidate design image.
"""

from __future__ import annotations

import json
import textwrap
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs/evaluation-runs/2026-09-16/expert-inputs.json"
OUTPUT = ROOT / "docs/evaluation-runs/2026-09-16/findy-cross-review/inputs"
FONT_PATHS = (
    Path("/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc"),
    Path("/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc"),
    Path("/System/Library/Fonts/Helvetica.ttc"),
)


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = list(FONT_PATHS)
    if bold:
        candidates[0], candidates[1] = candidates[1], candidates[0]
    for path in candidates:
        if path.exists():
            return ImageFont.truetype(str(path), size=size)
    return ImageFont.load_default(size=size)


def wrapped(draw: ImageDraw.ImageDraw, value: str, max_width: int, face: ImageFont.ImageFont) -> list[str]:
    if not value:
        return ["（説明なし）"]
    lines: list[str] = []
    current = ""
    for char in value:
        candidate = current + char
        if current and draw.textlength(candidate, font=face) > max_width:
            lines.append(current)
            current = char
        else:
            current = candidate
    if current:
        lines.append(current)
    return lines


def arrow(draw: ImageDraw.ImageDraw, start: tuple[int, int], end: tuple[int, int]) -> None:
    color = "#64748b"
    draw.line((*start, *end), fill=color, width=5)
    ex, ey = end
    draw.polygon([(ex, ey), (ex - 12, ey - 20), (ex + 12, ey - 20)], fill=color)


def render(review: dict) -> None:
    review_id = review["reviewId"]
    candidate = review["input"]
    nodes = candidate["nodes"]
    edges = candidate["edges"]
    width, height = 1600, 1200
    image = Image.new("RGB", (width, height), "#f8fafc")
    draw = ImageDraw.Draw(image)
    title_face = font(42, bold=True)
    meta_face = font(23)
    label_face = font(25, bold=True)
    type_face = font(18)
    body_face = font(19)

    draw.text((64, 48), candidate["scenario"]["title"], fill="#0f172a", font=title_face)
    draw.text((64, 106), f"匿名レビューID: {review_id}  |  テーマ: {review['theme']}", fill="#475569", font=meta_face)
    draw.line((64, 148, width - 64, 148), fill="#cbd5e1", width=2)

    diagram_left, diagram_right = 64, 640
    center_x = (diagram_left + diagram_right) // 2
    positions: dict[str, tuple[int, int, int, int]] = {}
    row_gap = 190 if len(nodes) <= 3 else 155
    start_y = 210
    branch_ids = {edge["target"] for edge in edges if edge["source"] == "app"}
    for index, node in enumerate(nodes):
        x = center_x - 220
        y = start_y + index * row_gap
        box_width = 440
        if len(branch_ids) > 1 and node["id"] in branch_ids:
            branch_index = sorted(branch_ids).index(node["id"])
            box_width = 270
            x = diagram_left + branch_index * 300
            y = start_y + (len(nodes) - len(branch_ids)) * row_gap
        positions[node["id"]] = (x, y, x + box_width, y + 108)

    for edge in edges:
        source = positions[edge["source"]]
        target = positions[edge["target"]]
        arrow(draw, ((source[0] + source[2]) // 2, source[3]), ((target[0] + target[2]) // 2, target[1] - 8))

    palette = ["#dbeafe", "#ffedd5", "#dcfce7", "#ede9fe", "#fef3c7"]
    for index, node in enumerate(nodes):
        box = positions[node["id"]]
        draw.rounded_rectangle(box, radius=18, fill="white", outline="#94a3b8", width=3)
        draw.rounded_rectangle((box[0], box[1], box[0] + 16, box[3]), radius=8, fill=palette[index % len(palette)])
        draw.text((box[0] + 32, box[1] + 18), node["label"], fill="#0f172a", font=label_face)
        draw.text((box[0] + 32, box[1] + 61), node["type"], fill="#475569", font=type_face)

    panel_x = 710
    draw.text((panel_x, 180), "コンポーネントの設計説明", fill="#0f172a", font=font(29, bold=True))
    y = 232
    available = width - panel_x - 64
    for index, node in enumerate(nodes):
        lines = wrapped(draw, node.get("description", ""), available - 38, body_face)
        box_height = 61 + len(lines) * 30
        draw.rounded_rectangle((panel_x, y, width - 64, y + box_height), radius=14, fill="white", outline="#cbd5e1", width=2)
        draw.text((panel_x + 18, y + 14), f"{index + 1}. {node['label']} / {node['type']}", fill="#1d4ed8", font=font(20, bold=True))
        text_y = y + 48
        for line in lines:
            draw.text((panel_x + 18, text_y), line, fill="#334155", font=body_face)
            text_y += 30
        y += box_height + 14

    draw.text((64, height - 46), "Frozen synthetic evaluation input · architecture topology and candidate claims", fill="#64748b", font=font(17))
    OUTPUT.mkdir(parents=True, exist_ok=True)
    image.save(OUTPUT / f"{review_id}.png", optimize=True)


def main() -> None:
    payload = json.loads(SOURCE.read_text())
    for review in payload["inputs"]:
        render(review)
    print(f"rendered {len(payload['inputs'])} sheets to {OUTPUT}")


if __name__ == "__main__":
    main()
