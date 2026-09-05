"""Compare the length of every piece of copy against the original page.

The FSM UNDIP text replaced the Nod Coding text in place, so each block should
stay close to the length it had in the archived original. Text that grows or
shrinks too much reflows the design the layout was built around.

Elements are paired by walking both documents and aligning their class
signatures with difflib, so extra WordPress-only markup in the archive (cookie
banner, Contact Form 7) does not shift the comparison.

    npm run build && python scripts/check-copy-length.py [--all] [--limit N]

Exit code is 1 when any pair falls outside the tolerance below.
"""

from __future__ import annotations

import argparse
import difflib
import html
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ARCHIVE = ROOT / "archive" / "webcopy"
DIST = ROOT / "dist"

PAGES = {
    "/": ("index.htm", "index.html"),
    "/alur-penilaian/": ("data-bootcamp/index.htm", "alur-penilaian/index.html"),
    "/panduan-penilai/": ("genai-bootcamp/index.htm", "panduan-penilai/index.html"),
    "/panduan-pimpinan/": (
        "professional-training/index.htm",
        "panduan-pimpinan/index.html",
    ),
    "/panduan-admin/": ("summer-bootcamps/index.htm", "panduan-admin/index.html"),
    "/kebijakan-privasi/": (
        "privacy-policy/index.htm",
        "kebijakan-privasi/index.html",
    ),
    "/kebijakan-data/": ("cookie-policy/index.htm", "kebijakan-data/index.html"),
}

# Blocks shorter than this are labels; a few characters either way is harmless.
MIN_LENGTH = 25
# Ratio of new length to original length that still preserves the layout.
LOW, HIGH = 0.70, 1.35
# Below this absolute difference the ratio does not matter.
SLACK = 25

SKIP_TAGS = re.compile(r"<(script|style|noscript|svg)\b[\s\S]*?</\1>", re.I)
COMMENT = re.compile(r"<!--[\s\S]*?-->")
TAG = re.compile(r"<([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>")
CLASS_ATTR = re.compile(r'\bclass="([^"]*)"')
NOISE = re.compile(r"^(is-in|is-loaded|astro-\w+|wpcf7\S*|icr-cc\S*)$")


def clean(markup: str) -> str:
    markup = SKIP_TAGS.sub(" ", markup)
    return COMMENT.sub(" ", markup)


def signature(class_value: str) -> str:
    return " ".join(sorted(c for c in class_value.split() if not NOISE.match(c)))


def blocks(markup: str) -> list[tuple[str, str]]:
    """(class signature, text) for each element holding its own text."""
    markup = clean(markup)
    out: list[tuple[str, str]] = []
    for match in TAG.finditer(markup):
        class_match = CLASS_ATTR.search(match.group(2))
        if not class_match:
            continue
        tail = markup[match.end() :]
        stop = tail.find("<")
        if stop <= 0:
            continue
        text = html.unescape(tail[:stop])
        text = " ".join(text.split())
        if len(text) < MIN_LENGTH:
            continue
        out.append((signature(class_match.group(1)), text))
    return out


def compare(route: str, archived: Path, built: Path, limit: int, show_all: bool):
    want = blocks(archived.read_text(encoding="utf-8", errors="replace"))
    got = blocks(built.read_text(encoding="utf-8", errors="replace"))

    matcher = difflib.SequenceMatcher(
        None, [c for c, _ in want], [c for c, _ in got], autojunk=False
    )
    rows = []
    for a, b, size in matcher.get_matching_blocks():
        for offset in range(size):
            old = want[a + offset][1]
            new = got[b + offset][1]
            if old == new:
                continue  # untranslated or identical, not a length question
            diff = len(new) - len(old)
            ratio = len(new) / len(old) if old else 0
            ok = abs(diff) <= SLACK or LOW <= ratio <= HIGH
            rows.append((ok, ratio, diff, len(old), len(new), old, new))

    bad = [r for r in rows if not r[0]]
    print(f"\n{route}  dibandingkan={len(rows)}  di luar toleransi={len(bad)}")
    for ok, ratio, diff, lo, ln, old, new in sorted(
        (bad if not show_all else rows), key=lambda r: -abs(r[2])
    )[:limit]:
        arrow = "terlalu panjang" if diff > 0 else "terlalu pendek"
        print(f"  {arrow}  {lo} -> {ln} ({diff:+d}, {ratio:.2f}x)")
        print(f"     asli : {old[:110]}")
        print(f"     baru : {new[:110]}")
    return len(bad)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--all", action="store_true", help="show every pair")
    parser.add_argument("--limit", type=int, default=8)
    args = parser.parse_args()

    if not DIST.exists():
        print("dist/ not found - run `npm run build` first")
        return 1

    total = 0
    for route, (archived, built) in PAGES.items():
        total += compare(
            route, ARCHIVE / archived, DIST / built, args.limit, args.all
        )
    print(f"\ntotal di luar toleransi: {total}")
    return 0 if total == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
