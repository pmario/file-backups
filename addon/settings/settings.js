if (typeof browser === "undefined") {
	globalThis.browser = globalThis.chrome;
}

function showSavedMessage() {
	// Update status to let user know options were saved.
	var status = document.getElementById('status');
	status.textContent = 'Settings saved!';
	setTimeout(function () {
		status.textContent = '';
	}, 750);
}

function refreshBackupdirValidity() {
	var input = document.getElementById('backupdir');
	var err = document.getElementById('backupdir-error');
	var save = document.getElementById('save');
	var msg = validateBackupDir(input.value);
	err.textContent = msg || "";
	input.classList.toggle("invalid", !!msg);
	save.disabled = !!msg;
}

// Saves options to chrome.storage.sync.
async function save_options() {
	var backupdir = document.getElementById('backupdir').value;
	if (validateBackupDir(backupdir)) return; // belt-and-braces — button is already disabled
	var stat = await browser.storage.local.set({
		backupdir: backupdir,
		backupEnabled: document.getElementById("backup").checked,
		numberOfBackups: document.getElementById('amount').valueAsNumber
	})

	if (stat) {
		console.log("storage.local.set error:", stat)
	} else showSavedMessage();
}

// Restores select box and text fields
async function restore_options() {
	var items = await browser.storage.local.get({
		backupdir: "twBackups",
		backupEnabled: true,
		numberOfBackups: 9
	});

	if (items) {
		document.getElementById('backupdir').value = items.backupdir;
		document.getElementById('amount').value = items.numberOfBackups;
		document.getElementById("backup").checked = items.backupEnabled;
	}
	refreshBackupdirValidity();
}

document.addEventListener('DOMContentLoaded', restore_options);
document.getElementById('backupdir').addEventListener('input', refreshBackupdirValidity);
document.getElementById('save').addEventListener('click', save_options);
