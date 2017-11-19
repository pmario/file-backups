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
