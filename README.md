# PDF Renamer

Electron desktop app that scans a folder of PDFs, extracts fields from the text
(date, document type, series, doc number, supplier), and renames/copies them to
a consistent naming scheme. PDFs with no extractable text (scanned images) fall
into a manual-rename tab.

## Development

```bash
npm install
npm run dev          # launch in dev mode
npm run build:win    # build the Windows installer + portable exe
```

## Releasing an update

The app auto-updates itself via GitHub Releases (see `.github/workflows/release.yml`).
To ship a new version:

1. Bump `"version"` in `package.json` (e.g. `2.1.0` -> `2.2.0`).
2. Commit the change.
3. Tag and push:
   ```bash
   git tag v2.2.0
   git push origin v2.2.0
   ```
4. GitHub Actions builds the Windows installer/portable exe and publishes a
   GitHub Release automatically. The tag name must match `v<version>` from
   `package.json`.
5. Installed copies of the app check for updates automatically on startup
   (and via the "Check for Updates" button in the header), download the new
   installer in the background, and prompt to restart once it's ready.

Note: only the NSIS installer build supports auto-update. The portable exe has
to be re-downloaded manually.
