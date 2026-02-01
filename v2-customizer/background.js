chrome.action.onClicked.addListener(tab => {
  if (tab.url && tab.url.includes('twitch.tv')) {
    chrome.tabs.sendMessage(tab.id, { type: 'toggleEditor' });
  }
});
