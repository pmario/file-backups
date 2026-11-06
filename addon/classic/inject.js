/*
The JavaScript in this file is injected into each TiddlyWiki Classic page that loads
*/

(function () {

"use strict";

/*
Returns true if successful, false if failed, null if not available
*/
var injectedSaveFile = function(path,content) {
	// check for windows or unix paths
/*	var slash = "\\";
	var dirPathPos = path.lastIndexOf("\\");
	if(dirPathPos == -1) {
		dirPathPos = path.lastIndexOf("/");
		slash = "/";
	}

	var splitPos = path.lastIndexOf("."+slash);
	if (splitPos !== -1) path = path.substr(splitPos+2);
	*/

	// TODO At the moment we deactivate the backups.
	// In a future version it should be activated again.
	config.options.chkSaveBackups = false;
	// Find the message box element
	var messageBox = document.getElementById("tiddlyfox-message-box");
	if(messageBox) {
		// Create the message element and put it in the message box
		var message = document.createElement("div");
		message.setAttribute("data-tiddlyfox-path",path);
		message.setAttribute("data-tiddlyfox-content",content);
		messageBox.appendChild(message);
		// Milestone armed by classic/milestone.js? The content script reads
		// these attributes from the message box synchronously while the event
		// is dispatched (same contract as tw5-bridge.js), so clear them again
		// right after.
		var milestone = isMainFile(path) ? takePendingMilestone() : null;
		if(milestone) {
			messageBox.setAttribute("data-file-backups-milestone", "yes");
			messageBox.setAttribute("data-file-backups-milestone-label", milestone.label || "");
			messageBox.setAttribute("data-file-backups-milestone-ts", milestone.ts);
			messageBox.setAttribute("data-file-backups-milestone-description", milestone.description || "");
		}
		// Per-wiki reminder overrides from the FileBackupsConfig tiddler (same
		// attributes tw5-bridge.js sets from $:/config/file-backups/*). Empty =
		// use the global default from the AddOn options.
		messageBox.setAttribute("data-fb-remind", configSlice("remindAfterDays"));
		messageBox.setAttribute("data-fb-count", configSlice("fileCountLimit"));
		messageBox.setAttribute("data-fb-size", configSlice("sizeLimitMB"));
		// Dispatch the custom event to the extension
		message.dispatchEvent(new CustomEvent("tiddlyfox-save-file", {bubbles: true}));
		if(milestone) {
			messageBox.removeAttribute("data-file-backups-milestone");
			messageBox.removeAttribute("data-file-backups-milestone-label");
			messageBox.removeAttribute("data-file-backups-milestone-ts");
			messageBox.removeAttribute("data-file-backups-milestone-description");
		}
	}
	return true;
};

// The milestone belongs to the wiki file itself, not to the extra files TW
// Classic may write in the same save (empty template, RSS feed).
var isMainFile = function(path) {
	try {
		if(typeof tw !== "undefined" && tw.io && tw.io.getOriginalLocalPath) {
			return path === tw.io.getOriginalLocalPath();
		}
	} catch(ex) {}
	return true;
};

// A whole number >= 0 from a FileBackupsConfig slice (|remindAfterDays|14|),
// else "" (= inherit the global default).
var configSlice = function(name) {
	try {
		var v = String(store.getTiddlerSlice("FileBackupsConfig", name) || "").trim();
		return /^\d+$/.test(v) ? v : "";
	} catch(ex) {
		return "";
	}
};

var takePendingMilestone = function() {
	var ms = window.__fileBackupsClassicMilestone;
	return (ms && ms.takePendingMilestone) ? ms.takePendingMilestone() : null;
};

/*
Returns text if successful, false if failed, null if not available
*/
var injectedLoadFile = function(path) {
	try {
		// fix a problem introduced with FF 68 and 
		// path differences between WinOS and *nix OSes
		path = (path.charAt(0) !== "/") ? "/" + path : path;
		// Just read the file synchronously
		var xhReq = new XMLHttpRequest();
		xhReq.open("GET", "file://" + encodeURI(path), false);
		xhReq.send(null);
		return xhReq.responseText;
	} catch(ex) {
		return false;
	}
};

var injectedConvertUriToUTF8 = function(path) {
	return path;
}

var injectedConvertUnicodeToFileFormat = function(s) {
	return s;
}

window.mozillaSaveFile = injectedSaveFile;
window.mozillaLoadFile = injectedLoadFile;
window.convertUriToUTF8 = injectedConvertUriToUTF8;
window.convertUnicodeToFileFormat = injectedConvertUnicodeToFileFormat;

})();
