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
/******/ 	return __webpack_require__(__webpack_require__.s = 2);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


const TITLE_ENABLE = "Enable Backups";
const TITLE_DISABLE = "Disable Backups";
const APPLICABLE_PROTOCOLS = ["file:", "file:"];

/*
Returns true only if the URL's protocol is in APPLICABLE_PROTOCOLS.
*/
function protocolIsApplicable(url) {
	var anchor = document.createElement('a');
	anchor.href = url;
	return APPLICABLE_PROTOCOLS.includes(anchor.protocol);
};

const pageActions = {

	toggleEnableBackups: function (tab) {
		function gotTitle(title) {
			if (title === TITLE_ENABLE) {
				browser.pageAction.setIcon({
					tabId: tab.id,
					path: "icons/backup.svg"
				});
				browser.pageAction.setTitle({
					tabId: tab.id,
					title: TITLE_DISABLE
				});
				browser.storage.local.set({
					backupEnabled: true
				});
			} else {
				browser.pageAction.setIcon({
					tabId: tab.id,
					path: "icons/download.svg"
				});
				browser.pageAction.setTitle({
					tabId: tab.id,
					title: TITLE_ENABLE
				});
				browser.storage.local.set({
					backupEnabled: false
				});
			}
		}

		if (protocolIsApplicable(tab.url)) {
			var gettingTitle = browser.pageAction.getTitle({
				tabId: tab.id
			});
			gettingTitle.then(gotTitle);
		}
	},

	messageUpdatePageAction: function (tab, items) {
		if (!protocolIsApplicable(tab.url)) return;

		var icon, title;
		if (items.backupEnabled) {
			icon = "icons/backup.svg";
			title = TITLE_DISABLE;
		} else {
			icon = "icons/download.svg";
			title = TITLE_ENABLE;
		}
		browser.pageAction.setIcon({
			tabId: tab.id,
			path: icon
		});
		browser.pageAction.setTitle({
			tabId: tab.id,
			title: title
		});
		browser.pageAction.show(tab.id);
	},

	/*
	Update the page action: set icon and title, then show.
	Only operates on tabs whose URL's protocol is applicable.
	*/
	updatePageAction: function (tab) {
		function onError(error) {};

		function onGotStore(items) {
			var icon, title;
			if (items.backupEnabled) {
				icon = "icons/backup.svg";
				title = TITLE_DISABLE;
			} else {
				icon = "icons/download.svg"
				title = TITLE_ENABLE
			}
			browser.pageAction.setIcon({
				tabId: tab.id,
				path: icon
			});
			browser.pageAction.setTitle({
				tabId: tab.id,
				title: title
			});
			browser.pageAction.show(tab.id);
		};

		function gotTabInfo(tab) {
			if (protocolIsApplicable(tab.url)) {
				let gettingItem = browser.storage.local.get();
				gettingItem.then(onGotStore, onError);
			} else browser.pageAction.hide(tab.id);
		}

		var gettingTitle = browser.tabs.get(tab.id);
		gettingTitle.then(gotTabInfo);
	},

	/*
	Initialize the page action: set icon and title, then show.
	Only operates on tabs whose URL's protocol is applicable.
	*/
	initializePageAction: function (tab) {
		if (protocolIsApplicable(tab.url)) {
			browser.pageAction.setIcon({
				tabId: tab.id,
				path: "icons/download.svg"
			});
			browser.pageAction.setTitle({
				tabId: tab.id,
				title: TITLE_ENABLE
			});
			browser.pageAction.show(tab.id);
		} else {
			browser.pageAction.hide(tab.id);
		}
	}
}

module.exports = pageActions;


/***/ }),
/* 1 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


const process = __webpack_require__(4);

function assertPath(path) {
  if (typeof path !== 'string') {
    throw new TypeError('Path must be a string!');
  }
}

// Resolves . and .. elements in a path with directory names
function normalizeStringWin32(path, allowAboveRoot) {
  var res = '';
  var lastSlash = -1;
  var dots = 0;
  var code;
  for (var i = 0; i <= path.length; ++i) {
    if (i < path.length)
      code = path.charCodeAt(i);
    else if (code === 47/*/*/ || code === 92/*\*/)
      break;
    else
      code = 47/*/*/;
    if (code === 47/*/*/ || code === 92/*\*/) {
      if (lastSlash === i - 1 || dots === 1) {
        // NOOP
      } else if (lastSlash !== i - 1 && dots === 2) {
        if (res.length < 2 ||
            res.charCodeAt(res.length - 1) !== 46/*.*/ ||
            res.charCodeAt(res.length - 2) !== 46/*.*/) {
          if (res.length > 2) {
            const start = res.length - 1;
            var j = start;
            for (; j >= 0; --j) {
              if (res.charCodeAt(j) === 92/*\*/)
                break;
            }
            if (j !== start) {
              if (j === -1)
                res = '';
              else
                res = res.slice(0, j);
              lastSlash = i;
              dots = 0;
              continue;
            }
          } else if (res.length === 2 || res.length === 1) {
            res = '';
            lastSlash = i;
            dots = 0;
            continue;
          }
        }
        if (allowAboveRoot) {
          if (res.length > 0)
            res += '\\..';
          else
            res = '..';
        }
      } else {
        if (res.length > 0)
          res += '\\' + path.slice(lastSlash + 1, i);
        else
          res = path.slice(lastSlash + 1, i);
      }
      lastSlash = i;
      dots = 0;
    } else if (code === 46/*.*/ && dots !== -1) {
      ++dots;
    } else {
      dots = -1;
    }
  }
  return res;
}

// Resolves . and .. elements in a path with directory names
function normalizeStringPosix(path, allowAboveRoot) {
  var res = '';
  var lastSlash = -1;
  var dots = 0;
  var code;
  for (var i = 0; i <= path.length; ++i) {
    if (i < path.length)
      code = path.charCodeAt(i);
    else if (code === 47/*/*/)
      break;
    else
      code = 47/*/*/;
    if (code === 47/*/*/) {
      if (lastSlash === i - 1 || dots === 1) {
        // NOOP
      } else if (lastSlash !== i - 1 && dots === 2) {
        if (res.length < 2 ||
            res.charCodeAt(res.length - 1) !== 46/*.*/ ||
            res.charCodeAt(res.length - 2) !== 46/*.*/) {
          if (res.length > 2) {
            const start = res.length - 1;
            var j = start;
            for (; j >= 0; --j) {
              if (res.charCodeAt(j) === 47/*/*/)
                break;
            }
            if (j !== start) {
              if (j === -1)
                res = '';
              else
                res = res.slice(0, j);
              lastSlash = i;
              dots = 0;
              continue;
            }
          } else if (res.length === 2 || res.length === 1) {
            res = '';
            lastSlash = i;
            dots = 0;
            continue;
          }
        }
        if (allowAboveRoot) {
          if (res.length > 0)
            res += '/..';
          else
            res = '..';
        }
      } else {
        if (res.length > 0)
          res += '/' + path.slice(lastSlash + 1, i);
        else
          res = path.slice(lastSlash + 1, i);
      }
      lastSlash = i;
      dots = 0;
    } else if (code === 46/*.*/ && dots !== -1) {
      ++dots;
    } else {
      dots = -1;
    }
  }
  return res;
}

function _format(sep, pathObject) {
  const dir = pathObject.dir || pathObject.root;
  const base = pathObject.base ||
    ((pathObject.name || '') + (pathObject.ext || ''));
  if (!dir) {
    return base;
  }
  if (dir === pathObject.root) {
    return dir + base;
  }
  return dir + sep + base;
}

