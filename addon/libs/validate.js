"use strict";

// Shared input-validation helpers for the popup and settings pages.
// Returned strings are user-facing messages; null means "no problem".
//
// The restrictions below mirror what browser.downloads.download enforces on
// the `filename` parameter, per MDN:
//   "Absolute paths, empty paths, path components that start and/or end with
//    a dot (.), and paths containing back-references (../) will cause an error."
// https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/downloads/download

(function (root) {
	function validateBackupDir(value) {
		if (!value) return null; // empty = use the default "twBackups"
		if (value.charAt(0) === "/" || value.charAt(0) === "\\") {
			return "Must be a relative path (no leading '/' or '\\').";
		}
		if (/^[a-zA-Z]:/.test(value)) {
			return "Must not start with a drive letter (like 'C:').";
		}
		var segments = value.split(/[\\/]/);
		for (var i = 0; i < segments.length; i++) {
			if (segments[i] === "..") {
				return "Browsers refuse '..' in paths.";
			}
		}
		if (/[<>:"|?*]/.test(value)) {
			return "Contains a character your OS does not allow in file names ( <  >  :  \"  |  ?  * ).";
		}
		return null;
	}

	root.validateBackupDir = validateBackupDir;
})(typeof globalThis !== "undefined" ? globalThis : this);
