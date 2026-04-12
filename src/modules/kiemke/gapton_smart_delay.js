// ============================================================
//  VTP Tool – Smart Delay Module
//  v1.1: Thu hẹp MutationObserver options để giảm CPU
//        - Bỏ characterData (không cần thiết để phát hiện mã thay đổi)
//        - Dùng attributes: false để tránh trigger từ style/class updates
// ============================================================
window.VTPSmartDelay = {

    /**
     * Chờ cho đến khi mã được xử lý xong (phần tử biến mất hoặc thay đổi)
     * Dùng MutationObserver thay vì polling timer
     */
    waitUntilCodeProcessed(targetCode, targetElement, maxWaitTime = 15000) {
        return new Promise((resolve) => {
            const checkStatus = () => {
                // Kiểm tra phần tử đã bị xóa khỏi DOM chưa
                if (!document.body.contains(targetElement)) return 'success';
                // Kiểm tra text đã thay đổi chưa
                if (!targetElement.innerText.includes(targetCode)) return 'success';

                // Kiểm tra popup lỗi từ hệ thống ZK
                const errorBox = document.querySelector(
                    '.z-messagebox-window, .z-errorbox, .z-notification-error'
                );
                if (errorBox && errorBox.style.display !== 'none') {
                    const okBtn = errorBox.querySelector('.z-button');
                    if (okBtn) okBtn.click();
                    return 'error';
                }
                return 'pending';
            };

            // Kiểm tra ngay trước khi tạo observer
            const initial = checkStatus();
            if (initial === 'success') return resolve(true);
            if (initial === 'error')   return resolve(false);

            // Fix #10: Khai báo trước observer để đảm bảo variable luôn in-scope
            let timeoutId;
            const observer = new MutationObserver((_mutations, obs) => {
                const status = checkStatus();
                if (status === 'success') {
                    obs.disconnect();
                    clearTimeout(timeoutId);
                    resolve(true);
                } else if (status === 'error') {
                    obs.disconnect();
                    clearTimeout(timeoutId);
                    resolve(false);
                }
            });

            observer.observe(document.body, {
                childList:     true,
                subtree:       true,
                characterData: false,  // ← Tắt để giảm trigger không cần thiết
                attributes:    false   // ← Tắt để bỏ qua style/class updates
            });

            timeoutId = setTimeout(() => {
                observer.disconnect();
                resolve(false);
            }, maxWaitTime);
        });
    },

    /**
     * Chờ trang lật xong (first cell thay đổi nội dung)
     */
    waitForPageLoad(oldFirstCode, maxWait = 10000) {
        return new Promise((resolve) => {
            const checkChanged = () => {
                const firstCell = document.querySelector('.z-listcell-content');
                if (!firstCell) return false;
                return firstCell.innerText.trim().replace(/\s+/g, '') !== oldFirstCode;
            };

            if (checkChanged()) return resolve(true);

            // Fix #10: Khai báo trước observer
            let timeoutId;
            const observer = new MutationObserver((_mutations, obs) => {
                if (checkChanged()) {
                    obs.disconnect();
                    clearTimeout(timeoutId);
                    resolve(true);
                }
            });

            // Chỉ dùng childList + subtree — đủ để phát hiện trang mới load
            observer.observe(document.body, {
                childList:     true,
                subtree:       true,
                characterData: false,
                attributes:    false
            });

            timeoutId = setTimeout(() => {
                observer.disconnect();
                resolve(false);
            }, maxWait);
        });
    },

    /** Helper sleep */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
};