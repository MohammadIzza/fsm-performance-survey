"""Compare the built pages against the archived originals, attribute by attribute.

For every element that carries `data-lg-*` or `data-plr-component`, both sides are
reduced to a `(class signature, attributes)` multiset and diffed. Anything the
build is missing, or carries beyond the original, is reported per page.

Run after `npm run build`:  python scripts/verify-theme-attributes.py
"""

from __future__ import annotations

import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ARCHIVE = ROOT / "archive" / "webcopy"
DIST = ROOT / "dist"

ANIM_ATTR = re.compile(r"\b(data-lg-[a-z-]+|data-plr-component)\b")
TAG = re.compile(r"<([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>")
CLASS_ATTR = re.compile(r'\bclass="([^"]*)"')
ATTR_PAIR = re.compile(r'([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:="([^"]*)")?')

# Runtime-applied classes and build-time noise that must not affect matching.
NOISE = re.compile(r"^(is-in|is-loaded|astro-\w+)$")

PAGES = {
    "/": ("index.htm", "index.html"),
    "/cookie-policy/": ("cookie-policy/index.htm", "cookie-policy/index.html"),
    "/data-bootcamp/": ("data-bootcamp/index.htm", "data-bootcamp/index.html"),
    "/genai-bootcamp/": ("genai-bootcamp/index.htm", "genai-bootcamp/index.html"),
    "/privacy-policy/": ("privacy-policy/index.htm", "privacy-policy/index.html"),
    "/professional-training/": (
        "professional-training/index.htm",
        "professional-training/index.html",
    ),
    "/summer-bootcamps/": (
        "summer-bootcamps/index.htm",
        "summer-bootcamps/index.html",
    ),
}

# Present only in the WordPress output; this build has no cookie banner, no
# Contact Form 7 markup and serves lottie/media from /assets.
IGNORED_SIGNATURES = {"icr-cc", "wpcf7"}


def signature(class_value: str) -> str:
    return " ".join(sorted(c for c in class_value.split() if not NOISE.match(c)))


def extract(html: str, strip_origin: bool) -> Counter:
    found: Counter = Counter()
    for match in TAG.finditer(html):
        attrs_text = match.group(2)
        if not ANIM_ATTR.search(attrs_text):
            continue
        class_match = CLASS_ATTR.search(attrs_text)
        sig = signature(class_match.group(1)) if class_match else ""
        if any(token in sig for token in IGNORED_SIGNATURES):
            continue
        attrs = []
        for name, value in ATTR_PAIR.findall(attrs_text):
            if not ANIM_ATTR.fullmatch(name):
                continue
            if name == "data-lg-lottie":
                # Compare the animation by filename: the theme used absolute
                # nodcoding.com URLs, this build serves them from /assets.
                value = (value or "").rsplit("/", 1)[-1]
            attrs.append(f"{name}={value or ''}")
        found[(sig, " ".join(sorted(attrs)))] += 1
    return found


def main() -> int:
    if not DIST.exists():
        print("dist/ not found - run `npm run build` first")
        return 1

    total_missing = total_extra = 0
    for route, (archived, built) in PAGES.items():
        source = (ARCHIVE / archived).read_text(encoding="utf-8", errors="replace")
        output = (DIST / built).read_text(encoding="utf-8", errors="replace")
        want = extract(source, False)
        got = extract(output, True)

        missing = want - got
        extra = got - want
        total_missing += sum(missing.values())
        total_extra += sum(extra.values())

        status = "ok" if not missing and not extra else "diff"
        print(f"\n{route}  [{status}]  original={sum(want.values())} built={sum(got.values())}")
        for label, bag in (("missing", missing), ("extra", extra)):
            for (sig, attrs), count in sorted(bag.items())[:12]:
                print(f"    {label:7} x{count}  .{sig or '(no class)'}")
                print(f"             {attrs}")
            if len(bag) > 12:
                print(f"    ... {len(bag) - 12} more {label} entries")

    print(f"\ntotal missing={total_missing}  extra={total_extra}")
    return 0 if total_missing == 0 and total_extra == 0 else 2


if __name__ == "__main__":
    sys.exit(main())