const win32 = {
  // path.resolve([from ...], to)
  resolve: function resolve() {
    var resolvedDevice = '';
    var resolvedTail = '';
    var resolvedAbsolute = false;

    for (var i = arguments.length - 1; i >= -1; i--) {
      var path;
      if (i >= 0) {
        path = arguments[i];
      } else if (!resolvedDevice) {
        path = process.cwd();
      } else {
        // Windows has the concept of drive-specific current working
        // directories. If we've resolved a drive letter but not yet an
        // absolute path, get cwd for that drive, or the process cwd if
        // the drive cwd is not available. We're sure the device is not
        // a UNC path at this points, because UNC paths are always absolute.
        path = process.env['=' + resolvedDevice] || process.cwd();

        // Verify that a cwd was found and that it actually points
        // to our drive. If not, default to the drive's root.
        if (path === undefined ||
            path.slice(0, 3).toLowerCase() !==
              resolvedDevice.toLowerCase() + '\\') {
          path = resolvedDevice + '\\';
        }
      }

      assertPath(path);

      // Skip empty entries
      if (path.length === 0) {
        continue;
      }

      var len = path.length;
      var rootEnd = 0;
      var code = path.charCodeAt(0);
      var device = '';
      var isAbsolute = false;

      // Try to match a root
      if (len > 1) {
        if (code === 47/*/*/ || code === 92/*\*/) {
          // Possible UNC root

          // If we started with a separator, we know we at least have an
          // absolute path of some kind (UNC or otherwise)
          isAbsolute = true;

          code = path.charCodeAt(1);
          if (code === 47/*/*/ || code === 92/*\*/) {
            // Matched double path separator at beginning
            var j = 2;
            var last = j;
            // Match 1 or more non-path separators
            for (; j < len; ++j) {
              code = path.charCodeAt(j);
              if (code === 47/*/*/ || code === 92/*\*/)
                break;
            }
            if (j < len && j !== last) {
              const firstPart = path.slice(last, j);
              // Matched!
              last = j;
              // Match 1 or more path separators
              for (; j < len; ++j) {
                code = path.charCodeAt(j);
                if (code !== 47/*/*/ && code !== 92/*\*/)
                  break;
              }
              if (j < len && j !== last) {
                // Matched!
                last = j;
                // Match 1 or more non-path separators
                for (; j < len; ++j) {
                  code = path.charCodeAt(j);
                  if (code === 47/*/*/ || code === 92/*\*/)
                    break;
                }
                if (j === len) {
                  // We matched a UNC root only

                  device = '\\\\' + firstPart + '\\' + path.slice(last);
                  rootEnd = j;
                } else if (j !== last) {
                  // We matched a UNC root with leftovers

                  device = '\\\\' + firstPart + '\\' + path.slice(last, j);
                  rootEnd = j;
                }
              }
            }
          } else {
            rootEnd = 1;
          }
        } else if ((code >= 65/*A*/ && code <= 90/*Z*/) ||
                   (code >= 97/*a*/ && code <= 122/*z*/)) {
          // Possible device root

          code = path.charCodeAt(1);
          if (path.charCodeAt(1) === 58/*:*/) {
            device = path.slice(0, 2);
            rootEnd = 2;
            if (len > 2) {
              code = path.charCodeAt(2);
              if (code === 47/*/*/ || code === 92/*\*/) {
                // Treat separator following drive name as an absolute path
                // indicator
                isAbsolute = true;
                rootEnd = 3;
              }
            }
          }
        }
      } else if (code === 47/*/*/ || code === 92/*\*/) {
        // `path` contains just a path separator
        rootEnd = 1;
        isAbsolute = true;
      }

      if (device.length > 0 &&
          resolvedDevice.length > 0 &&
          device.toLowerCase() !== resolvedDevice.toLowerCase()) {
        // This path points to another device so it is not applicable
        continue;
      }

      if (resolvedDevice.length === 0 && device.length > 0) {
        resolvedDevice = device;
      }
      if (!resolvedAbsolute) {
        resolvedTail = path.slice(rootEnd) + '\\' + resolvedTail;
        resolvedAbsolute = isAbsolute;
      }

      if (resolvedDevice.length > 0 && resolvedAbsolute) {
        break;
      }
    }

    // At this point the path should be resolved to a full absolute path,
    // but handle relative paths to be safe (might happen when process.cwd()
    // fails)

    // Normalize the tail path
    resolvedTail = normalizeStringWin32(resolvedTail, !resolvedAbsolute);

    return (resolvedDevice + (resolvedAbsolute ? '\\' : '') + resolvedTail) ||
           '.';
  },

  normalize: function normalize(path) {
    assertPath(path);
    const len = path.length;
    if (len === 0)
      return '.';
    var rootEnd = 0;
    var code = path.charCodeAt(0);
    var device;
    var isAbsolute = false;

    // Try to match a root
    if (len > 1) {
      if (code === 47/*/*/ || code === 92/*\*/) {
        // Possible UNC root

        // If we started with a separator, we know we at least have an absolute
        // path of some kind (UNC or otherwise)
        isAbsolute = true;

        code = path.charCodeAt(1);
        if (code === 47/*/*/ || code === 92/*\*/) {
          // Matched double path separator at beginning
          var j = 2;
          var last = j;
          // Match 1 or more non-path separators
          for (; j < len; ++j) {
            code = path.charCodeAt(j);
            if (code === 47/*/*/ || code === 92/*\*/)
              break;
          }
          if (j < len && j !== last) {
            const firstPart = path.slice(last, j);
            // Matched!
            last = j;
            // Match 1 or more path separators
            for (; j < len; ++j) {
              code = path.charCodeAt(j);
              if (code !== 47/*/*/ && code !== 92/*\*/)
                break;
            }
            if (j < len && j !== last) {
              // Matched!
              last = j;
              // Match 1 or more non-path separators
              for (; j < len; ++j) {
                code = path.charCodeAt(j);
                if (code === 47/*/*/ || code === 92/*\*/)
                  break;
              }
              if (j === len) {
                // We matched a UNC root only
                // Return the normalized version of the UNC root since there
                // is nothing left to process

                return '\\\\' + firstPart + '\\' + path.slice(last) + '\\';
              } else if (j !== last) {
                // We matched a UNC root with leftovers

                device = '\\\\' + firstPart + '\\' + path.slice(last, j);
                rootEnd = j;
              }
            }
          }
        } else {
          rootEnd = 1;
        }
      } else if ((code >= 65/*A*/ && code <= 90/*Z*/) ||
                 (code >= 97/*a*/ && code <= 122/*z*/)) {
        // Possible device root

        code = path.charCodeAt(1);
        if (path.charCodeAt(1) === 58/*:*/) {
          device = path.slice(0, 2);
          rootEnd = 2;
          if (len > 2) {
            code = path.charCodeAt(2);
            if (code === 47/*/*/ || code === 92/*\*/) {
              // Treat separator following drive name as an absolute path
              // indicator
              isAbsolute = true;
              rootEnd = 3;
            }
          }
        }
      }
    } else if (code === 47/*/*/ || code === 92/*\*/) {
      // `path` contains just a path separator, exit early to avoid unnecessary
      // work
      return '\\';
    }

    code = path.charCodeAt(len - 1);
    var trailingSeparator = (code === 47/*/*/ || code === 92/*\*/);
    var tail;
    if (rootEnd < len)
      tail = normalizeStringWin32(path.slice(rootEnd), !isAbsolute);
    else
      tail = '';
    if (tail.length === 0 && !isAbsolute)
      tail = '.';
    if (tail.length > 0 && trailingSeparator)
      tail += '\\';
    if (device === undefined) {
      if (isAbsolute) {
        if (tail.length > 0)
          return '\\' + tail;
        else
          return '\\';
      } else if (tail.length > 0) {
        return tail;
      } else {
        return '';
      }
    } else {
      if (isAbsolute) {
        if (tail.length > 0)
          return device + '\\' + tail;
        else
          return device + '\\';
      } else if (tail.length > 0) {
        return device + tail;
      } else {
        return device;
      }
    }
  },


  isAbsolute: function isAbsolute(path) {
    assertPath(path);
    const len = path.length;
    if (len === 0)
      return false;
    var code = path.charCodeAt(0);
    if (code === 47/*/*/ || code === 92/*\*/) {
      return true;
    } else if ((code >= 65/*A*/ && code <= 90/*Z*/) ||
               (code >= 97/*a*/ && code <= 122/*z*/)) {
      // Possible device root

      if (len > 2 && path.charCodeAt(1) === 58/*:*/) {
        code = path.charCodeAt(2);
        if (code === 47/*/*/ || code === 92/*\*/)
          return true;
      }
    }
    return false;
  },


  join: function join() {
    if (arguments.length === 0)
      return '.';

    var joined;
    var firstPart;
    for (var i = 0; i < arguments.length; ++i) {
      var arg = arguments[i];
      assertPath(arg);
      if (arg.length > 0) {
        if (joined === undefined)
          joined = firstPart = arg;
        else
          joined += '\\' + arg;
      }
    }

    if (joined === undefined)
      return '.';

    // Make sure that the joined path doesn't start with two slashes, because
    // normalize() will mistake it for an UNC path then.
    //
    // This step is skipped when it is very clear that the user actually
    // intended to point at an UNC path. This is assumed when the first
    // non-empty string arguments starts with exactly two slashes followed by
    // at least one more non-slash character.
    //
    // Note that for normalize() to treat a path as an UNC path it needs to
    // have at least 2 components, so we don't filter for that here.
    // This means that the user can use join to construct UNC paths from
    // a server name and a share name; for example:
    //   path.join('//server', 'share') -> '\\\\server\\share\\')
    //var firstPart = paths[0];
    var needsReplace = true;
    var slashCount = 0;
    var code = firstPart.charCodeAt(0);
    if (code === 47/*/*/ || code === 92/*\*/) {
      ++slashCount;
      const firstLen = firstPart.length;
      if (firstLen > 1) {
        code = firstPart.charCodeAt(1);
        if (code === 47/*/*/ || code === 92/*\*/) {
          ++slashCount;
          if (firstLen > 2) {
            code = firstPart.charCodeAt(2);
            if (code === 47/*/*/ || code === 92/*\*/)
              ++slashCount;
            else {
              // We matched a UNC path in the first part
              needsReplace = false;
            }
          }
        }
      }
    }
    if (needsReplace) {
      // Find any more consecutive slashes we need to replace
      for (; slashCount < joined.length; ++slashCount) {
        code = joined.charCodeAt(slashCount);
        if (code !== 47/*/*/ && code !== 92/*\*/)
          break;
      }

      // Replace the slashes if needed
      if (slashCount >= 2)
        joined = '\\' + joined.slice(slashCount);
    }

    return win32.normalize(joined);
  },


  // It will solve the relative path from `from` to `to`, for instance:
  //  from = 'C:\\orandea\\test\\aaa'
  //  to = 'C:\\orandea\\impl\\bbb'
  // The output of the function should be: '..\\..\\impl\\bbb'
  relative: function relative(from, to) {
    assertPath(from);
    assertPath(to);

    if (from === to)
      return '';

    var fromOrig = win32.resolve(from);
    var toOrig = win32.resolve(to);

    if (fromOrig === toOrig)
      return '';

    from = fromOrig.toLowerCase();
    to = toOrig.toLowerCase();

    if (from === to)
      return '';

    // Trim any leading backslashes
    var fromStart = 0;
    for (; fromStart < from.length; ++fromStart) {
      if (from.charCodeAt(fromStart) !== 92/*\*/)
        break;
    }
    // Trim trailing backslashes (applicable to UNC paths only)
    var fromEnd = from.length;
    for (; fromEnd - 1 > fromStart; --fromEnd) {
      if (from.charCodeAt(fromEnd - 1) !== 92/*\*/)
        break;
    }
    var fromLen = (fromEnd - fromStart);

    // Trim any leading backslashes
    var toStart = 0;
    for (; toStart < to.length; ++toStart) {
      if (to.charCodeAt(toStart) !== 92/*\*/)
        break;
    }
    // Trim trailing backslashes (applicable to UNC paths only)
    var toEnd = to.length;
    for (; toEnd - 1 > toStart; --toEnd) {
      if (to.charCodeAt(toEnd - 1) !== 92/*\*/)
        break;
    }
    var toLen = (toEnd - toStart);

    // Compare paths to find the longest common path from root
    var length = (fromLen < toLen ? fromLen : toLen);
    var lastCommonSep = -1;
    var i = 0;
    for (; i <= length; ++i) {
      if (i === length) {
        if (toLen > length) {
          if (to.charCodeAt(toStart + i) === 92/*\*/) {
            // We get here if `from` is the exact base path for `to`.
            // For example: from='C:\\foo\\bar'; to='C:\\foo\\bar\\baz'
            return toOrig.slice(toStart + i + 1);
          } else if (i === 2) {
            // We get here if `from` is the device root.
            // For example: from='C:\\'; to='C:\\foo'
            return toOrig.slice(toStart + i);
          }
        }
        if (fromLen > length) {
          if (from.charCodeAt(fromStart + i) === 92/*\*/) {
            // We get here if `to` is the exact base path for `from`.
            // For example: from='C:\\foo\\bar'; to='C:\\foo'
            lastCommonSep = i;
          } else if (i === 2) {
            // We get here if `to` is the device root.
            // For example: from='C:\\foo\\bar'; to='C:\\'
            lastCommonSep = 3;
          }
        }
        break;
      }
      var fromCode = from.charCodeAt(fromStart + i);
      var toCode = to.charCodeAt(toStart + i);
      if (fromCode !== toCode)
        break;
      else if (fromCode === 92/*\*/)
        lastCommonSep = i;
    }

    // We found a mismatch before the first common path separator was seen, so
    // return the original `to`.
    if (i !== length && lastCommonSep === -1) {
      return toOrig;
    }

    var out = '';
    if (lastCommonSep === -1)
      lastCommonSep = 0;
    // Generate the relative path based on the path difference between `to` and
    // `from`
    for (i = fromStart + lastCommonSep + 1; i <= fromEnd; ++i) {
      if (i === fromEnd || from.charCodeAt(i) === 92/*\*/) {
        if (out.length === 0)
          out += '..';
        else
          out += '\\..';
      }
    }

    // Lastly, append the rest of the destination (`to`) path that comes after
    // the common path parts
    if (out.length > 0)
      return out + toOrig.slice(toStart + lastCommonSep, toEnd);
    else {
      toStart += lastCommonSep;
      if (toOrig.charCodeAt(toStart) === 92/*\*/)
        ++toStart;
      return toOrig.slice(toStart, toEnd);
    }
  },


  _makeLong: function _makeLong(path) {
    // Note: this will *probably* throw somewhere.
    if (typeof path !== 'string')
      return path;

    if (path.length === 0) {
      return '';
    }

    const resolvedPath = win32.resolve(path);

    if (resolvedPath.length >= 3) {
      var code = resolvedPath.charCodeAt(0);
      if (code === 92/*\*/) {
        // Possible UNC root

        if (resolvedPath.charCodeAt(1) === 92/*\*/) {
          code = resolvedPath.charCodeAt(2);
          if (code !== 63/*?*/ && code !== 46/*.*/) {
            // Matched non-long UNC root, convert the path to a long UNC path
            return '\\\\?\\UNC\\' + resolvedPath.slice(2);
          }
        }
      } else if ((code >= 65/*A*/ && code <= 90/*Z*/) ||
                 (code >= 97/*a*/ && code <= 122/*z*/)) {
        // Possible device root

        if (resolvedPath.charCodeAt(1) === 58/*:*/ &&
            resolvedPath.charCodeAt(2) === 92/*\*/) {
          // Matched device root, convert the path to a long UNC path
          return '\\\\?\\' + resolvedPath;
        }
      }
    }

    return path;
  },


  dirname: function dirname(path) {
    assertPath(path);
    const len = path.length;
    if (len === 0)
      return '.';
    var rootEnd = -1;
    var end = -1;
    var matchedSlash = true;
    var offset = 0;
    var code = path.charCodeAt(0);

    // Try to match a root
    if (len > 1) {
      if (code === 47/*/*/ || code === 92/*\*/) {
        // Possible UNC root

        rootEnd = offset = 1;

        code = path.charCodeAt(1);
        if (code === 47/*/*/ || code === 92/*\*/) {
          // Matched double path separator at beginning
          var j = 2;
          var last = j;
          // Match 1 or more non-path separators
          for (; j < len; ++j) {
            code = path.charCodeAt(j);
            if (code === 47/*/*/ || code === 92/*\*/)
              break;
          }
          if (j < len && j !== last) {
            // Matched!
            last = j;
            // Match 1 or more path separators
            for (; j < len; ++j) {
              code = path.charCodeAt(j);
              if (code !== 47/*/*/ && code !== 92/*\*/)
                break;
            }
            if (j < len && j !== last) {
              // Matched!
              last = j;
              // Match 1 or more non-path separators
              for (; j < len; ++j) {
                code = path.charCodeAt(j);
                if (code === 47/*/*/ || code === 92/*\*/)
                  break;
              }
              if (j === len) {
                // We matched a UNC root only
                return path;
              }
              if (j !== last) {
                // We matched a UNC root with leftovers

                // Offset by 1 to include the separator after the UNC root to
                // treat it as a "normal root" on top of a (UNC) root
                rootEnd = offset = j + 1;
              }
            }
          }
        }
      } else if ((code >= 65/*A*/ && code <= 90/*Z*/) ||
                 (code >= 97/*a*/ && code <= 122/*z*/)) {
        // Possible device root

        code = path.charCodeAt(1);
        if (path.charCodeAt(1) === 58/*:*/) {
          rootEnd = offset = 2;
          if (len > 2) {
            code = path.charCodeAt(2);
            if (code === 47/*/*/ || code === 92/*\*/)
              rootEnd = offset = 3;
          }
        }
      }
    } else if (code === 47/*/*/ || code === 92/*\*/) {
      // `path` contains just a path separator, exit early to avoid
      // unnecessary work
      return path;
    }

    for (var i = len - 1; i >= offset; --i) {
      code = path.charCodeAt(i);
      if (code === 47/*/*/ || code === 92/*\*/) {
        if (!matchedSlash) {
          end = i;
          break;
        }
      } else {
        // We saw the first non-path separator
        matchedSlash = false;
      }
    }

    if (end === -1) {
      if (rootEnd === -1)
        return '.';
      else
        end = rootEnd;
    }
    return path.slice(0, end);
  },


  basename: function basename(path, ext) {
    if (ext !== undefined && typeof ext !== 'string')
      throw new TypeError('"ext" argument must be a string');
    assertPath(path);
    var start = 0;
    var end = -1;
    var matchedSlash = true;
    var i;

    // Check for a drive letter prefix so as not to mistake the following
    // path separator as an extra separator at the end of the path that can be
    // disregarded
    if (path.length >= 2) {
      const drive = path.charCodeAt(0);
      if ((drive >= 65/*A*/ && drive <= 90/*Z*/) ||
          (drive >= 97/*a*/ && drive <= 122/*z*/)) {
        if (path.charCodeAt(1) === 58/*:*/)
          start = 2;
      }
    }

    if (ext !== undefined && ext.length > 0 && ext.length <= path.length) {
      if (ext.length === path.length && ext === path)
        return '';
      var extIdx = ext.length - 1;
      var firstNonSlashEnd = -1;
      for (i = path.length - 1; i >= start; --i) {
        const code = path.charCodeAt(i);
        if (code === 47/*/*/ || code === 92/*\*/) {
          // If we reached a path separator that was not part of a set of path
          // separators at the end of the string, stop now
          if (!matchedSlash) {
            start = i + 1;
            break;
          }
        } else {
          if (firstNonSlashEnd === -1) {
            // We saw the first non-path separator, remember this index in case
            // we need it if the extension ends up not matching
            matchedSlash = false;
            firstNonSlashEnd = i + 1;
          }
          if (extIdx >= 0) {
            // Try to match the explicit extension
            if (code === ext.charCodeAt(extIdx)) {
              if (--extIdx === -1) {
                // We matched the extension, so mark this as the end of our path
                // component
                end = i;
              }
            } else {
              // Extension does not match, so our result is the entire path
              // component
              extIdx = -1;
              end = firstNonSlashEnd;
            }
          }
        }
      }

      if (start === end)
        end = firstNonSlashEnd;
      else if (end === -1)
        end = path.length;
      return path.slice(start, end);
    } else {
      for (i = path.length - 1; i >= start; --i) {
        const code = path.charCodeAt(i);
        if (code === 47/*/*/ || code === 92/*\*/) {
          // If we reached a path separator that was not part of a set of path
          // separators at the end of the string, stop now
          if (!matchedSlash) {
            start = i + 1;
            break;
          }
        } else if (end === -1) {
          // We saw the first non-path separator, mark this as the end of our
          // path component
          matchedSlash = false;
          end = i + 1;
        }
      }

      if (end === -1)
        return '';
      return path.slice(start, end);
    }
  },


  extname: function extname(path) {
    assertPath(path);
    var start = 0;
    var startDot = -1;
    var startPart = 0;
    var end = -1;
    var matchedSlash = true;
    // Track the state of characters (if any) we see before our first dot and
    // after any path separator we find
    var preDotState = 0;

    // Check for a drive letter prefix so as not to mistake the following
    // path separator as an extra separator at the end of the path that can be
    // disregarded
    if (path.length >= 2) {
      const code = path.charCodeAt(0);
      if (path.charCodeAt(1) === 58/*:*/ &&
          ((code >= 65/*A*/ && code <= 90/*Z*/) ||
           (code >= 97/*a*/ && code <= 122/*z*/))) {
        start = startPart = 2;
      }
    }

    for (var i = path.length - 1; i >= start; --i) {
      const code = path.charCodeAt(i);
      if (code === 47/*/*/ || code === 92/*\*/) {
        // If we reached a path separator that was not part of a set of path
        // separators at the end of the string, stop now
        if (!matchedSlash) {
          startPart = i + 1;
          break;
        }
        continue;
      }
      if (end === -1) {
        // We saw the first non-path separator, mark this as the end of our
        // extension
        matchedSlash = false;
        end = i + 1;
      }
      if (code === 46/*.*/) {
        // If this is our first dot, mark it as the start of our extension
        if (startDot === -1)
          startDot = i;
        else if (preDotState !== 1)
          preDotState = 1;
      } else if (startDot !== -1) {
        // We saw a non-dot and non-path separator before our dot, so we should
        // have a good chance at having a non-empty extension
        preDotState = -1;
      }
    }

    if (startDot === -1 ||
        end === -1 ||
        // We saw a non-dot character immediately before the dot
        preDotState === 0 ||
        // The (right-most) trimmed path component is exactly '..'
        (preDotState === 1 &&
         startDot === end - 1 &&
         startDot === startPart + 1)) {
      return '';
    }
    return path.slice(startDot, end);
  },


  format: function format(pathObject) {
    if (pathObject === null || typeof pathObject !== 'object') {
      throw new TypeError(
        `Parameter "pathObject" must be an object, not ${typeof pathObject}`
      );
    }
    return _format('\\', pathObject);
  },


  parse: function parse(path) {
    assertPath(path);

    var ret = { root: '', dir: '', base: '', ext: '', name: '' };
    if (path.length === 0)
      return ret;

    var len = path.length;
    var rootEnd = 0;
    var code = path.charCodeAt(0);

    // Try to match a root
    if (len > 1) {
      if (code === 47/*/*/ || code === 92/*\*/) {
        // Possible UNC root

        code = path.charCodeAt(1);
        rootEnd = 1;
        if (code === 47/*/*/ || code === 92/*\*/) {
          // Matched double path separator at beginning
          var j = 2;
          var last = j;
          // Match 1 or more non-path separators
          for (; j < len; ++j) {
            code = path.charCodeAt(j);
            if (code === 47/*/*/ || code === 92/*\*/)
              break;
          }
          if (j < len && j !== last) {
            // Matched!
            last = j;
            // Match 1 or more path separators
            for (; j < len; ++j) {
              code = path.charCodeAt(j);
              if (code !== 47/*/*/ && code !== 92/*\*/)
                break;
            }
            if (j < len && j !== last) {
              // Matched!
              last = j;
              // Match 1 or more non-path separators
              for (; j < len; ++j) {
                code = path.charCodeAt(j);
                if (code === 47/*/*/ || code === 92/*\*/)
                  break;
              }
              if (j === len) {
                // We matched a UNC root only

                rootEnd = j;
              } else if (j !== last) {
                // We matched a UNC root with leftovers

                rootEnd = j + 1;
              }
            }
          }
        }
      } else if ((code >= 65/*A*/ && code <= 90/*Z*/) ||
                 (code >= 97/*a*/ && code <= 122/*z*/)) {
        // Possible device root

        code = path.charCodeAt(1);
        if (path.charCodeAt(1) === 58/*:*/) {
          rootEnd = 2;
          if (len > 2) {
            code = path.charCodeAt(2);
            if (code === 47/*/*/ || code === 92/*\*/) {
              if (len === 3) {
                // `path` contains just a drive root, exit early to avoid
                // unnecessary work
                ret.root = ret.dir = path;
                return ret;
              }
              rootEnd = 3;
            }
          } else {
            // `path` contains just a drive root, exit early to avoid
            // unnecessary work
            ret.root = ret.dir = path;
            return ret;
          }
        }
      }
    } else if (code === 47/*/*/ || code === 92/*\*/) {
      // `path` contains just a path separator, exit early to avoid
      // unnecessary work
      ret.root = ret.dir = path;
      return ret;
    }

    if (rootEnd > 0)
      ret.root = path.slice(0, rootEnd);

    var startDot = -1;
    var startPart = rootEnd;
    var end = -1;
    var matchedSlash = true;
    var i = path.length - 1;

    // Track the state of characters (if any) we see before our first dot and
    // after any path separator we find
    var preDotState = 0;

    // Get non-dir info
    for (; i >= rootEnd; --i) {
      code = path.charCodeAt(i);
      if (code === 47/*/*/ || code === 92/*\*/) {
        // If we reached a path separator that was not part of a set of path
        // separators at the end of the string, stop now
        if (!matchedSlash) {
          startPart = i + 1;
          break;
        }
        continue;
      }
      if (end === -1) {
        // We saw the first non-path separator, mark this as the end of our
        // extension
        matchedSlash = false;
        end = i + 1;
      }
      if (code === 46/*.*/) {
        // If this is our first dot, mark it as the start of our extension
        if (startDot === -1)
          startDot = i;
        else if (preDotState !== 1)
          preDotState = 1;
      } else if (startDot !== -1) {
        // We saw a non-dot and non-path separator before our dot, so we should
        // have a good chance at having a non-empty extension
        preDotState = -1;
      }
    }

    if (startDot === -1 ||
        end === -1 ||
        // We saw a non-dot character immediately before the dot
        preDotState === 0 ||
        // The (right-most) trimmed path component is exactly '..'
        (preDotState === 1 &&
         startDot === end - 1 &&
         startDot === startPart + 1)) {
      if (end !== -1) {
        ret.base = ret.name = path.slice(startPart, end);
      }
    } else {
      ret.name = path.slice(startPart, startDot);
      ret.base = path.slice(startPart, end);
      ret.ext = path.slice(startDot, end);
    }

    // If the directory is the root, use the entire root as the `dir` including
    // the trailing slash if any (`C:\abc` -> `C:\`). Otherwise, strip out the
    // trailing slash (`C:\abc\def` -> `C:\abc`).
    if (startPart > 0 && startPart !== rootEnd)
      ret.dir = path.slice(0, startPart - 1);
    else
      ret.dir = ret.root;

    return ret;
  },


  sep: '\\',
  delimiter: ';',
  win32: null,
  posix: null
};


