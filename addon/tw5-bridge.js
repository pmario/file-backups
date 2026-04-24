/*
 * tw5-bridge.js — injected into TiddlyWiki5 pages by the file-backups
 * extension's content script. Runs in the page's JavaScript context so it can
 * reach `$tw.wiki`.
 *
 * Installs a "save as" toolbar button. Clicking it sets
 * `$:/temp/file-backups/next-saveAs = "yes"` and dispatches the normal TW
 * save (`tm-save-wiki`). When TW then fires `tiddlyfox-save-file` on the
 * messagebox, this bridge's capture-phase listener runs first, reads the temp
 * tiddler, and sets `data-tiddlyfox-saveas` on the messagebox synchronously.
 * The content script's existing bubble-phase listener then reads that
 * attribute and forwards `msg.saveas = "yes"` to the background, which opens
 * the native Save As dialog. The temp tiddler is cleared on consumption.
 *
 * The capture-phase approach is deliberate: `$tw.wiki.addEventListener("change", ...)`
 * fires asynchronously, too late to influence the save already in flight.
 */

(function () {
	"use strict";

	var retries = 0;
	function waitForReady() {
		var twReady = typeof $tw !== "undefined" && $tw.wiki && typeof $tw.wiki.addTiddler === "function";
		var boxReady = !!document.getElementById("tiddlyfox-message-box");
		if (twReady && boxReady) {
			install();
			return;
		}
		if (retries++ > 100) return; // ~5s
		setTimeout(waitForReady, 50);
	}
	waitForReady();

	function install() {
		installShadowTiddlers();
		attachSaveListener();
	}

	// Install the bridge's UI tiddlers as TW shadow tiddlers via a runtime
	// plugin bundle.
	//
	// Why a plugin bundle and not plain $tw.wiki.addTiddler:
	//   - $:/config/SaverFilter ([all[]] minus $:/state/ and $:/temp/) marks
	//     any non-temp tiddler change as dirty. A plain addTiddler would make
	//     the wiki appear unsaved the moment the page loads.
	//   - $:/core/save/all uses [is[tiddler]] which excludes shadow tiddlers,
	//     so shadows never get serialised into the wiki file.
	//   - saver-handler's change listener checks `if(change.normal)` so shadow
	//     change events don't count toward dirty either.
	//
	// The plugin *wrapper* tiddler is itself a real tiddler and would normally
	// trigger dirty, so we title it under $:/temp/ which SaverFilter already
	// excludes. TW's plugin registration checks the tiddler's fields (type +
	// plugin-type), not its title prefix — verified in TW boot.js.
	function installShadowTiddlers() {
		var pluginTitle = "$:/temp/file-backups/plugin-bundle";

		var pluginContents = {
			tiddlers: {
				"$:/plugins/file-backups/buttons/save-as": {
					title: "$:/plugins/file-backups/buttons/save-as",
					tags: "$:/tags/PageControls",
					caption: "{{$:/core/images/download-button}} save as",
					description: "Save a copy of this wiki to a chosen location (opens the native Save As dialog)",
					text: [
						"\\whitespace trim",
						"<$button tooltip=\"Save wiki to a chosen location\" aria-label=\"save as\" class=<<tv-config-toolbar-class>>>",
						"<$action-setfield $tiddler=\"$:/temp/file-backups/next-saveAs\" text=\"yes\"/>",
						"<$action-sendmessage $message=\"tm-save-wiki\"/>",
						"{{$:/core/images/download-button}}",
						"</$button>"
					].join("\n")
				}
			}
		};

		// plugin-type: "file-backups-assets" (not the standard "plugin") hides
		// the wrapper from Control Panel > Plugins / Themes / Languages tabs,
		// which filter on hard-coded plugin-type values. TW's registration
		// machinery is type-agnostic beyond string equality.
		$tw.wiki.addTiddler(new $tw.Tiddler({
			title: pluginTitle,
			type: "application/json",
			"plugin-type": "file-backups-assets",
			name: "File Backups",
			description: "Browser extension bridge for the file-backups addon",
			text: JSON.stringify(pluginContents)
		}));

		$tw.wiki.readPluginInfo([pluginTitle]);
		$tw.wiki.registerPluginTiddlers("file-backups-assets", [pluginTitle]);
		$tw.wiki.unpackPluginTiddlers();

		// unpackPluginTiddlers() rebuilds the shadowTiddlers map but does not
		// enqueue change events, so already-rendered widgets don't know about
		// the new shadows. Notify them explicitly as shadow changes (isShadow
		// = true) so SaverFilter's `if(change.normal)` check continues to
		// exclude these changes from the dirty count.
		Object.keys(pluginContents.tiddlers).forEach(function (title) {
			$tw.wiki.enqueueTiddlerEvent(title, false, true);
		});
	}

	// Capture-phase listener runs before the content-script's bubble-phase
	// listener on the same element, so the attribute it writes is visible when
	// the content script reads it.
	function attachSaveListener() {
		var box = document.getElementById("tiddlyfox-message-box");
		box.addEventListener("tiddlyfox-save-file", function () {
			var t = $tw.wiki.getTiddler("$:/temp/file-backups/next-saveAs");
			var armed = !!(t && t.fields.text === "yes");
			box.setAttribute("data-tiddlyfox-saveas", armed ? "yes" : "no");
			if (armed) {
				$tw.wiki.deleteTiddler("$:/temp/file-backups/next-saveAs");
			}
		}, true);
	}
})();
