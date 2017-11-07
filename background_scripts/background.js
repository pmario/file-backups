"use strict";

const path = require("path");

const actions = require("./page-actions");

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
browser.pageAction.onClicked.addListener(actions.toggleCSS);

/*
const leftPad = require("left-pad");

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const result = leftPad(message.text, message.amount, message.with);
    sendResponse(result);
});
*/

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    var x; 
    console.log("at the back got message.twdl");
    //show the choose file dialogue when tw not under 'tiddlywikilocations'
    if (!message.twdl) {
        x = chrome.downloads.download({
            url: URL.createObjectURL(new Blob([message.txt], {type: 'text/plain'})),
            filename: path.basename(message.path),
            conflictAction: 'overwrite'
//            saveAs : true
        });
        console.log("x: ", x);
    } else { 
        chrome.downloads.download({
            url: URL.createObjectURL(new Blob([message.txt], {type: 'text/plain'})),
            filename: 'tiddlywikilocations/'+message.path,
            conflictAction: 'overwrite'
        });
    }
    //once a day backup 
    chrome.storage.local.get({backupdir:"backupfiles",[message.path]:null}, function(items) {
        if ((new Date()).toISOString().slice(0,10) !== items[message.path]) {
            var bkdate = (new Date()).toISOString().slice(0,10);
            chrome.downloads.download({
                    url: URL.createObjectURL(new Blob([message.txt], {type: 'text/plain'})),
                    filename: 'tiddlywikilocations/'+items.backupdir+'/'+message.path.replace(new RegExp('.{' + message.path.lastIndexOf(".")  + '}'), '$&' + bkdate),
                    conflictAction: 'overwrite'
                });
            chrome.storage.local.set({
            [message.path] : bkdate
            })
        }
    });
});
