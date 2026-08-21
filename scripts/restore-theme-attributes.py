"""Re-attach the theme's animation attributes to the Astro components.

The migration stripped `data-lg-*` and `data-plr-component` from the markup and
pinned `is-in` on elements that would otherwise have stayed at `opacity: 0`. The
class names survived untouched, so the attributes can be matched back on.

A plain class lookup is not enough:

* The same class carries different attributes depending on where it sits
  (`.sb__title` reveals inside `s-usps` but not inside `s-instructors`), so every
  element is keyed by `(innermost enclosing component class, class signature)`
  and only falls back to the bare signature when that misses.
* `data-lg-lottie` holds a per-element animation URL. It is never taken from the
  table; the components already carry the right path, so the attribute is
  renamed in place and its sibling flags are looked up by animation filename.

The script strips every animation attribute before re-applying, so it is safe to
run repeatedly.

    python scripts/restore-theme-attributes.py [--dry-run]

Verify the result with `npm run build && python scripts/verify-theme-attributes.py`.
"""

from __future__ import annotations

import argparse
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ARCHIVE = ROOT / "archive" / "webcopy"
COMPONENTS = ROOT / "src" / "components"

ANIM_ATTR = re.compile(r"\b(data-lg-[a-z-]+|data-plr-component)\b")
TAG = re.compile(r"<(/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*?)(/?)>")
CLASS_ATTR = re.compile(r'\bclass="([^"]*)"')
ATTR_PAIR = re.compile(r'([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:="([^"]*)")?')
DATA_ANIMATION = re.compile(r'\bdata-(?:animation|lg-lottie)="([^"]*)"')
STRIP_ATTR = re.compile(
    r'\s+(?:data-plr-component|data-lg-(?!lottie\b)[a-z-]+)(?:="[^"]*")?'
)
VOID = {"img", "br", "hr", "input", "meta", "link", "source", "path", "use", "circle"}

LOTTIE_ATTRS = {
    "data-lg-lottie",
    "data-lg-lottie-autoplay",
    "data-lg-lottie-loop",
    "data-lg-lottie-loop-frame",
    "data-lg-lottie-required",
}
NOISE_CLASSES = {"is-in"}
# Classes that identify a theme component/section root, used as match context.
CONTEXT = re.compile(r"^(s-[a-z0-9-]+|b-[a-z0-9-]+|site-[a-z0-9-]+|sb-[a-z0-9-]+)$")

PAGE_SOURCES = {
    "home": "index.htm",
    "data-bootcamp": "data-bootcamp/index.htm",
    "genai-bootcamp": "genai-bootcamp/index.htm",
    "professional-training": "professional-training/index.htm",
    "summer-bootcamps": "summer-bootcamps/index.htm",
    "cookie-policy": "cookie-policy/index.htm",
    "privacy-policy": "privacy-policy/index.htm",
}


def normalise(class_value: str) -> str:
    return " ".join(sorted(c for c in class_value.split() if c not in NOISE_CLASSES))


def context_of(class_value: str) -> str | None:
    for token in class_value.split():
        if CONTEXT.match(token):
            return token
    return None


def walk(markup: str):
    """Yield (match, context) for each open tag, tracking the component nesting."""
    stack: list[tuple[str, str | None]] = []
    for match in TAG.finditer(markup):
        closing, name, attrs_text, self_closed = match.groups()
        if closing:
            for index in range(len(stack) - 1, -1, -1):
                if stack[index][0] == name:
                    del stack[index:]
                    break
            continue
        context = next((c for _, c in reversed(stack) if c), None)
        yield match, attrs_text, context
        if not self_closed and name.lower() not in VOID:
            class_match = CLASS_ATTR.search(attrs_text)
            own = context_of(class_match.group(1)) if class_match else None
            stack.append((name, own))


def build_tables(html: str):
    """(context, signature) -> attrs, plus a signature-only fallback.

    `contexts` records every component context seen on the page, including ones
    whose elements carry no attributes. A miss inside a known context therefore
    means "this element genuinely has none", and must not fall through to the
    signature-only table - that is what used to hand `sb-slide` titles the
    reveal belonging to `sb-usp`.
    """
    keyed: dict[tuple[str | None, str], list[dict]] = defaultdict(list)
    plain: dict[str, list[dict]] = defaultdict(list)
    contexts: set[str | None] = set()
    for match, attrs_text, context in walk(html):
        contexts.add(context)
        if not ANIM_ATTR.search(attrs_text):
            continue
        class_match = CLASS_ATTR.search(attrs_text)
        if not class_match:
            continue
        signature = normalise(class_match.group(1))
        if not signature:
            continue
        wanted = {
            name: value or ""
            for name, value in ATTR_PAIR.findall(attrs_text)
            if ANIM_ATTR.fullmatch(name) and name not in LOTTIE_ATTRS
        }
        if not wanted:
            continue
        keyed[(context, signature)].append(wanted)
        plain[signature].append(wanted)

    def resolve(groups):
        out, clashes = {}, 0
        for key, variants in groups.items():
            if len({tuple(sorted(v.items())) for v in variants}) > 1:
                clashes += 1
                out[key] = max(variants, key=len)
            else:
                out[key] = variants[0]
        return out, clashes

    keyed_table, keyed_clashes = resolve(keyed)
    plain_table, _ = resolve(plain)
    return (keyed_table, plain_table, contexts), keyed_clashes


