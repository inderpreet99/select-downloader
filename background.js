// 1. Create the context menu
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "download-links",
    title: "Download Links with Custom Name",
    contexts: ["selection"]
  });
});

// 2. Inject the script when clicked
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "download-links") {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: promptAndExtractLinks
    });
  }
});

// 3. Listen for the extracted links and trigger downloads
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "downloadLinks") {
    const { links, pattern } = message;

    links.forEach((linkData, index) => {
      // Extract the remote filename from the URL (e.g., https://example.com/file.pdf -> file.pdf)
      // If the URL ends in a slash or lacks a file, we default to "file_[index]"
      let remoteFileName = linkData.url.split('?')[0].split('/').pop() || `file_${index}`;
      
      // Clean up the link text so it's safe for file names (replaces spaces/special chars with underscores)
      let safeLinkText = linkData.text.replace(/[^a-z0-9]/gi, '_') || `link_${index}`;

      // Swap out the user's placeholders
      let finalName = pattern
        .replace('{linkText}', safeLinkText)
        .replace('{remoteFileName}', remoteFileName);

      // Strip out any remaining illegal characters that would cause Windows/macOS to reject the file path
      finalName = finalName.replace(/[<>:"/\\|?*]+/g, '');

      // Trigger the download
      chrome.downloads.download({
        url: linkData.url,
        filename: finalName,
        conflictAction: 'uniquify' // Adds (1), (2) if a file already exists
      });
    });
  }
});

// --- INJECTED CONTENT SCRIPT ---
// This runs on the actual webpage to interact with the DOM and the user
function promptAndExtractLinks() {
  const selection = window.getSelection();
  if (!selection.rangeCount) return;

  const range = selection.getRangeAt(0);
  const container = document.createElement("div");
  container.appendChild(range.cloneContents());

  // Find all <a> tags that actually have an href attribute
  const anchorTags = Array.from(container.querySelectorAll("a")).filter(a => a.href);

  if (anchorTags.length === 0) {
    alert("No links were found in the selected text.");
    return;
  }

  // Prompt the user for the naming structure
  const pattern = prompt(
    `Found ${anchorTags.length} links.\n\nEnter a file naming pattern.\nAvailable variables:\n{linkText} - The text of the link\n{remoteFileName} - The original file name from the URL\n\nExample: MYPREFIX-{linkText}.pdf`,
    "{remoteFileName}"
  );

  if (!pattern) return; // Exit if the user clicks "Cancel"

  // Extract both the URL and the visible text of the link
  const linksData = anchorTags.map(a => ({
    url: a.href,
    text: a.innerText.trim()
  }));

  // Send the payload to the background script
  chrome.runtime.sendMessage({
    action: "downloadLinks",
    links: linksData,
    pattern: pattern
  });
}