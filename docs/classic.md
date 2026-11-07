---
title: File Backups for TiddlyWiki Classic
---

[← Home](https://pmario.github.io/file-backups)

# File Backups for TiddlyWiki Classic

What File Backups adds to a **TiddlyWiki Classic** wiki. Requirements,
installation and the backup strategy are on the [Home](index.html)
page. Using TiddlyWiki 5? See
[File Backups for TiddlyWiki 5](tw5.html).

## Saving and backups

Open your wiki from a `file://` URL inside your Downloads folder and
save as usual. Each save writes the wiki to its current location and a
rotating backup into `twBackups/<wiki>.html/` next to it.

TiddlyWiki Classic's own backup option is **switched off** while the
AddOn is active; the AddOn's rotating backups replace it.

## Save milestone

A milestone is an extra snapshot that the rotation never overwrites.

- Click **save milestone** (shown below every *save changes* button,
  also in a customised `SideBarOptions`), use the **milestone** entry in
  the backstage menu, or press **Alt+M**.
- To hide the button, untick `chkFileBackupsMilestoneButton` in
  backstage → **tweak** (the `AdvancedOptions` tiddler). Like every
  Classic option this is stored in a browser cookie, so it applies to
  all your local Classic wikis. For one wiki only, add
  `|chkFileBackupsMilestoneButton|false|` to its `SystemSettings`
  tiddler. The backstage entry and Alt+M keep working.
- Enter an optional **Label** (up to 40 characters, used in the file
  name) and a one-line **Description**, then **Save milestone**.
  Enter saves, Escape closes the dialog.
- The snapshot is saved as `<wiki>(YYYY-MM-DD-hh-mm-ss)-<label>.html`
  next to the rotating backups.
- Every milestone is listed in the `Milestones` tiddler. It's hidden
  from the timeline but found by search. The dialog shows the last 5.

## Backup overview

The **backups** entry in the backstage menu opens the `FileBackups`
tiddler (also linked from the milestone dialog as
**Backups overview »**). It shows:

- all rotating backups and milestones with date, size, source and an
  estimated total size,
- each date links to the backup file,
- **Open backups folder**, which shows the folder in your file manager,
- **Open & sync this wiki's backup folder »** (see Folder sync),
- this wiki's reminder settings next to the global defaults.

The **Source** column says *downloads* for backups the AddOn saved, and
*Folder sync* for files it found in the folder.

## Reminders

Three optional reminders, all **off by default**:

- no milestone saved for this many days,
- the backup folder holds more than this many files,
- backups use more than this much disk space (MB).

Set the defaults for every wiki in the AddOn options:
about:addons → **File Backups** → **Preferences** → *Backup awareness*
(0 = off).

To change them for one wiki, edit the `FileBackupsConfig` tiddler:

```
|remindAfterDays|14|
|fileCountLimit|30|
|sizeLimitMB| |
```

Leave a value empty to use the default; 0 turns that reminder off for
this wiki. Changes apply from the next save.

When a limit is reached, a box appears at the top of the wiki after
saving, with **Save milestone** or **Show backups**, and **Snooze**.
Snooze tells you until when the reminder stays quiet. The AddOn only
informs — it never deletes your files.

## Folder sync

**Open & sync this wiki's backup folder »** (in the `FileBackups`
tiddler) opens the backup folder in a Firefox tab and compares it with
what the AddOn has recorded:

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

Reload any open wiki tabs. The sidebar button, the backstage entries
and the `FileBackups` tiddler come from the AddOn and disappear on
reload.

These tiddlers stay in your wiki, because they're yours:

- `Milestones` — your milestone list.
- `FileBackupsConfig` — per-wiki reminder settings, if you edited it.

Delete them manually if you don't need them.

[← Home](https://pmario.github.io/file-backups)
