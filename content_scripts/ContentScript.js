'use strict';

document.addEventListener('DOMContentLoaded', injectMessageBox, false);

function isTiddlyWikiClassicFile(doc) {
	// Test whether the document is a TiddlyWiki (we don't have access to JS objects in it)
	var versionArea = doc.getElementById("versionArea");
	return (doc.location.protocol === "file:") &&
		doc.getElementById("storeArea") &&
		(versionArea && /TiddlyWiki/.test(versionArea.text));
}

function isTiddlyWiki5File(doc) {
	// Test whether the document is a TiddlyWiki. Check the meta info, which is new in TW5
	var meta = document.getElementsByTagName("META");
	if (meta) {
		for (let i = 0; i < meta.length; i++) {
			if (meta[i].content === "TiddlyWiki") return (doc.location.protocol === "file:");
		}
	}
	return false;
}

// We may want to have special handling for non file base stuff too!
function isTiddlyWiki5(doc) {
	// Test whether the document is a TiddlyWiki. Check the meta info, which is new in TW5
	var meta = document.getElementsByTagName("META");
	if (meta) {
		for (let i = 0; i < meta.length; i++) {
			if (meta[i].content === "TiddlyWiki") return true;
		}
	}
	return false;
}

// main loop
function injectMessageBox(doc) {
	doc = document;

	// check, if we are allowed to run!!
	if (!isTiddlyWiki5File(doc)) return;

	// Inject the message box
	var messageBox = doc.getElementById("tiddlyfox-message-box");
	if (!messageBox) {
		messageBox = doc.createElement("div");
		messageBox.id = "tiddlyfox-message-box";
		messageBox.style.display = "none";
		doc.body.appendChild(messageBox);
	}
	// Attach the event handler to the message box
	messageBox.addEventListener("tiddlyfox-save-file", function (event) {
		var path;
		// Get the details from the message
		var message = event.target,
			subdir = message.parentNode.getAttribute("data-tiddlyfox-subdir"), // <-- see parentNode
			path = message.getAttribute("data-tiddlyfox-path"),
			content = message.getAttribute("data-tiddlyfox-content"),
			backupdir = message.getAttribute("data-tiddlyfox-backupdir");

		// Save the file
		saveFile(path, content, subdir, backupdir, cb);

		// using it that way, allows us to establishe a 2 way communication between
		// bg and tiddlyFox saver, within TW, in a backwards compatible way.
		function cb(dds) {
			// Send a confirmation message
			var event1 = doc.createEvent("Events");
			message.parentNode.setAttribute("data-tiddlyfox-subdir", dds);
			event1.initEvent("tiddlyfox-have-saved-file", true, false);
			message.dispatchEvent(event1);

			// Remove element from the message box, to reduce DOM size
			message.parentNode.removeChild(message);
		}
		return false;
	}, false);
}

function saveFile(filePath, content, subdir, backupdir, cb) {
	var msg = {};
	var diff;

	// Save the file
	try {
		msg.path = filePath;
		msg.subdir = subdir;
		msg.backupdir = backupdir;
		msg.txt = content;
		console.log("from cs: we are inside downloads at: " + msg.path);
		chrome.runtime.sendMessage(msg, (bgResponse) => {
			console.log("CS response: ", bgResponse);
			var diff = bgResponse.relPath;
			cb(diff);
		});
		return true;
	} catch (ex) {
		alert(ex);
		return false;
	}
}


