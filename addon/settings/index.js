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
/******/ 	return __webpack_require__(__webpack_require__.s = 6);
/******/ })
/************************************************************************/
/******/ ({

/***/ 6:
/***/ (function(module, exports) {

function showSavedMessage() {
	// Update status to let user know options were saved.
	var status = document.getElementById('status');
	status.textContent = 'Settings saved!';
	setTimeout(function () {
		status.textContent = '';
	}, 750);
}

// Saves options to chrome.storage.sync.
async function save_options() {
	var backupdir = document.getElementById('backupdir').value;
	var stat = await browser.storage.local.set({
		backupdir: backupdir,
		backupEnabled: document.getElementById("backup").checked,
		numberOfBackups: document.getElementById('amount').value
	})

	if (stat) {
		console.log("storage.local.set error:", stat)
	} else showSavedMessage();
}

// Restores select box and text fields
async function restore_options() {
	var items = await browser.storage.local.get({
		backupdir: "twBackups",
		backupEnabled: false,
		numberOfBackups: 5
	});

	if (items) {
		document.getElementById('backupdir').value = items.backupdir;
		document.getElementById('amount').value = items.numberOfBackups;
		document.getElementById("backup").checked = items.backupEnabled;
	}
}

document.addEventListener('DOMContentLoaded', restore_options);
document.getElementById('save').addEventListener('click', save_options);


/***/ })

/******/ });