const posix = {
  // path.resolve([from ...], to)
  resolve: function resolve() {
    var resolvedPath = '';
    var resolvedAbsolute = false;
    var cwd;

    for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
      var path;
      if (i >= 0)
        path = arguments[i];
      else {
        if (cwd === undefined)
          cwd = process.cwd();
        path = cwd;
      }

      assertPath(path);

      // Skip empty entries
      if (path.length === 0) {
        continue;
      }

      resolvedPath = path + '/' + resolvedPath;
      resolvedAbsolute = path.charCodeAt(0) === 47/*/*/;
    }

    // At this point the path should be resolved to a full absolute path, but
    // handle relative paths to be safe (might happen when process.cwd() fails)

    // Normalize the path
    resolvedPath = normalizeStringPosix(resolvedPath, !resolvedAbsolute);

    if (resolvedAbsolute) {
      if (resolvedPath.length > 0)
        return '/' + resolvedPath;
      else
        return '/';
    } else if (resolvedPath.length > 0) {
      return resolvedPath;
    } else {
      return '.';
    }
  },


  normalize: function normalize(path) {
    assertPath(path);

    if (path.length === 0)
      return '.';

    const isAbsolute = path.charCodeAt(0) === 47/*/*/;
    const trailingSeparator = path.charCodeAt(path.length - 1) === 47/*/*/;

    // Normalize the path
    path = normalizeStringPosix(path, !isAbsolute);

    if (path.length === 0 && !isAbsolute)
      path = '.';
    if (path.length > 0 && trailingSeparator)
      path += '/';

    if (isAbsolute)
      return '/' + path;
    return path;
  },


  isAbsolute: function isAbsolute(path) {
    assertPath(path);
    return path.length > 0 && path.charCodeAt(0) === 47/*/*/;
  },


  join: function join() {
    if (arguments.length === 0)
      return '.';
    var joined;
    for (var i = 0; i < arguments.length; ++i) {
      var arg = arguments[i];
      assertPath(arg);
      if (arg.length > 0) {
        if (joined === undefined)
          joined = arg;
        else
          joined += '/' + arg;
      }
    }
    if (joined === undefined)
      return '.';
    return posix.normalize(joined);
  },


  relative: function relative(from, to) {
    assertPath(from);
    assertPath(to);

    if (from === to)
      return '';

    from = posix.resolve(from);
    to = posix.resolve(to);

    if (from === to)
      return '';

    // Trim any leading backslashes
    var fromStart = 1;
    for (; fromStart < from.length; ++fromStart) {
      if (from.charCodeAt(fromStart) !== 47/*/*/)
        break;
    }
    var fromEnd = from.length;
    var fromLen = (fromEnd - fromStart);

    // Trim any leading backslashes
    var toStart = 1;
    for (; toStart < to.length; ++toStart) {
      if (to.charCodeAt(toStart) !== 47/*/*/)
        break;
    }
    var toEnd = to.length;
    var toLen = (toEnd - toStart);

    // Compare paths to find the longest common path from root
    var length = (fromLen < toLen ? fromLen : toLen);
    var lastCommonSep = -1;
    var i = 0;
    for (; i <= length; ++i) {
      if (i === length) {
        if (toLen > length) {
          if (to.charCodeAt(toStart + i) === 47/*/*/) {
            // We get here if `from` is the exact base path for `to`.
            // For example: from='/foo/bar'; to='/foo/bar/baz'
            return to.slice(toStart + i + 1);
          } else if (i === 0) {
            // We get here if `from` is the root
            // For example: from='/'; to='/foo'
            return to.slice(toStart + i);
          }
        } else if (fromLen > length) {
          if (from.charCodeAt(fromStart + i) === 47/*/*/) {
            // We get here if `to` is the exact base path for `from`.
            // For example: from='/foo/bar/baz'; to='/foo/bar'
            lastCommonSep = i;
          } else if (i === 0) {
            // We get here if `to` is the root.
            // For example: from='/foo'; to='/'
            lastCommonSep = 0;
          }
        }
        break;
      }
      var fromCode = from.charCodeAt(fromStart + i);
      var toCode = to.charCodeAt(toStart + i);
      if (fromCode !== toCode)
        break;
      else if (fromCode === 47/*/*/)
        lastCommonSep = i;
    }

    var out = '';
    // Generate the relative path based on the path difference between `to`
    // and `from`
    for (i = fromStart + lastCommonSep + 1; i <= fromEnd; ++i) {
      if (i === fromEnd || from.charCodeAt(i) === 47/*/*/) {
        if (out.length === 0)
          out += '..';
        else
          out += '/..';
      }
    }

    // Lastly, append the rest of the destination (`to`) path that comes after
    // the common path parts
    if (out.length > 0)
      return out + to.slice(toStart + lastCommonSep);
    else {
      toStart += lastCommonSep;
      if (to.charCodeAt(toStart) === 47/*/*/)
        ++toStart;
      return to.slice(toStart);
    }
  },


  _makeLong: function _makeLong(path) {
    return path;
  },


  dirname: function dirname(path) {
    assertPath(path);
    if (path.length === 0)
      return '.';
    var code = path.charCodeAt(0);
    var hasRoot = (code === 47/*/*/);
    var end = -1;
    var matchedSlash = true;
    for (var i = path.length - 1; i >= 1; --i) {
      code = path.charCodeAt(i);
      if (code === 47/*/*/) {
        if (!matchedSlash) {
          end = i;
          break;
        }
      } else {
        // We saw the first non-path separator
        matchedSlash = false;
      }
    }

    if (end === -1)
      return hasRoot ? '/' : '.';
    if (hasRoot && end === 1)
      return '//';
    return path.slice(0, end);
  },


  basename: function basename(path, ext) {
    if (ext !== undefined && typeof ext !== 'string')
      throw new TypeError('"ext" argument must be a string');
    assertPath(path);

    var start = 0;
    var end = -1;
    var matchedSlash = true;
    var i;

    if (ext !== undefined && ext.length > 0 && ext.length <= path.length) {
      if (ext.length === path.length && ext === path)
        return '';
      var extIdx = ext.length - 1;
      var firstNonSlashEnd = -1;
      for (i = path.length - 1; i >= 0; --i) {
        const code = path.charCodeAt(i);
        if (code === 47/*/*/) {
          // If we reached a path separator that was not part of a set of path
          // separators at the end of the string, stop now
          if (!matchedSlash) {
            start = i + 1;
            break;
          }
        } else {
          if (firstNonSlashEnd === -1) {
            // We saw the first non-path separator, remember this index in case
            // we need it if the extension ends up not matching
            matchedSlash = false;
            firstNonSlashEnd = i + 1;
          }
          if (extIdx >= 0) {
            // Try to match the explicit extension
            if (code === ext.charCodeAt(extIdx)) {
              if (--extIdx === -1) {
                // We matched the extension, so mark this as the end of our path
                // component
                end = i;
              }
            } else {
              // Extension does not match, so our result is the entire path
              // component
              extIdx = -1;
              end = firstNonSlashEnd;
            }
          }
        }
      }

      if (start === end)
        end = firstNonSlashEnd;
      else if (end === -1)
        end = path.length;
      return path.slice(start, end);
    } else {
      for (i = path.length - 1; i >= 0; --i) {
        if (path.charCodeAt(i) === 47/*/*/) {
          // If we reached a path separator that was not part of a set of path
          // separators at the end of the string, stop now
          if (!matchedSlash) {
            start = i + 1;
            break;
          }
        } else if (end === -1) {
          // We saw the first non-path separator, mark this as the end of our
          // path component
          matchedSlash = false;
          end = i + 1;
        }
      }

      if (end === -1)
        return '';
      return path.slice(start, end);
    }
  },


  extname: function extname(path) {
    assertPath(path);
    var startDot = -1;
    var startPart = 0;
    var end = -1;
    var matchedSlash = true;
    // Track the state of characters (if any) we see before our first dot and
    // after any path separator we find
    var preDotState = 0;
    for (var i = path.length - 1; i >= 0; --i) {
      const code = path.charCodeAt(i);
      if (code === 47/*/*/) {
        // If we reached a path separator that was not part of a set of path
        // separators at the end of the string, stop now
        if (!matchedSlash) {
          startPart = i + 1;
          break;
        }
        continue;
      }
      if (end === -1) {
        // We saw the first non-path separator, mark this as the end of our
        // extension
        matchedSlash = false;
        end = i + 1;
      }
      if (code === 46/*.*/) {
        // If this is our first dot, mark it as the start of our extension
        if (startDot === -1)
          startDot = i;
        else if (preDotState !== 1)
          preDotState = 1;
      } else if (startDot !== -1) {
        // We saw a non-dot and non-path separator before our dot, so we should
        // have a good chance at having a non-empty extension
        preDotState = -1;
      }
    }

    if (startDot === -1 ||
        end === -1 ||
        // We saw a non-dot character immediately before the dot
        preDotState === 0 ||
        // The (right-most) trimmed path component is exactly '..'
        (preDotState === 1 &&
         startDot === end - 1 &&
         startDot === startPart + 1)) {
      return '';
    }
    return path.slice(startDot, end);
  },


  format: function format(pathObject) {
    if (pathObject === null || typeof pathObject !== 'object') {
      throw new TypeError(
        `Parameter "pathObject" must be an object, not ${typeof pathObject}`
      );
    }
    return _format('/', pathObject);
  },


  parse: function parse(path) {
    assertPath(path);

    var ret = { root: '', dir: '', base: '', ext: '', name: '' };
    if (path.length === 0)
      return ret;
    var code = path.charCodeAt(0);
    var isAbsolute = (code === 47/*/*/);
    var start;
    if (isAbsolute) {
      ret.root = '/';
      start = 1;
    } else {
      start = 0;
    }
    var startDot = -1;
    var startPart = 0;
    var end = -1;
    var matchedSlash = true;
    var i = path.length - 1;

    // Track the state of characters (if any) we see before our first dot and
    // after any path separator we find
    var preDotState = 0;

    // Get non-dir info
    for (; i >= start; --i) {
      code = path.charCodeAt(i);
      if (code === 47/*/*/) {
        // If we reached a path separator that was not part of a set of path
        // separators at the end of the string, stop now
        if (!matchedSlash) {
          startPart = i + 1;
          break;
        }
        continue;
      }
      if (end === -1) {
        // We saw the first non-path separator, mark this as the end of our
        // extension
        matchedSlash = false;
        end = i + 1;
      }
      if (code === 46/*.*/) {
        // If this is our first dot, mark it as the start of our extension
        if (startDot === -1)
          startDot = i;
        else if (preDotState !== 1)
          preDotState = 1;
      } else if (startDot !== -1) {
        // We saw a non-dot and non-path separator before our dot, so we should
        // have a good chance at having a non-empty extension
        preDotState = -1;
      }
    }

    if (startDot === -1 ||
        end === -1 ||
        // We saw a non-dot character immediately before the dot
        preDotState === 0 ||
        // The (right-most) trimmed path component is exactly '..'
        (preDotState === 1 &&
         startDot === end - 1 &&
         startDot === startPart + 1)) {
      if (end !== -1) {
        if (startPart === 0 && isAbsolute)
          ret.base = ret.name = path.slice(1, end);
        else
          ret.base = ret.name = path.slice(startPart, end);
      }
    } else {
      if (startPart === 0 && isAbsolute) {
        ret.name = path.slice(1, startDot);
        ret.base = path.slice(1, end);
      } else {
        ret.name = path.slice(startPart, startDot);
        ret.base = path.slice(startPart, end);
      }
      ret.ext = path.slice(startDot, end);
    }

    if (startPart > 0)
      ret.dir = path.slice(0, startPart - 1);
    else if (isAbsolute)
      ret.dir = '/';

    return ret;
  },


  sep: '/',
  delimiter: ':',
  win32: null,
  posix: null
};


