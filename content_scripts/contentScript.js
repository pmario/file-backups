'use strict';

const PLUGIN_NAME = "file-backups"

document.addEventListener('DOMContentLoaded', main, false);

// main function
function main() {
	injectMessageBox();
	checkUrlConflict();
}

// TODO it's ugly .. improve this
function backendMessage(textHeader, textMsg, textUrl, color, background) {
	var color = color || "white",
		background = background || "red";

	var wrapper  = document.createElement("div"),
		br  = document.createElement("br"),
		pMsg = document.createElement("p"),
		pUrl = document.createElement("p"),
		textHeaderNode = document.createTextNode(textHeader),
		textMsgNode = document.createTextNode(textMsg),
		textUrlNode = document.createTextNode(textUrl);

	if (textHeader !== "") {
		pMsg.appendChild(textHeaderNode);
		pMsg.appendChild(br);
	};
	pMsg.appendChild(textMsgNode);
	pMsg.style = "font-weight: 600;";
	wrapper.appendChild(pMsg);
	pUrl.appendChild(textUrlNode);
	wrapper.appendChild(pUrl);
	wrapper.style = `position: fixed; left: 0; top: 0; right: 0; color: ${color}; background: ${background}; border: 4px solid black; text-align: center; margin: 8px; z-index: 10000; font-size: initial;`;
	document.body.appendChild(wrapper);
	wrapper.addEventListener("click", function (event) {
		document.body.removeChild(wrapper);
	}, false);
}

// Show a warning message, if a TW is open 2 times. At the moment, this isn't allowed.
function checkUrlConflict() {
	var data = {};

	data.url = document.URL,
	data.msg = "checkUrlConflict";

	var getStat = browser.runtime.sendMessage(data)

	getStat.then( (urlConflict) => {
//		console.log("urlConflict: ", urlConflict);
		if (urlConflict) {
			// backendMessage(textHeader, textMsg, textUrl, color, background)
			backendMessage("Message from 'file-backups' AddOn:",
						   "This TiddlyWiki file is already open in another tab OR an other window!",
							`${data.url}`)
		}
	});
}

// Can be found at: https://classic.TiddlyWiki.com
function isTiddlyWikiClassicFile(doc) {
	// Test whether the document is a TiddlyWiki (we don't have access to JS objects in it)
	var versionArea = doc.getElementById("versionArea");
	return (doc.location.protocol === "file:") &&
		doc.getElementById("storeArea") &&
		(versionArea && /TiddlyWiki/.test(versionArea.text));
}

// Can be found at: https://TiddlyWiki.com
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

// We may want to have special handling for non file based stuff too!
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

function injectClassicScript(doc) {
	var s = document.createElement('script');
	s.src = browser.extension.getURL('classic/inject.js');
	(doc.head || doc.documentElement).appendChild(s);
	s.onload = function () {
		s.parentNode.removeChild(s);
	};
}

// main loop
function injectMessageBox(doc) {
	doc = document;

	// check, if we are allowed to run!!
	if (isTiddlyWiki5File(doc)) {
		// do nothing
	} else if (isTiddlyWikiClassicFile(doc)) {
		injectClassicScript(doc);
	} else {
		return;
	}

	// Inject the message box
	var messageBox = doc.getElementById("tiddlyfox-message-box");
	if (messageBox) {
		var othersw = messageBox.getAttribute("data-message-box-creator") || null;
		if (othersw) {
			alert('"' + PLUGIN_NAME + '" has detected another plugin named: "' + othersw + '"\n' +
				'At the moment only 1 save mechanism can be active at once.\n' +
				'We will temporarily deactivate the functionality, until the problem is resolved!');
			return;
		} else {
			messageBox.setAttribute("data-message-box-creator", PLUGIN_NAME);
		}
	} else {
		messageBox = doc.createElement("div");
		messageBox.id = "tiddlyfox-message-box";
		messageBox.style.display = "none";
		messageBox.setAttribute("data-message-box-creator", PLUGIN_NAME);
		doc.body.appendChild(messageBox);
	}
	// Attach the event handler to the message box
	messageBox.addEventListener("tiddlyfox-save-file", function (event) {
		var path;
		// Get the details from the message
		var message = event.target,
			subdir = message.parentNode.getAttribute("data-tiddlyfox-subdir"), // <-- see parentNode
			saveas = message.parentNode.getAttribute("data-tiddlyfox-saveas"), // <-- see parentNode
			path = message.getAttribute("data-tiddlyfox-path"),
			content = message.getAttribute("data-tiddlyfox-content"),
			backupdir = message.getAttribute("data-tiddlyfox-backupdir");

		// Save the file
		saveFile(path, content, subdir, backupdir, saveas, cb);

		// using it that way, allows us to establishe a 2 way communication between
		// bg and tiddlyFox saver, within TW, in a backwards compatible way.
		function cb(response) {
			// Send a confirmation message
			if (response.relPath === "") {
				if (response.beakonError) {
					// backendMessage(textMsgNode, textUrlNode)
					// backendMessage(response.beakonError, response.beakonInfo.filename);
				} else if (response.downloadWikiError) {
					// TODO
				} else if (response.openNewTabError) {
					// backendMessage(textHeader, textMsg, textUrl, color, background)
					backendMessage("",
								   response.openNewTabError,
								   `Click -> <a href="${response.openNewTabInfo.filename}" class="tc-tiddlylink-external" target="_blank" rel="noopener noreferrer">${response.openNewTabInfo.filename}</a>`,
								   "black", "lightgreen");
				}
//				alert("The file can't be saved to:" + path + "\n\nThe next save will open a 'Save Dialog'!");
//				message.parentNode.setAttribute("data-tiddlyfox-saveas", "yes");
			} else {
				message.parentNode.setAttribute("data-tiddlyfox-saveas", "no");
			}

			let event1 = doc.createEvent("Events");
			message.parentNode.setAttribute("data-tiddlyfox-subdir", response.subdir || "");
			event1.initEvent("tiddlyfox-have-saved-file", true, false);
			message.dispatchEvent(event1);

			// Remove element from the message box, to reduce DOM size
			message.parentNode.removeChild(message);
		}
		return false;
	}, false);
}

function saveFile(filePath, content, subdir, backupdir, saveas, cb) {
	let msg = {},
		stat;

	// Save the file
	try {
		msg.msg = "save-wiki";
		msg.path = filePath;
		msg.subdir = subdir;
		msg.saveas = saveas;
		msg.backupdir = backupdir;
		msg.txt = content;

		stat = browser.runtime.sendMessage(msg)

		stat.then((bgResponse) => {
			cb(bgResponse);
		}, (err) => {
			console.log("save-wiki error:", err)
		});
		return true;
	} catch (ex) {
		alert(ex);
		return false;
	}
}
