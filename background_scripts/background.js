"use strict";

const BACKUP_DIR = "twBackups";

// At the moment it always returns win32
// startup() function needs to fix this
const tempPath = require("../libs/path");
const actions = require("./page-actions");

var path;

function getOsInfo(cb) {
    chrome.runtime.getPlatformInfo( function(info) {
        cb(info);
    })
};


getOsInfo( function(info) {
    if (info.os === "win") {
        path = tempPath;
    }
    else {
        path = tempPath.posix;
    }
});

/*
When first loaded, initialize the page action for all tabs.
*/
var gettingAllTabs = browser.tabs.query({});

gettingAllTabs.then((tabs) => {
  for (let tab of tabs) {
    actions.initializePageAction(tab);
  }
});

/*
Each time a tab is updated, reset the page action for that tab.
*/
chrome.tabs.onUpdated.addListener((id, changeInfo, tab) => {
  actions.initializePageAction(tab);
});

/*
Toggle CSS when the page action is clicked.
*/
browser.pageAction.onClicked.addListener( (tab) => {
    actions.toggleEnableBackups(tab);
    // getOsInfo((info)=>{console.log("info: ", info)}); // debugging only TODO remove
});


function getNextChar(count, max) {
    var char = "a";
    var cnt  = count - max;

    if (count <= max) {
        char = "-" + String.fromCharCode(64 + count);
    } else {
        for (var i = 0; i < max; i++) {
            if ((cnt - Math.pow(2,i) ) % Math.pow(2,i+1) === 0) {
                char = String.fromCharCode(65 + i);
              break;
            }
        }
        char = (char === "a") ? String.fromCharCode(64 + max) : char
    }
    console.log(char);
    return char;
}

function createBackup(message) {
// Backup using "Tower of Hanoi" backup schema
    chrome.storage.local.get(null, function(items) {
        var backupEnabled = items.backupEnabled || false,
            backupdir = items.backupdir || BACKUP_DIR,
            counter = items[message.path] || 1,
            max = items.noOfBackups || 4,
            nextChar = getNextChar(counter,max);

        // imo this won't happen, but who knows.
        if (counter >= Number.MAX_SAFE_INTEGER) counter = max + 1;

        if (backupEnabled) {
//            var bkdate = (new Date()).toISOString().slice(0,10);
            var pathX = path.parse(message.path);
            var nameX = path.join(message.subdir, backupdir, pathX.name + "(" + nextChar + ")" + pathX.ext);

            chrome.downloads.download({
                    url: URL.createObjectURL(new Blob([message.txt], {type: "text/plain"})),
                    filename: nameX,
                    conflictAction: "overwrite"
                }, (itemId) => {chrome.downloads.search({id:itemId}, (results)=>{
                // ^^^^^^^^^^^^^^^^^^
                    var a = a
                })});

            counter = counter + 1;
            chrome.storage.local.set({[message.path] : counter})
        }
    });
};


chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    console.log("at the back got message.twdl");
    //show the choose file dialogue when tw not under 'tiddlywikilocations'
    var allowBackup = false;
    var test = path.parse(message.path);
    var rel = path.relative(path.parse(message.path).dir, "Downloads");

    if (message.subdir) {
        var test = path.join(message.subdir, path.basename(message.path));

        // needed, for a roundtrip, to set up the right save directory.
        chrome.downloads.download({
            url: URL.createObjectURL(new Blob([message.txt], {type: "text/plain"})),
            filename: path.join(message.subdir, path.basename(message.path)),
            conflictAction: "overwrite"
//            saveAs: true
        }, (itemId) => {chrome.downloads.search({id:itemId}, (results)=>{
        // ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
            // check relative path
            //console.log(results);
            sendResponse({relPath : message.subdir});

            // Create a backup
            createBackup(message);
        })});
    } else {
        chrome.downloads.download({
            url: URL.createObjectURL(new Blob([message.txt], {type: "text/plain"})),
            filename: path.basename(message.path),
            conflictAction: "uniquify"
        }, (itemId) => {chrome.downloads.search({id:itemId}, (results)=>{
        // ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
            let relPath = path.relative(results[0].filename, path.parse(message.path).dir);
            // check relative path
            //console.log(results);

            // var x = path.parse(relPath); // for debugging only TODO remove!
            var y = relPath.split(path.sep);
            var z;

            y.shift(); // remove the ".."

            if (y[0] === "..") {
                z = ""; // problem .. path not valid
            }
            else {
                z = (y.length > 0) ? y.join(path.sep) : "." + path.sep;
            }

            sendResponse({relPath : z});
        })});
    }

    // This one is important! sendResponse will be async. ContentScript expects it that way atm.
    return true;
});