posix.win32 = win32.win32 = win32;
posix.posix = win32.posix = posix;

// add process.platform check if used with browser web extensions

//if (process.platform === 'win32')
  module.exports = win32;
//else
//  module.exports = posix;





/***/ }),
/* 2 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


const BACKUP_DIR = "twBackups";

// At the moment it always returns win32
// startup() function needs to fix this
const tempPath = __webpack_require__(1);
const actions = __webpack_require__(0);

var path,
    osInfo;

function getOsInfo(cb) {
	browser.runtime.getPlatformInfo().then((info) => {
		cb(info);
	})
};

getOsInfo((info) => {
    osInfo = info;
	if (info.os === "win") {
		path = tempPath;
	} else {
		path = tempPath.posix;
	}
});

// Derived from the $tw.Tiddler() ... but simplified the structure
// Facets are used to manipulate store objects.
// usage: facet = new Facet(otherFacet, {key:value}, {});
var Facet = function ( /* [fields,] fields */ ) {
	this.id = "!§$%&";
	this.fields = Object.create(null);
	for (var c = 0; c < arguments.length; c++) {
		var arg = arguments[c] || {},
			src = (arg.id === "!§$%&") ? arg.fields : arg;
		for (var t in src) {
			if (src[t] === undefined || src[t] === null) {
				if (t in this.fields) {
					delete this.fields[t]; // If we get a field that's undefined, delete any previous field value
				}
			} else {
				// Parse the field with the associated field module (if any)
				var value = src[t];
				// Freeze the field to keep it immutable
				if (value != null && typeof value === "object") {
					Object.freeze(value);
				}
				this.fields[t] = value;
			}
		}
	}
	// Freeze the tiddler against modification
	Object.freeze(this.fields);
	Object.freeze(this);
};

