---
title: Installing a beta build of File Backups
---

[← Home](https://pmario.github.io/file-backups)

# Installing a beta `.xpi`

Beta builds of File Backups are published on the
[FileBackups GitHub Repository](https://github.com/pmario/file-backups/releases)
as signed `.xpi` files attached to **Pre-release** entries. Firefox accepts
them like any AMO extension — no `about:config` flags needed.

## Steps

1. Open the
   [FileBackups GitHub Repository](https://github.com/pmario/file-backups/releases).
2. Find the latest entry tagged **Pre-release**.
3. In its **Assets** list, click the `.xpi` filename.
4. Firefox shows an install prompt: *"Add File Backups?"*
5. Click **Add**.

The toolbar icon (a blue diamond) appears once the install finishes.

## If Firefox downloads the file instead of installing it

Some Firefox configurations save `.xpi` files to disk instead of opening
the install prompt. In that case:

- Drag the downloaded `.xpi` onto any open Firefox window, **or**
- Open `about:addons` → click the gear icon → **Install Add-on From File…**
  → select the downloaded `.xpi`.

The install prompt appears either way.

## Replacing or going back to the AMO version

Beta and AMO builds share the same extension id, so installing a beta
**replaces** the AMO version in place. Settings, milestone history, and
backup state carry over.

To go back, reinstall from the
[Firefox Add-ons listing](https://addons.mozilla.org/en-US/firefox/addon/file-backups/) —
that overwrites the beta with the latest stable build.
