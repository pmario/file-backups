---
title: Advanced setup — wikis outside the Downloads folder
---

[← Home](https://pmario.github.io/file-backups)

# Advanced setup

The browser sandbox limits File Backups to writing inside your
**Downloads** folder. If you'd rather keep your wikis on a different
drive, in your Documents folder, or in a cloud-synced location, you
can use a directory **junction** (Windows) or **symlink** (macOS /
Linux) to make an outside folder appear inside Downloads. Saves and
backups are then written at the real location while the browser
believes it's working inside `Downloads/`.

## Windows: directory junction

It has to be a Windows junction. A **Windows shortcut (.lnk) won't work**.
Browsers won't open a wiki through one.

1. Make sure you create a new directory at your desired "outside" directory.
Eg: `C:\Users\<your-user>\Documents\MyWikis\`

2. Make sure there is no `MyWikis` directory in the browser Downloads folder.

3. Open **Command Prompt** (no admin required for junctions) and run:
    - Windows key or Start Menu
    - Type: `cmd`

    It should show something like this:

    ```
    Microsoft Windows [Version 10.0.xxxxx.yyyy]
    (c) Microsoft Corporation. All rights reserved.

    C:\Users\your-user>
    ```

4. Create a Junction

    Replace `your-user` with your real user name.
    The following command assumes, that you use the default browser settings.
    If you did configure a different download folder in your browser, you need to adjust it.

    The format is `mklink /J LinkTo LinkFrom`

    ```cmd
    mklink /J "C:\Users\<your-user>\Downloads\MyWikis" "C:\Users\<your-user>\Documents\MyWikis"
    ```

    It should show something like this

    ```
    Junction created for C:\Users\<your-user>\Downloads\MyWikis <<===>> C:\Users\<your-user>\Documents\MyWikis
    ```

5. Now open your Downloads folder in the File Explorer

    - There should be a Link icon and the MyWikis directory.
    - **Right Click - Drag** that directory onto your Desktop.
    - It opens a dialogue.
        - Select: **Create shortcut here**

    The Desktop, will now be the location, from where you open your wikis from now on.

    It's also possible to **right click** the MyWikis icon and choose 

    - **Pin to Quick access** or
    - **Pin to Start**

6. Open MyWikis Folder

    Drop your TW wiki files into there. Now they can be handled from the browser,
    but they actually stay out of your browser downloads folder. 

    To remove the junction later:

    ```cmd
    rmdir "C:\Users\<your-user>\Downloads\MyWikis"
    ```

    `rmdir` on a junction removes only the link, not the target folder.
    Your wiki files at `Documents\MyWikis\` are untouched.

## macOS / Linux: symlink

```sh
mkdir -p ~/Wikis
ln -s ~/Wikis ~/Downloads/MyWikis
```

Same effect — wikis live at `~/MyWikis`, the browser sees them inside
`Downloads/MyWikis/`. Remove with `rm ~/Downloads/MyWikis` (deletes
only the link).

## Caveats

- **Cloud-sync folders:** OneDrive, Dropbox, Google Drive sometimes
  have trouble with junctions or symlinks crossing into their managed
  trees. If you sync from inside a junctioned folder and see odd
  behaviour, junction the OTHER way — keep the wiki inside the synced
  folder and junction the synced folder into Downloads instead.
- **Cross-volume junctions** work on NTFS (e.g. `C:\` → `D:\`) but
  not across network shares.
- **Backups follow the junction** — the `twBackups/` folder lives at
  the real location, not inside Downloads. That's usually what you
  want; just be aware if you're configuring backup software at either
  end.
- **Junction visibility in Explorer:** the link appears with a small
  shortcut overlay icon and behaves like a regular folder.

---

[← Home](https://pmario.github.io/file-backups)
