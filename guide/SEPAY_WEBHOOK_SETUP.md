# 🔔 HƯỚNG DẪN SETUP SEPAY WEBHOOK - THANH TOÁN TỰ ĐỘNG

## 📋 TỔNG QUAN

Hệ thống thanh toán tự động sử dụng:

- **SePay** - Theo dõi biến động số dư ngân hàng (MIỄN PHÍ)
- **Google Apps Script** - Xử lý webhook và cập nhật Firebase (MIỄN PHÍ)
- **Firebase Realtime Database** - Lưu trữ và realtime update (MIỄN PHÍ)

---

## 🚀 BƯỚC 1: ĐĂNG KÝ SEPAY

### 1.1. Tạo tài khoản SePay

1. Truy cập: https://my.sepay.vn/register
2. Đăng ký bằng email
3. Xác nhận email

### 1.2. Liên kết tài khoản ngân hàng

1. Vào **Dashboard** > **Tài khoản ngân hàng**
2. Chọn **Thêm tài khoản**
3. Chọn ngân hàng: **MB Bank** (hoặc ngân hàng bạn dùng)
4. Nhập thông tin:
   - Số tài khoản: `0362310925` (thay bằng STK thật)
   - Tên chủ TK: `NGUYEN TRONG NGHIA`
5. Xác nhận theo hướng dẫn SePay

### 1.3. Lấy API Key

1. Vào **Cài đặt** > **API**
2. Copy **API Key** và lưu lại
3. Sẽ dùng để verify webhook

---

## 🚀 BƯỚC 2: TẠO GOOGLE APPS SCRIPT

### 2.1. Tạo project mới

1. Truy cập: https://script.google.com
2. Click **New Project**
3. Đổi tên project: `CodeMaster-Payment-Webhook`

### 2.2. Copy code

1. Xóa code mặc định
2. Copy toàn bộ code từ file: `webhook/sepay-webhook.gs`
3. Paste vào editor

### 2.3. Cập nhật cấu hình

Sửa các giá trị trong phần `CONFIG`:

```javascript
const CONFIG = {
  // Firebase Database URL (không có .json)
  FIREBASE_URL: "https://db-code-master-default-rtdb.firebaseio.com",

  // Firebase Database Secret (lấy từ Firebase Console)
  FIREBASE_SECRET: "YOUR_FIREBASE_DATABASE_SECRET",

  // SePay API Key (để verify webhook)
  SEPAY_API_KEY: "YOUR_SEPAY_API_KEY",

  // Prefix của nội dung chuyển khoản
  TRANSFER_PREFIX: "CODEMASTER",
};
```

### 2.4. Lấy Firebase Database Secret

1. Vào Firebase Console: https://console.firebase.google.com
2. Chọn project **db-code-master**
3. Vào **Project Settings** (icon bánh răng)
4. Tab **Service accounts**
5. Mục **Database secrets** > **Show** > Copy

⚠️ **LƯU Ý**: Database Secret đã deprecated, nên dùng Service Account.
Nhưng với đồ án demo, Secret vẫn hoạt động tốt.

### 2.5. Deploy Google Apps Script

1. Click **Deploy** > **New deployment**
2. Chọn type: **Web app**
3. Cấu hình:
   - Description: `SePay Webhook Handler v1`
   - Execute as: **Me**
   - Who has access: **Anyone** (quan trọng!)
4. Click **Deploy**
5. **Copy URL** được tạo ra (dạng: `https://script.google.com/macros/s/xxx/exec`)

---

## 🚀 BƯỚC 3: CẤU HÌNH WEBHOOK TRÊN SEPAY

### 3.1. Thêm Webhook

1. Vào SePay Dashboard > **Cài đặt** > **Webhook**
2. Click **Thêm webhook**
3. Nhập thông tin:
   - **URL**: Paste URL từ Google Apps Script
   - **Events**: Chọn **Giao dịch mới**
   - **Status**: Bật

### 3.2. Test Webhook

1. SePay có nút **Test webhook**
2. Click để gửi test request
3. Kiểm tra log trong Google Apps Script:
   - Vào **Executions** trong Apps Script
   - Xem có request đến không

---

## 🚀 BƯỚC 4: TEST THANH TOÁN THẬT

### 4.1. Chuẩn bị

1. Mở website CodeMaster
2. Đăng nhập với tài khoản user
3. Vào mua 1 khóa học PRO (đặt giá test 1,000đ - 10,000đ)

### 4.2. Thực hiện thanh toán

1. Quét mã QR bằng app ngân hàng
2. Chuyển khoản đúng số tiền
3. Nội dung: `CODEMASTER CM-xxx-xxx` (tự động điền)

### 4.3. Kiểm tra kết quả

Sau 5-30 giây:

- ✅ Trang checkout hiện "Thanh toán thành công!"
- ✅ User được enroll vào khóa học
- ✅ Order status = "completed" trong Firebase

---

## 🔍 DEBUG & TROUBLESHOOTING

### Kiểm tra Google Apps Script logs

1. Vào Apps Script > **Executions**
2. Xem các request đã nhận
3. Click vào từng execution để xem log chi tiết

### Kiểm tra Firebase

1. Vào Firebase Console > Realtime Database
2. Mở node `orders/CM-xxx-xxx`
3. Xem status đã chuyển thành "completed" chưa

### Các lỗi thường gặp

| Lỗi                   | Nguyên nhân        | Cách sửa                                         |
| --------------------- | ------------------ | ------------------------------------------------ |
| Webhook không nhận    | URL sai            | Kiểm tra lại URL deploy                          |
| Firebase không update | Secret sai         | Lấy lại Database Secret                          |
| Order không tìm thấy  | Content sai format | Kiểm tra nội dung CK có đúng `CODEMASTER CM-xxx` |
| Số tiền không khớp    | Chuyển thiếu/thừa  | Chuyển đúng số tiền hiển thị                     |

---

## 📊 GIÁM SÁT

### Xem log webhook

- Google Apps Script: **Executions** tab
- Firebase: **orders** node
- SePay: **Lịch sử giao dịch**

### Thống kê

- Vào Admin Dashboard > **Đơn hàng**
- Xem các đơn có `confirmedBy: "sepay-webhook"`

---

## 🔒 BẢO MẬT

### Checklist bảo mật:

- [ ] Không commit Firebase Secret lên Git
- [ ] Sử dụng biến môi trường cho Secret
- [ ] Verify API Key từ SePay
- [ ] Kiểm tra số tiền trước khi confirm

### Khuyến nghị production:

1. Dùng Firebase Admin SDK thay vì Database Secret
2. Thêm IP whitelist cho webhook
3. Log tất cả transactions để audit

---

## 📞 HỖ TRỢ

- SePay Support: support@sepay.vn
- Firebase Docs: https://firebase.google.com/docs
- Google Apps Script: https://developers.google.com/apps-script

---

**Chúc bạn triển khai thành công! 🎉**
