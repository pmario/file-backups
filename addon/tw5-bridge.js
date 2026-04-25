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
 *
 * UI tiddlers (button, shortcut recipes, readme, license) are shipped as
 * native TW .tid files under addon/tiddlers/. The bridge fetches them at
 * install time, parses the standard TW header/body format, and addTiddler-s
 * each. Authors edit real .tid files (drag in/out of TW round-trips cleanly)
 * instead of hand-escaped strings inside this JS file.
 */

(function () {
	"use strict";

	// Capture our own URL synchronously while the script is still running —
	// document.currentScript becomes null once the IIFE returns.
	var SCRIPT_SRC = (document.currentScript && document.currentScript.src) || "";
	var BASE_URL = SCRIPT_SRC.replace(/[^/]*$/, "");

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

	// Shipped tiddler assets that overwrite on every page load — only the
	// ones that need to drive widget refresh (the toolbar buttons + their
	// shortcut-action recipes). All under $:/temp/* so they're wiped on F5
	// and re-installed by the bridge.
	var TIDDLER_FILES = [
		"tiddlers/buttons-save-as.tid",
		"tiddlers/shortcut-save-as.tid",
		"tiddlers/shortcut-save-milestone.tid"
	];

	// Tiddlers shipped as SHADOWS via a runtime plugin bundle. Two reasons
	// to use shadows here:
	//   1. The keyboard-manager config tiddlers ($:/config/shortcuts/<name>,
	//      $:/config/ShortcutInfo/<name>) must live at exact paths outside
	//      $:/temp/, so shipping them as real tiddlers would dirty the wiki.
	//   2. Readme and license are informational; making them shadows means
	//      they live alongside the config tiddlers in one bundle the user
	//      can inspect under "$:/temp/plugins/file-backups/config" in TW.
	// Shadows satisfy getTiddlerText / getTiddlersWithTag the same as real
	// tiddlers, but they don't trigger SaverFilter and they auto-defer to
	// any real tiddler the user later creates at the same title — so user
	// customisation overrides the defaults with no guard logic on our side.
	// The wrapper plugin tiddler lives at $:/temp/* so it doesn't dirty
	// either, and uses a non-standard plugin-type so it stays out of
	// Control Panel > Plugins.
	var CONFIG_TIDDLER_FILES = [
		"tiddlers/plugin/config/shortcuts-save-wiki-as.tid",
		"tiddlers/plugin/config/ShortcutInfo-save-wiki-as.tid",
		"tiddlers/plugin/config/shortcuts-save-milestone.tid",
		"tiddlers/plugin/config/ShortcutInfo-save-milestone.tid",
		"tiddlers/plugin/readme.tid",
		"tiddlers/plugin/license.tid"
	];
	var CONFIG_BUNDLE_TITLE = "$:/temp/plugins/file-backups/config";
	var CONFIG_BUNDLE_TYPE = "file-backups-assets";

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

	async function install() {
		try {
			attachSaveListener();
			await Promise.all([
				installTiddlersFromAssets(TIDDLER_FILES),
				installShadowBundleFromAssets(CONFIG_TIDDLER_FILES, CONFIG_BUNDLE_TITLE, CONFIG_BUNDLE_TYPE)
			]);
		} catch (err) {
			console.log("[fb-bridge] install failed:", err);
		}
	}

	// Parse the standard TW .tid file format:
	//   key: value
	//   key: value
	//   <blank line>
	//   <text body up to EOF>
	function parseTid(raw) {
		// Normalise line endings and strip the file's trailing newline (most
		// editors save with one). Without this, single-line text bodies like
		// "alt-S\n" break TW's keyboard parser — split("-") yields ["alt",
		// "S\n"] and the named-key lookup fails on the "\n" suffix.
		var text = raw.replace(/\r\n/g, "\n").replace(/\n$/, "");
		var blank = text.indexOf("\n\n");
		var fields = {};
		if (blank < 0) {
			fields.text = text;
			return fields;
		}
		text.slice(0, blank).split("\n").forEach(function (line) {
			var c = line.indexOf(":");
			if (c > 0) {
				fields[line.slice(0, c).trim()] = line.slice(c + 1).trim();
			}
		});
		fields.text = text.slice(blank + 2);
		return fields;
	}

	async function installTiddlersFromAssets(files) {
		await Promise.all(files.map(async function (path) {
			var raw = await fetch(BASE_URL + path).then(function (r) { return r.text(); });
			var fields = parseTid(raw);
			$tw.wiki.addTiddler(new $tw.Tiddler(fields));
		}));
	}

	// Bundle a set of .tid assets into a runtime plugin so their tiddlers
	// become shadows in the wiki. Used for tiddlers whose titles must live
	// outside $:/temp/ but which we don't want to dirty the wiki — shadows
	// are read by getTiddlerText / getTiddlersWithTag the same as real
	// tiddlers, but they don't trigger SaverFilter and they auto-defer to
	// any real tiddler the user later creates at the same title.
	async function installShadowBundleFromAssets(files, wrapperTitle, pluginType) {
		var pluginContents = {tiddlers: {}};
		await Promise.all(files.map(async function (path) {
			var raw = await fetch(BASE_URL + path).then(function (r) { return r.text(); });
			var fields = parseTid(raw);
			if (fields.title) {
				pluginContents.tiddlers[fields.title] = fields;
			}
		}));
		$tw.wiki.addTiddler(new $tw.Tiddler({
			title: wrapperTitle,
			type: "application/json",
			"plugin-type": pluginType,
			text: JSON.stringify(pluginContents)
		}));
		$tw.wiki.readPluginInfo([wrapperTitle]);
		$tw.wiki.registerPluginTiddlers(pluginType, [wrapperTitle]);
		$tw.wiki.unpackPluginTiddlers();
		// Notify keyboard-manager / other listeners that the shadow set
		// changed so they re-cache. Keyboard manager's handleShortcutChanges
		// includes detectNewShortcuts which watches $:/config/shortcuts/
		// prefix changes — both shadow and real changes flow through the
		// same change-event pipeline.
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
			var t = $tw.wiki.getTiddler("$:/temp/plugins/file-backups/next-saveAs");
			var armed = !!(t && t.fields.text === "yes");
			box.setAttribute("data-tiddlyfox-saveas", armed ? "yes" : "no");
			if (armed) {
				$tw.wiki.deleteTiddler("$:/temp/plugins/file-backups/next-saveAs");
			}
		}, true);
	}
})();
