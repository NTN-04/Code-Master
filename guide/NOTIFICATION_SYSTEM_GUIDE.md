# Hệ Thống Thông Báo Realtime - CodeMaster

Hệ thống thông báo realtime sử dụng Firebase Realtime Database để gửi thông báo đến người dùng khi có các sự kiện quan trọng.

## 📋 Tổng quan

Hệ thống hiện chạy theo mô hình hybrid:

- Client lắng nghe realtime qua `NotificationService`.
- Các luồng nhạy cảm (`new_course`, gửi chéo user) ưu tiên đi qua Cloudflare Worker để xác thực admin token.
- Fallback client-side chỉ dành cho môi trường dev hoặc các luồng không yêu cầu broadcast admin.

### Các loại thông báo hỗ trợ

| Loại                 | Mô tả                              | Icon |
| -------------------- | ---------------------------------- | ---- |
| `payment_success`    | Thanh toán thành công              | ✅   |
| `payment_failed`     | Thanh toán thất bại                | ❌   |
| `course_enrolled`    | Đăng ký khóa học                   | 🎓   |
| `course_completed`   | Hoàn thành khóa học                | 🏆   |
| `progress_milestone` | Đạt mốc tiến trình (25%, 50%, 75%) | ⭐   |
| `comment_reply`      | Có người trả lời bình luận         | 💬   |
| `comment_mention`    | Được nhắc đến trong bình luận      | @    |
| `new_course`         | Có khóa học mới                    | 📚   |
| `promotion`          | Khuyến mãi                         | 🏷️   |
| `system`             | Thông báo hệ thống                 | 🔔   |

### Ý nghĩa `system` notification

`system` dùng cho thông báo vận hành nền tảng, ví dụ:

- Bảo trì hệ thống theo lịch
- Cập nhật tính năng quan trọng
- Thay đổi chính sách hoặc điều khoản
- Cảnh báo an toàn tài khoản

`system` không nên dùng cho sự kiện nghiệp vụ cụ thể (mua khóa học, reply comment, khóa học mới), vì các sự kiện đó đã có type riêng để filter/analytics chính xác.

## 🏗️ Cấu trúc Database

```
/notifications
  /{userId}
    /{notificationId}
      - type: string
      - title: string
      - message: string
      - link: string (optional)
      - data: object (optional)
      - read: boolean
      - isRead: boolean (tương thích dữ liệu cũ/mới)
      - createdAt: number (timestamp)

/notificationPreferences
  /{userId}
    - payment: boolean
    - course: boolean
    - comment: boolean
    - progress: boolean
    - promotion: boolean
    - system: boolean
```

## 📁 Các file liên quan

### Core files

- `assets/js/utils/notifications.js` - NotificationService class và helpers
- `assets/js/components/NotificationBell.js` - Component chuông thông báo
- `assets/css/notifications.css` - Styles cho thông báo

### Pages

- `notifications.html` - Trang xem tất cả thông báo
- `assets/js/notifications-page.js` - Logic cho trang thông báo

### Integration files (đã cập nhật)

- `assets/js/auth.js` - Khởi tạo NotificationBell khi đăng nhập
- `assets/js/course-intro.js` - Thông báo khi đăng ký khóa học
- `assets/js/pay/payment-service.js` - Thông báo thanh toán thành công
- `assets/js/comment-system.js` - Thông báo khi có reply
- `assets/js/course.js` - Thông báo milestone tiến trình
- `webhook/sepay-webhook.gs` - Thông báo từ server khi thanh toán

## 🚀 Cách sử dụng

### 1. Tạo thông báo mới

```javascript
import {
  createNotification,
  NOTIFICATION_TYPES,
} from "./utils/notifications.js";

// Tạo thông báo cho một user
await createNotification(userId, {
  type: NOTIFICATION_TYPES.COURSE_ENROLLED,
  title: "Đăng ký thành công",
  message: "Bạn đã đăng ký khóa học JavaScript cơ bản",
  link: "course-detail.html?id=js-basic",
  data: {
    courseId: "js-basic",
    courseName: "JavaScript cơ bản",
  },
});

// Hoặc dùng helper rõ nghĩa cho thông báo hệ thống
await createSystemNotification(userId, {
  title: "Bảo trì hệ thống",
  message: "Hệ thống sẽ bảo trì từ 23:00 đến 23:30 tối nay.",
  link: "profile.html",
});
```

> Lưu ý: cần import thêm `createSystemNotification` từ `./utils/notifications.js`.

### 2. Broadcast thông báo cho nhiều users

```javascript
import {
  broadcastNotification,
  NOTIFICATION_TYPES,
} from "./utils/notifications.js";

// Gửi thông báo khóa học mới cho tất cả users
const userIds = ["user1", "user2", "user3"];
await broadcastNotification(userIds, {
  type: NOTIFICATION_TYPES.NEW_COURSE,
  title: "Khóa học mới",
  message: "Khóa học React Native vừa ra mắt!",
  link: "course-intro.html?id=react-native",
});
```

### 3. Lắng nghe thông báo realtime

```javascript
import { getNotificationService } from "./utils/notifications.js";

const notificationService = getNotificationService();
notificationService.init(userId);

// Lắng nghe cập nhật
notificationService.addListener((event, data) => {
  if (event === "update") {
    console.log("Số thông báo chưa đọc:", data.unreadCount);
    console.log("Danh sách thông báo:", data.notifications);
  }
});
```

### 4. Quản lý thông báo

