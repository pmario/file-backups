"use strict";

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
browser.tabs.onUpdated.addListener((id, changeInfo, tab) => {
  actions.initializePageAction(tab);
});

/*
Toggle CSS when the page action is clicked.
*/
browser.pageAction.onClicked.addListener( (tab) => {
    actions.toggleCSS(tab);
    getOsInfo((info)=>{console.log("info: ", info)});
});


/*
const leftPad = require("left-pad");

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const result = leftPad(message.text, message.amount, message.with);
    sendResponse(result);
});
*/

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    console.log("at the back got message.twdl");
    //show the choose file dialogue when tw not under 'tiddlywikilocations'

    var test = path.parse(message.path);
    var rel = path.relative(path.parse(message.path).dir, "Downloads");

    if (message.subdir) {
        var test = path.join(message.subdir, path.basename(message.path));

        // needed, for a roundtrip, to set up the right save directory.
        chrome.downloads.download({
            url: URL.createObjectURL(new Blob([message.txt], {type: 'text/plain'})),
            filename: path.join(message.subdir, path.basename(message.path)),
            conflictAction: 'overwrite'
//            saveAs: true
        }, (itemId) => {chrome.downloads.search({id:itemId}, (results)=>{
            let relPath = path.relative(results[0].filename, path.parse(message.path).dir);
            // check relative path
            console.log(results);
            var x = path.parse(relPath);
            var y = relPath.split(path.sep);

            y.shift(); // remove the ".."

            if (y[0] === "..") {
                var z = ""; // problem .. path not valid
            }
            else {
                z = (y.length > 0) ? y.join(path.sep) : "." + path.sep;
            }

            sendResponse({ relPath : z});
        })});
    } else {
        chrome.downloads.download({
            url: URL.createObjectURL(new Blob([message.txt], {type: 'text/plain'})),
            filename: path.basename(message.path),
            conflictAction: 'uniquify'
        }, (itemId) => {chrome.downloads.search({id:itemId}, (results)=>{
            let relPath = path.relative(results[0].filename, path.parse(message.path).dir);
            // check relative path
            console.log(results);

            var x = path.parse(relPath);
            var y = relPath.split(path.sep);

            y.shift(); // remove the ".."

            if (y[0] === "..") {
                var z = ""; // problem .. path not valid
            }
            else {
                z = (y.length > 0) ? y.join(path.sep) : "." + path.sep;
            }

            sendResponse({ relPath : z});
        })});
    }
    //once a day backup 
/*
    chrome.storage.local.get({backupdir:"backupfiles",[message.path]:null}, function(items) {
        var counter = items[message.path];
        var bkdate = (new Date()).toISOString().slice(0,10);

        chrome.downloads.download({
                url: URL.createObjectURL(new Blob([message.txt], {type: 'text/plain'})),
                filename: path.join(items.backupdir, 'asdf.' + bkdate + ".html"),
                conflictAction: 'overwrite'
            });

        chrome.storage.local.set({[message.path] : counter})
    });
*/
    // sendResponse will be async
    return true;
});

