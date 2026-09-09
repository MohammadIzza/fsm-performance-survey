# Project Structure

This repository is a static mirror of `https://nodcoding.com/` prepared for local development.

## Folders

- `public/` contains the served website files. The local server uses this as the web root.
- `public/wp-content/` contains WordPress theme assets, uploads, plugin assets, JS chunks, CSS, fonts, and Lottie JSON files.
- `public/wp-includes/` contains WordPress runtime scripts required by the mirrored pages.
- `src/styles/` contains editable CSS layers, ordered by filename.
- `src/app/` contains editable browser JavaScript modules.
- `public/custom/` contains generated customization assets. Do not edit these files directly.
- `scripts/` contains local tooling with no external npm dependencies.
- `docs/` contains development notes and mirror metadata.

## Development Rule

Keep downloaded production assets stable. For custom work, prefer:

1. Add CSS in `src/styles/`, using the numeric prefix to control cascade order.
2. Add local JavaScript in `src/app/features/` and wire it from `src/app/main.js`.
3. Run `npm run build` to regenerate `public/custom/site.css` and `public/custom/site.js`.
4. Edit page HTML only when content or structure must change.
5. Avoid editing minified vendor bundles unless there is no practical alternative.
