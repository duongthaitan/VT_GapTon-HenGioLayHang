// ============================================================
//  VTP Tool – Background Service Worker v3.1
//  ✦ Mở Side Panel khi nhấn icon extension
//  ✦ Xử lý GhiĐơn: Google Sheets API, queue, stats
// ============================================================

// ── Mở Side Panel khi nhấn icon ─────────────────────────
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error('[VTP Background]', error));

// ════════════════════════════════════════
//  GHIĐƠN — Queue xử lý tuần tự
// ════════════════════════════════════════
const ghidonQueue = [];
let ghidonProcessing = false;

// ── Lắng nghe message ───────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  // ── GhiĐơn: Lưu đơn hàng ──
  if (message.action === 'GHIDON_SAVE_ORDER') {
    ghidonQueue.push({ data: message.data, sendResponse });
    ghidonProcessQueue();
    return true; // async response
  }

  // ── GhiĐơn: Cập nhật stats (sidepanel yêu cầu refresh) ──
  if (message.action === 'GHIDON_UPDATE_STATS') {
    chrome.storage.local.get(['ghidon_todayStats'], (r) => {
      chrome.storage.local.set({ __GHIDON_STATS_UPDATED__: Date.now() });
    });
    sendResponse({ success: true });
    return false;
  }

  // ── GhiĐơn: Trạng thái tài khoản đăng nhập ──
  if (message.action === 'GHIDON_ACCOUNT_STATUS') {
    chrome.storage.local.set({
      ghidon_accountVerified: message.verified,
      ghidon_currentUser:     message.user    || null,
      ghidon_requiredUser:    message.required || 'DƯƠNG THÁI TÂN',
    });
    sendResponse({ success: true });
    return false;
  }

  // ── GhiĐơn: Lấy settings & stats ──
  if (message.action === 'GHIDON_GET_SETTINGS') {
    chrome.storage.local.get([
      'ghidon_sheetWebAppUrl',
      'ghidon_sheetId',
      'ghidon_sheetName',
      'ghidon_buuTaName',
      'ghidon_enabled',
      'ghidon_soundEnabled',
      'ghidon_duplicateCheck',
      'ghidon_scanInterval',
      'ghidon_minBarcodeLen',
      'ghidon_todayStats',
      'ghidon_pendingOrders',
      'ghidon_accountVerified',
      'ghidon_currentUser',
      'ghidon_requiredUser',
    ], (result) => {
      sendResponse(result);
    });
    return true;
  }

  // ── GhiĐơn: Lưu settings ──
  if (message.action === 'GHIDON_SAVE_SETTINGS') {
    chrome.storage.local.set(message.settings, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  // ── GhiĐơn: Test kết nối Sheet ──
  if (message.action === 'GHIDON_TEST_CONNECTION') {
    ghidonTestConnection().then(sendResponse);
    return true;
  }

  // ── GhiĐơn: Sync đơn pending ──
  if (message.action === 'GHIDON_SYNC_PENDING') {
    ghidonSyncPending().then(() => sendResponse({ success: true }));
    return true;
  }

  // ── GhiĐơn: Reset stats hôm nay ──
  if (message.action === 'GHIDON_RESET_TODAY') {
    const today = new Date().toISOString().split('T')[0];
    chrome.storage.local.set({
      ghidon_todayStats: { date: today, count: 0, totalCOD: 0, orders: [] }
    }, () => sendResponse({ success: true }));
    return true;
  }
});

// ── Xử lý queue tuần tự ─────────────────────────────────
async function ghidonProcessQueue() {
  if (ghidonProcessing || ghidonQueue.length === 0) return;
  ghidonProcessing = true;
  while (ghidonQueue.length > 0) {
    const item = ghidonQueue.shift();
    try {
      const result = await ghidonSaveToSheet(item.data);
      item.sendResponse(result);
    } catch (err) {
      item.sendResponse({ success: false, error: err.message });
    }
  }
  ghidonProcessing = false;
}

// ── Ghi dữ liệu vào Google Sheet ────────────────────────
async function ghidonSaveToSheet(orderData) {
  const settings = await ghidonGetSettings();
  if (!settings.ghidon_sheetWebAppUrl) {
    return ghidonSaveLocal(orderData);
  }
  orderData.buuTa = settings.ghidon_buuTaName || '';
  try {
    const response = await fetch(settings.ghidon_sheetWebAppUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'addOrder',
        sheetName: settings.ghidon_sheetName || 'Trang tính1',
        data: orderData,
      }),
      redirect: 'follow',
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    const result = await response.json();
    if (result.status === 'success') {
      await ghidonUpdateStats(orderData);
      return { success: true, row: result.row };
    } else if (result.status === 'duplicate') {
      return { success: false, error: result.message, isDuplicate: true };
    } else {
      throw new Error(result.message || 'Lỗi từ Apps Script');
    }
  } catch (err) {
    console.error('[VTP GhiĐơn BG] Sheet API error:', err);
    await ghidonSaveLocal(orderData);
    return { success: false, error: err.message, savedLocally: true };
  }
}