def build_lottie_flags(pages: dict[str, str]) -> dict[str, dict[str, str]]:
    flags: dict[str, dict[str, str]] = {}
    for html in pages.values():
        for _, attrs_text, _ in walk(html):
            attrs = {n: v or "" for n, v in ATTR_PAIR.findall(attrs_text)}
            source = attrs.get("data-lg-lottie")
            if not source:
                continue
            name = source.rsplit("/", 1)[-1]
            flags.setdefault(
                name,
                {
                    k: v
                    for k, v in attrs.items()
                    if k in LOTTIE_ATTRS and k != "data-lg-lottie"
                },
            )
    return flags


def render(attrs: dict[str, str]) -> str:
    return " ".join(
        name if value == "" else f'{name}="{value}"'
        for name, value in sorted(attrs.items())
    )


def tables_for(relative: Path, tables, merged):
    for part in relative.parts:
        if part in PAGE_SOURCES:
            return tables[part]
    return merged


def patch(text: str, tables, lottie_flags) -> tuple[str, int, int, int]:
    keyed_table, plain_table, known_contexts = tables
    added = cleaned = lottie = 0
    out: list[str] = []
    cursor = 0
    for match, attrs_text, context in walk(text):
        class_match = CLASS_ATTR.search(attrs_text)
        animation = DATA_ANIMATION.search(attrs_text)
        if not class_match and not animation:
            continue

        new_attrs = attrs_text
        extra: dict[str, str] = {}
        touched = False

        if class_match:
            raw = class_match.group(1)
            stripped = " ".join(c for c in raw.split() if c not in NOISE_CLASSES)
            if stripped != raw:
                new_attrs = (
                    new_attrs[: class_match.start(1)]
                    + stripped
                    + new_attrs[class_match.end(1) :]
                )
                cleaned += 1
                touched = True
            signature = normalise(raw)
            wanted = keyed_table.get((context, signature))
            if wanted is None and (context is None or context not in known_contexts):
                # A component's root element has no enclosing context inside its
                # own file, while in the archived page it sits under the layout.
                # Those, and contexts this page never had, fall back by signature.
                wanted = plain_table.get(signature)
            if wanted:
                extra.update(wanted)

        if animation:
            if "data-animation=" in new_attrs:
                new_attrs = new_attrs.replace("data-animation=", "data-lg-lottie=", 1)
                touched = True
            lottie += 1
            extra.update(lottie_flags.get(animation.group(1).rsplit("/", 1)[-1], {}))

        present = {n for n, _ in ATTR_PAIR.findall(new_attrs)}
        extra = {k: v for k, v in extra.items() if k not in present}
        if extra:
            suffix = new_attrs.rstrip()
            self_closing = suffix.endswith("/")
            if self_closing:
                suffix = suffix[:-1].rstrip()
            new_attrs = f"{suffix} {render(extra)}" + (" /" if self_closing else "")
            added += len(extra)
            touched = True

        if not touched:
            continue
        out.append(text[cursor : match.start(3)])
        out.append(new_attrs)
        cursor = match.end(3)
    out.append(text[cursor:])
    return "".join(out), added, cleaned, lottie


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    pages = {
        key: (ARCHIVE / rel).read_text(encoding="utf-8", errors="replace")
        for key, rel in PAGE_SOURCES.items()
    }
    tables = {}
    for key, html in pages.items():
        bundle, clashes = build_tables(html)
        tables[key] = bundle
        if clashes:
            print(f"note: {key}: {clashes} context+class keys still ambiguous")
    merged, merged_clashes = build_tables("\n".join(pages.values()))
    if merged_clashes:
        print(f"note: shared: {merged_clashes} ambiguous keys")
    lottie_flags = build_lottie_flags(pages)
    print(f"\n{len(merged[0])} context keys, {len(lottie_flags)} lottie animations\n")

    added = cleaned = lottie = touched = 0
    for path in sorted(COMPONENTS.rglob("*.astro")):
        original = path.read_text(encoding="utf-8")
        # Strip first so re-runs converge on the same result.
        base = STRIP_ATTR.sub("", original)
        patched, a, c, l = patch(
            base, tables_for(path.relative_to(COMPONENTS), tables, merged), lottie_flags
        )
        if patched == original:
            continue
        touched += 1
        added, cleaned, lottie = added + a, cleaned + c, lottie + l
        if not args.dry_run:
            path.write_text(patched, encoding="utf-8")

    verb = "would change" if args.dry_run else "changed"
    print(f"{verb} {touched} files: +{added} attributes, -{cleaned} is-in, {lottie} lottie")
    return 0


if __name__ == "__main__":
    sys.exit(main())
