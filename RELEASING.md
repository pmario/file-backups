# Releasing

How to cut a beta or stable release of file-backups. Two release channels,
two branches, two GitHub Actions workflows.

## Version convention

Firefox's manifest.json [requires the version](https://mzl.la/3h3mCRu) to be
1 to 4 dot-separated numbers — letters are not allowed. We use the
4th-segment slot as the beta counter:

| Shape       | Meaning              | Example         |
| ----------- | -------------------- | --------------- |
| 3 segments  | stable release       | `0.9.0`         |
| 4 segments  | beta build           | `0.9.0.1`, `0.9.0.5` |

Comparison rule: missing segments = 0, so `0.9.0` === `0.9.0.0` < `0.9.0.1`.
A beta is HIGHER than the matching stable. The next stable patch after a
beta cycle bumps the third segment — `0.9.0.5` → `0.9.1` (or `0.10.0`),
never back to `0.9.0` (lower than the betas, AMO would reject).

The single `version` field in `package.json` is the source of truth. The
`stage` npm script propagates it to:

- `addon/manifest.json` (the version users install).
- `version.json` at repo root, plus the derived `beta` flag (true when 4
  segments). `version.json` is what gets published to
  `https://pmario.github.io/file-backups/version.json` for the active
  update-check (file-backups-fs1).

## Channels

| Channel | Branch  | AMO       | GitHub Release | Pages deploy |
| ------- | ------- | --------- | -------------- | ------------ |
| Beta    | unlisted| unlisted  | pre-release w/ .xpi attached | no |
| Stable  | release | listed    | release (no asset; AMO link) | yes (deploys `docs/`) |

Both workflows live in [.github/workflows/](.github/workflows/) and trigger on
push to their respective branches.

## Per-release checklist

For every release, beta or stable:

1. **Pick the next version in `package.json`.**
   - **New beta cycle:** set `version` to a 4-segment value with `1` in the
     last slot, e.g. `0.10.0.1`. Each subsequent `npm run stage` (which
     runs as a pre-script for lint, build and run) auto-increments the 4th
     segment, so by the time you push you'll typically be at `0.10.0.N`
     with N reflecting how many dev iterations you ran.
   - **Stable release:** strip the 4th segment, e.g. `0.10.0.5` → `0.10.1`
     (next patch) or `0.10.0.5` → `0.11.0` (next minor). Don't reuse the
     same x.y.z as a stable that was already a beta — AMO ordering would
     break.

2. **Stage propagates everything.** `npm run stage` (or any of the
   pre-script triggers — `npm run lint`, `npm run build`, `npm run run`)
   does:
     - `bump-beta.js` — increments package.json's 4th segment if there is
       one. Skips for 3-segment stable versions.
     - `copy-version.js` — syncs the resulting version into
       `addon/manifest.json` and into `version.json`. The `beta` flag in
       `version.json` is set to `true` when there are 4 segments, `false`
       for 3.
     - `index-tiddlers.js` — regenerates `addon/tiddlers/index.json`. When
       `version.json.beta` is `true` the dev test affordance under
       `addon/tiddlers/plugin/test/` is included in the bundle; when
       `false` it's stripped, so stable users never see the CP test
       buttons.

3. **Update `version.json`'s `released_at` and `url` by hand.** These are
   not auto-managed:
     - `released_at` — the date you actually push to the channel branch.
     - `url` — the per-minor What's New page,
       `https://pmario.github.io/file-backups/news/<major>-<minor>.html`.
       The popup chip's [View] button opens this; same URL goes into the
       GitHub Release.

4. **Author release notes.**
   - Stable: write [docs/news/latest.md](docs/news/latest.md). The release
     workflow reads this verbatim into the GitHub Release body.
   - Beta: skip — the workflow auto-generates notes from the commit log.

5. **Author / update the What's New page.** When a new minor version is cut
   (e.g. 0.9.x → 0.10.x), create or update the page that `version.json.url`
   points at: `docs/news/<major>-<minor>.html`. Patch releases within
   the same minor land on the existing page.

6. **Test locally:**
   ```sh
   npm test
   npm run lint
   npm run build
   ```
   All three must pass before pushing.

7. **Push to the channel branch.**
   ```sh
   # Beta:
   git push origin master:unlisted

   # Stable (after the beta has soaked):
   git push origin master:release
   ```
   Each branch push triggers its workflow.

## What the workflows do

### `unlisted` → [sign-unlisted.yml](.github/workflows/sign-unlisted.yml)

- Runs `npm ci`, `npm test`, `npm run lint`.
- Submits to AMO via `web-ext sign --channel unlisted`. AMO auto-signs (no
  human review) and the `.xpi` is NOT listed on the public AMO page.
