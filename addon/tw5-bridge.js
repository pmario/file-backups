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

	function installShadowTiddlers() {
		// Modelled on $:/core/ui/Buttons/save-wiki. Uses the download-button
		// icon and has no text (the toolbar-text config is ignored on purpose).
		var tiddlers = {
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
		};

		Object.keys(tiddlers).forEach(function (title) {
			$tw.wiki.addTiddler(new $tw.Tiddler(tiddlers[title]));
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
