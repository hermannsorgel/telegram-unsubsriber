const CONFIG = {
  TELEGRAM_URL_FULL: 'https://web.telegram.org/k/',
  MSG_LOG: 'TG_CLEANER_LOG',
};

let activeTab = null;

// 2. UI HELPER FUNCTIONS
const UI = {
  // Navigation & Views
  showView: (viewId) => {
    document.getElementById('mainInterface').style.display = viewId === 'main'
      ? 'block'
      : 'none';
    document.getElementById('wrongTabInterface').style.display =
      viewId === 'wrongTab' ? 'block' : 'none';
  },

  showChannelList: (show) => {
    document.getElementById('channelListContainer').style.display = show
      ? 'block'
      : 'none';
    document.getElementById('scanChannelsBtn').style.display = show
      ? 'none'
      : 'block';
    document.getElementById('leaveSelectedBtn').style.display = show
      ? 'block'
      : 'none';
  },

  // Logging
  log: (text, clear = false) => {
    const logEl = document.getElementById('log');
    if (!logEl) return;
    if (clear || (logEl.placeholder && !logEl.value)) logEl.value = '';
    logEl.value += text + '\n';
    logEl.scrollTop = logEl.scrollHeight;
  },

  // Button states
  setBusy: (isBusy) => {
    document.getElementById('scanChannelsBtn').disabled = isBusy;
    const leaveBtn = document.getElementById('leaveSelectedBtn');
    if (leaveBtn) leaveBtn.disabled = isBusy;
  },

  // Dialog
  showConfirm: (message, onConfirm, onCancel) => {
    const dialog = document.getElementById('confirmDialog');
    const msgEl = document.getElementById('confirmMessage');
    const yesBtn = document.getElementById('confirmYes');
    const noBtn = document.getElementById('confirmNo');

    msgEl.innerText = message;
    dialog.style.display = 'block';
    UI.setBusy(true);
    document.getElementById('leaveSelectedBtn').style.display = 'none';

    const cleanup = () => {
      dialog.style.display = 'none';
      yesBtn.removeEventListener('click', handleYes);
      noBtn.removeEventListener('click', handleNo);
    };

    const handleYes = () => {
      cleanup();
      document.getElementById('leaveSelectedBtn').style.display = 'block';
      onConfirm();
    };

    const handleNo = () => {
      cleanup();
      UI.setBusy(false);
      document.getElementById('leaveSelectedBtn').style.display = 'block';
      onCancel();
    };

    yesBtn.addEventListener('click', handleYes);
    noBtn.addEventListener('click', handleNo);
  },

  // DOM Rendering
  renderChannelList: (channels) => {
    const listItemsDiv = document.getElementById('channelListItems');
    listItemsDiv.innerHTML = '';

    channels.forEach((channel) => {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'channel-item';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = channel.id;
      checkbox.checked = true; // Checked by default
      checkbox.id = `chk_${channel.id}`;

      const label = document.createElement('label');
      label.htmlFor = `chk_${channel.id}`;
      label.innerText = channel.title;

      itemDiv.appendChild(checkbox);
      itemDiv.appendChild(label);
      listItemsDiv.appendChild(itemDiv);
    });
  },

  getSelectedChannelIds: () => {
    const checkboxes = document.querySelectorAll(
      '#channelListItems input[type="checkbox"]:checked',
    );
    return Array.from(checkboxes).map((checkbox) => checkbox.value);
  },

  toggleAllCheckboxes: (isUnchecking) => {
    const checkboxes = document.querySelectorAll(
      '#channelListItems input[type="checkbox"]',
    );
    checkboxes.forEach((checkbox) => (checkbox.checked = !isUnchecking));
  },
};

// 3. PURE UI EVENT LISTENERS
// redirect Button
document.getElementById('redirectToWebK').addEventListener('click', () => {
  chrome.tabs.create({ url: CONFIG.TELEGRAM_URL_FULL });
});

// Select/Unselect all channels
document.getElementById('toggleSelectAll').addEventListener('click', (e) => {
  const isUnchecking = e.target.innerText === 'Uncheck all';
  UI.toggleAllCheckboxes(isUnchecking);
  e.target.innerText = isUnchecking ? 'Check all' : 'Uncheck all';
});

// 4. MAIN
// initialization
document.addEventListener('DOMContentLoaded', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  activeTab = tab;

  const isWebK = tab?.url?.includes(CONFIG.TELEGRAM_URL_FULL);

  if (isWebK) {
    UI.showView('main');
    await checkExistingProcess(isWebK);
  } else {
    UI.showView('wrongTab');
  }
});

