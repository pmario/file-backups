/*!
 * *****************************************************************************
 * file-backups AddOn is designed to let you easily save and backup TiddlyWikis.
 * 
 * Learn more at: https://github.com/pmario/file-backups
 */
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


var backupdirNode;
var backupEnabledNode;
var amountNode;
var counterNode;
var versionNode;
var siteButtonNode;
var okButtonNode;

const manifest = browser.runtime.getManifest();

var NEWURL;

function onBadgeError(err) {
	console.log("getBadgeText error:", err);
}

function showNewVersion(text) {
	if (text) {
		siteButtonNode.innerText = "New Version Available?";
		siteButtonNode.setAttribute("class","panel-section-footer-button new-version");
		okButtonNode.innerText = "Got It!";
		NEWURL = "https://pmario.github.io/file-backups/news/latest"
	} else {
		siteButtonNode.innerText = "Homepage & Support";
		siteButtonNode.setAttribute("class","panel-section-footer-button");
		okButtonNode.innerText = "!";
		NEWURL = "https://pmario.github.io/file-backups"
	}
}

function restore_options() {
	backupdirNode = document.getElementById("backupdir");
	backupEnabledNode = document.getElementById("backupenabled");
	amountNode = document.getElementById("amount");
	versionNode = document.getElementById("version");
	siteButtonNode = document.getElementById("form-bg");
	okButtonNode = document.getElementById("form-ok");

	versionNode.textContent = "V" + manifest.version;

	NEWURL = "https://pmario.github.io/file-backups";

	
	function onError(err) {
		console.log("storage.local.get error:", err);
	}

	function onGotStore(items) {
		backupdirNode.value = items.backupdir;
		backupEnabledNode.checked = items.backupEnabled;
		amountNode.value = items.numberOfBackups;
	};

	function onGotBadge(text) {
		showNewVersion(text);
//		if (!text) browser.browserAction.setBadgeText({text: "!"})
	};
	
//	function onGotStore(items) {
//		backupdirNode.value = items.backupdir || "twBackups";
//		backupEnabledNode.checked = items.backupEnabled || true;
//		amountNode.value = items.numberOfBackups || 7;
//	};

	let gettingItem = browser.storage.local.get({
		backupdir : "twBackups",
		backupEnabled: true,
		numberOfBackups: 7
	});
	gettingItem.then(onGotStore, onError);
	
	let getBadge = browser.browserAction.getBadgeText({});
	getBadge.then(onGotBadge, this.onBadgeError)
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
	window.close()
}, false);

document.getElementById("form-ok").addEventListener("click", (e) => {
	let getBadge = browser.browserAction.getBadgeText({});
	getBadge.then((text) => {
		if (!text) {
			browser.browserAction.setBadgeText({text: "!"});
			browser.browserAction.setBadgeBackgroundColor({color: "#6600ff"});
			showNewVersion("!");
		}
		else {
			browser.browserAction.setBadgeText({text: ""})
			showNewVersion("");
		}
	}, this.onBadgeError)
	
//	console.log("submit OK:", e);
	e.preventDefault();
	e.stopPropagation();
//	window.close()
}, false);


document.getElementById("form-bg").addEventListener("click", (e) => {
	var creating = browser.tabs.create({
		url: NEWURL
	});
	window.close()
});


/***/ })

/******/ });