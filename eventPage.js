var menuItem = {
    "id": "calculate",
    "title": "Calculate it!",
    "contexts": ["selection"]
};

chrome.runtime.onInstalled.addListener(function() {
    chrome.contextMenus.create(menuItem);
});

chrome.contextMenus.onClicked.addListener(function(info, tab) {
    if (info.menuItemId == "calculate" && info.selectionText && tab && tab.id) {
        chrome.storage.sync.set({'expr': info.selectionText, 'tab': tab.id});
        if (tab.url && tab.url.indexOf('chrome://') === 0) {
            console.log('can\'t run on chrome pages');
        } else {
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ["math.js", "bigNumber.js", "open-modal-script.js"]
            });
        }
    }
});
