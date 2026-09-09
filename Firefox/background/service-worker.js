// Page Storage - Background Service Worker
// Gestiona los sitios habilitados y muestra en el badge el numero de entradas

function getOrigin(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.origin;
  } catch (e) {
    return null;
  }
}

async function isSiteEnabled(origin) {
  if (!origin) return false;
  const { enabledOrigins = {} } = await chrome.storage.local.get('enabledOrigins');
  return !!enabledOrigins[origin];
}

// Patron de coincidencia del origen, sin el puerto, igual que en el popup
function originPattern(origin) {
  const { protocol, hostname } = new URL(origin);
  return `${protocol}//${hostname}/*`;
}

// El acceso a cada sitio se concede por separado desde el popup
async function hasSitePermission(origin) {
  try {
    return await chrome.permissions.contains({ origins: [originPattern(origin)] });
  } catch (e) {
    return false;
  }
}

async function setSiteEnabled(origin, enabled) {
  const { enabledOrigins = {} } = await chrome.storage.local.get('enabledOrigins');
  if (enabled) {
    enabledOrigins[origin] = true;
  } else {
    delete enabledOrigins[origin];
  }
  await chrome.storage.local.set({ enabledOrigins });
}

function clearBadge(tabId) {
  chrome.action.setBadgeText({ tabId, text: '' });
}

// Contar cookies y entradas de almacenamiento web de la pestaña
async function countEntries(tabId, url) {
  let total = 0;

  try {
    const cookies = await chrome.cookies.getAll({ url });
    total += cookies.length;
  } catch (e) {
    // Sin permiso de host para esta URL
  }

  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        try {
          return localStorage.length + sessionStorage.length;
        } catch (e) {
          return 0;
        }
      }
    });
    total += (result && result.result) || 0;
  } catch (e) {
    // Pagina restringida, no se puede inyectar
  }

  return total;
}

async function updateBadge(tabId) {
  let tab;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch (e) {
    return;
  }

  const origin = getOrigin(tab.url);
  if (!origin || !(await isSiteEnabled(origin)) || !(await hasSitePermission(origin))) {
    clearBadge(tabId);
    return;
  }

  const total = await countEntries(tabId, tab.url);
  chrome.action.setBadgeText({ tabId, text: total > 0 ? String(total) : '' });
  chrome.action.setBadgeBackgroundColor({ tabId, color: '#512092' });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_SITE_STATE') {
    isSiteEnabled(message.origin).then((enabled) => sendResponse({ enabled }));
    return true;
  }

  if (message.type === 'TOGGLE_SITE') {
    const { origin, tabId, enabled } = message;
    setSiteEnabled(origin, enabled).then(async () => {
      if (enabled) {
        await updateBadge(tabId);
      } else {
        clearBadge(tabId);
      }
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === 'REFRESH_BADGE') {
    updateBadge(message.tabId).then(() => sendResponse({ success: true }));
    return true;
  }

  return false;
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    clearBadge(tabId);
  }

  if (changeInfo.status === 'complete') {
    updateBadge(tabId);
  }
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  updateBadge(tabId);
});

// Si el usuario revoca el acceso a un sitio desde el navegador, dejar de gestionarlo
chrome.permissions.onRemoved.addListener(async () => {
  const { enabledOrigins = {} } = await chrome.storage.local.get('enabledOrigins');
  for (const origin of Object.keys(enabledOrigins)) {
    if (!(await hasSitePermission(origin))) {
      await setSiteEnabled(origin, false);
    }
  }
});
