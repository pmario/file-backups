# Beta

This FireFox AddOn is considered BETA quality.

# File Backup Utility For TiddlyWiki

## Introduction
This browser add on is designed to let you easily save and backup TiddlyWikis. It is a file-based system for a single user. If you'd like your TiddlyWiki available over the network or in the cloud, please check out other options at "Getting Started With TiddlyWiki"[1].

This add on should work with any browser that supports web-extensions. So far it's been tested with FireFox 56, 57 beta, 58 beta, (2017.11.09).

It will save **TiddlyWiki5 and TiddlyWikiClassic** files. For TiddlyWikiClassic the TW internal backup mechanism is switched of!

For an overview of this add on please see the introduction video: https://youtu.be/KVLtID8nElU

## Installation

To install, **click this link: [file_backups-0.2.1-an.fx.xpi](https://github.com/pmario/file-backups/releases/download/V0.2.1/file_backups-0.2.1-an.fx.xpi)** or download and install from the [releases page](https://github.com/pmario/file-backups/releases/)

## File Storage Locations

### Main File Limitations

To help keep you secure, most modern browsers limit writing files to only a few locations.

This means this add on can only write to your downloads folder **and its subdirectories**.

For example on Windows 7 or newer, it's usually `C:\Users\<name>\Downloads` 

It's a good idea to keep your TiddlyWiki in it's own subfolder. So, you'll end up with something like 

 - `C:\Users\<name>\Downloads\myWikis\todo.html` or
 - `C:\Users\<name>\Downloads\myWikis\notes.html`
 
### The Backup Folder (Optional)

The default backup folder is called `twBackups`.  This can be changed in the options.  It's set globally and is relative to the wiki location.

For example if your TiddlyWiki is
`C:\Users\<name>\Downloads\myWikis\notes.html` 
the backup folder defaults to 
`C:\Users\<name>\Downloads\myWikis\twBackups\notes(A).html`

## The Backup Strategy

The backups are created using a slightly modified "Tower of Hanoi" rotation strategy, similar to some tape based backup software.

The following table shows the numbering system, with 4 different files.

|Backup Number | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |9 |10|11|12|13|14|15|16
|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
| File A | A| |A| |A| |A| |A| |A| |A| |A| 
| File B | |B||||B||||B||||B||
| File C | |||C||||||||C|||
|File D | |||||||D||||||||D

So the order will be: A, B, A, C, A, B, A, D, A, B, A, C, A, B, A, D, ... 

As you can see: 

 - A will be overwritten with every 2nd save
 - B will be written every 4th
 - C 8th
 - D 16th ... 
 
The generic order is: 2<sup> n-1</sup>.

Files can be restored from 1, 2, 4, 8, 16, ..., 2<sup> n-1</sup> saves ago!

Working with 11 files will result in 512 saves, before K is overwritten the first time. Then it will need another 1024 saves until it is overwritten again.

Eg: Starting with A, if you save your file twice a minute for eight hours, you will still have not overwriten K.
K is save #1024 and 2 * 60 * 8 = **960**.

### The Modification

The described mechanism has a "flaw", if we want a "per save" rotation. File "D" for instance, would only be be initialized after the 8th save. 

So the implemented sequence is: 

- Populate A, B, C, D ... then
- Start with the described rotation schema

Which will result in a slightly better recovery coverage.

## Links

[1] [https://tiddlywiki.com/#GettingStarted](https://tiddlywiki.com/#GettingStarted)

## License

Copyright Mario Pietsch 2017

CC-BY-NC-SA ... [https://creativecommons.org/licenses/by-nc-sa/4.0](https://creativecommons.org/licenses/by-nc-sa/4.0)

