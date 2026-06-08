"use strict";

// Shared reminder-message templates for the backup-awareness layer (phase 3).
// A reminder is {kind, value} where value is the effective threshold for the
// active wiki: days since last milestone, backup file count, or total MB.
//
// reminderMessage(kind, value) -> { text, action } | null
//   text   - the user-facing sentence
//   action - the primary action-button label for that reminder kind
//
// Loaded in two contexts that can't share a module: the content script (in-page
// banner, via manifest content_scripts) and the popup (chip, via <script>). It
// assigns one global so both can call it. Kept free of browser/DOM APIs.

(function (root) {
	var TEMPLATES = {
		milestone: function (v) {
			return {
				text: "No milestone saved for this wiki in over " + v + " days. Saving one captures a restore point you can jump back to.",
				action: "Save milestone"
			};
		},
		count: function (v) {
			return {
				text: "This wiki's backup folder now holds more than " + v + " files. Review them and remove any you no longer need.",
				action: "Show backups"
			};
		},
		size: function (v) {
			return {
				text: "This wiki's backups now use more than " + v + " MB of disk space. Review them and remove any you no longer need.",
				action: "Show backups"
			};
		}
	};

	function reminderMessage(kind, value) {
		var t = TEMPLATES[kind];
		return t ? t(value) : null;
	}

	root.reminderMessage = reminderMessage;
	root.FB_REMINDER_KINDS = ["milestone", "count", "size"];
})(typeof globalThis !== "undefined" ? globalThis : this);
