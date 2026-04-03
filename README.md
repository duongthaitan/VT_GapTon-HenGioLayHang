<div align="center">

<img src="https://via.placeholder.com/1000x250/ee0033/ffffff?text=VTP+Tool+All-in-One+-+Supercharge+Your+Workflow" alt="VTP Tool Banner" width="100%" style="border-radius: 12px;">

<br/>

# 📦 VTP Tool All-in-One

**Bộ công cụ tự động hóa đột phá dành riêng cho hệ thống Viettel Post**

[![Tác giả](https://img.shields.io/badge/Tác_giả-Thái_Tân_Dương-ee0033.svg?style=for-the-badge&logo=github)](https://github.com/duongthaitan)
[![Phiên bản](https://img.shields.io/badge/Version-1.0.0-0056b3.svg?style=for-the-badge&logo=semver)](https://github.com/duongthaitan)
[![Nền tảng](https://img.shields.io/badge/Chrome_Extension-4db8ff.svg?style=for-the-badge&logo=google-chrome)](https://google.com/chrome)
[![JavaScript](https://img.shields.io/badge/Vanilla_JS-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)]()
[![Giấy phép](https://img.shields.io/badge/License-MIT-success.svg?style=for-the-badge)](LICENSE)

*Một tiện ích nhỏ gọn, mạnh mẽ giúp bạn tiết kiệm hàng giờ thao tác thủ công mỗi ngày.*

[🚀 Cài đặt nhanh](#-hướng-dẫn-cài-đặt) • [📖 Cách sử dụng](#-hướng-dẫn-sử-dụng) • [🐛 Báo lỗi](mailto:duongthaitan13@gmail.com)

</div>

---

## ⚡ Giới thiệu dự án

**VTP Tool All-in-One** là tiện ích mở rộng (Chrome Extension) được thiết kế đặc biệt nhằm tối ưu hóa quy trình làm việc trên nền tảng Viettel Post. Bằng cách gộp hai tính năng cốt lõi là **Auto Sửa Giờ** và **Auto Kiểm Tồn**, công cụ giúp tự động hóa các thao tác lặp đi lặp lại, bypass các bước xác nhận rườm rà và hiển thị luồng công việc theo thời gian thực (Real-time HUD).

> **💡 Triết lý thiết kế:**
> *Nhanh - Nhẹ - Không xâm nhập.* Toàn bộ mã nguồn sử dụng **Vanilla JavaScript**, không phụ thuộc vào thư viện nặng nề như jQuery, kết hợp với hệ thống **Custom Toast Notification** giúp trải nghiệm người dùng mượt mà tuyệt đối.

---

## 🌟 Bảng tính năng cốt lõi

| 🕒 Module Sửa Giờ (Tab 1) | 📦 Module Kiểm Tồn (Tab 2) |
| :--- | :--- |
| **Xử lý Batch đệ quy:** Dán hàng trăm mã, công cụ tự động lặp qua từng mã và xử lý gọn gàng. | **Bypass UI & DOM Injection:** Tự động hóa quá trình điền mã và nhận diện trạng thái nhanh gấp 3 lần. |
| **Smart Date Selector:** Thuật toán ưu tiên chọn "Ngày kia", "Ngày mai" và "Cả ngày" chuẩn xác. | **HUD Overlay Dashboard:** Giao diện điều khiển nổi hiển thị % tiến trình ngay trên trang làm việc. |
| **Network-Adaptive Delay:** Tùy chỉnh trực tiếp <kbd>Delay</kbd> để tránh bị nghẽn mạng do VTP server lag. | **Data Export:** Ghi log trạng thái chi tiết và cho phép xuất trực tiếp ra file Excel (`.csv`). |

---

## 💻 Trải nghiệm thực tế (Demo)

<div align="center">
  <img src="https://via.placeholder.com/800x450/f8f9fa/ee0033?text=Chèn+Ảnh+Hoạc+GIF+Demo+Vào+Đây" alt="GIF Demo tính năng" width="100%" style="border-radius: 8px; box-shadow: 0 10px 20px rgba(0,0,0,0.1);">
  <p><i>Dashboard tương tác 2 Tabs và Hệ thống thông báo Pop-up chuyên nghiệp.</i></p>
</div>

---

## 🚀 Hướng dẫn cài đặt

Công cụ được thiết kế dưới dạng Unpacked Extension. Bạn chỉ mất 1 phút để cài đặt:

1. **Lấy Source Code:** Nhấn vào nút xanh <kbd>Code</kbd> $\rightarrow$ chọn <kbd>Download ZIP</kbd>. Sau đó giải nén ra một thư mục cố định trên máy.
2. **Mở Quản lý Tiện ích:** - Trên Chrome, nhập vào thanh địa chỉ: `chrome://extensions/`
   - Trên Edge, nhập: `edge://extensions/`
3. **Kích hoạt:** Bật công tắc **Chế độ dành cho nhà phát triển** (Developer mode) ở góc phải màn hình.
4. **Nạp tiện ích:** Bấm vào nút <kbd>Tải tiện ích đã giải nén</kbd> (Load unpacked) và trỏ vào thư mục bạn vừa giải nén.

🎉 *Thành công! Hãy ghim (Pin) biểu tượng tiện ích lên thanh trình duyệt để dùng bất cứ lúc nào.*

---

## 📖 Hướng dẫn sử dụng

### 1. Tab Sửa Giờ 🕒
<details open>
<summary><b>Nhấp để xem chi tiết các bước</b></summary>
<br>

* **Bước 1:** Click vào icon tiện ích trên trình duyệt, chọn tab **Sửa Giờ**.
* **Bước 2:** Dán toàn bộ mã vận đơn cần cập nhật vào ô văn bản. *(Yêu cầu: Mỗi mã nằm trên 1 dòng).*
* **Bước 3:** Đặt **Độ trễ mạng** (Recommend: `5s` cho mạng khỏe, `8-10s` nếu web Viettel Post đang xoay vòng).
* **Bước 4:** Bấm <kbd>▶ BẮT ĐẦU CHẠY</kbd>. Công cụ sẽ tự mở giao diện và làm việc.
</details>

### 2. Tab Kiểm Tồn 📦
<details open>
<summary><b>Nhấp để xem chi tiết các bước</b></summary>
<br>

* **Bước 1:** Đăng nhập và mở đúng màn hình **quản lý đơn hàng / kiểm kê** trên web Viettel Post.
* **Bước 2:** Bấm icon tiện ích, chuyển sang tab **Kiểm Tồn**. Trạng thái sẽ hiện màu xanh báo hiệu sẵn sàng.
* **Bước 3:** Bấm <kbd>🚀 CHẠY KIỂM TỒN</kbd>.
* **Bước 4:** Một Bảng Điều Khiển màu đỏ sẽ trượt lên ở góc dưới cùng bên phải màn hình web. Tool sẽ tự động quét.
* ⚠️ **Lưu ý:** Tuyệt đối không click chuột, cuộn chuột hay gõ phím vào trang web khi hệ thống đang xử lý.
</details>

---

## 🏗 Kiến trúc mã nguồn (Clean Architecture)

Hệ thống được thiết kế theo chuẩn module hóa (MV3), đảm bảo không xảy ra xung đột bộ nhớ giữa hai tính năng:

```text
VTP_All_In_One/
├── manifest.json            # File cấu hình định tuyến (Manifest Version 3)
├── popup.html               # Giao diện tổng (HTML5/CSS3 Variables)
├── popup.js                 # Xử lý sự kiện Tabs & Inject Logic (Service)
├── notification.js          # Hệ thống Toast UI Custom (Global Utility)
├── chinhgio_content.js      # Core Logic chạy ngầm cho tính năng Sửa Giờ
├── gapton_settings.js       # Quản lý cấu hình Regex/Prefix cho hệ thống Quét
├── gapton_smart_delay.js    # MutationObserver Engine (Chống block web)
└── gapton_core_scan.js      # Core Engine quét DOM, chèn mã và vẽ HUD Overlay
❓ Câu hỏi thường gặp (FAQ)Q: Tại sao bấm Kiểm Tồn mà tool không chạy?A: Bạn phải đảm bảo đang ở trên đúng Domain viettelpost.vn hoặc viettelpost.com.vn. Nếu web đang trắng hoặc treo, hãy nhấn <kbd>F5</kbd> tải lại trang và mở tab lại.Q: File xuất ra từ phần Kiểm Tồn mở bằng Excel bị lỗi Font?A: Do Excel đôi khi không nhận diện chuẩn UTF-8 mặc định. Bạn hãy khắc phục bằng cách: Mở Excel $\rightarrow$ Tab Data $\rightarrow$ From Text/CSV $\rightarrow$ Chọn File $\rightarrow$ Ở mục File Origin, chọn 65001: Unicode (UTF-8).🤝 Đóng góp & Phát triểnDự án này được tối ưu và duy trì bởi Thái Tân Dương.
Nếu bạn có ý tưởng cải tiến, tối ưu hóa thuật toán hoặc phát hiện lỗi (bug), đừng ngần ngại:Mở một Issue để thảo luận.Fork dự án, tạo nhánh mới (feature/amazing-feature) và gửi Pull Request.<div align="center">
<b>⌨️ Coded with ❤️ by Dương</b><a href="mailto:duongthaitan13@gmail.com">duongthaitan13@gmail.com</a> • <a href="https://github.com/duongthaitan">@duongthaitan</a><i>⭐ Nếu dự án này giúp bạn về nhà sớm hơn 1 giờ mỗi ngày, hãy tặng cho repository một ngôi sao nhé! ⭐</i>
</div>