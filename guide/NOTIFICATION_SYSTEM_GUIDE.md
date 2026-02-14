# Hệ Thống Thông Báo Realtime - CodeMaster

Hệ thống thông báo realtime sử dụng Firebase Realtime Database để gửi thông báo đến người dùng khi có các sự kiện quan trọng.

## 📋 Tổng quan

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
```

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

## 🔒 Firebase Rules

Thêm rules trong file `firebase/notification-rules.jsonc` vào Firebase Console:

```json
{
  "notifications": {
    "$userId": {
      ".read": "auth != null && auth.uid === $userId",
      ".write": "auth != null && auth.uid === $userId",
      ".indexOn": ["createdAt"]
    }
  }
}
```

**⚠️ QUAN TRỌNG**: Phải thêm `.indexOn` cho `createdAt` để tránh lỗi query. Nếu không có index, hệ thống sẽ tự động fallback sang query đơn giản nhưng sẽ kém hiệu quả hơn.

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

## 📱 Responsive

- Desktop: Dropdown từ icon chuông
- Mobile: Fullscreen hay fixed bottom toast

## 🔮 Tính năng tương lai

- [ ] Push notifications với FCM
- [ ] Email notifications
- [ ] Notification preferences UI trong profile
- [ ] Admin broadcast notifications
- [ ] Notification sound

## 🐛 Troubleshooting

### Lỗi "Index not defined, add .indexOn"?

- Thêm `.indexOn: ["createdAt"]` vào Firebase rules cho path `notifications/$userId`
- Hoặc hệ thống sẽ tự động fallback sang query không cần index (chậm hơn)

### Không thấy icon chuông?

- Kiểm tra user đã đăng nhập
- Kiểm tra import trong `auth.js`
- Kiểm tra CSS `notifications.css` đã được import

### Thông báo không realtime?

- Kiểm tra Firebase rules
- Kiểm tra userId đúng format
- Kiểm tra network connection

### Toast không hiển thị?

- Thông báo chỉ hiển thị trong 10 giây đầu
- Kiểm tra z-index của toast trong CSS
