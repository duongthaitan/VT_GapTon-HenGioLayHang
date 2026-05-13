/* ============================================================
   VTP Tool – Ghi Đơn Hàng | Content Script
   Chạy trên trang evtp2.viettelpost.vn
   Phát hiện barcode scan → trích xuất thông tin → gửi ghi Sheet
   ============================================================ */

(function () {
  'use strict';

  // Guard: tránh inject trùng
  if (window.__VTP_GHIDON_LOADED__) return;
  window.__VTP_GHIDON_LOADED__ = true;

  const CONFIG = {
    SCAN_CHAR_INTERVAL: 50,
    MIN_BARCODE_LENGTH: 8,
    MAX_BARCODE_LENGTH: 30,
    DOM_WAIT_TIMEOUT: 5000,
    DOM_CHECK_INTERVAL: 300,
    DUPLICATE_COOLDOWN: 10000,
  };

  let barcodeBuffer = '';
  let lastKeyTime = 0;
  let isEnabled = true;
  let soundEnabled = true;
  let duplicateCheck = true;
  let scannedCodes = new Map();
  let scanCount = 0;

  const ALLOWED_USER = 'DƯƠNG THÁI TÂN';  // Chỉ hoạt động với tài khoản này

  let currentUser = null;
  let accountVerified = false;

  init();

  function init() {
    console.log('[VTP GhiĐơn] Content script loaded');

    // Bước 1: Kiểm tra tài khoản trước
    waitForUserInfo().then((userName) => {
      currentUser = userName;

      if (!isAllowedUser(userName)) {
        console.warn(`[VTP GhiĐơn] Tài khoản không hợp lệ: "${userName}". Cần đăng nhập bằng "${ALLOWED_USER}"`);
        showToast(`🚫 Ghi Đơn chỉ hoạt động với tài khoản\n"${ALLOWED_USER}"`, 'error');
        // Thông báo lên sidepanel
        chrome.runtime.sendMessage({
          action: 'GHIDON_ACCOUNT_STATUS',
          verified: false,
          user: userName,
          required: ALLOWED_USER,
        });
        return; // Không khởi tạo scanner
      }

      accountVerified = true;
      console.log(`[VTP GhiĐơn] ✅ Tài khoản hợp lệ: "${userName}"`);
      // Thông báo lên sidepanel
      chrome.runtime.sendMessage({
        action: 'GHIDON_ACCOUNT_STATUS',
        verified: true,
        user: userName,
      });

      // Bước 2: Load settings và bắt đầu
      chrome.storage.local.get(
        ['ghidon_enabled', 'ghidon_scanInterval', 'ghidon_minBarcodeLen', 'ghidon_soundEnabled', 'ghidon_duplicateCheck'],
        (result) => {
          isEnabled = result.ghidon_enabled !== false;
          soundEnabled = result.ghidon_soundEnabled !== false;
          duplicateCheck = result.ghidon_duplicateCheck !== false;
          if (result.ghidon_scanInterval) CONFIG.SCAN_CHAR_INTERVAL = parseInt(result.ghidon_scanInterval, 10);
          if (result.ghidon_minBarcodeLen) CONFIG.MIN_BARCODE_LENGTH = parseInt(result.ghidon_minBarcodeLen, 10);
          if (isEnabled) {
            startListening();
            showToast(`📦 VTP Ghi Đơn sẵn sàng — ${userName}`, 'success');
          }
        }
      );
    });

    chrome.runtime.onMessage.addListener(handleMessage);
    chrome.storage.onChanged.addListener((changes) => {
      if (!accountVerified) return; // Chặn nếu sai tài khoản
      if (changes.ghidon_enabled) {
        isEnabled = changes.ghidon_enabled.newValue;
        if (isEnabled) { startListening(); showToast('✅ Ghi Đơn đã bật', 'success'); }
        else { stopListening(); showToast('⏸ Ghi Đơn đã tắt', 'warning'); }
      }
      if (changes.ghidon_soundEnabled) soundEnabled = changes.ghidon_soundEnabled.newValue;
      if (changes.ghidon_duplicateCheck) duplicateCheck = changes.ghidon_duplicateCheck.newValue;
      if (changes.ghidon_scanInterval) CONFIG.SCAN_CHAR_INTERVAL = parseInt(changes.ghidon_scanInterval.newValue, 10);
      if (changes.ghidon_minBarcodeLen) CONFIG.MIN_BARCODE_LENGTH = parseInt(changes.ghidon_minBarcodeLen.newValue, 10);
    });
  }

  // ── Đọc tên đăng nhập từ DOM ViettelPost ──────────────────
  function waitForUserInfo() {
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 20; // chờ tối đa 6 giây

      const checker = setInterval(() => {
        attempts++;
        const userName = detectUserName();
        if (userName) {
          clearInterval(checker);
          resolve(userName);
        } else if (attempts >= maxAttempts) {
          clearInterval(checker);
          resolve(null); // Không tìm thấy → coi như không hợp lệ
        }
      }, 300);
    });
  }

  function detectUserName() {
    // Thử các selector phổ biến của ViettelPost ZK framework
    const selectors = [
      '.z-menuitem-text',           // Menu item với tên user
      '.z-label[sclass*="user"]',   // Label user
      '[class*="username"]',
      '[class*="user-name"]',
      '[class*="fullname"]',
      '.header-username',
      '#userName',
      '#userFullName',
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        const text = (el.textContent || '').trim().toUpperCase();
        // ViettelPost thường hiển thị "Xin chào, DƯƠNG THÁI TÂN" hoặc chỉ tên
        if (text.length > 2 && !text.includes('MENU') && !text.includes('ĐĂNG XUẤT')) {
          return normalize(text.replace(/^XIN\s+CHÀO[,\s]*/i, ''));
        }
      }
    }

    // Fallback: tìm trong tất cả text nodes của header/nav
    const containers = document.querySelectorAll('header, .z-menubar, .z-navbar, nav, #header, .top-bar');
    for (const container of containers) {
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const text = normalize(node.textContent.trim());
        if (text.includes('DƯƠNG') || text.includes('THÁI TÂN')) {
          return text;
        }
      }
    }

    return null;
  }

  function normalize(str) {
    return (str || '').trim().toUpperCase()
      .normalize('NFC')
      .replace(/\s+/g, ' ');
  }

  function isAllowedUser(userName) {
    if (!userName) return false;
    return normalize(userName).includes(normalize(ALLOWED_USER));
  }


  function startListening() {
    document.addEventListener('keydown', onKeyDown, true);
  }

  function stopListening() {
    document.removeEventListener('keydown', onKeyDown, true);
  }

  function onKeyDown(e) {
    const now = Date.now();
    if (e.key === 'Enter') {
      if (barcodeBuffer.length >= CONFIG.MIN_BARCODE_LENGTH) {
        e.preventDefault();
        e.stopPropagation();
        processBarcode(barcodeBuffer.trim());
      }
      barcodeBuffer = '';
      lastKeyTime = 0;
      return;
    }
    if (e.key.length !== 1) return;
    if (lastKeyTime > 0 && (now - lastKeyTime) > CONFIG.SCAN_CHAR_INTERVAL) {
      barcodeBuffer = '';
    }
    if (barcodeBuffer.length >= CONFIG.MAX_BARCODE_LENGTH) {
      barcodeBuffer = '';
    }
    barcodeBuffer += e.key;
    lastKeyTime = now;
  }

  async function processBarcode(barcode) {
    if (duplicateCheck && scannedCodes.has(barcode)) {
      const lastScan = scannedCodes.get(barcode);
      if (Date.now() - lastScan < CONFIG.DUPLICATE_COOLDOWN) {
        showToast(`⚠️ Mã ${barcode} đã quét rồi!`, 'warning');
        if (soundEnabled) playSound('warning');
        return;
      }
    }
    scannedCodes.set(barcode, Date.now());
    showToast(`🔄 Đang xử lý: ${barcode}...`, 'info');

    try {
      const orderData = await waitForOrderData(barcode);
      const dataToSave = orderData || {
        maPhieuGui: barcode,
        thoiGianQuet: new Date().toLocaleString('vi-VN'),
        ghiChu: 'Chỉ có mã barcode',
      };

      const response = await sendToBackground({ action: 'GHIDON_SAVE_ORDER', data: dataToSave });

      if (response && response.success) {
        scanCount++;
        showToast(`✅ Đã ghi đơn ${barcode} (#${scanCount})`, 'success');
        if (soundEnabled) playSound('success');
        // Cập nhật badge và stats trên sidepanel
        chrome.runtime.sendMessage({ action: 'GHIDON_UPDATE_STATS' });
      } else if (response?.isDuplicate) {
        showToast(`⚠️ ${response.error}`, 'warning');
        if (soundEnabled) playSound('warning');
      } else {
        showToast(`❌ Lỗi: ${response?.error || 'Không rõ'}`, 'error');
        if (soundEnabled) playSound('error');
      }
    } catch (err) {
      showToast(`❌ Lỗi: ${err.message}`, 'error');
      if (soundEnabled) playSound('error');
    }
  }

  function waitForOrderData(barcode) {
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = CONFIG.DOM_WAIT_TIMEOUT / CONFIG.DOM_CHECK_INTERVAL;
      const checker = setInterval(() => {
        attempts++;
        const data = extractOrderData(barcode);
        if (data) { clearInterval(checker); resolve(data); }
        else if (attempts >= maxAttempts) { clearInterval(checker); resolve(null); }
      }, CONFIG.DOM_CHECK_INTERVAL);
    });
  }

  function extractOrderData(barcode) {
    try {
      return extractFromTable(barcode) || extractFromDialog(barcode) || extractFromPageText(barcode) || null;
    } catch (err) {
      return null;
    }
  }

  function extractFromTable(barcode) {
    const tables = document.querySelectorAll('table');
    for (const table of tables) {
      const rows = table.querySelectorAll('tr');
      for (const row of rows) {
        if (row.textContent.includes(barcode)) {
          const cells = row.querySelectorAll('td');
          if (cells.length < 3) continue;
          const cellTexts = Array.from(cells).map(c => (c.textContent || '').trim());
          return {
            maPhieuGui: barcode,
            nguoiGui: cellTexts[1] || '',
            nguoiNhan: cellTexts[2] || '',
            diaChiNhan: cellTexts[3] || '',
            sdtNguoiNhan: findPhone(cellTexts),
            trongLuong: findWeight(cellTexts),
            tienCOD: findCurrency(cellTexts),
            thoiGianQuet: new Date().toLocaleString('vi-VN'),
            nguonDuLieu: 'table',
          };
        }
      }
    }
    return null;
  }

  function extractFromDialog(barcode) {
    const dialogs = document.querySelectorAll('.z-window, .z-modal, .modal, [role="dialog"]');
    for (const d of dialogs) {
      if (d.textContent.includes(barcode)) {
        return extractFromContainer(d, barcode);
      }
    }
    return null;
  }

  function extractFromPageText(barcode) {
    const els = document.querySelectorAll('span, div, td, label');
    for (const el of els) {
      if (el.textContent.trim() === barcode) {
        const container = el.closest('tr, .z-row, .z-listitem, .row');
        if (container) return extractFromContainer(container, barcode);
      }
    }
    return null;
  }

  function extractFromContainer(container, barcode) {
    const text = container.textContent || '';
    return {
      maPhieuGui: barcode,
      nguoiGui: '',
      nguoiNhan: '',
      diaChiNhan: '',
      sdtNguoiNhan: (text.match(/0[0-9]{9,10}/) || [''])[0],
      trongLuong: (text.match(/([0-9.,]+)\s*(?:kg|g)/i) || ['', ''])[1],
      tienCOD: (text.match(/(?:cod|COD)[:\s]*([0-9.,]+)/i) || ['', ''])[1],
      thoiGianQuet: new Date().toLocaleString('vi-VN'),
      nguonDuLieu: 'container',
    };
  }

  function findPhone(arr) {
    for (const t of arr) { const m = t.match(/0[0-9]{9,10}/); if (m) return m[0]; }
    return '';
  }
  function findWeight(arr) {
    for (const t of arr) { const m = t.match(/([0-9.,]+)\s*(?:kg|g)/i); if (m) return m[1]; }
    return '';
  }
  function findCurrency(arr) {
    for (const t of arr) {
      const m = t.match(/(?:COD|tiền thu|thu hộ)[:\s]*([0-9,.]+)/i);
      if (m) return m[1].replace(/[,.\s]/g, '');
    }
    for (const t of arr) {
      if (/0[0-9]{9,10}/.test(t)) continue;
      if (/[0-9]+\s*(?:kg|g)\b/i.test(t)) continue;
      const cleaned = t.replace(/[^0-9]/g, '');
      if (cleaned.length >= 5 && cleaned.length <= 10) return cleaned;
    }
    return '';
  }

  function sendToBackground(msg) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(msg, (resp) => {
        if (chrome.runtime.lastError) resolve({ success: false, error: chrome.runtime.lastError.message });
        else resolve(resp);
      });
    });
  }

  function handleMessage(msg, sender, sendResponse) {
    if (msg.action === 'GHIDON_GET_STATUS') {
      sendResponse({ isEnabled, scanCount, lastScannedCodes: Array.from(scannedCodes.entries()).slice(-10) });
    } else if (msg.action === 'GHIDON_TOGGLE') {
      isEnabled = msg.enabled;
      isEnabled ? startListening() : stopListening();
      sendResponse({ success: true, isEnabled });
    } else if (msg.action === 'GHIDON_RESET_COUNT') {
      scanCount = 0; scannedCodes.clear();
      sendResponse({ success: true });
    } else if (msg.action === 'PING') {
      sendResponse({ alive: true });
    }
    return true;
  }

  function showToast(message, type = 'info') {
    const old = document.getElementById('vtp-ghidon-toast');
    if (old) old.remove();
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.id = 'vtp-ghidon-toast';
    toast.className = `vtp-ghidon-toast vtp-ghidon-toast--${type}`;
    toast.innerHTML = `
      <span class="vtp-ghidon-toast__icon">${icons[type] || 'ℹ️'}</span>
      <span class="vtp-ghidon-toast__msg">${message}</span>
      <button class="vtp-ghidon-toast__close" onclick="this.parentElement.remove()">✕</button>
    `;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('vtp-ghidon-toast--show'));
    setTimeout(() => {
      toast.classList.remove('vtp-ghidon-toast--show');
      setTimeout(() => toast.remove(), 400);
    }, 4000);
  }

  function playSound(type) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.value = 0.1;
      if (type === 'success') {
        osc.frequency.value = 800; osc.type = 'sine'; osc.start();
        setTimeout(() => osc.frequency.value = 1200, 100);
        setTimeout(() => { osc.stop(); ctx.close(); }, 200);
      } else if (type === 'error') {
        osc.frequency.value = 300; osc.type = 'square'; osc.start();
        setTimeout(() => { osc.stop(); ctx.close(); }, 400);
      } else {
        osc.frequency.value = 600; osc.type = 'triangle'; osc.start();
        setTimeout(() => { osc.stop(); ctx.close(); }, 150);
      }
    } catch (e) { /* ignore */ }
  }

})();
