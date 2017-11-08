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
/******/ 	return __webpack_require__(__webpack_require__.s = 4);
/******/ })
/************************************************************************/
/******/ ({

/***/ 4:
/***/ (function(module, exports, __webpack_require__) {

"use strict";


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
            content = message.getAttribute("data-tiddlyfox-content");

        // Save the file
        saveFile(path,content,cb);

        // using it that way allows us to establishe a 2 way communication between
        // bg and tiddlyFox saver, within TW, in a backwards compatible way.

        function cb(diff) {
            // Remove the message element from the message box
            message.parentNode.removeChild(message);

            // Send a confirmation message
            var event1 = doc.createEvent("Events");
            message.setAttribute("data-diff-dir", diff);
            event1.initEvent("tiddlyfox-have-saved-file",true,false);
            message.dispatchEvent(event1);
        }
        return false;
    },false);
}

function saveFile(filePath,content,cb) {
    var tiddlywikilocations = "/";
    
    var msg = {};
    var diff;

    // Save the file
    try {
            msg.path = filePath;
            msg.twdl = true;
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


/***/ })

/******/ });
