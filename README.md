# Survey FSM

Static frontend mirror prepared from `https://nodcoding.com/` for local customization and future development.

## Requirements

- Node.js 18 or newer.

No npm dependencies are required for the current static workflow.

## Local Development

```powershell
npm run build
npm start
```

Open:

```text
http://127.0.0.1:5501/
```

Use a different port when needed:

```powershell
$env:PORT=5600; npm start
```

## Build

```powershell
npm run build
```

The build script reads editable source files from `src/` and writes generated runtime files to `public/custom/`.

## Verify

Start the local server, then run:

```powershell
npm run verify
```

## Project Layout

- `public/` served static website.
- `src/styles/` editable CSS layers.
- `src/app/` editable browser JavaScript modules.
- `scripts/` local build, serve, normalize, and verification tools.
- `docs/` architecture and development notes.

Keep mirrored vendor files in `public/wp-content/` stable. Put custom frontend work in `src/`, then rebuild.
