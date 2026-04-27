---
title: File Backups uninstalled
---

[← Home](https://pmario.github.io/file-backups)

# File Backups was uninstalled

Thanks for trying the extension!

## One small clean-up step

If you have any **TiddlyWiki tabs open right now**, please reload them
(`Ctrl+R` / `F5` / `Cmd+R`).

While the extension was installed it added a few helper tiddlers under
`$:/temp/plugins/file-backups/*` (the toolbar buttons, a readme and a
license tiddler). They live in memory only and are **never saved into
your wiki file**, so they disappear on reload.

## What stays in your wiki

Two kinds of tiddlers do remain after the extension is gone — they're
yours, not the extension's:

- **$:/milestones** — the dictionary of milestone snapshots you took.
  Each milestone you saved is a row in this tiddler. Delete it
  manually if you don't want the history.
- **Any settings you customised** — for example if you remapped
  **Alt+S** (Save As) or **Alt+M** (Save Milestone) to different keys
  in TiddlyWiki's Control Panel. These were shadow defaults shipped
  by the extension; the moment you changed one, TiddlyWiki promoted
  it to a real tiddler and saved it. Look under
  
  - `$:/config/shortcuts/save-wiki-as`,
  - `$:/config/shortcuts/save-milestone`,
  - `$:/config/PageControlButtons/Visibility/...` if you want to clean
  them up.

## If you accidentally removed it

Reinstall from the
[Firefox Add-ons listing](https://addons.mozilla.org/en-US/firefox/addon/file-backups/),
or, for the latest beta, follow the
[beta install instructions](beta-install.html).

What survives the uninstall and what doesn't:

- **Saved into your wiki — preserved:** the `$:/milestones` tiddler
  (your milestone snapshots) and any shortcut/visibility settings
  you customised.
- **Stored by the extension — reset:** the backup directory name,
  number of backups, beta-channel opt-in. Firefox wipes the
  extension's storage on uninstall, so these go back to defaults
  after reinstall and you'll need to set them again.


## If you reinstall later

Already-open TiddlyWiki tabs reactivate automatically once the
extension is re-enabled — the toolbar buttons reappear and saving
works again, no reload needed.

## Feedback or bugs

[github.com/pmario/file-backups/issues](https://github.com/pmario/file-backups/issues)
