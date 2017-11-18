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
/******/ 	return __webpack_require__(__webpack_require__.s = 5);
/******/ })
/************************************************************************/
/******/ ({

/***/ 5:
/***/ (function(module, exports, __webpack_require__) {

"use strict";


/*
const tempPath = require("../libs/path");
var path;

function getOsInfo(cb) {
	chrome.runtime.getPlatformInfo(function (info) {
		cb(info);
	})
};

getOsInfo(function (info) {
	if (info.os === "win") {
		path = tempPath;
	} else {
		path = tempPath.posix;
	}
});
*/

var backupdirNode;
var backupEnabledNode;
var amountNode;
var counterNode;


function restore_options() {

	backupdirNode = document.getElementById("backupdir");
	backupEnabledNode = document.getElementById("backupenabled");
	amountNode = document.getElementById("amount");
//	counterNode = document.getElementById("counter");


	function onError(items) {}

	function onGotStore(items) {
		backupdirNode.value = items.backupdir || "twBackups";
		backupEnabledNode.checked = items.backupEnabled || false;
//		counterNode.value = items.counter || 0;
		amountNode.value = items.numberOfBackups || 5;

//		console.log("options item:", items)
	};

	let gettingItem = browser.storage.local.get();
	gettingItem.then(onGotStore, onError);
}

document.addEventListener('DOMContentLoaded', restore_options);

document.getElementById("backup-form").addEventListener("submit", (e) => {

	browser.storage.local.set( {
		backupdir: backupdirNode.value,
		backupEnabled: backupEnabledNode.checked,
		numberOfBackups : amountNode.valueAsNumber
		});

//	console.log("submit OK:", e);
	e.preventDefault();

	// TODO change to function and browser.runtime ...
	// !!!!! use storage items object structure
	chrome.runtime.sendMessage({
		msg: "updateBackupEnabled",
//		backupdir: backupdirNode.value,
		backupEnabled: backupEnabledNode.checked//,
//		counter: counterNode.valueAsNumber,
//		amount: amountNode.valueAsNumber
	});


	window.close()
}, false);

document.getElementById("form-bg").addEventListener("click", (e) => {
// TODO
});


/***/ })

/******/ });