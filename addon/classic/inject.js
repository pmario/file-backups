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
	// In a future version it shoudl be activated again.
	config.options.chkSaveBackups = false;
	// Find the message box element
	var messageBox = document.getElementById("tiddlyfox-message-box");
	if(messageBox) {
		// Create the message element and put it in the message box
		var message = document.createElement("div");
		message.setAttribute("data-tiddlyfox-path",path);
		message.setAttribute("data-tiddlyfox-content",content);
		messageBox.appendChild(message);
		// Create and dispatch the custom event to the extension
		var event = document.createEvent("Events");
		event.initEvent("tiddlyfox-save-file",true,false);
		message.dispatchEvent(event);
	}
	return true;
};

/*
Returns text if successful, false if failed, null if not available
*/
var injectedLoadFile = function(path) {
	try {
		// Just read the file synchronously
		var xhReq = new XMLHttpRequest();
		xhReq.open("GET", "file:///" + escape(path), false);
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
