"use strict";

// Schema helpers for the backup-awareness layer (file-backups-tla / phase 1).
// Pure functions over the per-wiki stash object stored in browser.storage.local
// at items[<wiki-path>]. They produce a NEW stash with the rotation slot or
// milestone record added; callers persist the result via storage.local.set.
//
// Pure means: no shared mutable references between input and output. Callers
// may mutate the result without poisoning the input. Adversarial tests in
// test/backup-tracking.test.js verify this contract along with tolerance for
// hostile prior shapes (a regression net for future schema drift).
//
// Shape notes:
//   stash.rotation is an object keyed by slot letter (A, B, C, ...) the same
//   value used in the filename suffix. Each value is {ts, size, downloadId,
//   filename}. Re-recording the same slot overwrites the prior record so the
//   data stays live as the rotation cycles.
//
//   stash.milestones is an append-only array; entries are never modified.
//   lastMilestoneAt mirrors the timestamp of the NEWEST entry observed so
//   far. It is monotonic: an older-ts append (clock skew, multi-tab race)
//   does not regress it. The stale-milestone reminder reads it directly.

(function (root) {
	function pickEntry(e) {
		return {
			ts: e && e.ts,
			size: e && e.size,
			downloadId: e && e.downloadId,
			filename: e && e.filename
		};
	}

	function recordRotationSlot(stash, slot, meta) {
		var priorRot = stash && stash.rotation;
		var validPrior = priorRot && typeof priorRot === "object" && !Array.isArray(priorRot);
		var rotation = {};
		if (validPrior) {
			for (var k in priorRot) {
				if (Object.prototype.hasOwnProperty.call(priorRot, k)) {
					rotation[k] = pickEntry(priorRot[k]);
				}
			}
		}
		rotation[slot] = pickEntry(meta);
		return Object.assign({}, stash, {rotation: rotation});
	}

	// Milestone records carry label + description on top of the common fields so
	// a summary can be reconstructed without the wiki's $:/milestones tiddler.
	function pickMilestone(e) {
		return {
			ts: e && e.ts,
			size: e && e.size,
			downloadId: e && e.downloadId,
			filename: e && e.filename,
			label: e && e.label,
			description: e && e.description
		};
	}

	function recordMilestone(stash, meta) {
		var priorList = (stash && Array.isArray(stash.milestones)) ? stash.milestones : [];
		var milestones = priorList.map(pickMilestone);
		milestones.push(pickMilestone(meta));
		var prevLast = (stash && typeof stash.lastMilestoneAt === "number") ? stash.lastMilestoneAt : 0;
		var nextLast = (typeof meta.ts === "number" && meta.ts > prevLast) ? meta.ts : prevLast;
		return Object.assign({}, stash, {
			milestones: milestones,
			lastMilestoneAt: nextLast
		});
	}

	// Resolve the effective limit for one wiki + one kind (phase 2).
	//
	// kind is a per-wiki field name: "remindAfterDays", "fileCountLimit",
	// or "sizeLimitMB". Each maps to a global default key on the storage.local
	// root. Resolution rule (per file-backups-fje):
	//   - per-wiki override is a number  -> it WINS, including 0. A user can
	//     switch a reminder OFF for one wiki even when the global is on.
	//   - per-wiki override is null/absent/non-number -> inherit the global.
	//   - global default is a number     -> use it; else fall back to 0 (off).
	// The function never throws on hostile shapes and always returns a number.
	var GLOBAL_KEY = {
		remindAfterDays: "defaultRemindMilestoneAfterDays",
		fileCountLimit: "defaultFileCountLimit",
		sizeLimitMB: "defaultSizeLimitMB"
	};

	function getEffectiveLimit(stash, globals, kind) {
		var gKey = GLOBAL_KEY[kind];
		if (!gKey) return 0; // unknown kind: treat as off, never throw
		var override = stash && stash[kind];
		if (typeof override === "number" && isFinite(override) && override >= 0) {
			return override;
		}
		var g = globals && globals[gKey];
		return (typeof g === "number" && isFinite(g) && g >= 0) ? g : 0;
	}

	// Reminder evaluation (phase 3). Pure over the per-wiki stash: counts and
	// sizes come from the phase-1 rotation + milestones records. Returns
	// {milestone, count, size} where each entry is the effective LIMIT the
	// reminder message quotes when that reminder fires and is not snoozed, else
	// null. A kind is null whenever its effective limit is 0 (opt-in off), so
	// all-limits-0 yields all-null (silent).
	// Count + size reflect what's actually in the folder: tracked entries flagged
	// missing (the reconcile / folder-sync sets entry.missing when the file is
	// gone) are EXCLUDED, and folder-sync-discovered files (stash.discovered —
	// present in the folder but never download-tracked) are INCLUDED. Both keep
	// the reminders aligned with the summary's accounting.
	function reminderFileCount(stash) {
		var rot = 0;
		if (stash && stash.rotation && typeof stash.rotation === "object" && !Array.isArray(stash.rotation)) {
			for (var k in stash.rotation) {
				if (Object.prototype.hasOwnProperty.call(stash.rotation, k) && stash.rotation[k] && !stash.rotation[k].missing) rot++;
			}
		}
		var ms = 0;
		if (stash && Array.isArray(stash.milestones)) {
			stash.milestones.forEach(function (m) { if (m && !m.missing) ms++; });
		}
		var disc = (stash && Array.isArray(stash.discovered)) ? stash.discovered.length : 0;
		return rot + ms + disc;
	}

	function reminderTotalSize(stash) {
		var total = 0;
		if (stash && stash.rotation && typeof stash.rotation === "object" && !Array.isArray(stash.rotation)) {
			for (var k in stash.rotation) {
				if (Object.prototype.hasOwnProperty.call(stash.rotation, k)) {
					var r = stash.rotation[k];
					if (r && !r.missing && typeof r.size === "number" && isFinite(r.size)) total += r.size;
				}
			}
		}
		if (stash && Array.isArray(stash.milestones)) {
			stash.milestones.forEach(function (m) {
				if (m && !m.missing && typeof m.size === "number" && isFinite(m.size)) total += m.size;
			});
		}
		if (stash && Array.isArray(stash.discovered)) {
			stash.discovered.forEach(function (d) {
				if (d && typeof d.size === "number" && isFinite(d.size)) total += d.size;
			});
		}
		return total;
	}

	function evaluateReminders(stash, overrides, globals, now) {
		var snz = (stash && stash.snoozedUntil) || {};
		var out = {milestone: null, count: null, size: null};

		var remind = getEffectiveLimit(overrides, globals, "remindAfterDays");
		if (remind > 0 && (now - ((stash && stash.lastMilestoneAt) || 0)) > remind * 86400000 && now > (snz.milestone || 0)) {
			out.milestone = remind;
		}
		var countLimit = getEffectiveLimit(overrides, globals, "fileCountLimit");
		if (countLimit > 0 && reminderFileCount(stash) > countLimit && now > (snz.count || 0)) {
			out.count = countLimit;
		}
		var sizeLimit = getEffectiveLimit(overrides, globals, "sizeLimitMB");
		if (sizeLimit > 0 && reminderTotalSize(stash) > sizeLimit * 1024 * 1024 && now > (snz.size || 0)) {
			out.size = sizeLimit;
		}
		return out;
	}

	// Recognise an open file as a tracked backup — a milestone snapshot OR a
	// Tower-of-Hanoi rotation slot (phase 3). The AddOn records every backup's
	// stored filename, so given the file currently open we can both recognise it
	// and recover its MAIN wiki — the stash key. allStashes is the raw
	// storage.local map (key = main-wiki path); currentNorm is the open file's
	// normalised path; norm() normalises a stored filename the same way
	// (slashes/case/decode). Stored filenames are relative to the download root,
	// the open path is absolute, so a match is: the open path equals, or ends with
	// "/" + the normalised filename. Returns {mainWikiPath, kind, entry} for the
	// first match (kind is "milestone" or "rotation"; rotation entries also carry
	// their slot letter), else null.
	function findBackupByFile(allStashes, currentNorm, norm) {
		if (!allStashes || typeof allStashes !== "object" || !currentNorm || typeof norm !== "function") return null;
		var matches = function (filename) {
			if (!filename) return false;
			var fn = norm(filename);
			return !!fn && (currentNorm === fn || currentNorm.slice(-(fn.length + 1)) === "/" + fn);
		};
		for (var key in allStashes) {
			if (!Object.prototype.hasOwnProperty.call(allStashes, key)) continue;
			var stash = allStashes[key];
			var ms = (stash && Array.isArray(stash.milestones)) ? stash.milestones : [];
			for (var i = 0; i < ms.length; i++) {
				if (ms[i] && matches(ms[i].filename)) return {mainWikiPath: key, kind: "milestone", entry: ms[i]};
			}
			var rot = (stash && stash.rotation && typeof stash.rotation === "object" && !Array.isArray(stash.rotation)) ? stash.rotation : {};
			for (var slot in rot) {
				if (Object.prototype.hasOwnProperty.call(rot, slot) && rot[slot] && matches(rot[slot].filename)) {
					return {mainWikiPath: key, kind: "rotation", entry: Object.assign({slot: slot}, rot[slot])};
				}
			}
			// Folder-sync-discovered files (present in the folder, never download-
			// tracked) — checked last so a download-tracked match always wins.
			var disc = (stash && Array.isArray(stash.discovered)) ? stash.discovered : [];
			for (var j = 0; j < disc.length; j++) {
				if (disc[j] && matches(disc[j].filename || disc[j].name)) {
					return {mainWikiPath: key, kind: "scan", entry: disc[j]};
				}
			}
		}
		return null;
	}

	// Parse a Firefox file:// directory listing — the application/http-index-format
	// body returned by fetch()ing a directory URL. Returns [{name, size}] for the
	// FILE entries (directories/symlinks skipped); names are URL-decoded. Tolerates
	// blank/header lines. Assumes the default columns the 200: header declares
	// (filename, content-length, last-modified, file-type).
	function parseIndexFormat(text) {
		var out = [];
		String(text == null ? "" : text).split(/\r?\n/).forEach(function (line) {
			if (line.slice(0, 4) !== "201:") return;
			var parts = line.slice(4).trim().split(/\s+/);
			if (parts.length < 2) return;
			if (parts[parts.length - 1] !== "FILE") return; // skip DIRECTORY / SYMBOLIC-LINK
			var name;
			try { name = decodeURIComponent(parts[0]); } catch (e) { name = parts[0]; }
			var size = parseInt(parts[1], 10);
			// 3rd column is the last-modified date (URL-encoded RFC date); use it as
			// the entry's ts so discovered rows format + sort like tracked ones.
			var ts = 0;
			if (parts.length >= 3) {
				var dstr; try { dstr = decodeURIComponent(parts[2]); } catch (e) { dstr = parts[2]; }
				var d = Date.parse(dstr);
				if (isFinite(d)) ts = d;
			}
			out.push({name: name, size: isFinite(size) ? size : 0, ts: ts});
		});
		return out;
	}

	// Sync a wiki's stash against a real folder listing (files from
	// parseIndexFormat). The folder is the source of truth: tracked entries (from
	// our downloads) get missing=false if present, missing=true if gone; files in
	// the folder that match no tracked entry are recorded under stash.discovered
	// with source:"scan" so they are distinguishable from download-tracked backups.
	// Matching is by the last path segment (the listing gives bare filenames, the
	// tracked filename is a full relative path), case-insensitive. MUTATES stash
	// and returns {tracked, missing, discovered} counts.
	function syncScannedFiles(stash, files) {
		if (!stash || typeof stash !== "object") return {tracked: 0, missing: 0, discovered: 0};
		var present = {};
		(Array.isArray(files) ? files : []).forEach(function (f) {
			if (f && f.name) present[String(f.name).toLowerCase()] = f;
		});
		function lastSeg(fn) {
			var parts = String(fn || "").split(/[\\\/]/);
			return parts[parts.length - 1].toLowerCase();
		}
		var tracked = 0, missing = 0, matched = {};
		function reconcile(entry) {
			if (!entry || !entry.filename) return;
			var seg = lastSeg(entry.filename);
			if (present[seg]) { entry.missing = false; tracked++; matched[seg] = true; }
			else { entry.missing = true; missing++; }
		}
		if (stash.rotation && typeof stash.rotation === "object" && !Array.isArray(stash.rotation)) {
			for (var slot in stash.rotation) {
				if (Object.prototype.hasOwnProperty.call(stash.rotation, slot)) reconcile(stash.rotation[slot]);
			}
		}
		if (Array.isArray(stash.milestones)) stash.milestones.forEach(reconcile);
		var discovered = [];
		(Array.isArray(files) ? files : []).forEach(function (f) {
			if (!f || !f.name || matched[String(f.name).toLowerCase()]) return;
			discovered.push({
				name: f.name,
				size: (typeof f.size === "number" && isFinite(f.size)) ? f.size : 0,
				ts: (typeof f.ts === "number" && isFinite(f.ts)) ? f.ts : 0, // file mtime from the listing
				filename: f.filename || null, // relative path (for a link), set by the caller
				source: "scan"
			});
		});
		stash.discovered = discovered;
		return {tracked: tracked, missing: missing, discovered: discovered.length};
	}

	// Recover the milestone label embedded in a backup filename. createMilestoneFile
	// names a milestone "<wiki>(<ts>)-<label><ext>" where <label> is the sanitized
	// [a-z0-9-] tail (sanitizeMilestoneLabel) and is omitted entirely when blank. A
	// folder-sync-discovered milestone carries no tracked label (it was never
	// download-recorded), so the summary parses it back out of the filename for
	// display. The pattern is end-anchored on ")-<label><ext>" so a wiki name that
	// itself contains "()" doesn't mislead it, and it tolerates a Windows duplicate
	// suffix ("- Copy" / "- Copy (2)") inserted before the extension. Returns "" for
	// an unlabelled milestone or any non-milestone name. The description is NOT in
	// the filename, so it cannot be recovered this way.
	function milestoneLabelFromName(name) {
		var m = String(name == null ? "" : name).match(/\)-([a-z0-9-]+)(?: - Copy(?: \(\d+\))?)?\.html?$/i);
		return (m && m[1]) ? m[1] : "";
	}

	root.recordRotationSlot = recordRotationSlot;
	root.recordMilestone = recordMilestone;
	root.getEffectiveLimit = getEffectiveLimit;
	root.reminderFileCount = reminderFileCount;
	root.reminderTotalSize = reminderTotalSize;
	root.evaluateReminders = evaluateReminders;
	root.findBackupByFile = findBackupByFile;
	root.parseIndexFormat = parseIndexFormat;
	root.syncScannedFiles = syncScannedFiles;
	root.milestoneLabelFromName = milestoneLabelFromName;
})(typeof globalThis !== "undefined" ? globalThis : this);
