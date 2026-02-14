# Hướng dẫn cài đặt và sử dụng hệ thống bình luận CodeMaster

## Tổng quan

Hệ thống bình luận CodeMaster là một giải pháp hoàn chỉnh cho phép học viên trao đổi, thảo luận về từng bài học trong khóa học. Hệ thống được xây dựng với các tính năng:

- ✅ Đăng bình luận và trả lời (nested comments)
- ✅ Thả like/dislike
- ✅ Báo cáo vi phạm
- ✅ Realtime updates
- ✅ Responsive design cho mobile
- ✅ Chống spam và bảo mật
- ✅ UI/UX thân thiện

## Cài đặt

### 2. Thêm CSS

Thêm link CSS vào `course-detail.html`:

```html
<link rel="stylesheet" href="./assets/css/comments.css" />
```

### 3. Import JavaScript Module

Trong `course.js`, thêm import:

```javascript
import CommentSystem from "./comment-system.js";
```

### 4. Khởi tạo hệ thống bình luận

Hệ thống sẽ tự động khởi tạo khi người dùng chọn bài học:

```javascript
// Trong trang course-detail.html và blog-detail.html
if (commentSystem) {
  commentSystem.destroy();
}
commentSystem = new CommentSystem(courseId, lessonId);
```

## Sử dụng

### 1. Hiển thị bình luận

Hệ thống tự động hiển thị phần bình luận ở cuối mỗi bài học. Gồm:

- **Header**: Tiêu đề "Bình luận" và số lượng bình luận
- **Form đăng bình luận**: Hiển thị khi đã đăng nhập
- **Danh sách bình luận**: Hiển thị theo thứ tự mới nhất trước
- **Nested replies**: Phản hồi được hiển thị thụt lề

### 2. Đăng bình luận

1. Người dùng nhập nội dung vào ô textarea
2. Hệ thống hiển thị số ký tự đã nhập/tối đa
3. Click "Gửi bình luận" để đăng
4. Hiển thị thông báo thành công/lỗi

### 3. Trả lời bình luận

1. Click nút "Trả lời" trong bình luận
2. Form trả lời xuất hiện
3. Nhập nội dung và click "Gửi phản hồi"
4. Phản hồi hiển thị thụt lề dưới bình luận gốc

### 4. Like/Dislike

1. Click nút 👍 hoặc 👎
2. Hệ thống cập nhật số lượng vote realtime
3. User có thể đổi vote hoặc bỏ vote

### 5. Báo cáo vi phạm

1. Click nút "Báo cáo"
2. Chọn lý do từ dropdown
3. Nhập mô tả chi tiết (tùy chọn)
4. Click "Gửi báo cáo"

### 6. Xóa/Sửa bình luận

- Chỉ tác giả mới có thể xóa/sửa bình luận của mình
- Nút "Sửa" và "Xóa" hiển thị trong menu hành động
- Khi xóa sẽ có popup xác nhận

## Tính năng bảo mật

### 1. Chống spam

- Giới hạn tần suất đăng bình luận (5 giây/lần)
- Giới hạn độ dài nội dung (tối đa 2000 ký tự)
- Kiểm tra đăng nhập trước khi cho phép thao tác

### 2. Validation

- Kiểm tra quyền người dùng qua Firebase Rules
- Validate dữ liệu đầu vào
- Escape HTML để tránh XSS

## Tùy chỉnh

### 1. Thay đổi giới hạn ký tự

```javascript
// Trong comment-system.js
this.maxCommentLength = 2000; // Thay đổi giá trị này
```

### 2. Thay đổi thời gian chống spam

```javascript
// Trong comment-system.js
this.commentCooldown = 5000; // milliseconds
```

### 3. Tùy chỉnh giao diện

Chỉnh sửa CSS trong `assets/css/comments.css`:

```css
.comments-section {
  /* Tùy chỉnh màu sắc, kích thước, v.v. */
  background-color: white;
  border-radius: var(--border-radius);
  padding: 25px;
}
```

## Responsive Design

Hệ thống được tối ưu cho mobile:

- Breakpoints: 768px và 480px
- Layout tự động điều chỉnh theo kích thước màn hình
- Touch-friendly buttons và form controls
- Optimized typography cho mobile

## API Reference

### CommentSystem Class

```javascript
// Khởi tạo
const commentSystem = new CommentSystem(courseId, lessonId);

// Phương thức chính
commentSystem.loadComments(); // Tải bình luận
commentSystem.submitComment(); // Gửi bình luận
commentSystem.submitReply(commentId); // Gửi phản hồi
commentSystem.toggleVote(commentId, voteType); // Like/dislike
commentSystem.deleteComment(commentId); // Xóa bình luận
commentSystem.destroy(); // Cleanup
```

## Changelog

### v1.0.0 (2024-01-15)

- ✅ Tính năng cơ bản: đăng, xem, trả lời bình luận
- ✅ Like/dislike system
- ✅ Báo cáo vi phạm
- ✅ Realtime updates
- ✅ Responsive design
- ✅ Bảo mật và chống spam
