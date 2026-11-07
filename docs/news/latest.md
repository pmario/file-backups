[← Home](https://pmario.github.io/file-backups)

# File Backups 0.9.x

A Firefox extension that saves your TiddlyWiki to disk and keeps a
rotating set of backups next to it. Works with both **TiddlyWiki 5**
and **TiddlyWiki Classic**. Single-user, file-based, no cloud. Open
your `*.html` wiki from `file://` and the extension takes care of the
rest.

## How it works

Each save writes the wiki to its current location, then drops a rotated
backup into a `twBackups/` folder beside it. The rotation is a slightly
modified Tower of Hanoi — by default 9 backup slots, so the most recent
saves stay close at hand and the oldest still go back hundreds of edits.

## What's in 0.9.x

How to use each feature is described in the guides:
[TiddlyWiki 5](https://pmario.github.io/file-backups/tw5.html) · [TiddlyWiki Classic](https://pmario.github.io/file-backups/classic.html).

### Save milestone

An extra, labelled snapshot next to the rotating backups, which the
rotation never overwrites. Every milestone is also listed inside the
wiki. ([TiddlyWiki 5](https://pmario.github.io/file-backups/tw5.html#save-milestone) ·
[TiddlyWiki Classic](https://pmario.github.io/file-backups/classic.html#save-milestone))

### Backup overview

Lists this wiki's rotating backups and milestones with date, size and
an estimated total, each linked to its file, plus a button to open the
backup folder. ([TiddlyWiki 5](https://pmario.github.io/file-backups/tw5.html#backup-overview) ·
[TiddlyWiki Classic](https://pmario.github.io/file-backups/classic.html#backup-overview))

### Reminders

Three optional reminders, **off by default**: no milestone for too
long, too many backup files, too much disk space. Global defaults in
the AddOn options, per-wiki overrides in the wiki. The AddOn only
informs — it never deletes your files.
([TiddlyWiki 5](https://pmario.github.io/file-backups/tw5.html#reminders) ·
[TiddlyWiki Classic](https://pmario.github.io/file-backups/classic.html#reminders))

### Folder sync

Compares the backup folder with the AddOn's records: marks deleted
files as missing and adds backups it didn't know yet, for example after
reinstalling the AddOn. ([TiddlyWiki 5](https://pmario.github.io/file-backups/tw5.html#folder-sync) ·
[TiddlyWiki Classic](https://pmario.github.io/file-backups/classic.html#folder-sync))

### Opening a backup

When you open a backup or milestone file, the wiki shows which backup
it is, with a link back to the main wiki.
([TiddlyWiki 5](https://pmario.github.io/file-backups/tw5.html#opening-a-backup) ·
[TiddlyWiki Classic](https://pmario.github.io/file-backups/classic.html#opening-a-backup))

### Save As and optional toolbar buttons

TiddlyWiki 5 only: save a copy anywhere in your Downloads folder, and
choose which toolbar buttons are shown.
([TiddlyWiki 5](https://pmario.github.io/file-backups/tw5.html#save-as))

### Local file access warning

Since Firefox 153, extensions need permission to access local files.
If it's off, the toolbar icon shows **!** and the popup explains how to
turn it on. ([Home](https://pmario.github.io/file-backups/index.html#allow-access-to-local-files-firefox-153))

### Backup-directory validation

If you change the backup folder name in the popup or preferences, the
field is checked live and shows an inline error if you enter something
the browser would refuse to write to.

## Installation

Install from the Firefox Add-ons listing:
[addons.mozilla.org/en-US/firefox/addon/file-backups](https://addons.mozilla.org/en-US/firefox/addon/file-backups/).

If you want the latest beta builds, grab the signed `.xpi` from the
[FileBackups GitHub Repository](https://github.com/pmario/file-backups/releases)
and drop it into Firefox's about:addons.

## Update notifications

The toolbar icon shows a small `↻` badge when a new release is
available. Click the icon and the popup explains which version, with
[View] linking to the release notes and [Got it] to dismiss.

By default, only stable releases trigger a notification (via Firefox's
built-in extension auto-update). Tick **Check for Beta Updates** in the
extension's preferences to also be notified when a beta is published —
the extension then checks for new betas once every 12 hours, plus each
time you open the popup.

The extension makes no telemetry calls and shares no data with third
parties. Your wiki content never leaves your machine — the optional
beta update check is the only network request, and only fires when
you've opted in.

## Feedback and bugs

[FileBackups GitHub Repository](https://github.com/pmario/file-backups/issues)

[← Home](https://pmario.github.io/file-backups)