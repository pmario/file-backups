'use strict';

const TITLE_APPLY = "Enable Backups";
const TITLE_REMOVE = "Disable Backups";
const APPLICABLE_PROTOCOLS = ["file:", "file:"];

/*
Returns true only if the URL's protocol is in APPLICABLE_PROTOCOLS.
*/
function protocolIsApplicable(url) {
  var anchor =  document.createElement('a');
  anchor.href = url;
  return APPLICABLE_PROTOCOLS.includes(anchor.protocol);
};

const pageActions = {

    toggleEnableBackups: function (tab) {

      function gotTitle(title) {
        if (title === TITLE_APPLY) {
            browser.pageAction.setIcon({tabId: tab.id, path: "icons/download.svg"});
            browser.pageAction.setTitle({tabId: tab.id, title: TITLE_REMOVE});
            chrome.storage.local.set({
                backupEnabled: true
            });
        } else {
            browser.pageAction.setIcon({tabId: tab.id, path: "icons/spiral.svg"});
            browser.pageAction.setTitle({tabId: tab.id, title: TITLE_APPLY});
            chrome.storage.local.set({
                backupEnabled: false
            });
        }
      }

      if (protocolIsApplicable(tab.url)) {
          var gettingTitle = browser.pageAction.getTitle({tabId: tab.id});
          gettingTitle.then(gotTitle);
      }
    },

    /*
    Initialize the page action: set icon and title, then show.
    Only operates on tabs whose URL's protocol is applicable.
    */
    updatePageAction: function (tab) {
        function onError(error) {};

        function onGotStore(items) {
            var icon, title;
            if (items.backupEnabled) {
                  icon = "icons/download.svg";
                  title = TITLE_REMOVE;
              } else {
                  icon = "icons/spiral.svg"
                  title = TITLE_REMOVE
              }
              browser.pageAction.setIcon({tabId: tab.tabId, path: icon});
              browser.pageAction.setTitle({tabId: tab.tabId, title: title});
              browser.pageAction.show(tab.tabId);
        };

        function gotTabInfo(tab) {
            if (protocolIsApplicable(tab.url)) {
                let gettingItem = browser.storage.local.get();
                gettingItem.then(onGotStore, onError);
            } else browser.pageAction.hide(tab.id);
        }

        var gettingTitle = browser.tabs.get(tab.tabId);
        gettingTitle.then(gotTabInfo);

    },

    /*
    Initialize the page action: set icon and title, then show.
    Only operates on tabs whose URL's protocol is applicable.
    */
    initializePageAction: function (tab) {
      if (protocolIsApplicable(tab.url)) {
        browser.pageAction.setIcon({tabId: tab.id, path: "icons/spiral.svg"});
        browser.pageAction.setTitle({tabId: tab.id, title: TITLE_APPLY});
        browser.pageAction.show(tab.id);
      } else {
          browser.pageAction.hide(tab.id);
      }
    }
}

module.exports = pageActions;
