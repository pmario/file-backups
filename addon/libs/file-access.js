"use strict";

// Browser-free helpers for the "local file access" check (issue #45).
// background.js does the browser.* calls and hands the results in here, so
// the decision logic can be unit-tested in plain Node (test/file-access.test.js).
//
// Firefox 153 split file:// access out of the host permissions into a separate
// "Access local files on your computer" option, OFF by default for all
// extensions. extension.isAllowedFileSchemeAccess() reflects that option from
// Fx153 on. In Firefox 48-152 it ALWAYS returned false (MDN BCD), while file
// access was implicitly granted — so only trust it on 153+. Chromium has its
// own "Allow access to file URLs" toggle and reports it correctly.

(function (root) {
	var FILE_ACCESS_MIN_FIREFOX = 153;

	// Major Gecko/Firefox version, or null for non-Gecko browsers (Chromium).
	// The UA's "Firefox/<n>" token carries the real Gecko version, also in
	// forks (LibreWolf, Waterfox, ...) whose getBrowserInfo() name/version
	// differ. Don't use "rv:" — Firefox froze it at 109. getBrowserInfo() is
	// the fallback when the UA token is missing (e.g. UA overridden).
	function firefoxMajorVersion(userAgent, browserInfo) {
		var m = /\bFirefox\/(\d+)/.exec(String(userAgent || ""));
		if (m) return parseInt(m[1], 10);
		if (browserInfo && browserInfo.name === "Firefox") {
			var v = parseInt(browserInfo.version, 10);
			if (!isNaN(v)) return v;
		}
		return null;
	}

	// apiResult: what isAllowedFileSchemeAccess() resolved to, or null if the
	// API is missing or threw. Unknown → true: never raise a false alarm.
	function fileAccessAllowed(firefoxMajor, apiResult) {
		if (typeof firefoxMajor === "number" && firefoxMajor < FILE_ACCESS_MIN_FIREFOX) return true;
		if (typeof apiResult === "boolean") return apiResult;
		return true;
	}

	// Pages whose load re-triggers the check: local .html/.htm files, with an
	// optional ?query or #fragment. Without file access the content script
	// can't run, so we can't tell whether it's a TiddlyWiki — any local HTML
	// page is the trigger.
	function isLocalHtmlUrl(url) {
		return /^file:\/\/.*\.html?(?:[?#]|$)/i.test(String(url || ""));
	}

	root.FILE_ACCESS_MIN_FIREFOX = FILE_ACCESS_MIN_FIREFOX;
	root.firefoxMajorVersion = firefoxMajorVersion;
	root.fileAccessAllowed = fileAccessAllowed;
	root.isLocalHtmlUrl = isLocalHtmlUrl;
})(typeof globalThis !== "undefined" ? globalThis : this);
