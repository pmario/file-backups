/*
 * tw5-bridge.js — injected into TiddlyWiki5 pages by the file-backups
 * extension's content script. Runs in the page's JavaScript context so it can
 * reach `$tw.wiki`.
 *
 * Installs a "save as" toolbar button. Clicking it sets
 * `$:/temp/plugins/file-backups/next-saveAs = "yes"` and dispatches the normal TW
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

	// When the extension is disabled or reinstalled, content scripts and the
	// background are torn down but page-context scripts (this file) are not —
	// the bridge from the previous extension lifecycle stays bound to the
	// messagebox. The newly-injected content script then loads a SECOND bridge
	// instance, which would attach a second capture-phase listener. Both fire
	// per save: the first reads the temp tiddler and deletes it, the second
	// reads undefined and overwrites data-tiddlyfox-saveas back to "no".
	// Result: Save As silently degrades to normal save until F5.
	// Detect the prior instance and bail.
	if (window.__fileBackupsBridgeInstalled) {
		return;
	}
	window.__fileBackupsBridgeInstalled = true;

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

	// Install the bridge's UI tiddlers as plain real tiddlers under
	// $:/temp/plugins/file-backups/*.
	//
	// Earlier versions used a TW shadow plugin bundle, but shadow change
	// events (isShadow=true) don't reliably trigger list-widget refresh on
	// first-time-shadow-appearance — so on extension (re)install into an
	// already-loaded TW page the toolbar buttons rendered with action
	// widgets that didn't actually fire on click.
	//
	// Plain tiddlers under $:/temp/ are equivalent to shadows in the only
	// two dimensions that matter for us:
	//   - $:/config/SaverFilter excludes $:/temp/* → no dirty bump.
	//   - $:/core/save/all (the wiki-file save template) also excludes
	//     $:/temp/* → tiddlers never get serialised into the user's wiki.
	// And they fire ordinary change events, which TW's list widget refreshes
	// on unambiguously, so the toolbar updates the same way it would after
	// any normal user-driven tiddler add. Same path as fresh boot.
	function installShadowTiddlers() {
		var tiddlers = [
			{
				title: "$:/temp/plugins/file-backups/buttons/save-as",
				tags: "$:/tags/PageControls",
				caption: "{{$:/core/images/download-button}} save as",
				description: "Save a copy of this wiki to a chosen location (opens the native Save As dialog)",
				text: [
					"\\whitespace trim",
					"<$button tooltip=\"Save wiki to a chosen location\" aria-label=\"save as\" class=<<tv-config-toolbar-class>>>",
					"<$action-setfield $tiddler=\"$:/temp/plugins/file-backups/next-saveAs\" text=\"yes\"/>",
					"<$action-sendmessage $message=\"tm-save-wiki\"/>",
					"{{$:/core/images/download-button}}",
					"</$button>"
				].join("\n")
			},
			{
				title: "$:/temp/plugins/file-backups/readme",
				text: [
					"! File Backups — extension assets",
					"",
					"These tiddlers are installed automatically by the [[File Backups browser extension|https://github.com/pmario/file-backups]] and ship the UI elements the extension needs (currently the \"save as\" toolbar button, more to follow).",
					"",
					"They live under `$:/temp/plugins/file-backups/*` so they don't dirty the wiki and never get serialised into your saved wiki file. They are recreated in memory each time you open a wiki while the extension is active."
				].join("\n")
			},
			{
				title: "$:/temp/plugins/file-backups/license",
				text: [
					"Copyright (c) 2017-2026 Mario Pietsch",
					"",
					"Licensed under the BSD 3-Clause License.",
					"Full text: https://opensource.org/licenses/BSD-3-Clause"
				].join("\n")
			}
		];

		tiddlers.forEach(function (fields) {
			$tw.wiki.addTiddler(new $tw.Tiddler(fields));
		});
	}

	// Capture-phase listener runs before the content-script's bubble-phase
	// listener on the same element, so the attribute it writes is visible when
	// the content script reads it.
	function attachSaveListener() {
		var box = document.getElementById("tiddlyfox-message-box");
		box.addEventListener("tiddlyfox-save-file", function () {
			var t = $tw.wiki.getTiddler("$:/temp/plugins/file-backups/next-saveAs");
			var armed = !!(t && t.fields.text === "yes");
			box.setAttribute("data-tiddlyfox-saveas", armed ? "yes" : "no");
			if (armed) {
				$tw.wiki.deleteTiddler("$:/temp/plugins/file-backups/next-saveAs");
			}
		}, true);
	}
})();