/*
When first loaded, initialize the page action for all tabs.
*/
var gettingAllTabs = browser.tabs.query({});

gettingAllTabs.then((tabs) => {
//	console.log("tabs: ", tabs);
	for (let tab of tabs) {
		actions.initializePageAction(tab);
	}
});

//
//
// Tab Actions
//
//
browser.tabs.onActivated.addListener((tab) => {
	var x = tab
	x.id = tab.tabId;

	actions.updatePageAction(x);
	//    console.log("activated:", tab)
});

/*
Each time a tab is updated, reset the page action for that tab.
*/
browser.tabs.onUpdated.addListener((id, changeInfo, tab) => {
	tab.id = id;
	actions.updatePageAction(tab);
	//  console.log("update triggered:", tab)
});

/*
Toggle CSS when the page action is clicked.
*/
browser.pageAction.onClicked.addListener((tab) => {
	actions.toggleEnableBackups(tab);
});


//
//
// Bacground main() listener!!
//
//
browser.runtime.onMessage.addListener(handleMessages);

// should be straight forward and simple.
// uses the following  construction to respond back to the contentScript:
// https://developer.mozilla.org/en-US/Add-ons/WebExtensions/API/runtime/onMessage#Sending_an_asynchronous_response_using_a_Promise
async function handleMessages(message, sender, sendResponse) {
	// Update tab icon, when main-popup save is clicked
	if (message.msg === "updateBackupEnabled") {
		return handleUpdateTabIcon(message);
	}

	// Standard save-wiki message from contentScript
	if (message.msg === "save-wiki") {
		return handleSaveWiki(message);
	}

	// Check tabs, if TW file URL is open already.
	if (message.msg === "checkUrlConflict") {
		return checkUrlConflict(message);
	}
}

