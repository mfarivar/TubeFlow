// Frontend Javascript for Video Downloader

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const urlInput = document.getElementById('url-input');
  const pasteBtn = document.getElementById('paste-btn');
  const urlError = document.getElementById('url-error');
  const bulkPreviewCard = document.getElementById('bulk-preview-card');
  const bulkCount = document.getElementById('bulk-count');
  
  const videoPreviewCard = document.getElementById('video-preview-card');
  const videoThumb = document.getElementById('video-thumb');
  const videoDurationBadge = document.getElementById('video-duration-badge');
  const videoTitle = document.getElementById('video-title');
  const videoAuthor = document.getElementById('video-author');
  
  // Re-fit window height when the video thumbnail finishes loading
  videoThumb.addEventListener('load', () => {
    fitWindow();
  });
  
  const formatVideo = document.getElementById('format-video');
  const formatAudio = document.getElementById('format-audio');
  
  const trimEnable = document.getElementById('trim-enable');
  const trimInputsContainer = document.getElementById('trim-inputs-container');
  const trimStart = document.getElementById('trim-start');
  const trimEnd = document.getElementById('trim-end');
  
  const downloadBtn = document.getElementById('download-btn');
  const downloadBtnText = document.getElementById('download-btn-text');
  
  const loadingOverlay = document.getElementById('loading-overlay');
  const downloadOverlay = document.getElementById('download-overlay');
  const dlStatusTitle = document.getElementById('dl-status-title');
  const dlStatusFilename = document.getElementById('dl-status-filename');
  const dlProgressFill = document.getElementById('dl-progress-fill');
  const dlProgressPercent = document.getElementById('dl-progress-percent');
  const dlProgressSpeed = document.getElementById('dl-progress-speed');
  const dlProgressEta = document.getElementById('dl-progress-eta');
  const cancelBtn = document.getElementById('cancel-btn');
  
  const completeOverlay = document.getElementById('complete-overlay');
  const successFilename = document.getElementById('success-filename');
  const showFinderBtn = document.getElementById('show-finder-btn');
  const resetBtn = document.getElementById('reset-btn');

  // History Elements
  const historyToggleBtn = document.getElementById('history-toggle-btn');
  const historyDrawer = document.getElementById('history-drawer');
  const closeDrawerBtn = document.getElementById('close-drawer-btn');
  const clearHistoryBtn = document.getElementById('clear-history-btn');
  const historyList = document.getElementById('history-list');
  const historyEmpty = document.getElementById('history-empty');

  // Save Folder Elements
  const changeFolderBtn = document.getElementById('change-folder-btn');
  const folderPathDisplay = document.getElementById('folder-path-display');

  // Regex to extract YouTube video ID (supports youtube.com, music.youtube.com, and youtu.be)
  const YOUTUBE_REGEX = /^(?:https?:\/\/)?(?:www\.|music\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  
  // Regex to match TikTok video links (supports standard and mobile vt/vm links)
  const TIKTOK_REGEX = /^(?:https?:\/\/)?(?:www\.|vm\.|vt\.)?tiktok\.com\/[@a-zA-Z0-9_-]+\/video\/\d+|(?:https?:\/\/)?(?:vm\.|vt\.)?tiktok\.com\/[a-zA-Z0-9_-]+/;
  
  // State
  let currentVideoDuration = 0; // In seconds
  let activeUrl = "";
  let activeUrls = []; // Store list of currently active URLs

  // Dynamic window sizing — measure content and resize the native window
  function fitWindow() {
    requestAnimationFrame(() => {
      const container = document.querySelector('.app-container');
      const card = document.querySelector('.app-card');
      if (!container || !card) return;

      // Save original styles to restore them after measuring
      const origBodyHeight = document.body.style.height;
      const origContainerHeight = container.style.height;
      const origCardFlex = card.style.flex;
      const origCardHeight = card.style.height;
      const origCardOverflow = card.style.overflowY;

      // Temporarily remove height constraints to allow natural content-based sizing
      document.body.style.height = 'auto';
      container.style.height = 'auto';
      card.style.flex = 'none';
      card.style.height = 'auto';
      card.style.overflowY = 'visible';

      // Measure the natural layout height of the container
      const contentHeight = container.offsetHeight;

      // Restore original styles immediately
      document.body.style.height = origBodyHeight;
      container.style.height = origContainerHeight;
      card.style.flex = origCardFlex;
      card.style.height = origCardHeight;
      card.style.overflowY = origCardOverflow;

      // Calculate final target window height (add title bar ~28px + small buffer ~16px)
      const targetHeight = contentHeight + 28 + 16;

      if (window.pywebview && window.pywebview.api) {
        window.pywebview.api.resize_window(targetHeight);
      }
    });
  }

  // Helper: Format seconds to HH:MM:SS
  function formatSeconds(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return [
      h.toString().padStart(2, '0'),
      m.toString().padStart(2, '0'),
      s.toString().padStart(2, '0')
    ].join(':');
  }

  // Helper: Parse HH:MM:SS or MM:SS to seconds
  function parseTimeToSeconds(timeStr) {
    if (!timeStr) return null;
    const parts = timeStr.split(':').map(p => p.trim());
    
    // Check if there are any non-numeric parts
    if (parts.some(p => isNaN(p) || p === "")) return null;
    
    const nums = parts.map(Number);
    if (nums.length === 3) {
      // HH:MM:SS
      return nums[0] * 3600 + nums[1] * 60 + nums[2];
    } else if (nums.length === 2) {
      // MM:SS
      return nums[0] * 60 + nums[1];
    } else if (nums.length === 1) {
      // SS
      return nums[0];
    }
    return null;
  }

  // Helper: Validate HH:MM:SS or MM:SS input string
  function isValidTimeString(timeStr) {
    const seconds = parseTimeToSeconds(timeStr);
    return seconds !== null && seconds >= 0;
  }

  // Helper: Extract all valid URLs from a text block
  function parseUrls(text) {
    if (!text) return [];
    // Split by newlines, commas, spaces, or semicolons
    const tokens = text.split(/[\s,;]+/);
    const validUrls = [];
    tokens.forEach(token => {
      const trimmed = token.trim();
      if (!trimmed) return;
      if (trimmed.match(YOUTUBE_REGEX) || trimmed.match(TIKTOK_REGEX)) {
        if (!validUrls.includes(trimmed)) {
          validUrls.push(trimmed);
        }
      }
    });
    return validUrls;
  }

  // Clipboard Paste Handler
  pasteBtn.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      urlInput.value = text;
      // Trigger validation
      urlInput.dispatchEvent(new Event('input'));
    } catch (err) {
      console.warn('Navigator clipboard API read failed. Trying to focus and paste natively.', err);
      // Fallback: If clipboard read is blocked, just focus the input
      urlInput.focus();
    }
  });

  // URL Input listener
  urlInput.addEventListener('input', () => {
    const rawText = urlInput.value;
    const detectedUrls = parseUrls(rawText);
    
    if (detectedUrls.length === 0) {
      if (rawText.trim() === "") {
        urlError.classList.add('hidden');
      } else {
        urlError.innerText = "Please enter a valid YouTube, YouTube Music, or TikTok link.";
        urlError.classList.remove('hidden');
      }
      resetMetadataState();
      return;
    }
    
    urlError.classList.add('hidden');
    
    const listsMatch = activeUrls.length === detectedUrls.length && 
                       activeUrls.every((v, i) => v === detectedUrls[i]);
                       
    if (!listsMatch) {
      activeUrls = detectedUrls;
      
      if (activeUrls.length === 1) {
        bulkPreviewCard.classList.add('hidden');
        activeUrl = activeUrls[0];
        fetchMetadata(activeUrl);
      } else {
        resetMetadataState(false);
        
        bulkCount.innerText = `${activeUrls.length} URLs loaded (ready to download)`;
        bulkPreviewCard.classList.remove('hidden');
        
        downloadBtn.removeAttribute('disabled');
        downloadBtnText.innerText = `Download ${activeUrls.length} Items`;
        
        trimEnable.checked = false;
        trimEnable.dispatchEvent(new Event('change'));
        trimEnable.setAttribute('disabled', 'true');
        fitWindow();
      }
    }
  });

  // Fetch Metadata from Python Backend
  async function fetchMetadata(url) {
    showLoading(true);
    resetMetadataState(false); // don't clear URL input, just clear preview
    
    try {
      if (window.pywebview && window.pywebview.api) {
        const info = await window.pywebview.api.get_video_info(url);
        if (info && !info.error) {
          // Set UI values
          currentVideoDuration = info.duration;
          
          videoTitle.innerText = info.title;
          videoAuthor.innerText = info.uploader || "Unknown Channel";
          videoThumb.src = info.thumbnail || "";
          videoDurationBadge.innerText = formatSeconds(info.duration);
          
          // Prepopulate trim inputs
          trimStart.value = "00:00:00";
          trimEnd.value = formatSeconds(info.duration);
          
          // Show Card
          videoPreviewCard.classList.remove('hidden');
          downloadBtn.removeAttribute('disabled');
          fitWindow();
        } else {
          showError(info.error || "Failed to parse video details.");
        }
      } else {
        // Mock fallback for standard browser testing
        setTimeout(() => {
          currentVideoDuration = 365;
          videoTitle.innerText = "Rick Astley - Never Gonna Give You Up (Official Music Video)";
          videoAuthor.innerText = "Rick Astley";
          videoThumb.src = "https://img.youtube.com/vi/dQw4w9WgXcQ/0.jpg";
          videoDurationBadge.innerText = "00:06:05";
          trimStart.value = "00:00:00";
          trimEnd.value = "00:06:05";
          videoPreviewCard.classList.remove('hidden');
          downloadBtn.removeAttribute('disabled');
          fitWindow();
          showLoading(false);
        }, 1000);
        return;
      }
    } catch (err) {
      console.error(err);
      showError("An error occurred connecting to Python backend.");
    }
    showLoading(false);
  }

  function showError(msg) {
    urlError.innerText = msg;
    urlError.classList.remove('hidden');
    resetMetadataState();
  }

  function showLoading(show) {
    if (show) {
      loadingOverlay.classList.remove('hidden');
    } else {
      loadingOverlay.classList.add('hidden');
    }
  }

  // Reset preview states
  function resetMetadataState(clearInput = true) {
    if (clearInput) {
      urlInput.value = "";
      activeUrl = "";
      activeUrls = [];
      syncLastClipboardWithoutPaste();
    }
    currentVideoDuration = 0;
    videoPreviewCard.classList.add('hidden');
    bulkPreviewCard.classList.add('hidden');
    videoThumb.src = "";
    videoTitle.innerText = "";
    videoAuthor.innerText = "";
    videoDurationBadge.innerText = "00:00";
    
    // Disable inputs
    trimEnable.checked = false;
    trimEnable.removeAttribute('disabled');
    trimInputsContainer.classList.add('disabled');
    trimStart.setAttribute('disabled', 'true');
    trimEnd.setAttribute('disabled', 'true');
    trimStart.value = "00:00:00";
    trimEnd.value = "00:00:00";
    
    downloadBtn.setAttribute('disabled', 'true');
    downloadBtnText.innerText = "Download";
    fitWindow();
  }

  // Trim Checkbox Toggle
  trimEnable.addEventListener('change', () => {
    if (trimEnable.checked) {
      trimInputsContainer.classList.remove('disabled');
      trimStart.removeAttribute('disabled');
      trimEnd.removeAttribute('disabled');
    } else {
      trimInputsContainer.classList.add('disabled');
      trimStart.setAttribute('disabled', 'true');
      trimEnd.setAttribute('disabled', 'true');
      
      // Reset to whole video bounds
      if (currentVideoDuration > 0) {
        trimStart.value = "00:00:00";
        trimEnd.value = formatSeconds(currentVideoDuration);
      }
    }
  });

  // Validate Start and End times on change
  function validateTrimInputs() {
    if (!trimEnable.checked) return true;
    
    const startStr = trimStart.value.trim();
    const endStr = trimEnd.value.trim();
    
    if (!isValidTimeString(startStr)) {
      alert("Invalid Start Time format. Use HH:MM:SS or MM:SS.");
      trimStart.focus();
      return false;
    }
    if (!isValidTimeString(endStr)) {
      alert("Invalid End Time format. Use HH:MM:SS or MM:SS.");
      trimEnd.focus();
      return false;
    }
    
    const startSec = parseTimeToSeconds(startStr);
    const endSec = parseTimeToSeconds(endStr);
    
    if (startSec >= currentVideoDuration) {
      alert("Start Time cannot be greater than or equal to the total video duration.");
      trimStart.focus();
      return false;
    }
    if (endSec > currentVideoDuration) {
      alert("End Time cannot exceed the total video duration.");
      trimEnd.focus();
      return false;
    }
    if (startSec >= endSec) {
      alert("Start Time must be less than the End Time.");
      trimStart.focus();
      return false;
    }
    
    return true;
  }

  // Click Download Button
  downloadBtn.addEventListener('click', async () => {
    if (activeUrls.length === 1) {
      if (!validateTrimInputs()) return;
    }
    
    const format = formatVideo.checked ? 'video' : 'audio';
    
    let trimStartSec = null;
    let trimEndSec = null;
    
    if (activeUrls.length === 1 && trimEnable.checked) {
      trimStartSec = parseTimeToSeconds(trimStart.value);
      trimEndSec = parseTimeToSeconds(trimEnd.value);
    }
    
    // Prepare progress dialog
    if (activeUrls.length > 1) {
      dlStatusTitle.innerText = `Downloading (1 of ${activeUrls.length})`;
      dlStatusFilename.innerText = "Starting batch download...";
    } else {
      dlStatusTitle.innerText = format === 'video' ? 'Downloading Video' : 'Downloading Voice/Audio';
      dlStatusFilename.innerText = videoTitle.innerText;
    }
    
    dlProgressFill.style.width = '0%';
    dlProgressPercent.innerText = '0%';
    dlProgressSpeed.innerText = '0 MB/s';
    dlProgressEta.innerText = 'ETA: --:--';
    
    downloadOverlay.classList.remove('hidden');
    
    try {
      if (window.pywebview && window.pywebview.api) {
        const target = activeUrls.length > 1 ? activeUrls : activeUrl;
        await window.pywebview.api.download_media(target, format, trimStartSec, trimEndSec);
      } else {
        // Mock Progress for standard browser debugging
        const target = activeUrls.length > 1 ? activeUrls : [activeUrl];
        console.log(`Starting mock download for format: ${format}, bulk count: ${target.length}`);
        
        let currentItem = 1;
        let pct = 0;
        
        const runMockItem = () => {
          if (currentItem > target.length) {
            window.downloadComplete(target.length > 1 ? "Successfully downloaded all mock items!" : "mock_file.mp4");
            return;
          }
          
          pct = 0;
          const interval = setInterval(() => {
            pct += 10;
            window.updateProgress(pct, "8.4 MB/s", "00:03", currentItem, target.length);
            if (pct >= 100) {
              clearInterval(interval);
              currentItem++;
              setTimeout(runMockItem, 500);
            }
          }, 200);
          
          cancelBtn.onclick = () => {
            clearInterval(interval);
            downloadOverlay.classList.add('hidden');
          };
        };
        
        runMockItem();
      }
    } catch (err) {
      console.error("Download triggering error: ", err);
      alert("Error starting download.");
      downloadOverlay.classList.add('hidden');
    }
  });

  // Cancel Button
  cancelBtn.addEventListener('click', async () => {
    try {
      if (window.pywebview && window.pywebview.api) {
        await window.pywebview.api.cancel_download();
      }
    } catch (err) {
      console.error(err);
    }
    downloadOverlay.classList.add('hidden');
  });

  // Show in Finder
  showFinderBtn.addEventListener('click', async () => {
    try {
      if (window.pywebview && window.pywebview.api) {
        await window.pywebview.api.open_downloads_folder();
      }
    } catch (err) {
      console.error(err);
    }
  });

  // Reset / Download Another
  resetBtn.addEventListener('click', () => {
    completeOverlay.classList.add('hidden');
    resetMetadataState(true);
  });

  // Global Callbacks for Python to trigger
  window.updateProgress = function(percent, speedStr, etaStr, currentIdx, totalCount) {
    if (totalCount && totalCount > 1) {
      dlStatusTitle.innerText = `Downloading (${currentIdx} of ${totalCount})`;
      if (activeUrls[currentIdx - 1]) {
        dlStatusFilename.innerText = activeUrls[currentIdx - 1];
      }
    }
    dlProgressFill.style.width = `${percent}%`;
    dlProgressPercent.innerText = `${percent}%`;
    dlProgressSpeed.innerText = speedStr;
    dlProgressEta.innerText = `ETA: ${etaStr}`;
  };

  // --- Clipboard Monitoring & Auto-Detection ---
  let lastClipboardText = "";

  async function checkClipboard() {
    if (window.pywebview && window.pywebview.api) {
      try {
        const text = await window.pywebview.api.get_clipboard();
        if (text && text.trim() !== "" && text !== lastClipboardText) {
          const detected = parseUrls(text);
          if (detected.length > 0) {
            lastClipboardText = text;
            urlInput.value = text;
            urlInput.dispatchEvent(new Event('input'));
          }
        }
      } catch (err) {
        console.error("Clipboard check failed:", err);
      }
    }
  }

  async function syncLastClipboardWithoutPaste() {
    if (window.pywebview && window.pywebview.api) {
      try {
        const text = await window.pywebview.api.get_clipboard();
        lastClipboardText = text;
      } catch (err) {
        console.error(err);
      }
    }
  }

  // Check clipboard when window gains focus
  window.addEventListener('focus', () => {
    checkClipboard();
  });

  // Poll clipboard every 1.5 seconds if window has focus
  setInterval(() => {
    if (document.hasFocus()) {
      checkClipboard();
    }
  }, 1500);

  // Sync clipboard on startup
  setTimeout(syncLastClipboardWithoutPaste, 1000);

  window.downloadComplete = function(filename) {
    downloadOverlay.classList.add('hidden');
    completeOverlay.classList.remove('hidden');
    successFilename.innerText = filename;
    // Automatically reload history when download finishes
    loadHistory();
  };

  window.downloadFailed = function(errorMsg) {
    downloadOverlay.classList.add('hidden');
    alert(`Download failed:\n${errorMsg}`);
  };

  // --- Save Folder Logic ---

  async function initDownloadFolder() {
    try {
      if (window.pywebview && window.pywebview.api) {
        const folder = await window.pywebview.api.get_download_folder();
        updateFolderDisplay(folder);
      } else {
        updateFolderDisplay('/Users/mock/Downloads');
      }
    } catch (err) {
      console.error("Failed to initialize download folder:", err);
    }
  }

  function updateFolderDisplay(folderPath) {
    if (folderPathDisplay) {
      folderPathDisplay.innerText = folderPath;
      folderPathDisplay.title = folderPath;
    }
    const successLoc = document.querySelector('.success-location');
    if (successLoc) {
      successLoc.innerText = `Saved to: ${folderPath}`;
    }
  }

  if (changeFolderBtn) {
    changeFolderBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        if (window.pywebview && window.pywebview.api) {
          const chosen = await window.pywebview.api.select_download_folder();
          if (chosen) {
            updateFolderDisplay(chosen);
          }
        } else {
          // Fallback mockup
          console.log("Mock folder selector opened");
          updateFolderDisplay('/Users/mock/CustomFolder');
        }
      } catch (err) {
        console.error("Failed to change download folder:", err);
      }
    });
  }

  // --- History Drawer Logic ---

  // Toggle Drawer open/close
  historyToggleBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent document click handler from immediately closing the drawer
    historyDrawer.classList.toggle('open');
    if (historyDrawer.classList.contains('open')) {
      loadHistory();
    }
  });

  closeDrawerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    historyDrawer.classList.remove('open');
  });

  // Close drawer if clicking outside
  document.addEventListener('click', (e) => {
    if (historyDrawer.classList.contains('open') &&
        !historyDrawer.contains(e.target) &&
        !e.target.closest('#history-toggle-btn')) {
      historyDrawer.classList.remove('open');
    }
  });

  // Clear History
  clearHistoryBtn.addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear your download history?')) {
      if (window.pywebview && window.pywebview.api) {
        await window.pywebview.api.clear_history();
      }
      loadHistory();
    }
  });

  // Load History from Python API
  async function loadHistory() {
    try {
      if (window.pywebview && window.pywebview.api) {
        const history = await window.pywebview.api.get_history();
        renderHistoryList(history);
      } else {
        // Mock data for standard browser testing
        const mockHistory = [
          {
            id: "1",
            title: "Rick Astley - Never Gonna Give You Up (Official Music Video)",
            filename: "Rick Astley - Never Gonna Give You Up.mp4",
            filepath: "/Users/max/Downloads/Rick Astley - Never Gonna Give You Up.mp4",
            url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            format: "video",
            timestamp: Math.floor(Date.now() / 1000) - 3600
          },
          {
            id: "2",
            title: "Lofi Hip Hop Radio - Beats to Relax/Study to",
            filename: "Lofi Beats.mp3",
            filepath: "/Users/max/Downloads/Lofi Beats.mp3",
            url: "https://www.youtube.com/watch?v=jfKfPfyJRdk",
            format: "audio",
            timestamp: Math.floor(Date.now() / 1000) - 86400
          }
        ];
        renderHistoryList(mockHistory);
      }
    } catch (err) {
      console.error("Failed to load history:", err);
    }
  }

  // Render History Card List
  function renderHistoryList(history) {
    historyList.innerHTML = "";
    if (!history || history.length === 0) {
      historyEmpty.classList.remove('hidden');
      historyList.classList.add('hidden');
      return;
    }

    historyEmpty.classList.add('hidden');
    historyList.classList.remove('hidden');

    history.forEach(item => {
      const itemEl = document.createElement('div');
      itemEl.className = 'history-item';

      const dateStr = new Date(item.timestamp * 1000).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const badgeClass = item.format === 'video' ? 'badge-video' : 'badge-audio';
      const badgeLabel = item.format === 'video' ? 'Video' : 'Audio';

      itemEl.innerHTML = `
        <div class="history-item-info">
          <span class="history-item-title" title="${item.title}">${item.title}</span>
          <div class="history-item-meta">
            <span class="history-item-badge ${badgeClass}">${badgeLabel}</span>
            <span>${dateStr}</span>
          </div>
        </div>
        <div class="history-item-actions">
          <button class="history-action-btn locate" title="Locate in Finder">
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            </svg>
          </button>
          <button class="history-action-btn delete" title="Delete from history">
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      `;

      // Locate in Finder Action
      const locateBtn = itemEl.querySelector('.locate');
      locateBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (window.pywebview && window.pywebview.api) {
          const success = await window.pywebview.api.reveal_in_finder(item.filepath);
          if (!success) {
            alert("Could not locate this file. It may have been moved, renamed, or deleted.");
          }
        } else {
          console.log(`Mock locating file path: ${item.filepath}`);
          alert(`Mock locating: ${item.filename}`);
        }
      });

      // Delete from History list
      const deleteBtn = itemEl.querySelector('.delete');
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (window.pywebview && window.pywebview.api) {
          await window.pywebview.api.remove_from_history(item.id);
          loadHistory();
        } else {
          console.log(`Mock deleting history item: ${item.id}`);
          const idx = history.findIndex(i => i.id === item.id);
          if (idx !== -1) history.splice(idx, 1);
          renderHistoryList(history);
        }
      });

      historyList.appendChild(itemEl);
    });
  }

  // Initial load
  if (window.pywebview && window.pywebview.api) {
    loadHistory();
    initDownloadFolder();
    fitWindow();
  } else {
    let pywebviewLoaded = false;
    window.addEventListener('pywebviewready', () => {
      pywebviewLoaded = true;
      loadHistory();
      initDownloadFolder();
      fitWindow();
    });
    
    // Fallback for standard browser after 150ms
    setTimeout(() => {
      if (!pywebviewLoaded && !(window.pywebview && window.pywebview.api)) {
        loadHistory();
        initDownloadFolder();
        fitWindow();
      }
    }, 150);
  }

});
