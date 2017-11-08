'use strict';

document.addEventListener('DOMContentLoaded', injectMessageBox, false);

function fireContentLoadedEvent () {
    console.log ("DOMContentLoaded");
    // PUT YOUR CODE HERE.
    //document.body.textContent = "Changed this!";
}

function injectMessageBox(doc) {
    doc = document;
    // Inject the message box
    var messageBox = doc.getElementById("tiddlyfox-message-box");
    if(!messageBox) {
        messageBox = doc.createElement("div");
        messageBox.id = "tiddlyfox-message-box";
        messageBox.style.display = "none";
        doc.body.appendChild(messageBox);
    }
    // Attach the event handler to the message box
    messageBox.addEventListener("tiddlyfox-save-file",function(event) {
        var path;
        // Get the details from the message
        var message = event.target,
            path = message.getAttribute("data-tiddlyfox-path"),
            content = message.getAttribute("data-tiddlyfox-content"),
            subdir = message.parentNode.getAttribute("data-downloads-subdir");

        // Save the file
        saveFile(path,content,subdir,cb);

        // using it that way, allows us to establishe a 2 way communication between
        // bg and tiddlyFox saver, within TW, in a backwards compatible way.
        function cb(diff) {
            // Send a confirmation message
            var event1 = doc.createEvent("Events");
            message.parentNode.setAttribute("data-downloads-subdir", diff);
            event1.initEvent("tiddlyfox-have-saved-file",true,false);
            message.dispatchEvent(event1);
            // Remove the message element from the message box
            message.parentNode.removeChild(message);
        }
        return false;
    },false);
}

function saveFile(filePath,content,subdir,cb) {
    var msg = {};
    var diff;

    // Save the file
    try {
            msg.path = filePath;
            msg.subdir = subdir;
            msg.txt = content;
            console.log("from cs: we are inside downloads at: " + msg.path);
            chrome.runtime.sendMessage(msg, (bgResponse) => {console.log("CS response: ", bgResponse);
                                                                diff = bgResponse.relPath;
                                                                cb(diff);
                                                            });
        return true;
    } catch(ex) {
        alert(ex);
        return false;
    }
}
