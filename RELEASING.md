# Releasing

Two channels, two branches, two workflows.

| Channel | Branch     | Output                          |
| ------- | ---------- | ------------------------------- |
| Beta    | `unlisted` | AMO unlisted `.xpi` + GH Pre-release |
| Stable  | `release`  | AMO listed (review) + GH Release     |

Pages publication is independent: GitHub Pages is configured as
"Deploy from a branch" → master / docs, so each master push
auto-rebuilds the site. No workflow steps involved.

## Version format

| Shape       | Use     | Example   |
| ----------- | ------- | --------- |
| 3 segments  | stable  | `0.9.0`   |
| 4 segments  | beta    | `0.9.0.5` |

`npm run stage` auto-bumps the LAST segment. Missing segments = 0, so a
4-seg beta is HIGHER than the matching 3-seg stable. The next stable
after a beta cycle bumps the 3rd segment (`0.9.0.5` → `0.9.1`), never
back to `0.9.0` (AMO would reject the downgrade).

`package.json` is the source of truth; `stage` syncs to
`addon/manifest.json` and `docs/version.json` (with `beta = (segments == 4)`).
`docs/version.json` ships inside the Pages artifact and is served at
`https://pmario.github.io/file-backups/version.json`.

## Beta release

```powershell
npm run create-unlisted          # real run
npm run create-unlisted:dry      # validate without pushing
```

The script does pre-flight checks, runs stage + lint, commits, and
pushes `master:unlisted`.

Manual edits BEFORE running:

- `docs/version.json`: `released_at` (today), `url`
  (`https://pmario.github.io/file-backups/news/<major>-<minor>.html`).
- `docs/news/<major>-<minor>.html` — create on a new minor cycle, update
  for patches. The popup chip's [View] button targets this URL.

## Stable release

1. `package.json`: strip the 4th segment (`0.9.0.5` → `0.9.1` or `0.10.0`).
2. `docs/version.json`: update `released_at` and `url`.
3. `docs/news/<major>-<minor>.html`: ensure it exists.
4. `docs/news/latest.md`: write release notes — the workflow reads this
   verbatim into the GitHub Release body.
5. `npm test && npm run lint && npm run build`.
6. `git push origin master:release`.

## Local signing (for testing)

```powershell
.\build-tools\sign.ps1 -Channel unlisted   # auto-signed, no review
.\build-tools\sign.ps1 -Channel listed     # goes to AMO review
```

Reads AMO credentials from Windows SecretStore. Each sign consumes a
version slot on AMO — bump locally before retry.

## GitHub one-time setup

- **Settings → Secrets → Actions:** add `AMO_JWT_ISSUER` and
  `AMO_JWT_SECRET` from
  [AMO API Keys](https://addons.mozilla.org/en-US/developers/addon/api/key/).
- **Settings → Pages → Source:** Deploy from a branch → `master` / `/docs`.

Tracked as bd-8f6 until done.

## Gotchas

- AMO rejects duplicate versions across all channels.
- `docs/news/latest.md` must exist before any `release` push.
- `npm run stage` bumps on every `lint`/`build`/`run` locally — if dev
  iterations inflated the count, set `package.json.version` explicitly
  before the publish.

## What clients see

- **Stable users** (default): rely on Firefox's native AMO auto-update.
- **Beta users** (`showBetaUpdates=true` in popup settings): active
  fetch of `version.json` on lifecycle + popup-open, 12h throttle.
- **Dismiss** records the version in `storage.local`; same version
  doesn't re-prompt.
