# 🚀 CodeMaster - Hệ thống học lập trình trực tuyến

**Website**: [https://code-master-dev.vercel.app]

## 🎯 Giới thiệu

**CodeMaster** là nền tảng học lập trình trực tuyến miễn phí với các tính năng:

- ✅ Quản lý khóa học và bài học
- ✅ Hệ thống bình luận realtime
- ✅ AI Chatbot hỗ trợ học tập
- ✅ Quản trị viên toàn diện
- ✅ Theo dõi tiến độ học tập
- ✅ Blog và chia sẻ kiến thức

---

## 🔧 Yêu cầu hệ thống

### Môi trường phát triển

- **Web Browser**: Chrome, Firefox, Safari (phiên bản mới nhất)
- **Code Editor**: VS Code (khuyến nghị)
- **Live Server**: Extension cho VS Code hoặc HTTP server

### Dịch vụ bên thứ 3

- **Firebase Account**: Miễn phí
- **Google Cloud Account**: Cho Gemini AI (miễn phí có hạn mức)
- **Vercel Account**: Cho deployment (tùy chọn)

---

## 🔥 Cài đặt Firebase

### Bước 1: Tạo Firebase Project

1. **Truy cập Firebase Console**

   ```
   https://console.firebase.google.com/
   ```

2. **Tạo project mới**

   - Click **"Add project"**
   - Tên project: `codemaster-[tên-của-bạn]`
   - Bật Google Analytics (khuyến nghị)
   - Chọn region: `asia-southeast1` (Singapore)

3. **Kích hoạt các dịch vụ cần thiết**

### Bước 2: Cấu hình Authentication

1. **Vào Authentication > Get started**
2. **Chọn Sign-in method:**

   - ✅ **Email/Password**: Enable
   - ✅ **Google**: Enable (cung cấp email hỗ trợ)
   - ✅ **GitHub**: Enable (tùy chọn)

3. **Thêm domain ủy quyền:**
   ```
   localhost
   127.0.0.1
   [domain-của-bạn].vercel.app
   ```

### Bước 3: Cấu hình Realtime Database

1. **Vào Realtime Database > Create Database**
2. **Chọn location**: `asia-southeast1`
3. **Security rules**: Bắt đầu với test mode
4. **Cập nhật Rules bảo mật:**

### Bước 4: Import dữ liệu mẫu

1. **Vào Realtime Database > Import JSON**
2. **Upload file**: `data/firebase-db-code-master.json`
3. **Xác nhận import** (sẽ ghi đè dữ liệu hiện tại)

### Bước 5: Lấy thông tin cấu hình

1. **Vào Project Settings > General**
2. **Tại mục "Your apps" > Web apps**
3. **Copy thông tin cấu hình:**
   ```javascript
   const firebaseConfig = {
     apiKey: "your-api-key",
     authDomain: "your-project.firebaseapp.com",
     databaseURL: "https://your-project-default-rtdb.firebaseio.com",
     projectId: "your-project-id",
     storageBucket: "your-project.firebasestorage.app",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abcdef",
     measurementId: "G-ABCDEFGH",
   };
   ```

---

## ⚙️ Cấu hình dự án

### Bước 1: Cập nhật Firebase Config

Mở file `assets/js/firebaseConfig.js` và thay thế:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
  measurementId: "YOUR_MEASUREMENT_ID",
};
```

### Bước 2: Tạo Admin User đầu tiên

1. **Chạy ứng dụng** và đăng ký tài khoản
2. **Vào Firebase Console > Realtime Database**
3. **Tìm user vừa tạo** trong node `users`
4. **Thêm trường `role: 1`** để làm admin:
   ```json
   {
     "users": {
       "user-uid-here": {
         "email": "admin@example.com",
         "username": "Admin",
         "role": 1,
         "createdAt": "2025-01-20"
       }
     }
   }
   ```

---

## 🚀 Khởi chạy ứng dụng

### Phương pháp 1: VS Code Live Server

1. **Cài đặt extension "Live Server"**
2. **Click chuột phải vào `index.html`**
3. **Chọn "Open with Live Server"**
4. **Truy cập:** `http://127.0.0.1:5500`

---

**🎉 Chúc bạn có trải nghiệm tuyệt vời với CodeMaster!**