async function checkExistingProcess(isWebK) {
  const { isCleaning } = await chrome.storage.local.get(['isCleaning']);
  if (!isCleaning) return;

  let isActuallyRunning = false;
  if (isWebK && activeTab?.id) {
    try {
      const checkRes = await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        world: 'MAIN',
        func: () => !!window.__tgCleanerChannels,
      });
      isActuallyRunning = checkRes?.[0]?.result === true;
    } catch (error) {
      isActuallyRunning = false;
    }
  }

  if (isActuallyRunning) {
    UI.setBusy(true);
    UI.log('Task in progress in the background...', true);
  } else {
    await chrome.storage.local.set({ isCleaning: false });
    UI.setBusy(false);
  }
}

// scan channels
document
  .getElementById('scanChannelsBtn')
  .addEventListener('click', async () => {
    if (!activeTab?.id) return;

    UI.log('Scanning channels...', true); // true = clear log
    UI.setBusy(true);

    try {
      const injectionResult = await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        world: 'MAIN',
        func: scanChannelsAction,
      });

      if (!injectionResult?.[0]?.result) {
        UI.log(
          '[Error] Script injection returned no result. Is the page loaded?',
        );
        return;
      }

      const { result } = injectionResult[0];

      if (result.error) {
        UI.log(`[Error] Scan failed: ${result.error}`);
        return;
      }

      if (result.count === 0) {
        UI.log('No channels found.');
        return;
      }

      const channelWord = result.count === 1 ? 'channel' : 'channels';
      UI.log(`Scan complete. ${result.count} ${channelWord} found.`);

      UI.renderChannelList(result.channels);
      UI.showChannelList(true);
    } catch (err) {
      UI.log(`[Error] Script injection failed: ${err.message || err}`);
    } finally {
      UI.setBusy(false);
    }
  });

const getSelection = () => {
  const ids = UI.getSelectedChannelIds();
  return ids.length > 0 ? ids : null;
};

// leave channels
document.getElementById('leaveSelectedBtn').addEventListener('click', () => {
  const selection = getSelection();
  if (!selection) {
    UI.log('No channels selected to leave.');
    return;
  }

  const channelWord = selection.length === 1 ? 'channel' : 'channels';
  const confirmMsg =
    `You are about to leave ${selection.length} ${channelWord}. This action can't be undone. Are you sure?`;

  UI.showConfirm(
    confirmMsg,
    async () => {
      const selection = getSelection();
      if (!selection) {
        UI.log('No channels selected. Operation cancelled.');
        UI.setBusy(false);
        return;
      }

      // This listens to window.postMessage and forwards to the popup
      await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: () => {
          if (window.__tgLogBridge) return; // Prevent double-injection
          window.__tgLogBridge = true;
          window.addEventListener('message', (event) => {
            if (event.data?.type === 'TG_CLEANER_LOG') {
              // Forward to popup, silently fail if popup is closed
              chrome.runtime.sendMessage(event.data).catch(() => {});
            }
          });
        },
      });

      // User Confirmed Action
      await chrome.storage.local.set({ isCleaning: true });
      chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        world: 'MAIN',
        func: leaveChannelsAction,
        args: [selection],
      });

      UI.showChannelList(false);
    },
    () => {
      // User Cancelled Action
    },
  );
});

// background Listeners (Handling Stage 2 Completion)
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === CONFIG.MSG_LOG) {
    UI.log(message.text);

    if (message.isFinished) {
      UI.setBusy(false);
      chrome.storage.local.set({ isCleaning: false });
      UI.showChannelList(false); // Reset UI state after completion
    }
  }
});

