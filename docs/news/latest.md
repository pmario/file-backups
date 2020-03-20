[Home](https://pmario.github.io/file-backups)

TLDR; This info is important for you, IF your PC is always on, your browser is never restarted, your TW tabs are always open _and_ you use file-backups plugin V0.3.5 or earlier.

If _all_ of this is true for you, I highly recommend to go on reading if you don't want to loose some data!

## V0.4.0 What's New

 - The plugin, if downloaded in the background, will only be installed and activated at browser restart
 - Memory leak fixed for frequently saved huge TWs
 - File-Backups AddOn only uses 1 icon - The browser "diamond" icon
 - The "diamond" icon gets a "blue" !-indicator
   - The drop-down will show eg: new version ;)
 - An "out of order" backup is created if a TiddlyWiki is saved for the first time
   - Only different names are detected.
   - If the AddOn is uninstalled and installed again the first save will create an "out of order" backup per new name.
 - Backups are activated by default if the AddOn is installed
 - Default number of backups was increased from 6 to 7
 - The plugin Options setting site was updated
 - AddOn should work for "FireFox for Android"
   - At least it does for me ;)


## More details

FireFox has switched to a 4 week release cycle starting with FF 71. That means I have to test file-backups compatibility even more frequently than it was needed with the 6 week release cycle.

I do test file-backups V0.3.5 and (V0.3.10 beta) with FF-stable, FF-developer edition, FF-nightly and Cliqz browser as soon as a new "stable" release will be activated.
AND
Most of the time, some days prior to a new stable release. ... Just to be sure it still works.

We need to update file-backups V0.3.5 plugin to V0.4.0 because it will contain a much better update behaviour.

At the moment, it's possible to loose data, if the AddOn is updated in the background, because of some oversights in early days V0.3.5.

Users, that use file-backups V0.3.10 beta [1] shouldn't run into the edge-case described below. See point 1) at What's New below.

File-Backups plugin is only active for tabs with a file:/// URL

Data-loss is possible if:

 - Your PC is always on _and_
 - Your browser is never closed / restarted _and_
 - Your TiddlyWiki tabs are open all the time _and_
 - Browser AddOns are updated automatically

 - Browser update in the background _may_ cause problems, but I don't have evidence about this atm.

It's edge-cases, but I know that there are some users, that use TWs that way. ...

 - The easiest way to be safe for those users is to restart the browser, once the AddOn is updated

The problem at the moment is, that there is no visible indication, that a new AddOn version has been installed and activated. (Sorry about that!)