```javascript
const service = getNotificationService();

// Đánh dấu đã đọc
await service.markAsRead(notificationId);

// Đánh dấu tất cả đã đọc
await service.markAllAsRead();

// Xóa thông báo
await service.deleteNotification(notificationId);

// Xóa tất cả
await service.clearAllNotifications();
```

Lưu ý:

- Với mô hình server-side dispatch, Worker ghi dữ liệu bằng secret ở backend nên không phụ thuộc rule write từ browser.
- Rule ở trên vẫn cần giữ chặt để chặn client ghi trái phép vào notification của user khác.

## ☁️ Server-side Dispatch (Khuyen nghi production)

De dam bao bao mat khi gui thong bao cheo user (vi du `comment_reply`, `new_course`), nen dung server endpoint thay vi ghi truc tiep tu client.

### 1. Deploy Cloudflare Worker cho notification

- File worker mau: `webhook/notification-worker.js`
- Routes ho tro:
  - `POST /notification` - Tao notification cho 1 user
  - `POST /new-course` - Broadcast NEW_COURSE cho user thuong

### 2. Tao cac Secret trong Cloudflare Worker

- `FIREBASE_DB_URL`: URL Realtime Database (khong co duoi `.json`)
- `FIREBASE_DB_SECRET`: Database secret hoac token co quyen ghi
- `FIREBASE_WEB_API_KEY`: Firebase Web API key (de verify Firebase ID token)
- `ADMIN_API_KEY`: khoa noi bo danh cho backend-to-backend (khong dung tren browser)

### 3. Cau hinh endpoint trong frontend

Endpoint production da duoc cau hinh cung trong code tai `assets/js/utils/notifications.js`:

```javascript
const DEFAULT_NOTIFICATION_SERVER_ENDPOINT =
  "https://notification-dispatch.infocodemasterdev.workers.dev";
```

Vi vay, thong thuong khong can set localStorage tren tung thiet bi.

Neu can debug nhanh, co the override tam thoi trong console:

```javascript
window.NOTIFICATION_SERVER_ENDPOINT = "https://your-staging-worker.workers.dev";
location.reload();
```

He thong se gui `Authorization: Bearer <Firebase ID Token>` tu user dang dang nhap.
Worker xac thuc token va kiem tra role admin trong node `users/{uid}`.

Neu chua set endpoint, he thong se fallback ghi client-side (phu hop dev, khong khuyen nghi production).

## 🔄 Luồng hoạt động tổng thể

### Luồng realtime hiển thị

1. Notification được ghi vào `notifications/{userId}/{notificationId}`.
2. `NotificationService` lắng nghe realtime và cập nhật badge/dropdown.
3. `notifications-page.js` hiển thị danh sách và filter theo type/unread.

### Luồng xác thực server-side

1. Frontend gửi request kèm `Authorization: Bearer <Firebase ID Token>`.
2. Worker verify token qua Firebase Identity Toolkit.
3. Worker đọc `users/{uid}.role` để xác định admin.
4. Chỉ admin mới được gọi route broadcast như `/new-course`.

## 📚 Chi tiết NEW_COURSE (quan trọng)

`new_course` là thông báo broadcast khi admin tạo khóa học mới từ trang quản trị.

### Trigger

- Trigger tại luồng tạo course mới trong `admin-courses.js` (method `notifyNewCourse`).
- Không trigger khi chỉ edit course cũ.

### Payload

- `type`: `new_course`
- `title`: "Khóa học mới"
- `message`: chứa tên khóa học vừa tạo
- `link`: `course-intro.html?id=<courseId>`
- `data`: `{ courseId, courseName, category }`

### Recipient selection

- Worker đọc toàn bộ `users`.
- Loại trừ tài khoản admin (`role === 1`).
- Broadcast đến user thường.

### Security/authorization

- Route `/new-course` yêu cầu admin hợp lệ.
- Nếu token không hợp lệ hoặc user không phải admin => `403 Forbidden`.

### Failure behavior

- Nếu endpoint server bật nhưng dispatch lỗi, admin sẽ nhận lỗi ngay ở UI.
- Không broadcast client-side âm thầm trong production path để tránh lạm quyền.

### Cách kiểm chứng NEW_COURSE

1. Đăng nhập admin và tạo course mới.
2. Kiểm tra worker logs có request `POST /new-course`.
3. Kiểm tra 1 user thường online nhận toast + badge.
4. Mở `notifications.html` của user thường thấy type `new_course` với link đúng.

## 🎨 Tùy chỉnh giao diện

### CSS Variables

Sử dụng các biến CSS của dự án:

- `--brand-blue`: #5ebbff
- `--brand-purple`: #a174ff
- `--brand-gradient`: linear-gradient

### Custom colors cho từng loại thông báo

Chỉnh sửa trong `notifications.js` hoặc `NotificationBell.js`:

```javascript
const NOTIFICATION_COLORS = {
  payment_success: "#10b981",
  payment_failed: "#ef4444",
  // ...
};
```

## ⚡ Tính năng

- ✅ Realtime với Firebase Realtime Database
- ✅ Toast popup khi có thông báo mới
- ✅ Dropdown danh sách thông báo từ icon chuông
- ✅ Trang xem tất cả thông báo với filter
- ✅ Đánh dấu đã đọc/chưa đọc
- ✅ Xóa thông báo
- ✅ Badge số thông báo chưa đọc
- ✅ Responsive trên mobile
- ✅ Dark mode support (CSS media query)