- Creates a GitHub **pre-release** tagged `v<version>`, with auto-generated
  release notes and the signed `.xpi` attached.

### `release` → [sign-release.yml](.github/workflows/sign-release.yml)

- Runs `npm ci`, `npm test`, `npm run lint`.
- Submits to AMO via `web-ext sign --channel listed --approval-timeout 0`.
  Goes through AMO human review (hours to days); the workflow returns as
  soon as the upload succeeds rather than waiting.
- Creates a GitHub **release** tagged `v<version>` with body taken from
  `docs/news/latest.md`. No `.xpi` asset — users install from AMO.
- Deploys the contents of `docs/` to GitHub Pages. This is what publishes
  the updated `version.json` and any new What's New page.

## Local signing (optional, for testing)

The CI workflows are the canonical sign path — push a branch, GitHub
Actions runs `web-ext sign`, the result is attached to a GitHub Release.
But it's sometimes useful to sign locally for ad-hoc testing.

[build-tools/sign.ps1](build-tools/sign.ps1) is the one-command local sign:

1. Runs `npm run stage` (bump-beta + copy-version + index-tiddlers) so the
   manifest version and tiddler index are fresh.
2. Reads the AMO API credentials from Windows SecretStore (so they never
   appear in argv or shell history).
3. Runs `web-ext sign --source-dir addon --channel <channel>`.
4. Reports the path of the produced `.xpi`.

```powershell
# One-time SecretStore setup (see the script's .NOTES section for full steps).

# Per-build:
.\build-tools\sign.ps1 -Channel unlisted   # beta — auto-signed, no review
.\build-tools\sign.ps1 -Channel listed     # stable — goes to AMO review
```

**Important caveats:**

- AMO **rejects duplicate versions** across all uploads. A successful
  local sign consumes the version slot for that channel — CI then has
  to use a different version, or it'll fail with `409 Conflict`.
- The local sign mutates `addon/manifest.json`'s version via
  `npm run stage` (bump-beta increments locally). Commit or revert that
  change deliberately; don't surprise yourself with an uncommitted bump.
- AMO listed channel signing on a local terminal returns once the
  upload succeeds. The reviewed `.xpi` becomes available later via your
  AMO developer dashboard.

## Required GitHub configuration

One-time setup:

- Repository **Settings** → **Secrets and variables** → **Actions** → add:
  - `AMO_JWT_ISSUER` — AMO API key issuer
  - `AMO_JWT_SECRET` — AMO API key secret
  Generate at https://addons.mozilla.org/en-US/developers/addon/api/key/.
- Repository **Settings** → **Pages** → **Build and deployment source**:
  set to **GitHub Actions** (not branch).

This setup is tracked in [bd-8f6](.beads/) — until it's complete, neither
release workflow can succeed end-to-end.

## Common gotchas

- **AMO rejects duplicate versions across channels.** If the previous beta
  was `0.10.0.5`, the stable cannot be `0.10.0` (lower, would be a
  downgrade) and cannot be `0.10.0.5` (duplicate). Bump to `0.10.1` or
  similar.
- **Forgetting to update `version.json`'s `released_at` / `url`** means the
  Pages-hosted file shows stale metadata. The popup chip will still work
  (it relies on `version` and `beta`), but the [View] button might 404 if
  `url` points at a What's New page that doesn't exist yet.
- **`docs/news/latest.md` must exist before pushing to `release`** — the
  workflow reads it directly into the GitHub Release body and fails if
  missing.
- **`docs/news/<major>-<minor>.html` must exist when bumping a minor.**
  The popup chip's [View] button hits whatever URL `version.json.url`
  carries; a 404 there is the most user-visible breakage of forgetting
  this step.
- **`stage` keeps bumping during dev iteration.** Every `npm run lint` /
  `build` / `run` increments the 4th segment. That's intentional — the
  number visible to clients reflects the most recent build. If the count
  has run away during local hacking and you want a clean number for
  release, set the version explicitly in `package.json` before pushing.

## What clients see

- **Stable users with default settings** (`showBetaUpdates=false`): rely on
  Firefox's native AMO auto-update path. The extension's active fetch
  doesn't run for them. They see the popup chip + toolbar `↻` badge only
  when AMO fires `runtime.onUpdateAvailable`.
- **Beta users** (`showBetaUpdates=true`): the active fetch hits the
  Pages-hosted `version.json` on lifecycle events + popup-open, throttled
  to once per 12 hours. Picks up whatever the latest published version
  is — beta or stable — and surfaces it via the same chip + badge.
- **Either user, after dismissing a notification:** the dismissed version
  is recorded in `storage.local.dismissedUpdateVersion`; the SAME version
  doesn't re-prompt. The next bumped version does.
