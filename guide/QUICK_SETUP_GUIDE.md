# ⚡ HƯỚNG DẪN NHANH - SETUP THANH TOÁN TỰ ĐỘNG

## 📋 CHECKLIST SETUP

### Bước 1: Đăng ký SePay (5 phút)

- [ ] Truy cập https://my.sepay.vn/register
- [ ] Đăng ký tài khoản
- [ ] Liên kết tài khoản ngân hàng MB Bank
- [ ] Copy API Key từ **Cài đặt > API**

### Bước 2: Tạo Google Apps Script (10 phút)

- [ ] Truy cập https://script.google.com
- [ ] Tạo project mới: `CodeMaster-Payment-Webhook`
- [ ] Copy code từ `webhook/sepay-webhook.gs`
- [ ] Cập nhật `FIREBASE_SECRET` và `SEPAY_API_KEY`
- [ ] Deploy > New deployment > Web app
- [ ] Copy URL webhook

### Bước 3: Cấu hình SePay Webhook (2 phút)

- [ ] Vào SePay > **Cài đặt > Webhook**
- [ ] Thêm URL webhook từ Apps Script
- [ ] Chọn event: **Giao dịch mới**
- [ ] Bật webhook

### Bước 4: Deploy Firebase Rules (2 phút)

- [ ] Copy nội dung `data/firebase-rules.json`
- [ ] Paste vào Firebase Console > Realtime Database > Rules
- [ ] Publish

### Bước 5: Test (5 phút)

- [ ] Mở website > Checkout khóa học
- [ ] Quét QR > Chuyển khoản 1,000đ test
- [ ] Chờ 5-30 giây
- [ ] ✅ Tự động hiện "Thanh toán thành công!"

---

## 🔑 CÁC GIÁ TRỊ CẦN THAY THẾ

### Trong `webhook/sepay-webhook.gs`:

```javascript
FIREBASE_URL: "https://db-code-master-default-rtdb.firebaseio.com"; // ✅ Đã đúng
FIREBASE_SECRET: "YOUR_FIREBASE_DATABASE_SECRET_HERE"; // ❌ Cần thay
SEPAY_API_KEY: "YOUR_SEPAY_API_KEY_HERE"; // ❌ Cần thay
```

### Lấy Firebase Database Secret:

1. Firebase Console > Project Settings (⚙️)
2. Service accounts tab
3. Database secrets > Show > Copy

### Lấy SePay API Key:

1. SePay Dashboard > Cài đặt > API
2. Copy API Key

---

## 📁 CẤU TRÚC FILE MỚI

```
code-master/
├── webhook/
│   └── sepay-webhook.gs          # Code cho Google Apps Script
├── docs/
│   ├── SEPAY_WEBHOOK_SETUP.md    # Hướng dẫn chi tiết
│   └── QUICK_SETUP_GUIDE.md      # File này
└── data/
    └── firebase-rules.json        # Đã thêm paymentLogs rules
```

---

## 🧪 CÁCH TEST CHI TIẾT

### Test 1: Test Firebase Connection

**Mục đích:** Kiểm tra Google Apps Script có kết nối được Firebase không

**Các bước thực hiện:**

1. Mở project Google Apps Script của bạn
2. Trong editor, đảm bảo đã cập nhật `FIREBASE_SECRET` đúng
3. Ở thanh công cụ phía trên, chọn function `testFirebaseConnection` từ dropdown
   ```
   ▼ testFirebaseConnection  |  ▶ Run  |  🐛 Debug
   ```
4. Click nút **▶ Run** (hoặc Ctrl+R)
5. Lần đầu chạy sẽ yêu cầu **cấp quyền**:
   - Click "Review Permissions"
   - Chọn tài khoản Google của bạn
   - Click "Advanced" > "Go to CodeMaster-Payment-Webhook (unsafe)"
   - Click "Allow"
6. Xem kết quả trong **Execution log** (phía dưới editor):
   ```
   ✅ Thành công: "Firebase connection: OK"
   ❌ Thất bại: "Firebase connection: FAILED" + Error message
   ```

**Xử lý lỗi thường gặp:**

| Lỗi                | Nguyên nhân         | Cách sửa                           |
| ------------------ | ------------------- | ---------------------------------- |
| `401 Unauthorized` | FIREBASE_SECRET sai | Lấy lại secret từ Firebase Console |
| `404 Not Found`    | FIREBASE_URL sai    | Kiểm tra URL database              |
| `Network error`    | Không có internet   | Kiểm tra kết nối mạng              |

---

### Test 2: Test Webhook thủ công (Giả lập SePay gửi request)

**Mục đích:** Kiểm tra logic xử lý webhook hoạt động đúng

**⚠️ Yêu cầu:** Phải có 1 order PENDING trong database trước

**Các bước thực hiện:**

1. **Tạo order test:**
   - Mở website CodeMaster
   - Đăng nhập > Vào mua 1 khóa học PRO
   - Ở trang checkout, **KHÔNG chuyển khoản**, chỉ để đó
   - Copy mã đơn hàng (VD: `CM-1234567890-ABCDEF`)

