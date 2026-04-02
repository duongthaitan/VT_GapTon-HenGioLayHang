// Hàm tạo độ trễ
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Hàm mô phỏng thao tác gõ phím cho Angular
const setInputValue = (inputElement, value) => {
    inputElement.value = value;
    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
    inputElement.dispatchEvent(new Event('change', { bubbles: true }));
};

async function processNextBill() {
    // Lấy trạng thái hiện tại từ Storage
    let data = await chrome.storage.local.get(['billList', 'delay', 'isRunning', 'currentIndex']);

    if (!data.isRunning) return console.log("Đã dừng tự động hóa.");
    if (data.currentIndex >= data.billList.length) {
        window.VTPNotification.show("Đã chạy xong toàn bộ mã vận đơn!"  , 'success');
        await chrome.storage.local.set({ isRunning: false });
        return;
    }

    let currentBill = data.billList[data.currentIndex];
    let delayMs = data.delay * 1000;

    console.log(`Đang xử lý đơn thứ ${data.currentIndex + 1}: ${currentBill}`);

    try {
        // --- BƯỚC 2: Nhập mã và Tìm kiếm ---
        let searchInput = document.querySelector('input#frm_keyword');
        let searchBtn = document.querySelector('button.btn-viettel i.fa-search').parentElement;

        if (searchInput && searchBtn) {
            setInputValue(searchInput, currentBill);
            searchBtn.click();
        } else {
            console.error("Không tìm thấy ô tìm kiếm.");
        }

        await sleep(2000); // Chờ kết quả tìm kiếm load ra bảng

        // --- BƯỚC 3: Bấm vào icon menu (fa-bars) và Sửa đơn ---
        let menuIcon = document.querySelector('i.fa.fa-bars');
        if (menuIcon) {
            menuIcon.click();
            await sleep(500); // Đợi menu xổ ra

            // Tìm nút có chữ "Sửa đơn"
            let menuItems = document.querySelectorAll('button.vtp-bill-btn-action span');
            let editBtn = Array.from(menuItems).find(span => span.innerText.includes('Sửa đơn'));

            if (editBtn) {
                editBtn.parentElement.click();
            }
        }

        // Chờ X giây (theo cấu hình của người dùng) để trang sửa đơn load
        await sleep(delayMs);

        // --- BƯỚC 4: Ấn vào ô thời gian hẹn lấy ---
        let timeSelectBtn = document.querySelector('button.select-down');
        if (timeSelectBtn) {
            timeSelectBtn.click();
            await sleep(1000); // Đợi popup ngày tháng hiện ra
        }

        // --- BƯỚC 5: Chọn "Ngày kia" (ưu tiên) hoặc "Ngày mai" và "Cả ngày" ---
        // Trên web Angular, việc click vào thẻ <label> thường ổn định hơn thẻ <input radio> bị ẩn
        let labelNgayKia = document.querySelector('label[for="2_apt"]');
        let labelNgayMai = document.querySelector('label[for="1_apt"]');

        if (labelNgayKia) {
            labelNgayKia.click();
        } else if (labelNgayMai) {
            labelNgayMai.click();
        }

        await sleep(500);

        // Chọn "Cả ngày"
        let labelCaNgay = Array.from(document.querySelectorAll('label.lb-time')).find(lbl => lbl.getAttribute('for') === '1_op' && lbl.innerText.includes('Cả ngày'));
        if (labelCaNgay) {
            labelCaNgay.click();
        }

        await sleep(500);

        // --- BƯỚC 6: Ấn vào Cập nhật ---
        let updateBtns = document.querySelectorAll('button.btn-viettel.btn-block');
        let updateBtn = Array.from(updateBtns).find(btn => btn.innerText.trim() === 'Cập nhật');

        if (updateBtn) {
            updateBtn.click();
        }

        await sleep(2000); // Chờ API lưu thành công trước khi qua đơn mới

        // Cập nhật index và chạy tiếp đệ quy
        await chrome.storage.local.set({ currentIndex: data.currentIndex + 1 });
        processNextBill();

    } catch (error) {
        console.error("Lỗi trong quá trình xử lý đơn:", error);
    }
}

// Bắt đầu chuỗi chạy ngay khi file được chèn vào từ popup
processNextBill();