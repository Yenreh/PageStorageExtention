// Page Storage - Popup Script
// Lista, filtra, copia, edita y borra cookies, localStorage y sessionStorage

const VALUE_PREVIEW_LENGTH = 120;

// Clonar un icono declarado como plantilla en el popup
function iconNode(name) {
  return document.getElementById(`icon-${name}`).content.cloneNode(true);
}

// Patron de coincidencia del origen para los permisos opcionales.
// Se omite el puerto: Chrome resuelve la URL de cada cookie sin el y filtra
// los resultados de cookies.getAll con los permisos concedidos
function originPattern(origin) {
  const { protocol, hostname } = new URL(origin);
  return `${protocol}//${hostname}/*`;
}

// El acceso a cada sitio se concede por separado al activar el interruptor
async function hasSitePermission(origin) {
  try {
    return await chrome.permissions.contains({ origins: [originPattern(origin)] });
  } catch (e) {
    return false;
  }
}

async function requestSitePermission(origin) {
  try {
    return await chrome.permissions.request({ origins: [originPattern(origin)] });
  } catch (e) {
    return false;
  }
}

async function removeSitePermission(origin) {
  try {
    await chrome.permissions.remove({ origins: [originPattern(origin)] });
  } catch (e) {
    // El permiso ya no estaba concedido
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const currentUrl = document.getElementById('currentUrl');
  const toggleBar = document.getElementById('toggleBar');
  const enableToggle = document.getElementById('enableToggle');
  const searchBar = document.getElementById('searchBar');
  const searchInput = document.getElementById('searchInput');
  const searchClear = document.getElementById('searchClear');
  const sections = document.getElementById('sections');
  const noData = document.getElementById('noData');
  const noDataTitle = document.getElementById('noDataTitle');
  const noDataHint = document.getElementById('noDataHint');
  const clearAllBtn = document.getElementById('clearAllBtn');
  const refreshBtn = document.getElementById('refreshBtn');
  const reloadBtn = document.getElementById('reloadBtn');
  const toast = document.getElementById('toast');

  const lists = {
    cookies: document.getElementById('listCookies'),
    localStorage: document.getElementById('listLocalStorage'),
    sessionStorage: document.getElementById('listSessionStorage')
  };

  const counters = {
    cookies: document.getElementById('countCookies'),
    localStorage: document.getElementById('countLocalStorage'),
    sessionStorage: document.getElementById('countSessionStorage')
  };

  const entries = { cookies: [], localStorage: [], sessionStorage: [] };

  let currentTab = null;
  let currentOrigin = null;
  let filter = '';
  let editing = null;
  let toastTimer = null;

  function t(key) {
    return chrome.i18n.getMessage(key) || key;
  }

  function applyTranslations() {
    document.title = t('popupTitle');
    document.documentElement.lang = chrome.i18n.getUILanguage();

    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const message = chrome.i18n.getMessage(el.getAttribute('data-i18n'));
      if (message) el.textContent = message;
    });

    document.querySelectorAll('[data-i18n-title]').forEach((el) => {
      const message = chrome.i18n.getMessage(el.getAttribute('data-i18n-title'));
      if (message) el.title = message;
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const message = chrome.i18n.getMessage(el.getAttribute('data-i18n-placeholder'));
      if (message) el.placeholder = message;
    });
  }

  function showToast(key) {
    toast.textContent = t(key);
    toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 1800);
  }

  async function getCurrentTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  // Extraer el origen (protocolo + host) de una URL, o null si no aplica
  function getOrigin(url) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
      return parsed.origin;
    } catch (e) {
      return null;
    }
  }

  // URL con la que se identifica una cookie para leerla o escribirla
  function cookieUrl(cookie) {
    const domain = cookie.domain.startsWith('.') ? cookie.domain.slice(1) : cookie.domain;
    return `${cookie.secure ? 'https' : 'http'}://${domain}${cookie.path}`;
  }

  function truncate(value) {
    const text = value === null || value === undefined ? '' : String(value);
    return text.length > VALUE_PREVIEW_LENGTH
      ? `${text.slice(0, VALUE_PREVIEW_LENGTH)}...`
      : text;
  }

  // Estado visible: lista de datos o mensaje informativo
  function showState(state) {
    const hasData = state === 'data';
    sections.style.display = hasData ? 'block' : 'none';
    searchBar.style.display = hasData ? 'flex' : 'none';
    noData.style.display = hasData ? 'none' : 'block';

    if (hasData) return;

    noDataTitle.textContent = state === 'restricted' ? t('restrictedTitle') : t('disabledTitle');
    noDataHint.textContent = state === 'restricted' ? t('restrictedHint') : t('disabledHint');
  }

  function setActionsEnabled(enabled) {
    clearAllBtn.disabled = !enabled;
    refreshBtn.disabled = !enabled;
    reloadBtn.disabled = !enabled;
    document.querySelectorAll('.section-btn').forEach((btn) => {
      btn.disabled = !enabled;
    });
  }

  // Ejecutar codigo en la pagina para leer o modificar el almacenamiento web
  async function runInPage(func, args = []) {
    try {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: currentTab.id },
        func,
        args
      });
      return result ? result.result : null;
    } catch (e) {
      return null;
    }
  }

  function readWebStorage(previewLength) {
    const dump = (storage) => {
      const list = [];
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        const value = storage.getItem(key) || '';
        list.push({
          key,
          preview: value.length > previewLength ? `${value.slice(0, previewLength)}...` : value
        });
      }
      return list;
    };

    try {
      return { localStorage: dump(localStorage), sessionStorage: dump(sessionStorage) };
    } catch (e) {
      return null;
    }
  }

  // Valor completo de una entrada: las cookies ya lo traen, el storage se consulta
  async function getFullValue(area, entry) {
    if (area === 'cookies') return entry.cookie.value;

    const value = await runInPage(
      (name, key) => {
        try {
          return window[name].getItem(key);
        } catch (e) {
          return null;
        }
      },
      [area, entry.key]
    );

    return value === null ? '' : value;
  }

  async function setValue(area, entry, value) {
    if (area !== 'cookies') {
      const done = await runInPage(
        (name, key, newValue) => {
          try {
            window[name].setItem(key, newValue);
            return true;
          } catch (e) {
            return false;
          }
        },
        [area, entry.key, value]
      );
      return done === true;
    }

    const cookie = entry.cookie;
    const details = {
      url: cookieUrl(cookie),
      name: cookie.name,
      value,
      path: cookie.path,
      secure: cookie.secure,
      httpOnly: cookie.httpOnly,
      storeId: cookie.storeId
    };

    if (!cookie.hostOnly) details.domain = cookie.domain;
    if (!cookie.session && cookie.expirationDate) details.expirationDate = cookie.expirationDate;
    if (['no_restriction', 'lax', 'strict'].includes(cookie.sameSite)) {
      details.sameSite = cookie.sameSite;
    }
    if (cookie.partitionKey) details.partitionKey = cookie.partitionKey;

    try {
      const saved = await chrome.cookies.set(details);
      return !!saved;
    } catch (e) {
      return false;
    }
  }

  async function copyValue(area, entry) {
    const value = await getFullValue(area, entry);

    try {
      await navigator.clipboard.writeText(value);
      showToast('toastCopied');
    } catch (e) {
      showToast('toastCopyError');
    }
  }

  function matchesFilter(entry) {
    if (!filter) return true;
    const haystack = `${entry.key} ${entry.preview} ${entry.meta || ''}`.toLowerCase();
    return haystack.includes(filter);
  }

  function iconButton(className, titleKey, iconName, onClick) {
    const button = document.createElement('button');
    button.className = className;
    button.title = t(titleKey);
    button.appendChild(iconNode(iconName));
    button.addEventListener('click', onClick);
    return button;
  }

  function buildEditorRow(area, entry) {
    const item = document.createElement('li');
    item.className = 'entry editing';

    const key = document.createElement('span');
    key.className = 'entry-key';
    key.textContent = entry.key;

    const editor = document.createElement('textarea');
    editor.className = 'entry-editor';
    editor.value = editing.value;
    editor.spellcheck = false;

    const actions = document.createElement('div');
    actions.className = 'editor-actions';

    const cancel = document.createElement('button');
    cancel.className = 'editor-btn';
    cancel.textContent = t('cancelEditTitle');
    cancel.addEventListener('click', () => {
      editing = null;
      render();
    });

    const save = document.createElement('button');
    save.className = 'editor-btn primary';
    save.textContent = t('saveEntryTitle');
    save.addEventListener('click', async () => {
      save.disabled = true;
      const ok = await setValue(area, entry, editor.value);
      editing = null;
      showToast(ok ? 'toastSaved' : 'toastSaveError');
      await loadData();
    });

    editor.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        editing = null;
        render();
      }
    });

    actions.appendChild(cancel);
    actions.appendChild(save);

    item.appendChild(key);
    item.appendChild(editor);
    item.appendChild(actions);

    setTimeout(() => {
      item.scrollIntoView({ block: 'nearest' });
      editor.focus();
    }, 0);
    return item;
  }

  function buildRow(area, entry) {
    if (editing && editing.area === area && editing.key === entry.key) {
      return buildEditorRow(area, entry);
    }

    const item = document.createElement('li');
    item.className = 'entry';

    const info = document.createElement('div');
    info.className = 'entry-info';

    const key = document.createElement('span');
    key.className = 'entry-key';
    key.textContent = entry.key;
    key.title = entry.key;

    const value = document.createElement('span');
    value.className = 'entry-value';
    value.textContent = entry.preview;
    value.title = entry.preview;

    info.appendChild(key);
    info.appendChild(value);

    if (entry.meta) {
      const meta = document.createElement('span');
      meta.className = 'entry-meta';
      meta.textContent = entry.meta;
      meta.title = entry.meta;
      info.appendChild(meta);
    }

    const actions = document.createElement('div');
    actions.className = 'entry-actions';
    actions.appendChild(
      iconButton('entry-btn', 'copyEntryTitle', 'copy', () => copyValue(area, entry))
    );
    actions.appendChild(
      iconButton('entry-btn', 'editEntryTitle', 'edit', async () => {
        editing = { area, key: entry.key, value: await getFullValue(area, entry) };
        render();
      })
    );
    actions.appendChild(
      iconButton('entry-btn delete', 'deleteEntryTitle', 'remove', () => deleteEntry(area, entry))
    );

    item.appendChild(info);
    item.appendChild(actions);
    return item;
  }

  function renderArea(area) {
    const list = lists[area];
    const all = entries[area];
    const visible = all.filter(matchesFilter);

    counters[area].textContent = filter ? `${visible.length}/${all.length}` : String(all.length);
    list.replaceChildren();

    if (visible.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'entry-empty';
      empty.textContent = filter && all.length > 0 ? t('noMatches') : t('emptyList');
      list.appendChild(empty);
      return;
    }

    visible.forEach((entry) => list.appendChild(buildRow(area, entry)));
  }

  function render() {
    Object.keys(entries).forEach(renderArea);
  }

  async function loadCookies() {
    const cookies = await chrome.cookies.getAll({ url: currentTab.url });
    cookies.sort((a, b) => a.name.localeCompare(b.name));
    entries.cookies = cookies.map((cookie) => ({
      key: cookie.name,
      preview: truncate(cookie.value),
      meta: `${cookie.domain}${cookie.path}`,
      cookie
    }));
  }

  async function loadWebStorage() {
    const data = await runInPage(readWebStorage, [VALUE_PREVIEW_LENGTH]);

    if (!data) {
      entries.localStorage = [];
      entries.sessionStorage = [];
      showToast('toastError');
      return;
    }

    entries.localStorage = data.localStorage;
    entries.sessionStorage = data.sessionStorage;
  }

  async function loadData() {
    showState('data');
    setActionsEnabled(true);
    await Promise.all([loadCookies(), loadWebStorage()]);
    render();
    refreshBadge();
  }

  async function deleteEntry(area, entry) {
    if (area === 'cookies') {
      const cookie = entry.cookie;
      const details = { url: cookieUrl(cookie), name: cookie.name, storeId: cookie.storeId };
      if (cookie.partitionKey) details.partitionKey = cookie.partitionKey;
      await chrome.cookies.remove(details);
    } else {
      await runInPage(
        (name, key) => {
          try {
            window[name].removeItem(key);
          } catch (e) {
            // Almacenamiento bloqueado por el sitio
          }
        },
        [area, entry.key]
      );
    }

    showToast('toastEntryDeleted');
    await loadData();
  }

  async function clearCookies() {
    const cookies = await chrome.cookies.getAll({ url: currentTab.url });
    await Promise.all(
      cookies.map((cookie) => {
        const details = { url: cookieUrl(cookie), name: cookie.name, storeId: cookie.storeId };
        if (cookie.partitionKey) details.partitionKey = cookie.partitionKey;
        return chrome.cookies.remove(details);
      })
    );
  }

  async function clearArea(area) {
    if (area === 'cookies') {
      await clearCookies();
      return;
    }

    await runInPage(
      (name) => {
        try {
          window[name].clear();
        } catch (e) {
          // Almacenamiento bloqueado por el sitio
        }
      },
      [area]
    );
  }

  async function clearAll() {
    await clearArea('cookies');
    await clearArea('localStorage');
    await clearArea('sessionStorage');
    showToast('toastCleared');
    await loadData();
  }

  function refreshBadge() {
    chrome.runtime.sendMessage({ type: 'REFRESH_BADGE', tabId: currentTab.id }).catch(() => {});
  }

  async function loadSiteState() {
    if (!currentOrigin) {
      enableToggle.checked = false;
      enableToggle.disabled = true;
      toggleBar.title = t('toggleUnavailable');
      setActionsEnabled(false);
      showState('restricted');
      return;
    }

    toggleBar.title = '';
    const response = await chrome.runtime.sendMessage({
      type: 'GET_SITE_STATE',
      origin: currentOrigin
    });

    let enabled = !!(response && response.enabled);

    // El acceso al sitio pudo revocarse desde el navegador
    if (enabled && !(await hasSitePermission(currentOrigin))) {
      enabled = false;
      await chrome.runtime.sendMessage({
        type: 'TOGGLE_SITE',
        origin: currentOrigin,
        tabId: currentTab.id,
        enabled: false
      });
    }

    enableToggle.disabled = false;
    enableToggle.checked = enabled;

    if (enabled) {
      await loadData();
    } else {
      setActionsEnabled(false);
      showState('disabled');
    }
  }

  async function toggleSite() {
    if (!currentOrigin) return;

    const enabled = enableToggle.checked;

    // Pedir el acceso al sitio es lo primero, para no perder el gesto del usuario
    if (enabled && !(await requestSitePermission(currentOrigin))) {
      enableToggle.checked = false;
      showToast('toastPermissionDenied');
      return;
    }

    enableToggle.disabled = true;

    try {
      await chrome.runtime.sendMessage({
        type: 'TOGGLE_SITE',
        origin: currentOrigin,
        tabId: currentTab.id,
        enabled
      });

      if (enabled) {
        await loadData();
      } else {
        await removeSitePermission(currentOrigin);
        setActionsEnabled(false);
        showState('disabled');
      }
    } finally {
      enableToggle.disabled = false;
    }
  }

  function applyFilter(value) {
    filter = value.trim().toLowerCase();
    searchClear.hidden = searchInput.value.length === 0;
    render();
  }

  async function init() {
    applyTranslations();
    setActionsEnabled(false);

    currentTab = await getCurrentTab();
    if (!currentTab) {
      showState('restricted');
      return;
    }

    currentOrigin = getOrigin(currentTab.url);
    currentUrl.textContent = currentTab.url;
    currentUrl.title = currentTab.url;

    await loadSiteState();
  }

  enableToggle.addEventListener('change', toggleSite);
  clearAllBtn.addEventListener('click', clearAll);
  refreshBtn.addEventListener('click', loadData);
  reloadBtn.addEventListener('click', async () => {
    await chrome.tabs.reload(currentTab.id);
    window.close();
  });

  searchInput.addEventListener('input', () => applyFilter(searchInput.value));
  searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && searchInput.value) {
      event.preventDefault();
      searchInput.value = '';
      applyFilter('');
    }
  });
  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    applyFilter('');
    searchInput.focus();
  });

  document.querySelectorAll('[data-clear]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await clearArea(btn.dataset.clear);
      showToast('toastSectionCleared');
      await loadData();
    });
  });

  init();
});
