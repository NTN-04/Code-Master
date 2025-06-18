# Hướng Dẫn Sử Dụng Trang Quản Trị CodeMaster

## Cách Truy Cập Trang Admin

### 1. Tài Khoản Admin Mặc Định

- **Email**: codemaster@gmail.com
- **Mật khẩu**: codemaster123
- **Role**: 1 (Admin)

### 2. Cách Tạo Tài Khoản Admin Mới

1. Đăng ký tài khoản thường qua trang `/login.html`
2. Truy cập Firebase Realtime Database
3. Tìm user ID trong bảng `users`
4. Thay đổi field `role` từ `2` thành `1`

## Các Tính Năng Chính

### 📊 Dashboard

- **Thống kê tổng quan**: Số người dùng, khóa học, học viên đang học
- **Hoạt động gần đây**: Theo dõi các hoạt động mới nhất của hệ thống
- **Biểu đồ thống kê**: Hiển thị dữ liệu dưới dạng biểu đồ

### 👥 Quản Lý Người Dùng

- **Xem danh sách**: Hiển thị tất cả người dùng với avatar, tên, email, role
- **Bộ lọc**: Tìm kiếm theo tên/email, lọc theo role và trạng thái
- **Thao tác**:
  - ✏️ **Chỉnh sửa**: Cập nhật thông tin người dùng
  - ⏸️ **Tạm ngừng/Kích hoạt**: Thay đổi trạng thái tài khoản
  - 🗑️ **Xóa**: Xóa tài khoản người dùng

### 📚 Quản Lý Khóa Học

- **Hiển thị grid**: Các khóa học với hình ảnh, tiêu đề, mô tả
- **Thông tin chi tiết**: Cấp độ, thời lượng, số bài học
- **Thao tác**:
  - ✏️ **Chỉnh sửa**: Cập nhật thông tin khóa học
  - 🗑️ **Xóa**: Xóa khóa học
  - ➕ **Thêm mới**: Tạo khóa học mới

### 📄 Quản Lý Tài Liệu

- **Danh sách bảng**: Hiển thị tài liệu dưới dạng bảng
- **Thông tin**: Tiêu đề, loại, cấp độ, ngày tạo, trạng thái
- **Thao tác**: Chỉnh sửa và xóa tài liệu

### 📈 Thống Kê & Analytics

- **Biểu đồ người dùng**: Thống kê người dùng mới theo tháng
- **Khóa học phổ biến**: Ranking các khóa học được học nhiều nhất
- **Dữ liệu chi tiết**: Các metric quan trọng của hệ thống

### ⚙️ Cài Đặt Hệ Thống

- **Thông tin website**: Tên, mô tả, email liên hệ
- **Cấu hình chung**: Các thiết lập global của hệ thống

## Cấu Trúc Role & Permissions

### Role System

- **Role 1**: Admin (Quản trị viên)

  - Truy cập đầy đủ trang admin
  - Quản lý người dùng, khóa học, tài liệu
  - Xem thống kê và cài đặt hệ thống

- **Role 2**: User (Người dùng)
  - Truy cập các trang học tập
  - Quản lý hồ sơ cá nhân
  - Không thể truy cập trang admin

### Status System

- **active**: Tài khoản hoạt động bình thường
- **suspended**: Tài khoản bị tạm ngừng (không thể đăng nhập)

## Bảo Mật

### Authentication & Authorization

- **Admin Guard**: Middleware kiểm tra quyền truy cập trang admin
- **Role Verification**: Xác minh role từ Firebase Realtime Database
- **Status Check**: Kiểm tra trạng thái tài khoản trước khi cho phép truy cập

### Access Control

- Chỉ user có `role: 1` mới truy cập được trang admin
- Tự động redirect về trang chủ nếu không có quyền
- Loading screen trong quá trình kiểm tra quyền

## Các File Quan Trọng

### Frontend Files

- `admin.html` - Giao diện trang quản trị
- `assets/css/admin.css` - Styles cho trang admin
- `assets/js/admin.js` - Logic chính của admin panel
- `assets/js/admin-guard.js` - Middleware bảo vệ trang admin

### Database Files

- `data/db_users.json` - Dữ liệu người dùng mẫu
- `data/db_courses.json` - Dữ liệu khóa học
- `data/db_resources.json` - Dữ liệu tài liệu

### Configuration

- `assets/js/firebaseConfig.js` - Cấu hình Firebase
- `assets/js/auth.js` - Xử lý authentication tổng thể

## Troubleshooting

### Không thể truy cập trang admin

1. Kiểm tra đã đăng nhập chưa
2. Xác minh role trong database (`role: 1`)
3. Kiểm tra trạng thái tài khoản (`status: "active"`)
4. Xem console browser để debug lỗi

### Lỗi tải dữ liệu

1. Kiểm tra kết nối Firebase
2. Xem Firebase Console để kiểm tra database
3. Kiểm tra file JSON local có đúng format không

### Giao diện không hiển thị đúng

1. Kiểm tra file CSS có load không
2. Clear cache browser
3. Kiểm tra responsive trên device khác

## Best Practices

### Quản Lý Người Dùng

- Thường xuyên review danh sách người dùng
- Tạm ngừng tài khoản spam thay vì xóa
- Backup dữ liệu trước khi xóa

### Quản Lý Nội Dung

- Kiểm tra chất lượng khóa học trước khi publish
- Cập nhật thông tin khóa học định kỳ
- Organize tài liệu theo category rõ ràng

### Bảo Mật

- Thay đổi mật khẩu admin mặc định
- Hạn chế số lượng admin
- Monitor hoạt động đăng nhập

## Support

Nếu gặp vấn đề khi sử dụng trang quản trị, vui lòng:

1. Kiểm tra hướng dẫn troubleshooting ở trên
2. Xem log trong browser console
3. Liên hệ developer để được hỗ trợ

---

**Lưu ý**: Trang quản trị này được thiết kế để quản lý nội dung và người dùng một cách hiệu quả. Hãy sử dụng các tính năng một cách có trách nhiệm và đảm bảo backup dữ liệu thường xuyên.
