if (typeof browser === "undefined") {
	globalThis.browser = globalThis.chrome;
}

// Captured during restore_options(); the form is "dirty" when current
// field values diverge. Save toggles green, otherwise gray.
var baseline = null;

function showSavedMessage() {
	// Update status to let user know options were saved.
	var status = document.getElementById('status');
	status.textContent = 'Settings saved!';
	setTimeout(function () {
		status.textContent = '';
	}, 750);
}

// Read a numeric input as a non-negative integer. Empty / NaN / negative
// all coerce to 0 (the "off" value) so the dirty-check never sees NaN
// (NaN !== NaN would mark the form permanently dirty).
function readNum(id) {
	var n = document.getElementById(id).valueAsNumber;
	return (typeof n === "number" && isFinite(n) && n >= 0) ? n : 0;
}

function readForm() {
	return {
		backupdir: document.getElementById('backupdir').value,
		backupEnabled: document.getElementById("backup").checked,
		numberOfBackups: document.getElementById('amount').valueAsNumber,
		showBetaUpdates: document.getElementById("showBetaUpdates").checked,
		defaultRemindMilestoneAfterDays: readNum('defaultRemindMilestoneAfterDays'),
		defaultFileCountLimit: readNum('defaultFileCountLimit'),
		defaultSizeLimitMB: readNum('defaultSizeLimitMB')
	};
}

function isDirty() {
	if (!baseline) return false;
	var cur = readForm();
	for (var k in baseline) {
		if (baseline[k] !== cur[k]) return true;
	}
	return false;
}

function refreshSaveDirty() {
	document.getElementById('save').classList.toggle('dirty', isDirty());
}

function refreshBackupdirValidity() {
	var input = document.getElementById('backupdir');
	var err = document.getElementById('backupdir-error');
	var save = document.getElementById('save');
	var msg = validateBackupDir(input.value);
	err.textContent = msg || "";
	input.classList.toggle("invalid", !!msg);
	save.disabled = !!msg;
	refreshSaveDirty();
}

// Saves options to chrome.storage.sync.
async function save_options() {
	var values = readForm();
	if (validateBackupDir(values.backupdir)) return; // belt-and-braces — button is already disabled
	var stat = await browser.storage.local.set(values);

	if (stat) {
		console.log("storage.local.set error:", stat)
	} else {
		// Re-evaluate the badge instead of clearing it directly. If "!"
		// (backupdir invalid) goes away but updateAvailable is still set,
		// the badge downgrades to "↻" rather than disappearing entirely.
		try {
			await browser.runtime.sendMessage({msg: "refreshBadge"});
		} catch (err) {}
		baseline = values;
		refreshSaveDirty();
		showSavedMessage();
	}
}

// Restores select box and text fields
async function restore_options() {
	var items = await browser.storage.local.get({
		backupdir: "twBackups",
		backupEnabled: true,
		numberOfBackups: 9,
		showBetaUpdates: false,
		defaultRemindMilestoneAfterDays: 0,
		defaultFileCountLimit: 0,
		defaultSizeLimitMB: 0
	});

	if (items) {
		document.getElementById('backupdir').value = items.backupdir;
		document.getElementById('amount').value = items.numberOfBackups;
		document.getElementById("backup").checked = items.backupEnabled;
		document.getElementById("showBetaUpdates").checked = items.showBetaUpdates;
		document.getElementById('defaultRemindMilestoneAfterDays').value = items.defaultRemindMilestoneAfterDays;
		document.getElementById('defaultFileCountLimit').value = items.defaultFileCountLimit;
		document.getElementById('defaultSizeLimitMB').value = items.defaultSizeLimitMB;
	}
	baseline = readForm();
	refreshBackupdirValidity();
}

document.addEventListener('DOMContentLoaded', restore_options);
document.getElementById('backupdir').addEventListener('input', refreshBackupdirValidity);
document.getElementById('backup').addEventListener('change', refreshSaveDirty);
document.getElementById('amount').addEventListener('input', refreshSaveDirty);
document.getElementById('showBetaUpdates').addEventListener('change', refreshSaveDirty);
document.getElementById('defaultRemindMilestoneAfterDays').addEventListener('input', refreshSaveDirty);
document.getElementById('defaultFileCountLimit').addEventListener('input', refreshSaveDirty);
document.getElementById('defaultSizeLimitMB').addEventListener('input', refreshSaveDirty);
document.getElementById('save').addEventListener('click', save_options);