// Check, if there is an other tab, with the same URL open already?
async function checkUrlConflict(message) {
	var count = 0,
		tabs = await browser.tabs.query({url:"file://*/*"});

	for (let tab of tabs) {
		if (tab.url === message.url) {
			count += 1;
		}
	}
	return (count > 1);
}

async function handleUpdateTabIcon(message) {
	function updateTab(tabs) {
		if (tabs.length > 0) {
			actions.messageUpdatePageAction(tabs[0], message);
		}
		return {};
	}

	function onError(error) {
		console.log(`Error: ${error}`);
	}

	var gettingActive = browser.tabs.query({
		currentWindow: true,
		active: true
	});
	gettingActive.then(updateTab, onError);
}


/*
// The sequence can be calculated like this:
// seq = 2^set−1 + j * 2^set, j = 0, 1, 2, 3, 4

console.clear();

var max = 2;
var set = 11;

for (var j = 0; j < 12; j++) {
    var seq = Math.pow(2,set-1) + j * Math.pow(2,set);
    console.log(seq);
}
// File 11 -> seq: 1024, 3072, 5120, 7168, ...
// File 5 -> 16, 48, 80, 112, ..
*/

// Find file index, if counter is known.
function getNextChar(count, max) {
	var char = "a";
	var cnt = count - max;

	if (count <= max) {
		char = String.fromCharCode(64 + count);
	} else {
		for (var i = 0; i < max; i++) {
			if ((cnt - Math.pow(2, i)) % Math.pow(2, i + 1) === 0) {
				char = String.fromCharCode(65 + i);
				break;
			}
		}
		char = (char === "a") ? String.fromCharCode(64 + max) : char
	}
	//	console.log(char);
	return char;
}

