// ============================================================
//  VTP Tool – Popup Controller
//  v2.5 Critical Fix:
//    - Fix #23: chrome.storage.local.set() KHÔNG hoạt động từ world:'MAIN'
//              (Chrome MV3 không cấp Extension API cho MAIN world scripts)
//              → Thay bằng waitForTabReload: gapton_core_scan LUÔN gọi
//              location.reload() khi xong → tab reload = tín hiệu scan done
//    - Fix #22: pollScanComplete đăng ký TRƯỚC inject (giữ lại backup)
//    - Fix #21: chrome.storage.local thay vì window variable
//    - Fix #17: Bỏ double F5
//    - Fix #20: reloadAfterScanPromise đăng ký TRƯỚC inject
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {

    // Fix #5: Hẳng số HTML cho các nút — tránh copy-paste, tái sử dụng
    const BTN_HTML = {
        startPlay:    `<svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><polygon points="4,2 17,10 4,18"/></svg> Bắt Đầu Chạy`,
        startRunning: `<svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14"><path d="M21 12a9 9 0 11-3.36-7.02"/></svg> Đang chạy…`,
        kiemkePlay:   `<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><polygon points="4 2.5 17 10 4 17.5"/></svg> Chạy Kiểm Kê Tự Động`,
        kiemkeRun:    `<svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14"><path d="M21 12a9 9 0 11-3.36-7.02"/></svg> Đang kiểm kê...`,
        gaptonPlay:   `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" width="15" height="15"><path d="M17.5 13.3V6.7a1.7 1.7 0 00-.83-1.44L10.83 1.9a1.7 1.7 0 00-1.66 0L3.33 5.26A1.7 1.7 0 002.5 6.7v6.6a1.7 1.7 0 00.83 1.44l5.84 3.36a1.7 1.7 0 001.66 0l5.84-3.36A1.7 1.7 0 0017.5 13.3z"/></svg> Quét Mã Thủ Công`,
    };

    // ════════════════════════════════════════
    //  TAB SWITCHING + Sliding Indicator
    // ════════════════════════════════════════
    const tabBtns     = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-pane');
    const tabIndicator = document.getElementById('tabIndicator');

    function updateTabIndicator(activeBtn) {
        if (!tabIndicator || !activeBtn) return;
        const nav = activeBtn.closest('.tab-nav');
        if (!nav) return;
        const navRect = nav.getBoundingClientRect();
        const btnRect = activeBtn.getBoundingClientRect();
        tabIndicator.style.width     = btnRect.width + 'px';
        tabIndicator.style.transform = `translateX(${btnRect.left - navRect.left}px)`;
    }

    // Init indicator position
    const initActiveBtn = document.querySelector('.tab-btn.active');
    requestAnimationFrame(() => updateTabIndicator(initActiveBtn));

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-selected', 'false'); // Fix #13
            });
            tabContents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            btn.setAttribute('aria-selected', 'true');   // Fix #13
            document.getElementById(btn.getAttribute('data-target')).classList.add('active');
            updateTabIndicator(btn);
        });
    });

    // ════════════════════════════════════════
    //  TEXTAREA — Live bill count (debounced)
    // ════════════════════════════════════════
    const billListEl  = document.getElementById('billList');
    const billCountEl = document.getElementById('billCount');

    function parseBills() {
        return billListEl.value.split('\n').map(b => b.trim()).filter(b => b !== '');
    }

    function updateBillCount() {
        const bills = parseBills();
        if (bills.length > 0) {
            billCountEl.textContent = `${bills.length} mã`;
            billCountEl.classList.add('has-bills');
        } else {
            billCountEl.textContent = '0 mã';
            billCountEl.classList.remove('has-bills');
        }
    }

    // Debounce 120ms — tránh re-render khi user paste lớn hoặc gõ nhanh
    let _billCountTimer = null;
    billListEl.addEventListener('input', () => {
        clearTimeout(_billCountTimer);
        _billCountTimer = setTimeout(updateBillCount, 120);
    });

    // ════════════════════════════════════════
    //  DELAY STEPPER (+/−)
    // ════════════════════════════════════════
    const delayInput = document.getElementById('delay');

    document.getElementById('delayPlus').addEventListener('click', () => {
        delayInput.value = Math.min(parseInt(delayInput.value || 1) + 1, 30);
    });
    document.getElementById('delayMinus').addEventListener('click', () => {
        delayInput.value = Math.max(parseInt(delayInput.value || 2) - 1, 1);
    });

    // ════════════════════════════════════════
    //  PROGRESS BAR — helpers
    // ════════════════════════════════════════
    const progressCard = document.getElementById('progressContainer');
    const progressBar  = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    const statusDot    = document.querySelector('#statusChinhGio .status-dot');
    const statusMsg    = document.querySelector('#statusChinhGio .status-text');

    function updateProgressUI(current, total) {
        if (total > 0) {
            progressCard.style.display   = 'block';
            const pct                    = Math.floor((current / total) * 100);
            progressBar.style.width      = pct + '%';
            progressText.textContent     = `${current} / ${total} (${pct}%)`;

            if (current >= total) {
                if (statusMsg) statusMsg.textContent      = '✅ Đã hoàn thành!';
                if (statusDot) statusDot.style.background = '#22c55e';
            } else {
                if (statusMsg) statusMsg.textContent      = `Đang xử lý đơn ${current + 1} / ${total}…`;
                if (statusDot) statusDot.style.background = '#f59e0b';
            }
        } else {
            progressCard.style.display = 'none';
        }
    }

    // ════════════════════════════════════════
    //  RESTORE STATE — khi mở lại popup
    // ════════════════════════════════════════
    chrome.storage.local.get(['isRunning', 'currentIndex', 'billList', 'delay'], (data) => {
        // Restore delay setting
        if (data.delay) {
            delayInput.value = data.delay;
        }
        // Restore bill list và tiến trình nếu đang chạy
        if (data.isRunning && data.billList) {
            billListEl.value = data.billList.join('\n');
            updateBillCount();
            updateProgressUI(data.currentIndex || 0, data.billList.length);
        }
    });

    // ════════════════════════════════════════
    //  STORAGE LISTENER — cập nhật UI realtime
    //  Fix v1.1: Đọc trực tiếp từ `changes`, KHÔNG gọi storage.get() lồng nhau
    // ════════════════════════════════════════
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace !== 'local') return;

        // Cập nhật tiến trình khi currentIndex thay đổi
        if (changes.currentIndex) {
            // Lấy giá trị mới nhất từ changes, không cần get() thêm
            chrome.storage.local.get(['isRunning', 'billList'], (data) => {
                if (data.isRunning && data.billList) {
                    updateProgressUI(changes.currentIndex.newValue, data.billList.length);
                }
            });
        }

        // Cập nhật trạng thái khi dừng
        if (changes.isRunning && changes.isRunning.newValue === false) {
            if (statusMsg) statusMsg.textContent      = 'Đã dừng.';
            if (statusDot) statusDot.style.background = '#6b7280';
            // Re-enable nút Start khi script báo đã dừng
            const startBtn = document.getElementById('startChinhGioBtn');
            if (startBtn) startBtn.disabled = false;
        }
    });

    // ════════════════════════════════════════
    //  TAB 1 — SỬA GIỜ
    //  [v3.0] Vòng lặp chạy ở SIDEPANEL (extension page)
    //  → Không bị Chrome throttle khi chuyển tab
    //  → Content script chỉ xử lý 1 đơn/lần, trả kết quả qua storage
    // ════════════════════════════════════════
    const startChinhGioBtn = document.getElementById('startChinhGioBtn');
    const stopChinhGioBtn  = document.getElementById('stopChinhGioBtn');

    // Helper: chờ content script báo xong 1 đơn qua storage
    function waitForChinhGioStepDone(timeoutMs = 120000) {
        return new Promise((resolve) => {
            let resolved = false;

            const deadline = setTimeout(() => {
                if (resolved) return;
                resolved = true;
                chrome.storage.onChanged.removeListener(listener);
                resolve({ status: 'timeout' });
            }, timeoutMs);

            function listener(changes, ns) {
                if (ns !== 'local' || resolved) return;
                if (changes.__VTP_CHINHGIO_STEP_DONE__?.newValue) {
                    resolved = true;
                    clearTimeout(deadline);
                    chrome.storage.onChanged.removeListener(listener);
                    resolve(changes.__VTP_CHINHGIO_STEP_DONE__.newValue);
                }
            }
            chrome.storage.onChanged.addListener(listener);

            // Backup check (signal có thể đã set trước khi listener đăng ký)
            chrome.storage.local.get('__VTP_CHINHGIO_STEP_DONE__', (data) => {
                if (data.__VTP_CHINHGIO_STEP_DONE__ && !resolved) {
                    resolved = true;
                    clearTimeout(deadline);
                    chrome.storage.onChanged.removeListener(listener);
                    resolve(data.__VTP_CHINHGIO_STEP_DONE__);
                }
            });
        });
    }

    startChinhGioBtn.addEventListener('click', async () => {
        const bills = parseBills();
        const delay = parseInt(delayInput.value) || 4;

        if (bills.length === 0) {
            alert('Vui lòng dán ít nhất 1 mã vận đơn!');
            return;
        }

        let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.url) {
            alert('Không thể xác định trang hiện tại. Hãy mở trình duyệt và thử lại!');
            return;
        }

        const mainTabId = tab.id;

        // Disable UI
        startChinhGioBtn.disabled  = true;
        startChinhGioBtn.innerHTML = BTN_HTML.startRunning;

        await chrome.storage.local.set({
            billList:     bills,
            delay,
            isRunning:    true,
            currentIndex: 0
        });
        updateProgressUI(0, bills.length);

        // ── Vòng lặp chính — chạy ở sidepanel (KHÔNG bị throttle) ──
        const skipList = [];

        for (let i = 0; i < bills.length; i++) {
            // Kiểm tra user bấm Dừng
            const state = await chrome.storage.local.get(['isRunning']);
            if (!state.isRunning) {
                console.log('[VTP Sửa Giờ] Người dùng bấm Dừng.');
                break;
            }

            // Cập nhật UI trên sidepanel
            if (statusMsg) statusMsg.textContent      = `Đang xử lý đơn ${i + 1} / ${bills.length}…`;
            if (statusDot) statusDot.style.background = '#f59e0b';
            updateProgressUI(i, bills.length);

            // Xóa signal cũ
            try { await chrome.storage.local.remove('__VTP_CHINHGIO_STEP_DONE__'); } catch (_) {}

            // Inject content script xử lý 1 đơn
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: mainTabId },
                    files: ['src/shared/notification.js', 'src/modules/chinhgio/chinhgio_content.js']
                });
            } catch (e) {
                console.error('[VTP] Lỗi inject:', e);
                skipList.push({ bill: bills[i], reason: 'Inject thất bại: ' + e.message });
                continue;
            }

            // Chờ content script hoàn thành 1 đơn (max 2 phút)
            const result = await waitForChinhGioStepDone(120000);
            console.log(`[VTP Sửa Giờ] Kết quả đơn ${i + 1}:`, result.status, result.bill || '');

            if (result.status === 'skipped' || result.status === 'error') {
                skipList.push({ bill: result.bill || bills[i], reason: result.reason || 'Lỗi không xác định' });
            }

            // Cập nhật progress
            updateProgressUI(i + 1, bills.length);

            // Delay giữa các đơn — chạy ở sidepanel → KHÔNG bị throttle!
            if (i < bills.length - 1) {
                await new Promise(r => setTimeout(r, 1000));
            }
        }

        // ── Hoàn tất ──
        await chrome.storage.local.set({ isRunning: false });

        if (skipList.length === 0) {
            if (statusMsg) statusMsg.textContent      = '✅ Đã hoàn thành!';
            if (statusDot) statusDot.style.background = '#22c55e';
        } else {
            if (statusMsg) statusMsg.textContent      = `⚠️ Xong — Bỏ qua ${skipList.length} đơn`;
            if (statusDot) statusDot.style.background = '#f59e0b';
            console.warn('[VTP Sửa Giờ] Đơn bị bỏ qua:', skipList);
        }

        // Reset UI
        startChinhGioBtn.disabled  = false;
        startChinhGioBtn.innerHTML = BTN_HTML.startPlay;
    });

    stopChinhGioBtn.addEventListener('click', async () => {
        await chrome.storage.local.set({ isRunning: false });
        if (statusMsg) statusMsg.textContent      = 'Đã dừng.';
        if (statusDot) statusDot.style.background = '#6b7280';
        startChinhGioBtn.disabled  = false;
        startChinhGioBtn.innerHTML = BTN_HTML.startPlay;
    });

    // ════════════════════════════════════════
    //  TAB 2 — KIỂM TỒN
    // ════════════════════════════════════════
    const statusBoxGapTon       = document.getElementById('statusBoxGapTon');
    const startGapTonBtn        = document.getElementById('startGapTonBtn');
    const loadRoutesBtn         = document.getElementById('loadRoutesBtn');
    const routeChecklist        = document.getElementById('routeChecklist');
    const routeSelectAllWrap    = document.getElementById('routeSelectAllWrap');
    const routeSelectAllCb      = document.getElementById('routeSelectAll');
    const routeCounterEl        = document.getElementById('routeCounter');
    const startKiemKeTuyenBtn   = document.getElementById('startKiemKeTuyenBtn');
    const cancelKiemKeTuyenBtn  = document.getElementById('cancelKiemKeTuyenBtn'); // Fix #1
    const routeProgressCard     = document.getElementById('routeProgressCard');
    const routeProgressBar      = document.getElementById('routeProgressBar');
    const routeProgressPct      = document.getElementById('routeProgressPct');
    const routeProgressStatus   = document.getElementById('routeProgressStatus');
    const routeElapsedEl        = document.getElementById('routeElapsedTime');     // Fix #7
    const routeEtaEl            = document.getElementById('routeEtaTime');         // Fix #7

    let loadedRoutes = []; // Danh sách tuyến đã load

    // Fix #4 + #7: Visual status — lookup bằng data-index (an toàn hơn tên)
    function setRouteStatus(routeName, status) {
        // Tìm bằng data-index nếu có, fallback bằng route name
        const idx = loadedRoutes.indexOf(routeName);
        let item = null;
        if (idx >= 0) {
            const cb = routeChecklist.querySelector(`.route-item-cb[data-index="${idx}"]`);
            if (cb) item = cb.closest('.route-item');
        }
        if (!item) return;
        item.classList.remove('is-running', 'is-done', 'is-error');

        // Xoá icon cũ
        const oldIcon = item.querySelector('.route-status-icon');
        if (oldIcon) oldIcon.remove();

        if (status === 'waiting') return;
        item.classList.add(`is-${status}`);

        // Thêm icon tương ứng
        const iconMap = { running: '⏳', done: '✅', error: '❌' };
        const icon = document.createElement('span');
        icon.className = 'route-status-icon';
        icon.textContent = iconMap[status] || '';
        item.querySelector('label')?.appendChild(icon);
    }

    function setGapTonStatus(isReady, title, desc) {
        statusBoxGapTon.className = `alert ${isReady ? 'alert-success' : 'alert-warning'}`;
        statusBoxGapTon.querySelector('.alert-icon').textContent  = isReady ? '✅' : '⚠️';
        statusBoxGapTon.querySelector('.alert-title').textContent = title;
        statusBoxGapTon.querySelector('.alert-desc').textContent  = desc;
        const dot = statusBoxGapTon.querySelector('.alert-pulse');
        if (dot) dot.style.background = isReady ? 'var(--green)' : 'var(--amber)';
        startGapTonBtn.disabled      = !isReady;
        loadRoutesBtn.disabled       = !isReady;
    }

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.url?.includes('viettelpost') || tab?.url?.includes('localhost')) {
            setGapTonStatus(true, 'Sẵn sàng hoạt động', 'Trang ViettelPost đã được phát hiện');
        } else {
            setGapTonStatus(false, 'Chưa sẵn sàng', 'Vui lòng mở trang ViettelPost!');
        }
    } catch (err) {
        setGapTonStatus(false, 'Lỗi xác định trang', err.message);
    }

    // ── Cập nhật số tuyến đã chọn ──
    function updateSelectedCount() {
        const checked = routeChecklist.querySelectorAll('.route-item-cb:checked');
        const count   = checked.length;
        routeCounterEl.textContent = `${count} tuyến`;
        startKiemKeTuyenBtn.disabled = count === 0;

        // Cập nhật select all checkbox state
        if (loadedRoutes.length > 0) {
            routeSelectAllCb.checked       = (count === loadedRoutes.length);
            routeSelectAllCb.indeterminate = (count > 0 && count < loadedRoutes.length);
        }

        // Toggle class is-checked trên items
        routeChecklist.querySelectorAll('.route-item').forEach(item => {
            const cb = item.querySelector('.route-item-cb');
            if (cb) item.classList.toggle('is-checked', cb.checked);
        });
    }

    // ── Render checklist từ danh sách tuyến ──
    function renderRouteChecklist(routes) {
        loadedRoutes = routes;
        routeChecklist.innerHTML = '';

        if (routes.length === 0) {
            routeChecklist.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <svg viewBox="0 0 56 56" fill="none" width="32" height="32">
                            <rect x="4" y="10" width="30" height="26" rx="4" stroke="var(--red)" stroke-width="1.5" stroke-dasharray="4 2"/>
                            <path d="M34 16l8 0 5 6V36h-13V16z" stroke="var(--red)" stroke-width="1.5"/>
                            <circle cx="11" cy="42" r="4.5" stroke="var(--red)" stroke-width="1.5"/>
                            <circle cx="37" cy="42" r="4.5" stroke="var(--red)" stroke-width="1.5"/>
                        </svg>
                    </div>
                    <p class="empty-title">Chưa có dữ liệu tuyến</p>
                    <p class="empty-hint">Nhấn "Tải danh sách" để bắt đầu</p>
                </div>`;
            routeSelectAllWrap.style.display = 'none';
            startKiemKeTuyenBtn.disabled = true;
            return;
        }

        routeSelectAllWrap.style.display = 'block';

        const frag = document.createDocumentFragment();
        routes.forEach((route, idx) => {
            const item = document.createElement('div');
            item.className = 'route-item';
            item.innerHTML = `
                <label class="checkbox-label">
                    <input type="checkbox" class="cb-input route-item-cb" data-index="${idx}" data-route="${route.replace(/"/g, '&quot;')}">
                    <span class="cb-box"></span>
                    <span class="route-item-num">${idx + 1}</span>
                    <span class="route-item-text">${route}</span>
                </label>`;

            const cb = item.querySelector('.route-item-cb');
            cb.addEventListener('change', updateSelectedCount);
            frag.appendChild(item);
        });

        routeChecklist.appendChild(frag);
        updateSelectedCount();
    }

    // ── Select All toggle ──
    routeSelectAllCb.addEventListener('change', () => {
        const isChecked = routeSelectAllCb.checked;
        routeChecklist.querySelectorAll('.route-item-cb').forEach(cb => {
            cb.checked = isChecked;
        });
        updateSelectedCount();
    });

    // ── Load Routes — inject script vào trang VTP để đọc combobox ──
    loadRoutesBtn.addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.url?.includes('viettelpost') && !tab?.url?.includes('localhost')) {
            alert('Vui lòng mở trang ViettelPost kiểm kê trước!');
            return;
        }

        loadRoutesBtn.disabled = true;
        loadRoutesBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="animation: spin 1s linear infinite;">
                <path d="M21 12a9 9 0 11-3.36-7.02"/>
                <polyline points="21 3 21 9 15 9"/>
            </svg>
            Đang tải...`;

        try {
            // Inject script để đọc combobox trên trang VTP
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                world: 'MAIN',
                func: () => {
                    // Bước 1: Tìm combobox kiểm kê
                    const comboboxes = document.querySelectorAll('.z-combobox');
                    let targetCombobox = null;

                    for (const cb of comboboxes) {
                        const input = cb.querySelector('.z-combobox-input');
                        if (input) {
                            const placeholder = input.getAttribute('placeholder') || '';
                            const value = input.value || '';
                            if (placeholder.includes('Hình thức kiểm kê') ||
                                value.includes('Kiểm kê') ||
                                value.includes('kiểm kê') ||
                                value.includes('Kiểm') ||
                                value.includes('bưu cục')) {
                                targetCombobox = cb;
                                break;
                            }
                        }
                    }

                    if (!targetCombobox) {
                        // Fallback: lấy combobox đầu tiên
                        for (const cb of comboboxes) {
                            if (cb.querySelector('.z-combobox-input')) {
                                targetCombobox = cb;
                                break;
                            }
                        }
                    }

                    if (!targetCombobox) return { error: 'Không tìm thấy ô chọn hình thức kiểm kê!' };

                    // Bước 2: Click mở dropdown
                    const dropdownBtn = targetCombobox.querySelector('.z-combobox-button');
                    if (dropdownBtn) dropdownBtn.click();

                    // Bước 3: Chờ nhỏ rồi đọc items
                    return new Promise(resolve => {
                        setTimeout(() => {
                            const routes = [];
                            const popups = document.querySelectorAll('.z-combobox-popup');

                            for (const popup of popups) {
                                if (popup.style.display === 'none' || popup.offsetHeight === 0) continue;
                                const items = popup.querySelectorAll('.z-comboitem');
                                items.forEach(item => {
                                    const textEl = item.querySelector('.z-comboitem-text');
                                    if (textEl) {
                                        const text = textEl.textContent.replace(/\u00A0/g, ' ').trim();
                                        if (text) routes.push(text);
                                    }
                                });
                                if (routes.length > 0) break;
                            }

                            // Đóng dropdown (click lại hoặc click body)
                            if (dropdownBtn) dropdownBtn.click();

                            resolve({ routes });
                        }, 1500);
                    });
                }
            });

            const data = results?.[0]?.result;
            if (data?.error) {
                alert(data.error);
                return;
            }

            const routes = data?.routes || [];
            if (routes.length === 0) {
                alert('Không tìm thấy tuyến nào! Đảm bảo bạn đang ở trang kiểm kê bưu phẩm.');
                return;
            }

            renderRouteChecklist(routes);

            // Fix #14: Lưu routes vào session storage
            try {
                if (chrome.storage.session) {
                    await chrome.storage.session.set({ vtpLoadedRoutes: routes });
                }
            } catch (_) {}

        } catch (e) {
            console.error('[VTP] Lỗi load routes:', e);
            alert('Lỗi khi tải danh sách tuyến: ' + e.message);
        } finally {
            loadRoutesBtn.disabled = false;
            loadRoutesBtn.innerHTML = `
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" width="15" height="15">
                    <polyline points="19 3.5 19 8.5 14 8.5"/>
                    <polyline points="1 16.5 1 11.5 6 11.5"/>
                    <path d="M3 7.5a7.5 7.5 0 0 1 12.19-2.78L19 8.5M1 11.5l3.81 3.78A7.5 7.5 0 0 0 17 12.5"/>
                </svg>
                Tải danh sách tuyến từ VTP`;
        }
    });

    // Fix #14: Restore từ session storage
    try {
        if (chrome.storage.session) {
            const sessionData = await chrome.storage.session.get(['vtpLoadedRoutes']);
            if (sessionData.vtpLoadedRoutes?.length > 0) {
                renderRouteChecklist(sessionData.vtpLoadedRoutes);
                console.log('[VTP] ↩ Restored', sessionData.vtpLoadedRoutes.length, 'tuyến từ session');
            }
        }
    } catch (_) {}

    // Fix #1: Nút hủy — set cancelToken thông qua global _vtpCancelToken
    cancelKiemKeTuyenBtn.addEventListener('click', () => {
        if (window._vtpCancelToken) window._vtpCancelToken.cancelled = true;
        cancelKiemKeTuyenBtn.disabled = true;
        routeProgressStatus.textContent = '⏹ Đang dừng sau khi hoàn thành tuyến hiện tại...';
    });

    startKiemKeTuyenBtn.addEventListener('click', async () => {
        let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.url?.includes('viettelpost') && !tab?.url?.includes('localhost')) return;

        const selectedRoutes = [];
        routeChecklist.querySelectorAll('.route-item-cb:checked').forEach(cb => {
            selectedRoutes.push(cb.getAttribute('data-route'));
        });
        if (selectedRoutes.length === 0) { alert('Vui lòng chọn ít nhất 1 tuyến!'); return; }

        // Fix #6: Confirm khi chạy >= 3 tuyến
        if (selectedRoutes.length >= 3) {
            const ok = confirm(
                `Bạn muốn tự động kiểm kê ${selectedRoutes.length} tuyến?\n\n` +
                `Bắt đầu: ${selectedRoutes[0]}\nKết thúc: ${selectedRoutes[selectedRoutes.length - 1]}\n\n` +
                `Mỗi tuyến sẽ mất vài phút. Không thao tác khác trong lúc chạy.`
            );
            if (!ok) return;
        }

        // Fix #2: Lưu mainTabId ngay — dùng get() trong vòng lặp thay vì active query
        const mainTabId = tab.id;

        // Fix #1: Tạo cancel token mới cho lần chạy này
        window._vtpCancelToken = { cancelled: false };
        const cancelToken = window._vtpCancelToken;

        // Disable UI, show cancel button
        startKiemKeTuyenBtn.disabled       = true;
        startKiemKeTuyenBtn.innerHTML      = BTN_HTML.kiemkeRun;
        cancelKiemKeTuyenBtn.style.display = 'inline-flex';
        cancelKiemKeTuyenBtn.disabled      = false;
        loadRoutesBtn.disabled             = true;
        startGapTonBtn.disabled            = true;

        routeProgressCard.style.display = 'block';
        routeProgressBar.style.width    = '0%';
        routeProgressPct.textContent    = `0 / ${selectedRoutes.length}`;
        if (routeElapsedEl) routeElapsedEl.textContent = '⏱ 00:00';
        if (routeEtaEl)     routeEtaEl.textContent     = '';

        let completed  = 0;
        let errors     = [];
        let elapsedSec = 0;

        // Fix #7: ETA / elapsed timer
        const elapsedTimer = setInterval(() => {
            elapsedSec++;
            const m = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
            const s = String(elapsedSec % 60).padStart(2, '0');
            if (routeElapsedEl) routeElapsedEl.textContent = `⏱ ${m}:${s}`;
            if (completed > 0 && routeEtaEl) {
                const avgSec = elapsedSec / completed;
                const remain = selectedRoutes.length - completed;
                const etaSec = Math.round(avgSec * remain);
                const em = String(Math.floor(etaSec / 60)).padStart(2, '0');
                const es = String(etaSec % 60).padStart(2, '0');
                routeEtaEl.textContent = `~Còn ${em}:${es}`;
            }
        }, 1000);

        // ── Helper: chờ tín hiệu scan xong qua chrome.storage.local ──
        // [Fix #21] Dùng storage thay vì window variable → tồn tại qua reload
        // [Fix #22] KHÔNG remove signal ngay lúc khởi tạo — tránh xóa mất tín hiệu
        //           đã được set nếu script scan chạy trước khi poll kịp đăng ký.
        //           Việc xóa signal cũ phải được thực hiện bởi clearScanComplete()
        //           TRƯỚC KHI inject script scan, không phải bên trong pollScanComplete.
        function pollScanComplete(timeoutMs = 600000) {
            return new Promise((resolve) => {
                let resolved = false;

                const deadline = setTimeout(() => {
                    if (resolved) return;
                    resolved = true;
                    chrome.storage.onChanged.removeListener(listener);
                    console.warn('[VTP] pollScanComplete: timeout sau', timeoutMs, 'ms');
                    resolve(false);
                }, timeoutMs);

                // Đăng ký listener TRƯỚC (tránh miss event)
                function listener(changes, namespace) {
                    if (namespace !== 'local' || resolved) return;
                    if (changes.__VTP_SCAN_COMPLETE__?.newValue === true) {
                        resolved = true;
                        clearTimeout(deadline);
                        chrome.storage.onChanged.removeListener(listener);
                        console.log('[VTP] ✅ Nhận tín hiệu __VTP_SCAN_COMPLETE__ từ storage!');
                        resolve(true);
                    }
                }
                chrome.storage.onChanged.addListener(listener);

                // Backup: kiểm tra ngay sau khi đăng ký listener
                // (phòng trường hợp storage đã được set trước khi listener đăng ký)
                chrome.storage.local.get('__VTP_SCAN_COMPLETE__', (data) => {
                    if (data.__VTP_SCAN_COMPLETE__ === true && !resolved) {
                        resolved = true;
                        clearTimeout(deadline);
                        chrome.storage.onChanged.removeListener(listener);
                        console.log('[VTP] ✅ __VTP_SCAN_COMPLETE__ đã có sẵn trong storage (backup check)!');
                        resolve(true);
                    }
                });
            });
        }

        // ── Helper: xóa tín hiệu scan trong storage ──
        async function clearScanComplete() {
            try {
                await chrome.storage.local.remove('__VTP_SCAN_COMPLETE__');
            } catch (_) {}
        }

        // ♥ HELPER: chờ trang scan mở (hỗ trợ cả full-nav và SPA)
        //   • Full-nav: URL thay đổi và tab status = complete
        //   • SPA TH1 : input.clsinputpg xuất hiện (tab có mã)
        //   • SPA TH2 : span.z-label "Hoàn thành" xuất hiện (tab trống)
        //
        // Guard: phải có __VTP_5STEPS_INJECTED__ = true để tránh false-positive
        //   Trước khi script 5 bước chạy, trang cũ có thể đang reload và các element
        //   cũ vẫn xuất hiện trong thời gian ngắn → cần kiểm tra cờ inject.
        function waitForScanPage(tabId, urlBefore, timeoutMs = 90000) {
            return new Promise((resolve) => {
                let done = false;
                function finish(val) {
                    if (done) return; done = true;
                    clearTimeout(deadline);
                    clearInterval(spaPoller);
                    chrome.tabs.onUpdated.removeListener(navListener);
                    resolve(val);
                }
                const deadline = setTimeout(() => finish(false), timeoutMs);

                // Chế độ 1: Full-nav – URL thay đổi
                const navListener = (tid, changeInfo, updatedTab) => {
                    if (tid !== tabId || changeInfo.status !== 'complete') return;
                    const newUrl = updatedTab.url || '';
                    if (newUrl && newUrl !== urlBefore) {
                        console.log('[VTP] ♥ Tab navigated:', newUrl);
                        finish(true);
                    }
                };
                chrome.tabs.onUpdated.addListener(navListener);

                // Chế độ 2: SPA – poll trang scan (hỗ trợ TH1 có mã VÀ TH2 tab trống)
                // PHẢI kiểm tra __VTP_5STEPS_INJECTED__ để tránh false-positive từ trang cũ
                const spaPoller = setInterval(async () => {
                    try {
                        const res = await chrome.scripting.executeScript({
                            target: { tabId }, world: 'MAIN',
                            func: () => {
                                const injected = !!window.__VTP_5STEPS_INJECTED__;
                                // TH1: tab có mã → input.clsinputpg tồn tại
                                const hasInput = !!document.querySelector('input.clsinputpg');
                                // TH2: tab trống → span.z-label "Hoàn thành" chỉ xuất hiện trên trang scan
                                const hasHoanThanh = Array.from(document.querySelectorAll('span.z-label'))
                                    .some(el => el.textContent.trim() === 'Hoàn thành');
                                return injected && (hasInput || hasHoanThanh);
                            }
                        });
                        if (res?.[0]?.result === true) {
                            console.log('[VTP] ♥ SPA: trang scan đã mở (TH1: input | TH2: Hoàn thành)');
                            finish(true);
                        }
                    } catch (_) {} // tab đang navigate
                }, 800); // [v2.5] Giảm từ 1200ms
            });
        }

        // ♥ HELPER: chờ trang danh sách (sau reload) sẵn sàng
        //   Điều kiện: combobox .z-combobox xuất hiện VÀ không có loading indicator
        function waitForListPageReady(tabId, timeoutMs = 45000) {
            return new Promise((resolve) => {
                const start = Date.now();
                const poller = setInterval(async () => {
                    try {
                        const res = await chrome.scripting.executeScript({
                            target: { tabId }, world: 'MAIN',
                            func: () => {
                                const hasCombobox = document.querySelectorAll('.z-combobox').length > 0;
                                const loading = document.querySelector('.z-loading-indicator, .z-apply-loading-indicator');
                                const isLoading = loading && loading.style.display !== 'none';
                                return hasCombobox && !isLoading;
                            }
                        });
                        if (res?.[0]?.result === true) {
                            clearInterval(poller);
                            resolve(true);
                        } else if (Date.now() - start >= timeoutMs) {
                            clearInterval(poller);
                            resolve(false);
                        }
                    } catch (_) {
                        if (Date.now() - start >= timeoutMs) {
                            clearInterval(poller);
                            resolve(false);
                        }
                    }
                }, 800);
            });
        }

        // ── Helper: chờ tab reload hoàn tất ──
        function waitForTabReload(tabId, urlKeyword, timeoutMs = 30000) {
            return new Promise((resolve) => {
                const timer = setTimeout(() => {
                    chrome.tabs.onUpdated.removeListener(listener); resolve(false);
                }, timeoutMs);
                const listener = (tid, changeInfo, updated) => {
                    if (tid !== tabId || changeInfo.status !== 'complete') return;
                    if (!urlKeyword || (updated.url || '').includes(urlKeyword)) {
                        clearTimeout(timer);
                        chrome.tabs.onUpdated.removeListener(listener);
                        resolve(true);
                    }
                };
                chrome.tabs.onUpdated.addListener(listener);
            });
        }

        // ════════════════════════════════════════
        //  VÒNG LẶP CHÍNH — từng tuyến
        // ════════════════════════════════════════
        for (let i = 0; i < selectedRoutes.length; i++) {
            const route = selectedRoutes[i];

            // Fix #1: Kiểm tra cancel trước mỗi tuyến
            if (cancelToken.cancelled) {
                console.log('[VTP] ⏹ Hủy kiểm kê theo yêu cầu người dùng.');
                break;
            }

            routeProgressStatus.textContent = `[${i + 1}/${selectedRoutes.length}] Kiểm kê: ${route}`;
            setRouteStatus(route, 'running'); // Fix #4

            try {
                // A: Fix #2 — dùng mainTabId, không query theo active
                tab = await chrome.tabs.get(mainTabId);

                // B: Chờ trang danh sách sẵn sàng (combobox phải xuất hiện)
                routeProgressStatus.textContent = `[${i + 1}/${selectedRoutes.length}] Chờ trang danh sách sẵn sàng...`;
                const listReady = await waitForListPageReady(mainTabId, 45000);
                if (!listReady) {
                    throw new Error('Trang danh sách không load được (timeout 45s). Vui lòng kiểm tra lại!');
                }
                console.log(`[VTP] ✅ Trang danh sách sẵn sàng cho tuyến: ${route}`);

                // C: Set route + clear flags (SAU khi trang sẵn sàng)
                await chrome.scripting.executeScript({
                    target: { tabId: mainTabId }, world: 'MAIN',
                    func: (name) => {
                        window.__VTP_SELECTED_ROUTE__  = name;
                        window.__VTP_SCAN_COMPLETE__   = null;
                        window.__VTP_5STEPS_DONE__     = null;
                        window.__VTP_5STEPS_INJECTED__ = null; // Reset cờ guard SPA
                    },
                    args: [route]
                });

                // D: Lấy URL hiện tại trước khi inject
                const tabInfo   = await chrome.tabs.get(mainTabId);
                const urlBefore = tabInfo.url;
                console.log('[VTP] URL trước inject:', urlBefore);

                // E: Đăng ký waitForScanPage TRƯỚC khi inject
                routeProgressStatus.textContent = `[${i + 1}/${selectedRoutes.length}] Thực hiện 5 bước: ${route}`;
                const scanPagePromise = waitForScanPage(mainTabId, urlBefore, 90000);

                // F: Inject kiemke_tuyen_auto (5 bước) + đánh dấu đã inject
                await chrome.scripting.executeScript({
                    target: { tabId: mainTabId }, world: 'MAIN',
                    files: ['src/shared/notification.js', 'src/modules/kiemke/kiemke_tuyen_auto.js']
                });
                // Đánh dấu cờ để SPA poller không bị false-positive
                await chrome.scripting.executeScript({
                    target: { tabId: mainTabId }, world: 'MAIN',
                    func: () => { window.__VTP_5STEPS_INJECTED__ = true; }
                });

                // G: Chờ trang scan mở (URL change hoặc SPA input.clsinputpg)
                routeProgressStatus.textContent = `[${i + 1}/${selectedRoutes.length}] Chờ trang kiểm kê mở...`;
                const scanPageReady = await scanPagePromise;
                if (!scanPageReady) {
                    throw new Error('Không vào được trang kiểm kê sau 90 giây');
                }
                console.log('[VTP] ✅ Trang scan đã mở');

                // Buffer nhỏ để trang render đầy đủ (tối ưu từ 2500ms)
                await new Promise(r => setTimeout(r, 500)); // [v2.5] Giảm từ 1000ms

                // H: Inject gapton_core_scan
                routeProgressStatus.textContent = `[${i + 1}/${selectedRoutes.length}] Đang quét mã: ${route}`;
                console.log('[VTP] Inject gapton_core_scan.js...');

                // [Fix #23] Dùng waitForTabReload thay vì chrome.storage signal
                // Lý do: chrome.storage.local.set() KHÔNG hoạt động trong world:'MAIN'
                //        (Chrome MV3: MAIN world không có quyền truy cập Extension APIs)
                // gapton_core_scan.js LUÔN gọi location.reload() khi xong (cả TH1 và TH2)
                // → Tab reload chính là tín hiệu "quét xong" đáng tin cậy nhất
                // PHẢI đăng ký TRƯỚC inject để không bỏ lỡ sự kiện reload
                await clearScanComplete(); // dọn signal cũ (backward compat)
                const scanCompleteViaReload = waitForTabReload(mainTabId, '', 660000); // 11 phút

                await chrome.scripting.executeScript({
                    target: { tabId: mainTabId }, world: 'MAIN',
                    files: ['src/shared/notification.js', 'src/modules/kiemke/gapton_settings.js', 'src/modules/kiemke/gapton_smart_delay.js', 'src/modules/kiemke/gapton_core_scan.js']
                });
                console.log('[VTP] Inject gapton_core_scan.js xong. Chờ tab reload (tín hiệu scan done)...');

                // I: Chờ tab reload = scan xong
                // gapton_core_scan gọi location.reload() → tab fires status:'complete'
                routeProgressStatus.textContent = `[${i + 1}/${selectedRoutes.length}] Chờ quét xong: ${route}...`;
                const scanDone = await scanCompleteViaReload;
                // Tab đã reload hoàn tất tại đây

                if (!scanDone) {
                    console.warn('[VTP] Scan timeout tuyến:', route);
                    errors.push({ route, error: 'Scan timeout sau 11 phút' });
                    setRouteStatus(route, 'error');
                } else {
                    console.log('[VTP] ✅ Scan xong (tab đã reload):', route);
                    setRouteStatus(route, 'done');
                }

                // J: Tab đã tự reload sau scan → KHÔNG waitForTabReload thêm
                // Chỉ cần chờ ổn định, vòng tiếp theo gọi waitForListPageReady
                if (i < selectedRoutes.length - 1 && !cancelToken.cancelled) {
                    if (!scanDone) {
                        // Timeout: chủ động reload để vòng tiếp theo có trang sạch
                        routeProgressStatus.textContent = `[${i + 1}/${selectedRoutes.length}] Đang reload trang...`;
                        const manualP = waitForTabReload(mainTabId, '', 20000);
                        try {
                            await chrome.scripting.executeScript({
                                target: { tabId: mainTabId }, world: 'MAIN',
                                func: () => location.reload()
                            });
                        } catch (_) {}
                        await manualP;
                    }
                    await new Promise(r => setTimeout(r, 200)); // [v2.5] Giảm từ 500ms
                }

            } catch (e) {
                console.error(`[VTP] Lỗi tuyến "${route}":`, e);
                errors.push({ route, error: e.message });
                setRouteStatus(route, 'error'); // Fix #4
                // Sau lỗi: thử reload để vòng tiếp theo có trạng thái sạch
                try {
                    const reloadPromise = waitForTabReload(mainTabId, '', 20000);
                    await chrome.scripting.executeScript({
                        target: { tabId: mainTabId }, world: 'MAIN',
                        func: () => location.reload()
                    });
                    await reloadPromise;
                    await new Promise(r => setTimeout(r, 800)); // [v2.5] Giảm từ 1500ms
                } catch (_) {}
            }

            // Cập nhật progress
            completed++;
            const pct = Math.round((completed / selectedRoutes.length) * 100);
            routeProgressBar.style.width = pct + '%';
            routeProgressPct.textContent = `${completed} / ${selectedRoutes.length}`;

            if (i < selectedRoutes.length - 1 && !cancelToken.cancelled) {
                routeProgressStatus.textContent = `✔️ Xong tuyến ${i + 1}. Chuyển sang tuyến ${i + 2}: ${selectedRoutes[i + 1]}...`;
                await new Promise(r => setTimeout(r, 200)); // [v2.5] Giảm từ 500ms
            }
        }

        // Hoàn tất — dọn dẹp
        clearInterval(elapsedTimer); // Fix #7
        if (routeEtaEl) routeEtaEl.textContent = '';
        routeProgressBar.style.width = '100%';

        if (cancelToken.cancelled) {
            routeProgressStatus.textContent = `⏹ Đã dừng. Hoàn thành ${completed}/${selectedRoutes.length} tuyến.`;
        } else if (errors.length === 0) {
            routeProgressStatus.textContent = `✅ Hoàn tất! Đã kiểm kê ${completed} tuyến thành công.`;
        } else {
            routeProgressStatus.textContent =
                `⚠️ Hoàn tất ${completed} tuyến. ${errors.length} lỗi: ${errors.map(e => e.route).join(', ')}`;
        }

        // Reset UI
        startKiemKeTuyenBtn.disabled       = false;
        startKiemKeTuyenBtn.innerHTML      = BTN_HTML.kiemkePlay; // Fix #5
        cancelKiemKeTuyenBtn.style.display = 'none';              // Fix #1
        cancelKiemKeTuyenBtn.disabled      = false;
        loadRoutesBtn.disabled             = false;
        startGapTonBtn.disabled            = false;
    });

    // ════════════════════════════════════════
    //  NÚT QUÉT MÃ CŨ (Core Scan)
    // ════════════════════════════════════════
    startGapTonBtn.addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.url?.includes('viettelpost') && !tab?.url?.includes('localhost')) return;

        startGapTonBtn.disabled  = true;
        startGapTonBtn.innerHTML = '⏳ Đang nạp hệ thống…';

        try {
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                world:  'MAIN',
                files:  ['src/shared/notification.js', 'src/modules/kiemke/gapton_settings.js', 'src/modules/kiemke/gapton_smart_delay.js', 'src/modules/kiemke/gapton_core_scan.js']
            });
        } catch (e) {
            console.error('[VTP] Lỗi inject Kiểm Tồn:', e);
            alert('Không thể chạy script. Hãy kiểm tra lại trang ViettelPost!');
            startGapTonBtn.disabled  = false;
            startGapTonBtn.innerHTML = BTN_HTML.gaptonPlay;
            return;
        }

        // Side panel không đóng được bằng window.close()
        // Tool đã inject thành công, người dùng có thể tiếp tục xem trạng thái
        startGapTonBtn.innerHTML = BTN_HTML.gaptonPlay.replace('Quét Mã Kiểm Tồn', '✅ Đã nạp script!');
        setTimeout(() => {
            startGapTonBtn.disabled  = false;
            startGapTonBtn.innerHTML = BTN_HTML.gaptonPlay;
        }, 3000);
    });

    // ════════════════════════════════════════
    //  TAB 3 — GHI ĐƠN HÀNG
    // ════════════════════════════════════════
    const ghidonToggle         = document.getElementById('ghidonToggle');
    const ghidonConnDot        = document.getElementById('ghidonConnDot');
    const ghidonConnMsg        = document.getElementById('ghidonConnMsg');
    const ghidonConnectionText = document.getElementById('ghidonConnectionText');
    const ghidonTotalOrders    = document.getElementById('ghidonTotalOrders');
    const ghidonTotalCOD       = document.getElementById('ghidonTotalCOD');
    const ghidonOrderList      = document.getElementById('ghidonOrderList');
    const ghidonPendingSection = document.getElementById('ghidonPendingSection');
    const ghidonPendingCount   = document.getElementById('ghidonPendingCount');
    const ghidonSyncBtn        = document.getElementById('ghidonSyncBtn');
    const ghidonResetBtn       = document.getElementById('ghidonResetBtn');
    const ghidonBadge          = document.getElementById('ghidonBadge');
    // Settings
    const ghidonSettingsToggle = document.getElementById('ghidonSettingsToggle');
    const ghidonSettingsBody   = document.getElementById('ghidonSettingsBody');
    const ghidonWebAppUrl      = document.getElementById('ghidonWebAppUrl');
    const ghidonSheetId        = document.getElementById('ghidonSheetId');
    const ghidonSheetName      = document.getElementById('ghidonSheetName');
    const ghidonBuuTa          = document.getElementById('ghidonBuuTa');
    const ghidonScanInterval   = document.getElementById('ghidonScanInterval');
    const ghidonMinLen         = document.getElementById('ghidonMinLen');
    const ghidonSoundEnabled   = document.getElementById('ghidonSoundEnabled');
    const ghidonDuplicateCheck = document.getElementById('ghidonDuplicateCheck');
    const ghidonSaveSettingsBtn= document.getElementById('ghidonSaveSettingsBtn');
    const ghidonTestConnBtn    = document.getElementById('ghidonTestConnBtn');
    const ghidonTestResult     = document.getElementById('ghidonTestResult');
    const ghidonOpenSheetBtn   = document.getElementById('ghidonOpenSheetBtn');
    // Account
    const ghidonAccountBar     = document.getElementById('ghidonAccountBar');
    const ghidonAccountIcon    = document.getElementById('ghidonAccountIcon');
    const ghidonAccountName    = document.getElementById('ghidonAccountName');
    const ghidonWrongAccount   = document.getElementById('ghidonWrongAccount');
    const ghidonWrongAccountMsg= document.getElementById('ghidonWrongAccountMsg');

    // ── Helper: gửi message đến background ──
    function ghidonMsg(msg) {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage(msg, (resp) => {
                if (chrome.runtime.lastError) resolve({});
                else resolve(resp || {});
            });
        });
    }

    // ── Helper: format tiền ──
    function ghidonFormatMoney(amount) {
        const num = parseInt(amount, 10) || 0;
        if (num === 0) return '0đ';
        return num.toLocaleString('vi-VN') + 'đ';
    }

    // ── Helper: lấy giờ từ chuỗi ──
    function ghidonExtractTime(timeStr) {
        if (!timeStr) return '';
        const parts = timeStr.split(', ');
        return parts[1] ? parts[1].substring(0, 5) : timeStr.substring(0, 5);
    }

    // ── Khởi tạo GhiĐơn tab ──
    async function ghidonInit() {
        await ghidonLoadSettings();
        await ghidonLoadStats();
        await ghidonCheckConnection();
        await ghidonLoadAccountStatus(); // Khôi phục trạng thái account
    }

    // ── Load settings vào form ──
    async function ghidonLoadSettings() {
        const s = await ghidonMsg({ action: 'GHIDON_GET_SETTINGS' });
        ghidonToggle.checked = s.ghidon_enabled !== false;
        // Chỉ ghi đè nếu storage có giá trị — giữ nguyên HTML default nếu chưa lưu
        if (ghidonWebAppUrl    && s.ghidon_sheetWebAppUrl) ghidonWebAppUrl.value    = s.ghidon_sheetWebAppUrl;
        if (ghidonSheetId      && s.ghidon_sheetId)        ghidonSheetId.value      = s.ghidon_sheetId;
        if (ghidonSheetName    && s.ghidon_sheetName)      ghidonSheetName.value    = s.ghidon_sheetName;
        if (ghidonBuuTa        && s.ghidon_buuTaName)      ghidonBuuTa.value        = s.ghidon_buuTaName;
        if (ghidonScanInterval && s.ghidon_scanInterval)   ghidonScanInterval.value = s.ghidon_scanInterval;
        if (ghidonMinLen       && s.ghidon_minBarcodeLen)  ghidonMinLen.value       = s.ghidon_minBarcodeLen;
        if (ghidonSoundEnabled)   ghidonSoundEnabled.checked   = s.ghidon_soundEnabled !== false;
        if (ghidonDuplicateCheck) ghidonDuplicateCheck.checked = s.ghidon_duplicateCheck !== false;
    }

    // ── Load stats + render orders + pending ──
    async function ghidonLoadStats() {
        const s = await ghidonMsg({ action: 'GHIDON_GET_SETTINGS' });
        const stats = s.ghidon_todayStats || {};
        const today = new Date().toISOString().split('T')[0];

        if (stats.date === today) {
            ghidonTotalOrders.textContent = stats.count || 0;
            ghidonTotalCOD.textContent    = ghidonFormatMoney(stats.totalCOD || 0);
            ghidonRenderOrders(stats.orders || []);
            // Badge on tab
            const count = stats.count || 0;
            if (ghidonBadge) {
                ghidonBadge.textContent   = count > 0 ? count : 0;
                ghidonBadge.style.display = count > 0 ? 'inline-flex' : 'none';
            }
        } else {
            ghidonTotalOrders.textContent = '0';
            ghidonTotalCOD.textContent    = '0đ';
            ghidonRenderOrders([]);
            if (ghidonBadge) ghidonBadge.style.display = 'none';
        }

        // Pending
        const pending = s.ghidon_pendingOrders || [];
        if (pending.length > 0) {
            ghidonPendingSection.style.display = 'block';
            ghidonPendingCount.textContent      = pending.length;
        } else {
            ghidonPendingSection.style.display = 'none';
        }
    }

    // ── Render danh sách đơn ──
    function ghidonRenderOrders(orders) {
        if (orders.length === 0) {
            ghidonOrderList.innerHTML = '<li class="ghidon-order-empty">Chưa có đơn nào hôm nay</li>';
            return;
        }
        const recent = orders.slice(-8).reverse();
        ghidonOrderList.innerHTML = recent.map(order => `
            <li class="ghidon-order-item">
                <span class="ghidon-order-code">${order.ma || '---'}</span>
                <div class="ghidon-order-meta">
                    ${order.cod && order.cod !== '0' ? `<span class="ghidon-order-cod">${ghidonFormatMoney(order.cod)}</span>` : ''}
                    <span class="ghidon-order-time">${ghidonExtractTime(order.time)}</span>
                    <span class="ghidon-order-ok">✅</span>
                </div>
            </li>
        `).join('');
    }

    // ── Kiểm tra kết nối Sheet ──
    async function ghidonCheckConnection() {
        const s = await ghidonMsg({ action: 'GHIDON_GET_SETTINGS' });
        if (!s.ghidon_sheetWebAppUrl) {
            ghidonSetConnStatus('local', '💾 Chưa cấu hình Sheet — Lưu cục bộ');
            return;
        }
        ghidonSetConnStatus('checking', 'Đang kiểm tra kết nối Sheet...');
        const result = await ghidonMsg({ action: 'GHIDON_TEST_CONNECTION' });
        if (result && result.success) {
            ghidonSetConnStatus('connected', '🟢 Đã kết nối Google Sheet');
        } else {
            ghidonSetConnStatus('disconnected', `🔴 Lỗi: ${result?.error || 'Không kết nối được'}`);
        }
    }

    function ghidonSetConnStatus(type, text) {
        const colorMap = {
            connected:    '#10B981',
            disconnected: '#EE0033',
            checking:     '#F59E0B',
            local:        '#94A3B8',
        };
        const color = colorMap[type] || colorMap.local;
        if (ghidonConnDot) { ghidonConnDot.className = 'status-dot'; ghidonConnDot.style.background = color; }
        if (ghidonConnMsg) ghidonConnMsg.textContent = text;
        if (ghidonConnectionText) ghidonConnectionText.textContent = text;
    }

    // ── Toggle enable/disable ──
    if (ghidonToggle) {
        ghidonToggle.addEventListener('change', async () => {
            const enabled = ghidonToggle.checked;
            await chrome.storage.local.set({ ghidon_enabled: enabled });
            // Gửi tới content script trên tab active
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tab) await chrome.tabs.sendMessage(tab.id, { action: 'GHIDON_TOGGLE', enabled });
            } catch (_) {}
        });
    }

    // ── Settings collapsible toggle ──
    if (ghidonSettingsToggle) {
        ghidonSettingsToggle.addEventListener('click', () => {
            const isOpen = ghidonSettingsBody.style.display !== 'none';
            ghidonSettingsBody.style.display = isOpen ? 'none' : 'flex';
            ghidonSettingsToggle.setAttribute('aria-expanded', !isOpen);
        });
    }

    // ── Lưu settings ──
    if (ghidonSaveSettingsBtn) {
        ghidonSaveSettingsBtn.addEventListener('click', async () => {
            const settings = {
                ghidon_sheetWebAppUrl: ghidonWebAppUrl?.value.trim() || '',
                ghidon_sheetId:        ghidonSheetId?.value.trim()   || '',
                ghidon_sheetName:      ghidonSheetName?.value.trim() || 'Trang tính1',
                ghidon_buuTaName:      ghidonBuuTa?.value.trim()    || '',
                ghidon_scanInterval:   parseInt(ghidonScanInterval?.value, 10) || 50,
                ghidon_minBarcodeLen:  parseInt(ghidonMinLen?.value, 10) || 8,
                ghidon_soundEnabled:   ghidonSoundEnabled?.checked !== false,
                ghidon_duplicateCheck: ghidonDuplicateCheck?.checked !== false,
            };
            await ghidonMsg({ action: 'GHIDON_SAVE_SETTINGS', settings });
            // Visual feedback
            const origHTML = ghidonSaveSettingsBtn.innerHTML;
            ghidonSaveSettingsBtn.innerHTML = '✅ Đã lưu!';
            ghidonSaveSettingsBtn.disabled  = true;
            setTimeout(() => {
                ghidonSaveSettingsBtn.innerHTML = origHTML;
                ghidonSaveSettingsBtn.disabled  = false;
            }, 2000);
            // Re-check connection
            await ghidonCheckConnection();
        });
    }

    // ── Test kết nối ──
    if (ghidonTestConnBtn) {
        ghidonTestConnBtn.addEventListener('click', async () => {
            ghidonTestResult.style.display = 'none';
            ghidonTestConnBtn.disabled = true;
            const origHTML = ghidonTestConnBtn.innerHTML;
            ghidonTestConnBtn.innerHTML = '<svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13"><path d="M21 12a9 9 0 11-3.36-7.02"/></svg> Đang test...';

            // Save current URL first
            if (ghidonWebAppUrl?.value.trim()) {
                await chrome.storage.local.set({ ghidon_sheetWebAppUrl: ghidonWebAppUrl.value.trim() });
            }

            const result = await ghidonMsg({ action: 'GHIDON_TEST_CONNECTION' });

            ghidonTestResult.style.display = 'block';
            if (result && result.success) {
                ghidonTestResult.className   = 'ghidon-test-result is-success';
                ghidonTestResult.textContent = `✅ Kết nối thành công! ${result.message || ''}`;
                ghidonSetConnStatus('connected', '🟢 Đã kết nối Google Sheet');
            } else {
                ghidonTestResult.className   = 'ghidon-test-result is-error';
                ghidonTestResult.textContent = `❌ Lỗi: ${result?.error || 'Không kết nối được'}`;
                ghidonSetConnStatus('disconnected', `🔴 ${result?.error || 'Lỗi kết nối'}`);
            }

            ghidonTestConnBtn.innerHTML = origHTML;
            ghidonTestConnBtn.disabled  = false;
        });
    }

    // ── Sync pending ──
    if (ghidonSyncBtn) {
        ghidonSyncBtn.addEventListener('click', async () => {
            const origHTML = ghidonSyncBtn.innerHTML;
            ghidonSyncBtn.innerHTML  = '⏳ Sync...';
            ghidonSyncBtn.disabled   = true;
            await ghidonMsg({ action: 'GHIDON_SYNC_PENDING' });
            setTimeout(async () => {
                ghidonSyncBtn.innerHTML = origHTML;
                ghidonSyncBtn.disabled  = false;
                await ghidonLoadStats();
            }, 3000);
        });
    }

    // ── Reset stats hôm nay ──
    if (ghidonResetBtn) {
        ghidonResetBtn.addEventListener('click', async () => {
            if (!confirm('Reset thống kê hôm nay? (Dữ liệu trên Sheet không bị ảnh hưởng)')) return;
            await ghidonMsg({ action: 'GHIDON_RESET_TODAY' });
            await ghidonLoadStats();
        });
    }

    // ── Mở Sheet ──
    if (ghidonOpenSheetBtn) {
        ghidonOpenSheetBtn.addEventListener('click', async () => {
            const s = await ghidonMsg({ action: 'GHIDON_GET_SETTINGS' });
            if (s.ghidon_sheetId) {
                chrome.tabs.create({ url: `https://docs.google.com/spreadsheets/d/${s.ghidon_sheetId}` });
            } else {
                chrome.tabs.create({ url: 'https://docs.google.com/spreadsheets/' });
            }
        });
    }

    // ── Lắng nghe storage changes để refresh stats realtime ──
    chrome.storage.onChanged.addListener((changes, ns) => {
        if (ns !== 'local') return;
        if (changes.__GHIDON_STATS_UPDATED__ || changes.ghidon_todayStats || changes.ghidon_pendingOrders) {
            ghidonLoadStats();
        }
        // Cập nhật trạng thái tài khoản realtime
        if (changes.ghidon_accountVerified || changes.ghidon_currentUser) {
            ghidonLoadAccountStatus();
        }
    });

    // ── Load & render trạng thái tài khoản ──
    async function ghidonLoadAccountStatus() {
        const s = await ghidonMsg({ action: 'GHIDON_GET_SETTINGS' });
        const verified = s.ghidon_accountVerified;
        const user     = s.ghidon_currentUser;
        ghidonRenderAccountStatus(verified, user);
    }

    function ghidonRenderAccountStatus(verified, user) {
        if (!ghidonAccountBar) return;

        if (user === null || user === undefined) {
            // Chưa phát hiện user
            ghidonAccountBar.className = 'ghidon-account-bar';
            if (ghidonAccountIcon) ghidonAccountIcon.textContent = '👤';
            if (ghidonAccountName) ghidonAccountName.textContent = 'Chưa mở trang ViettelPost';
            if (ghidonWrongAccount) ghidonWrongAccount.style.display = 'none';
            return;
        }

        if (verified) {
            ghidonAccountBar.className = 'ghidon-account-bar is-verified';
            if (ghidonAccountIcon) ghidonAccountIcon.textContent = '✅';
            if (ghidonAccountName) ghidonAccountName.textContent = user;
            if (ghidonWrongAccount) ghidonWrongAccount.style.display = 'none';
        } else {
            ghidonAccountBar.className = 'ghidon-account-bar is-invalid';
            if (ghidonAccountIcon) ghidonAccountIcon.textContent = '⛔';
            if (ghidonAccountName) ghidonAccountName.textContent = user || 'Không xác định';
            if (ghidonWrongAccount) ghidonWrongAccount.style.display = 'flex';
            if (ghidonWrongAccountMsg) {
                ghidonWrongAccountMsg.textContent =
                    `Đang đăng nhập: "${user || '?'}" — Cần đăng nhập bằng DƯƠNG THÁI TÂN`;
            }
        }
    }

    // ── Khởi tạo lần đầu ──
    ghidonInit();

});