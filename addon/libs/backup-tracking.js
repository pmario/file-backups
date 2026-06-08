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

	root.recordRotationSlot = recordRotationSlot;
	root.recordMilestone = recordMilestone;
})(typeof globalThis !== "undefined" ? globalThis : this);