async function createBackup(message) {
	let items,
		itemId,
		results;

	// Backup using "Tower of Hanoi" backup schema
	items = await browser.storage.local.get()

	if (items) {
		let stash = new Facet(items[message.path]) || {},
			counter = stash.fields.counter || 1,
			backupEnabled = items.backupEnabled || false,
			backupdir = items.backupdir || BACKUP_DIR,
			max = items.numberOfBackups || 5,
			nextChar = getNextChar(counter, max);

		// imo this won't happen, but who knows.
		if (counter >= Number.MAX_SAFE_INTEGER) counter = max + 1;

		if (backupEnabled) {
			var pathX = path.parse(message.path);
			var nameX = path.join(message.subdir, backupdir, pathX.base, pathX.name + "(" + nextChar + ")" + pathX.ext);

			itemId = await browser.downloads.download({
				url: URL.createObjectURL(new Blob([message.txt], {type: "text/plain"})),
				filename: nameX,
				conflictAction: "overwrite"
			})

			if (itemId) {
				results = await browser.downloads.search({id: itemId});
			} // if itemId

			// Store the config elements per tab.
			counter = counter + 1;

			browser.storage.local.set({
				[message.path]: new Facet(stash, {
					counter: counter
				})
			})
		} // if backupEnabled
	} // if items
};

