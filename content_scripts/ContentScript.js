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
        // Get the details from the message
        var message = event.target,
            path = Xpath.basename(message.getAttribute("data-tiddlyfox-path")),
            content = message.getAttribute("data-tiddlyfox-content");
        // Save the file
        saveFile(path,content);
        // Remove the message element from the message box
        message.parentNode.removeChild(message);
        // Send a confirmation message

        var event1 =doc.createEvent("Events");
        event1.initEvent("tiddlyfox-have-saved-file",true,false);
        event1.savedFilePath = path;
        message.dispatchEvent(event1);
        return false;
    },false);
}

function saveFile(filePath,content) {
    var tiddlywikilocations = "/";
    
    var msg = {}, 
        path, 
        firstloc = filePath.indexOf("/"+tiddlywikilocations+"/");
    // Save the file
    try {
        if (firstloc === -1) {
            alert("file not in a sudir to "+tiddlywikilocations+", it will be saved to the download dir");
            path = filePath.split("/");
            msg.path = path[path.length-1];
//            msg.twdl = true;
        }
        else {
            msg.path = filePath.slice(firstloc+tiddlywikilocations.length + "//".length);
            msg.twdl = true;
        }
        msg.txt = content;
        console.log("from cs: we are inside downloads at "+msg.path);
        chrome.runtime.sendMessage(msg);
        return true;
    } catch(ex) {
        alert(ex);
        return false;
    }
}