// 5. INJECTED SCRIPTS
function scanChannelsAction() {
  try {
    const api = (method, params) =>
      window.rootScope?.managers?.apiManager?.invokeApi(method, params || {});

    if (!window.rootScope?.managers?.apiManager) {
      return {
        error:
          'Telegram API manager not found. Make sure you are logged into Telegram Web.',
      };
    }

    const allChannels = [];
    const seenChatIds = new Set();

    const finish = () => {
      window.__tgCleanerChannels = allChannels;
      return {
        count: allChannels.length,
        channels: allChannels.map((channel) => ({
          id: String(channel.id),
          title: channel.title || String(channel.id),
        })),
      };
    };

    const getNextPage = (offsetDate, offsetId, offsetPeer) => {
      return api('messages.getDialogs', {
        exclude_pinned: false,
        folder_id: 0,
        offset_date: offsetDate || 0,
        offset_id: offsetId || 0,
        offset_peer: offsetPeer || { _: 'inputPeerEmpty' },
        limit: 100,
        hash: 0,
      }).then((response) => {
        if (
          !response ||
          !response.chats ||
          !response.dialogs ||
          response.dialogs.length === 0
        ) {
          return finish();
        }

        const dialogPeerIds = new Set(
          response.dialogs.map((dialog) => {
            const peer = dialog.peer;
            return String(peer.channel_id || peer.chat_id || peer.user_id);
          }),
        );

        response.chats.forEach((chat) => {
          if (
            (chat._ === 'channel' || chat._ === 'chat') &&
            !chat.left &&
            !chat.deactivated &&
            !chat.creator &&
            !chat.kicked &&
            !seenChatIds.has(String(chat.id)) &&
            dialogPeerIds.has(String(chat.id))
          ) {
            seenChatIds.add(String(chat.id));
            allChannels.push(chat);
          }
        });

        if (response.dialogs.length < 100) return finish();

        const lastDialog = response.dialogs[response.dialogs.length - 1];
        const lastPeer = lastDialog.peer;
        const lastMessageId = lastDialog.top_message;

        const message = response.messages.find(
          (msg) => msg.id === lastMessageId,
        );
        const lastDate = message ? message.date : Math.floor(Date.now() / 1000);

        let nextPeer = { _: 'inputPeerEmpty' };
        if (lastPeer._ === 'peerUser') {
          const user = response.users.find((u) => u.id === lastPeer.user_id);
          if (user) {
            nextPeer = {
              _: 'inputPeerUser',
              user_id: user.id,
              access_hash: user.access_hash,
            };
          }
        } else if (lastPeer._ === 'peerChat') {
          nextPeer = { _: 'inputPeerChat', chat_id: lastPeer.chat_id };
        } else if (lastPeer._ === 'peerChannel') {
          const channel = response.chats.find(
            (chat) => chat.id === lastPeer.channel_id,
          );
          if (channel) {
            nextPeer = {
              _: 'inputPeerChannel',
              channel_id: channel.id,
              access_hash: channel.access_hash,
            };
          }
        }

        return new Promise((res) => setTimeout(res, 500)).then(() =>
          getNextPage(lastDate, lastMessageId, nextPeer)
        );
      });
    };

    return getNextPage(0, 0, { _: 'inputPeerEmpty' }).catch((error) => ({
      error: error.message || String(error),
    }));
  } catch (error) {
    return { error: error.message || String(error) };
  }
}

function leaveChannelsAction(selectedIds) {
  const log = (text, isFinished = false) => {
    window.postMessage({ type: 'TG_CLEANER_LOG', text, isFinished }, '*');
  };

  const api = (method, params) =>
    window.rootScope?.managers?.apiManager?.invokeApi(method, params || {});

  if (!window.rootScope?.managers?.apiManager) {
    log('[Error] Telegram API manager not found.', true);
    return;
  }

  let channels = window.__tgCleanerChannels || [];
  channels = channels.filter((channel) =>
    selectedIds.includes(String(channel.id))
  );

  if (!channels || !channels.length) {
    log('[Error] No valid channels selected to leave.', true);
    return;
  }

  const channelWord = channels.length === 1 ? 'channel' : 'channels';
  log(`Leaving ${channels.length} ${channelWord}...`);

  (async () => {
    for (let i = 0; i < channels.length; i++) {
      const channel = channels[i];
      try {
        // Generate the URL beforehand for both blocks
        const url = channel.username
          ? `https://t.me/${channel.username}`
          : `https://t.me/c/${channel.id}`;

        if (channel._ === 'channel') {
          await api('channels.leaveChannel', {
            channel: {
              _: 'inputChannel',
              channel_id: channel.id,
              access_hash: channel.access_hash,
            },
          });
          log(
            `Left channel: "${channel.title || channel.id}" - ${url} (${
              i + 1
            }/${channels.length})`,
          );
        } else if (channel._ === 'chat') {
          await api('messages.deleteChatUser', {
            chat_id: channel.id,
            user_id: { _: 'inputUserSelf' },
          });
          log(
            `Left legacy group: "${channel.title || channel.id}" - ${url} (${
              i + 1
            }/${channels.length})`,
          );
        }

        if (i < channels.length - 1) {
          await new Promise((res) => setTimeout(res, 700));
        }
      } catch (error) {
        const errMsg = error.message || String(error);
        log(
          `[Error] Failed to leave "${channel.title || channel.id}": ${errMsg}`,
        );
      }
    }
    log(`✓ Done`, true);
    window.__tgCleanerChannels = null;
  })();
}
