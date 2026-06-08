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

	function recordMilestone(stash, meta) {
		var priorList = (stash && Array.isArray(stash.milestones)) ? stash.milestones : [];
		var milestones = priorList.map(pickEntry);
		milestones.push(pickEntry(meta));
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

	root.recordRotationSlot = recordRotationSlot;
	root.recordMilestone = recordMilestone;
	root.getEffectiveLimit = getEffectiveLimit;
})(typeof globalThis !== "undefined" ? globalThis : this);
