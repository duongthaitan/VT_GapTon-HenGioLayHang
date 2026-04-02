document.addEventListener('DOMContentLoaded', async () => {
    // --- XỬ LÝ CHUYỂN TAB ---
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(btn.getAttribute('data-target')).classList.add('active');
        });
    });

    // --- LOGIC TAB 1: CHỈNH GIỜ ---
    document.getElementById('startChinhGioBtn').addEventListener('click', async () => {
        const billText = document.getElementById('billList').value;
        const bills = billText.split('\n').map(b => b.trim()).filter(b => b !== '');
        const delay = parseInt(document.getElementById('delay').value) || 5;

        if (bills.length === 0) {
            window.VTPNotification.show("Vui lòng dán ít nhất 1 mã vận đơn!", 'error');
            return;
        }

        await chrome.storage.local.set({ billList: bills, delay: delay, isRunning: true, currentIndex: 0 });
        document.getElementById('statusChinhGio').innerText = "Trạng thái: Đang chạy...";

let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            // THÊM notification.js vào đầu tiên
            files: ['notification.js', 'chinhgio_content.js']
        });
    });

    document.getElementById('stopChinhGioBtn').addEventListener('click', async () => {
        await chrome.storage.local.set({ isRunning: false });
        document.getElementById('statusChinhGio').innerText = "Trạng thái: Đã dừng.";
    });

    // --- LOGIC TAB 2: KIỂM TỒN (GAP TON) ---
    const statusBoxGapTon = document.getElementById('statusBoxGapTon');
    const startGapTonBtn = document.getElementById('startGapTonBtn');

    try {
        let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.url && tab.url.includes("viettelpost")) {
            statusBoxGapTon.className = 'status-box ready';
            statusBoxGapTon.innerText = 'Trang hợp lệ - Sẵn sàng hoạt động';
            startGapTonBtn.disabled = false;
        } else {
            statusBoxGapTon.className = 'status-box not-ready';
            statusBoxGapTon.innerText = 'Vui lòng mở trang Viettel Post!';
            startGapTonBtn.disabled = true;
        }
    } catch (err) {
        statusBoxGapTon.innerText = 'Lỗi xác định trang.';
    }

    startGapTonBtn.addEventListener('click', async () => {
        let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab.url.includes("viettelpost")) return;

        startGapTonBtn.innerText = `Đang nạp hệ thống...`;
        
chrome.scripting.executeScript({
            target: { tabId: tab.id },
            world: "MAIN", 
            // THÊM notification.js vào đầu tiên
            files: ["notification.js", "gapton_settings.js", "gapton_smart_delay.js", "gapton_core_scan.js"]
        }, () => {
            window.close();
        });
    });
});