// ── Lưu tạm local khi mất mạng ──────────────────────────
async function ghidonSaveLocal(orderData) {
  const settings = await ghidonGetSettings();
  const pendingOrders = settings.ghidon_pendingOrders || [];
  pendingOrders.push({ ...orderData, _savedAt: Date.now(), _synced: false });
  await chrome.storage.local.set({ ghidon_pendingOrders: pendingOrders });
  await ghidonUpdateStats(orderData);
  return { success: true, savedLocally: true };
}

// ── Sync đơn pending ────────────────────────────────────
async function ghidonSyncPending() {
  const settings = await ghidonGetSettings();
  if (!settings.ghidon_sheetWebAppUrl) return;
  const pendingOrders = settings.ghidon_pendingOrders || [];
  if (pendingOrders.length === 0) return;
  console.log(`[VTP GhiĐơn BG] Syncing ${pendingOrders.length} pending orders...`);
  const remaining = [];
  for (const order of pendingOrders) {
    try {
      const response = await fetch(settings.ghidon_sheetWebAppUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'addOrder',
          sheetName: settings.ghidon_sheetName || 'Trang tính1',
          data: order,
        }),
        redirect: 'follow',
      });
      if (!response.ok) remaining.push(order);
    } catch (err) {
      remaining.push(order);
    }
  }
  await chrome.storage.local.set({ ghidon_pendingOrders: remaining });
  console.log(`[VTP GhiĐơn BG] Sync done. ${remaining.length} orders still pending.`);
}

// ── Cập nhật thống kê ngày ───────────────────────────────
async function ghidonUpdateStats(orderData) {
  const today = new Date().toISOString().split('T')[0];
  const settings = await ghidonGetSettings();
  let stats = settings.ghidon_todayStats || {};
  if (stats.date !== today) {
    stats = { date: today, count: 0, totalCOD: 0, orders: [] };
  }
  stats.count += 1;
  stats.totalCOD += parseInt(orderData.tienCOD || '0', 10) || 0;
  stats.orders.push({
    ma: orderData.maPhieuGui,
    time: orderData.thoiGianQuet,
    cod: orderData.tienCOD || '0',
  });
  if (stats.orders.length > 50) stats.orders = stats.orders.slice(-50);
  await chrome.storage.local.set({ ghidon_todayStats: stats });
}

// ── Test kết nối Sheet ───────────────────────────────────
async function ghidonTestConnection() {
  const settings = await ghidonGetSettings();
  if (!settings.ghidon_sheetWebAppUrl) {
    return { success: false, error: 'Chưa cấu hình URL Apps Script' };
  }
  try {
    const response = await fetch(settings.ghidon_sheetWebAppUrl + '?action=ping', {
      method: 'GET',
      redirect: 'follow',
    });
    if (response.ok) {
      const result = await response.json();
      return { success: true, message: result.message || 'Kết nối OK' };
    } else {
      return { success: false, error: `HTTP ${response.status}` };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ── Helper lấy settings ─────────────────────────────────
function ghidonGetSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(null, resolve);
  });
}

// ── Auto sync GhiĐơn mỗi 5 phút ────────────────────────
setInterval(ghidonSyncPending, 5 * 60 * 1000);

// ── Khởi tạo ────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  console.log('[VTP Tool] Installed v3.1');
  // Pre-configure GhiĐơn Sheet (chỉ set nếu chưa có)
  chrome.storage.local.get(['ghidon_sheetWebAppUrl'], (r) => {
    if (!r.ghidon_sheetWebAppUrl) {
      chrome.storage.local.set({
        ghidon_enabled: true,
        ghidon_sheetWebAppUrl: 'https://script.google.com/macros/s/AKfycbx3xw-zPbYntN2fk4agjpRaheYf7U-JFpJ6kDDCmLqHiDMDWrcWmFo1JB76UydFBIql/exec',
        ghidon_sheetId: '14qQL6Muqc47ANn_uMUy7ri-pBmDaG6-udCTLleZySg8',
        ghidon_sheetName: 'Trang tính1',
        ghidon_soundEnabled: true,
        ghidon_duplicateCheck: true,
        ghidon_scanInterval: 50,
        ghidon_minBarcodeLen: 8,
      });
    }
  });
});