async function downloadWiki(message) {
	let itemId,
		results,
		response = {};

	// get info from local storage.
	let items = await browser.storage.local.get(),
		stash = new Facet(items[message.path]) || {};

//	let test = path.join(message.subdir, path.basename(message.path));

	// needed, for a roundtrip, to set up the right save directory.
	itemId = await browser.downloads.download({
		url: URL.createObjectURL(new Blob([message.txt], { type: "text/plain"})),
		filename: path.join(message.subdir, path.basename(message.path)),
		conflictAction: "overwrite"
	});

	if (itemId) {
		results = await browser.downloads.search({id: itemId});
	}

	// Check, if download dir is the same.
	if (!(message.path === results[0].filename)) {
		return {relPath: "",
				downloadWikiError: "Wrong Download Directory!",
				downloadWikiInfo: results[0]};
	}

	if (results) {
		// Create a backup
		await createBackup(message);
	}

	response.relPath = message.subdir;
	return response;
} // downloadWiki()

async function downloadDialog(message) {
	let itemId,
		results,
		response = {};

	itemId = await browser.downloads.download({
		url: URL.createObjectURL(new Blob([message.txt], {type: "text/plain"})),
		filename: path.basename(message.path),
		conflictAction: "overwrite",
		saveAs: true
	})

	if (itemId) {
		results = await browser.downloads.search({id: itemId});
	}

	if (results) {
		// check relative path
		//console.log(results);
		response = await prepareAndOpenNewTab(results[0]);
	}
	return response;
} // downloadDialog()

async function createBeakon(message) {
	var itemId,
		results,
		savedAs,
		response = {},
		template = `This file was created by "file-backups" browser AddOn,<br/>
to find out the default position, to save your TiddlyWiki.<br/>
You can delete it if you want. It will be recreated, if needed.<br/>
`;

	itemId = await browser.downloads.download({
		url: URL.createObjectURL(new Blob([template], {type: "text/plain"})),
		filename: "beakon.tmp.html",
		conflictAction: "overwrite"
	});

	if (itemId) {
		results = await browser.downloads.search({id: itemId});
	}

	if (results) {
		let rejectPath = false;
		let defaultEl = path.parse(results[0].filename);
		defaultEl.base = "";
		defaultEl.name = "";
		defaultEl.ext = "";
		let defaultDir = path.format(defaultEl);

		let relPath = path.relative(results[0].filename, path.parse(message.path).dir);

		if (path.isAbsolute(relPath)) rejectPath = true;

		let y = relPath.split(path.sep);

		savedAs = path.parse(results[0].filename);
		y.shift(); // remove the ".."

		if (y[0] === ".." || rejectPath) {
			response.relPath = ""; // problem .. path not valid
			response.beakonError = "Path is outside browser donwload directory!";
			response.beakonInfo = results[0];
		} else {
			response.relPath = (y.length > 0) ? y.join(path.sep) : "." + path.sep;
		}

		// save the subdir info
		let items = await browser.storage.local.get();

		if (items) {
			let stash = new Facet(items[message.path]) || {};

			// Save config
			browser.storage.local.set({
				defaultDir: defaultDir,
			[message.path]: new Facet(stash, {subdir: response.relPath})
			});
		} // if items

		// TODO should be obsolete now
		// notify(savedAs, y);

	} // if results

	return response;
} // createBeakon()

function timeout(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

async function prepareAndOpenNewTab(dlInfo) {
	let items = await browser.storage.local.get(),
		stash = new Facet(items[dlInfo.filename]) || {},
		filename = dlInfo.filename,
		rejectPath;

	let elem = path.parse(dlInfo.filename);
	elem.base = "";
	elem.name = "";
	elem.ext = "";
	let newDir = path.format(elem);

	let rel = path.relative(items.defaultDir, newDir);
	if (path.isAbsolute(rel)) rejectPath = true;

	if (rejectPath === true) {
		rel = "";
	} else if (rel === "") { // TODO check path library, imo bug on windows!
		rel = "." + path.sep;
	}

	await browser.storage.local.set({
		[dlInfo.filename]: new Facet(stash, {subdir: rel})
	});

	//TDOO remove this hack!!!
	await timeout(1000);

	return await openNewWiki(dlInfo);
} // prepareAndOpenNewTab()

async function openNewWiki(dlInfo) {
	if (osInfo.os === "win") {
		var test = await browser.tabs.create({
			active: true,
			url: dlInfo.filename
		});
	} else {
		return {relPath: "",
				openNewTabError:"Please open your Wiki at:",
				openNewTabInfo: dlInfo};
	}
}

async function handleSaveWiki(message) {
	let allowBackup = false,
		test = path.parse(message.path),
		rel = path.relative(path.parse(message.path).dir, "Downloads"),
		response = {};

	var items = await browser.storage.local.get();

	if (items) {
		let stash = new Facet(items[message.path]) || {},
			subdir = stash.fields.subdir || null;

		message.subdir = (message.subdir) ? message.subdir : (subdir) ? subdir : null;

		if (message.subdir) {
			// normal download
			// everything is known, data from local storage is set.
			response = await downloadWiki(message);

			// check if browser download dir has been changed.
			if (response.relPath === "") {
				response = await downloadDialog(message);
			}
		} else if (message.saveas === "yes") {
			// save dialog
			response = await downloadDialog(message);
		} else {
			// 2 click save
			// we need to save temp(x).html to find out where the download directory is.
			// than save again
			response = await createBeakon(message);
			if (!response.relPath) {
				message.saveAs === "yes";
				response = await downloadDialog(message);
			} else {
				message.subdir = response.relPath;
				response = await downloadWiki(message);
			}
		}
	}
	// This one is important! sendResponse will be async. ContentScript expects it that way atm.
	return response; //{relPath: response};
};




/***/ }),
/* 3 */,
/* 4 */
/***/ (function(module, exports) {

// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };


/***/ })
/******/ ]);
