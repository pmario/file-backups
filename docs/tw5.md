---
title: File Backups for TiddlyWiki 5
---

[← Home](https://pmario.github.io/file-backups)

# File Backups for TiddlyWiki 5

What File Backups adds to a **TiddlyWiki 5** wiki. Requirements,
installation and the backup strategy are on the [Home](index.html)
page. Using TiddlyWiki Classic? See
[File Backups for TiddlyWiki Classic](classic.html).

## Saving and backups

Open your wiki from a `file://` URL inside your Downloads folder and
save as usual. Each save writes the wiki to its current location and a
rotating backup into `twBackups/<wiki>.html/` next to it.

## Save milestone

A milestone is an extra snapshot that the rotation never overwrites.

- Click the **★** toolbar button, press **Alt+M**, or use the form in
  Control Panel → **Settings** → **FileBackups**.
- Enter an optional **Label** (up to 40 characters, used in the file
  name) and a one-line **Description**, then **Save milestone**.
- The snapshot is saved as `<wiki>(YYYY-MM-DD-hh-mm-ss)-<label>.html`
  next to the rotating backups.
- Every milestone is listed in the `$:/milestones` tiddler.

## Save As

**Alt+S** opens the browser's "Save As" dialog, so you can save a copy
of the wiki anywhere inside your Downloads folder.

## Toolbar buttons and shortcuts

Only **Save milestone** is shown in the toolbar by default. **Save As**
is opt-in: tick its checkbox in Control Panel → **Settings** →
**FileBackups**. The keyboard shortcuts work either way and can be
changed in Control Panel → **Keyboard Shortcuts**.

## Backup overview

Control Panel → **Settings** → **FileBackups** shows this wiki's
latest rotating backups and milestones:

- date, size, source and an estimated total size,
- each date links to the backup file,
- **Show all »** opens the full list,
- **Open backups folder** shows the folder in your file manager.

The **Source** column says *downloads* for backups the AddOn saved, and
*Folder sync* for files it found in the folder (see below).

## Reminders

Three optional reminders, all **off by default**:

- no milestone saved for this many days,
- the backup folder holds more than this many files,
- backups use more than this much disk space (MB).

Set the defaults for every wiki in the AddOn options:
about:addons → **File Backups** → **Preferences** → *Backup awareness*
(0 = off).

To change them for one wiki, use the *Backup awareness (this wiki)*
fields in Control Panel → **Settings** → **FileBackups**. Leave a field
empty to use the default; 0 turns that reminder off for this wiki. The
values are stored in `$:/config/file-backups/remindAfterDays`,
`$:/config/file-backups/fileCountLimit` and
`$:/config/file-backups/sizeLimitMB`.

When a limit is reached, a box appears at the top of the wiki after
saving, with **Save milestone** or **Show backups**, and **Snooze**.
Snooze tells you until when the reminder stays quiet. The AddOn only
informs — it never deletes your files.

## Folder sync

**Open & sync this wiki's backup folder »** (Control Panel →
**Settings** → **FileBackups**) opens the backup folder in a Firefox
tab and compares it with what the AddOn has recorded:

- files that are gone are marked *missing*,
- backups the AddOn doesn't know yet (for example after reinstalling
  it) are added to the overview.

If the wiki has no save record yet, the folder page says so: save the
wiki once, then open the folder again. Folder sync needs the
"Access local files on your computer" permission (see
[Home](index.html)).

## Opening a backup

When you open a backup or milestone file, the wiki shows which backup
it is, with a link back to the main wiki.

## After uninstalling

Reload any open wiki tabs. The AddOn's helper tiddlers under
`$:/temp/plugins/file-backups/*` (toolbar buttons, readme, license)
live in memory only and disappear on reload.

These tiddlers stay in your wiki, because they're yours:

- `$:/milestones` — your milestone list.
- `$:/config/file-backups/*` — per-wiki reminder settings, if you set
  any.
- Settings you changed, for example `$:/config/shortcuts/save-wiki-as`,
  `$:/config/shortcuts/save-milestone` and
  `$:/config/PageControlButtons/Visibility/...`.

Delete them manually if you don't need them.

[← Home](https://pmario.github.io/file-backups)
