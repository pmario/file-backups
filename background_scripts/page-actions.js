'use strict';

const CSS = "body { border: 20px solid red; }";
const TITLE_APPLY = "Apply CSS";
const TITLE_REMOVE = "Remove CSS";
const APPLICABLE_PROTOCOLS = ["file:"];

const pageActions = {
    /*
    Toggle CSS: based on the current title, insert or remove the CSS.
    Update the page action's title and icon to reflect its state.
    */
    toggleCSS: function toggleCSS(tab) {

      function gotTitle(title) {
        if (title === TITLE_APPLY) {
          browser.pageAction.setIcon({tabId: tab.id, path: "icons/download.svg"});
          browser.pageAction.setTitle({tabId: tab.id, title: TITLE_REMOVE});
          browser.tabs.insertCSS({code: CSS});
        } else {
          browser.pageAction.setIcon({tabId: tab.id, path: "icons/spiral.svg"});
          browser.pageAction.setTitle({tabId: tab.id, title: TITLE_APPLY});
          browser.tabs.removeCSS({code: CSS});
        }
      }

      var gettingTitle = browser.pageAction.getTitle({tabId: tab.id});
      gettingTitle.then(gotTitle);
    },

    /*
    Returns true only if the URL's protocol is in APPLICABLE_PROTOCOLS.
    */
    protocolIsApplicable: function protocolIsApplicable(url) {
      var anchor =  document.createElement('a');
      anchor.href = url;
      return APPLICABLE_PROTOCOLS.includes(anchor.protocol);
    },

    /*
    Initialize the page action: set icon and title, then show.
    Only operates on tabs whose URL's protocol is applicable.
    */
    initializePageAction: function initializePageAction(tab) {
      if (this.protocolIsApplicable(tab.url)) {
        browser.pageAction.setIcon({tabId: tab.id, path: "icons/spiral.svg"});
        browser.pageAction.setTitle({tabId: tab.id, title: TITLE_APPLY});
        browser.pageAction.show(tab.id);
      }
    }
}

module.exports = pageActions;