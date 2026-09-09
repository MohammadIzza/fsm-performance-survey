# Development

## Run Locally

```powershell
npm run build
npm start
```

The default URL is:

```text
http://127.0.0.1:5501/
```

Use another port when needed:

```powershell
$env:PORT=5600; npm start
```

## Verify

With the local server running:

```powershell
npm run verify
```

## Customize

Use these files first:

- `src/styles/00-tokens.css` for design tokens.
- `src/styles/10-base.css` for base page defaults.
- `src/styles/20-components.css` for reusable component rules.
- `src/styles/90-overrides.css` for mirror-specific fixes.
- `src/app/features/` for small browser behaviors.

The source pages are mirrored static HTML, so large feature work should be planned as either:

- a careful static-site refactor, or
- a rebuild into a modern framework using this mirror as the visual/content reference.
