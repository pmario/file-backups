/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// identity function for calling harmony imports with the correct context
/******/ 	__webpack_require__.i = function(value) { return value; };
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, {
/******/ 				configurable: false,
/******/ 				enumerable: true,
/******/ 				get: getter
/******/ 			});
/******/ 		}
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 3);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


const CSS = "body { border: 20px solid red; }";
const TITLE_APPLY = "Apply CSS";
const TITLE_REMOVE = "Remove CSS";
const APPLICABLE_PROTOCOLS = ["file:"];

const pageActions = {
    /*
    Toggle CSS: based on the current title, insert or remove the CSS.
    Update the page action's title and icon to reflect its state.
    */
    toggleCSS: function toggleCSS(tab) {

      function gotTitle(title) {
        if (title === TITLE_APPLY) {
          browser.pageAction.setIcon({tabId: tab.id, path: "icons/download.svg"});
          browser.pageAction.setTitle({tabId: tab.id, title: TITLE_REMOVE});
          browser.tabs.insertCSS({code: CSS});
        } else {
          browser.pageAction.setIcon({tabId: tab.id, path: "icons/spiral.svg"});
          browser.pageAction.setTitle({tabId: tab.id, title: TITLE_APPLY});
          browser.tabs.removeCSS({code: CSS});
        }
      }

      var gettingTitle = browser.pageAction.getTitle({tabId: tab.id});
      gettingTitle.then(gotTitle);
    },

    /*
    Returns true only if the URL's protocol is in APPLICABLE_PROTOCOLS.
    */
    protocolIsApplicable: function protocolIsApplicable(url) {
      var anchor =  document.createElement('a');
      anchor.href = url;
      return APPLICABLE_PROTOCOLS.includes(anchor.protocol);
    },

    /*
    Initialize the page action: set icon and title, then show.
    Only operates on tabs whose URL's protocol is applicable.
    */
    initializePageAction: function initializePageAction(tab) {
      if (this.protocolIsApplicable(tab.url)) {
        browser.pageAction.setIcon({tabId: tab.id, path: "icons/spiral.svg"});
        browser.pageAction.setTitle({tabId: tab.id, title: TITLE_APPLY});
        browser.pageAction.show(tab.id);
      }
    }
}

module.exports = pageActions;

/***/ }),
/* 1 */,
/* 2 */,
/* 3 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


//const path = require("path");

const actions = __webpack_require__(0);

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
            filename: message.path,
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


/***/ })
/******/ ]);