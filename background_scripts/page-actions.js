'use strict';

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
