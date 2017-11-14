# Beta

This FireFox AddOn is considered BETA quality. 

# File Backup Utility - for TiddlyWiki (atm)

This addOn should give you the possibility to save "file-based" TiddlyWikis, to your browser backup directory.

This addOn should work with browsers, that support web-extensions. Tested with FireFox 56, 57 beta, 58 beta, (2017.11.09). 

See the video: https://youtu.be/dt-nH9jSQ6c

## Restrictions

Due to incresed security concerns, all major browser vendors limit the directories, where addOns have write access.
So this addOn can only write to the users downloads folder eg: `C:\Users\<name>\Downloads` **and its subdirectories**.

So you can have the following construction: 

 - `C:\Users\<name>\Downloads\myWikis\todo.html` or
 - `C:\Users\<name>\Downloads\myWikis\notes.html`
 
## Backup Folder (Optional)

 - default: `twBackups`

This directory can be set globally and is relative to the wiki location. eg:

 - `C:\Users\<name>\Downloads\myWikis\notes.html` or
 - `C:\Users\<name>\Downloads\myWikis\twBackups\notes(A).html`

## Installation

Just click this link: [file_backups-0.1.1-an.fx-windows.xpi](https://github.com/pmario/file-backups/releases/download/V0.1.1/file_backups-0.1.1-an.fx-windows.xpi)

Or see: https://github.com/pmario/file-backups/releases/

## Backup Strategy

The backup strategy works with a, slightly modified, "Tower of Hanoi" backup rotation strategy, which is known from tape based systems.

The following table shows the numbering system, with 4 different files.

 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |9 |10|11|12|13|14|15|16
-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-
A| |A| |A| |A| |A| |A| |A| |A| 
||B||||B||||B||||B||
||||C||||||||C|||
||||||||D||||||||D

So the order will be: A, B, A, C, A, B, A, D, A, B, A, C, A, B, A, D, ... 

As you can see: 

 - A will be overwritten with every 2nd save.
 - B will be written every 4th
 - C 8th
 - D 16th ... 
 
The gneric order is: 2<sup> n-1</sup>.

Files can be restored from 1, 2, 4, 8, 16, ..., 2<sup> n-1</sup> saves ago!

Working with 11 files will result in 512 saves, before K is overwritten the first time. Then it will need another 1024 saves until it is overwritten again.

Eg: If you save your file 2 times per minute for 8 hours, you'll not be able to overwrite K again. Because it is save #1024 and 2 * 60 * 8 = **960**.

## Modification to the Algorithm

The described mechanism has a "flaw", if we want a "per save" rotation. File "D" (see table) is initialized the first time after 8 saves. So the implemented startup sequence is: 

- Populate A, B, C, D ... then
- Start with the described rotation schema

Which will result in a slightly better recovery coverage.

## License

Copyright Mario Pietsch 2017

CC-BY-NC-SA ... https://creativecommons.org/licenses/by-nc-sa/4.0