2. **Sửa function test trong Apps Script:**

   ```javascript
   function testWebhook() {
     // Thay CM-1234567890-ABCDEF bằng mã order thật
     const mockPayload = {
       postData: {
         contents: JSON.stringify({
           id: "TEST-" + Date.now(),
           transferAmount: 1000, // Số tiền phải khớp với order
           content: "CODEMASTER CM-1234567890-ABCDEF", // ← Thay mã order thật
           accountNumber: "0362310925",
           transactionDate: new Date().toISOString(),
         }),
       },
     };

     const result = doPost(mockPayload);
     console.log("Test result:", result.getContent());
   }
   ```

3. **Chạy test:**
   - Chọn function `testWebhook` từ dropdown
   - Click **▶ Run**

4. **Kiểm tra kết quả:**

   **Trong Execution log:**

   ```
   ✅ Thành công:
   📨 Received webhook: {...}
   💰 Transaction parsed: {...}
   🔍 Order ID extracted: CM-1234567890-ABCDEF
   📋 Order found: {...}
   ✅ Order status updated to completed
   ✅ User xxx enrolled in course xxx
   ✅ Payment confirmed successfully!
   Test result: {"success":true,"message":"Payment confirmed",...}
   ```

   **Trong Firebase Database:**
   - Mở Firebase Console > Realtime Database
   - Vào `orders/CM-1234567890-ABCDEF`
   - Kiểm tra: `status: "completed"`, `confirmedBy: "sepay-webhook"`

   **Trong trang Checkout (nếu còn mở):**
   - Tự động hiện "Thanh toán thành công!" 🎉

**Xử lý lỗi:**

| Log message                 | Nguyên nhân                     | Cách sửa                        |
| --------------------------- | ------------------------------- | ------------------------------- |
| `Order not found`           | Mã order sai hoặc không tồn tại | Kiểm tra lại mã order           |
| `Order status is completed` | Order đã được xử lý rồi         | Tạo order mới để test           |
| `Amount mismatch`           | Số tiền không khớp              | Sửa `transferAmount` trong test |
| `Order has expired`         | Order quá 30 phút               | Tạo order mới                   |

---

### Test 3: Test thật với chuyển khoản

**Mục đích:** Kiểm tra toàn bộ luồng end-to-end

**Các bước:**

1. **Chuẩn bị:**
   - Đặt giá khóa học = **1,000đ** (để test an toàn)
   - Đảm bảo SePay đã liên kết tài khoản MB Bank
   - Đảm bảo Webhook URL đã cấu hình đúng

2. **Thực hiện:**
   - Mở website > Đăng nhập
   - Vào mua khóa học PRO 1,000đ
   - Quét mã QR bằng app MB Bank
   - Chuyển khoản **đúng số tiền** (1,000đ)
   - **Quan trọng:** Nội dung chuyển khoản phải là `CODEMASTER CM-xxx-xxx`

3. **Theo dõi:**
   - **App MB Bank:** Chuyển khoản thành công ✓
   - **SePay Dashboard:** Giao dịch mới xuất hiện (5-10 giây)
   - **Apps Script > Executions:** Có request mới (10-30 giây)
   - **Trang Checkout:** Tự động hiện "Thanh toán thành công!" 🎉

4. **Verify:**
   - Firebase: `orders/CM-xxx/status = "completed"`
   - Firebase: `enrollments/userId/courseId` đã được tạo
   - Website: User có thể truy cập khóa học

**Timeline dự kiến:**

```
0s    - User chuyển khoản
5s    - MB Bank xử lý xong
10s   - SePay phát hiện giao dịch
15s   - Webhook gửi đến Apps Script
20s   - Firebase được update
20s   - Trang checkout tự động refresh
```

---

### Test 4: Xem Payment Logs

**Kiểm tra logs trong Firebase:**

1. Mở Firebase Console > Realtime Database
2. Mở node `paymentLogs`
3. Xem các log:
   ```json
   {
     "TXN-xxx": {
       "type": "success",
       "orderId": "CM-1234567890-ABCDEF",
       "amount": 1000,
       "timestamp": "2026-01-31T...",
       "source": "sepay-webhook"
     }
   }
   ```

---

## ❓ TROUBLESHOOTING

| Vấn đề                     | Giải pháp                                                         |
| -------------------------- | ----------------------------------------------------------------- |
| Webhook không nhận request | Kiểm tra URL deploy, phải chọn "Anyone" có thể access             |
| Firebase không update      | Kiểm tra FIREBASE_SECRET đúng chưa                                |
| Order không tìm thấy       | Kiểm tra nội dung chuyển khoản có đúng format `CODEMASTER CM-xxx` |
| Số tiền không khớp         | Chuyển đúng số tiền, không thừa không thiếu                       |

---

## 📞 TỔNG KẾT

✅ **Chi phí: 0đ**
✅ **Thời gian setup: ~20 phút**
✅ **Thanh toán thật: CÓ**
✅ **Tự động 100%: CÓ**

**Chúc thành công! 🎉**
