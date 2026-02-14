# 🔧 Hướng dẫn Setup Cloudflare Worker (Giải quyết lỗi 302)

## ❓ Tại sao cần Cloudflare Worker?

Google Apps Script **luôn trả về HTTP 302 redirect** khi có response - đây là hành vi mặc định của nó. SePay không tự động follow redirect nên báo lỗi 302.

**Giải pháp**: Sử dụng Cloudflare Worker (miễn phí) làm proxy:

```
SePay → Cloudflare Worker → Google Apps Script
         (follow 302)           (xử lý logic)
```

## 📋 Các bước thực hiện

### Bước 1: Đăng ký Cloudflare (miễn phí)

1. Truy cập: https://dash.cloudflare.com/sign-up
2. Đăng ký bằng email
3. Xác nhận email

### Bước 2: Tạo Worker

1. Đăng nhập Cloudflare Dashboard
2. Menu bên trái → **Workers & Pages**
3. Click **Create Application**
4. Chọn **Create Worker**
5. Đặt tên: `sepay-webhook-proxy`
6. Click **Deploy** (tạm thời với code mặc định)

### Bước 3: Chỉnh sửa code Worker

1. Sau khi deploy, click **Edit code**
2. Xóa toàn bộ code mặc định
3. Copy nội dung từ file `webhook/cloudflare-worker.js`
4. Paste vào editor
5. **QUAN TRỌNG**: Thay URL Apps Script:
   ```javascript
   const GOOGLE_APPS_SCRIPT_URL = "URL_APPS_SCRIPT_CỦA_BẠN";
   ```
6. Click **Save and Deploy**

### Bước 4: Lấy URL Worker

Sau khi deploy, bạn sẽ có URL dạng:

```
https://sepay-webhook-proxy.YOUR_ACCOUNT.workers.dev
```

### Bước 5: Cấu hình SePay

1. Đăng nhập SePay Dashboard
2. Vào **Ngân hàng** → Chọn tài khoản MB Bank
3. Tab **Webhook** → Cấu hình
4. **Webhook URL**: Paste URL Cloudflare Worker
5. Lưu

## ✅ Test webhook

### Test 1: Kiểm tra Worker hoạt động

Mở trình duyệt, truy cập URL Worker:

```
https://sepay-webhook-proxy.YOUR_ACCOUNT.workers.dev
```

Kết quả mong đợi:

```json
{
  "success": true,
  "message": "SePay Webhook Proxy is running! 🚀",
  "timestamp": "2026-01-31T...",
  "target": "https://script.google.com/..."
}
```

### Test 2: Test webhook thủ công

Dùng Postman hoặc curl:

```bash
curl -X POST https://sepay-webhook-proxy.YOUR_ACCOUNT.workers.dev \
  -H "Content-Type: application/json" \
  -d '{
    "id": 12345,
    "transferAmount": 2000,
    "content": "CODEMASTER CM-TEST-123456",
    "accountNumber": "0362310925",
    "transactionDate": "2026-01-31 10:00:00"
  }'
```

### Test 3: Chuyển tiền thật

1. Mở trang thanh toán CodeMaster
2. Tạo đơn hàng mới
3. Chuyển khoản theo QR
4. Kiểm tra SePay Dashboard → Giao dịch → Xem webhook response

## 🔍 Xem logs

### Cloudflare Worker logs:

1. Dashboard → Workers & Pages → sepay-webhook-proxy
2. Tab **Logs** → **Begin log stream**
3. Thực hiện giao dịch test
4. Xem log realtime

### Google Apps Script logs:

1. Mở Apps Script project
2. **Thực thi** → **Nhật ký thực thi**
3. Xem các log từ script

## ⚠️ Lưu ý quan trọng

1. **Cloudflare Workers miễn phí**: 100,000 request/ngày - quá đủ cho project
2. **Không cần domain riêng**: Dùng subdomain `.workers.dev` miễn phí
3. **99.9% uptime**: Cloudflare rất ổn định
4. **Tốc độ nhanh**: CDN toàn cầu, response time < 50ms

## 🔄 Luồng hoạt động mới

```
1. Người dùng chuyển tiền qua MB Bank
2. MB Bank → SePay (phát hiện giao dịch)
3. SePay → Cloudflare Worker (gửi webhook)
4. Cloudflare Worker → Google Apps Script (forward + follow redirect)
5. Apps Script → Firebase (cập nhật order, enroll user)
6. Website → Firebase listener (realtime update UI)
7. ✅ Hiển thị "Thanh toán thành công!"
```

## ❓ Troubleshooting

### Lỗi: Worker trả về 500

- Kiểm tra URL Apps Script có đúng không
- Xem logs trong Cloudflare Dashboard

### Lỗi: Apps Script không nhận được request

- Kiểm tra Apps Script đã deploy chưa
- Đảm bảo "Who has access: Anyone"

### Lỗi: Order not found

- Kiểm tra Order ID trong Firebase
- Xem format Order ID có khớp không

---

**🎉 Sau khi setup xong, webhook sẽ hoạt động ổn định!**
