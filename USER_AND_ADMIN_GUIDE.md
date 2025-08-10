# Hướng Dẫn Sử Dụng Toàn Diện - CodeMaster

Tài liệu này cung cấp hướng dẫn chi tiết về cách sử dụng các chức năng của hệ thống CodeMaster dành cho cả Người dùng (User) và Quản trị viên (Admin).

---

## I. Hướng Dẫn Dành Cho Người Dùng (User)

Phần này mô tả các chức năng chính mà người dùng có thể tương tác sau khi đăng nhập.

### 1. Đăng ký và Đăng nhập

- **Đăng ký**: Người dùng có thể tạo tài khoản mới tại trang `login.html` bằng cách cung cấp Tên, Email và Mật khẩu.
- **Đăng nhập**: Sử dụng Email và Mật khẩu đã đăng ký để truy cập hệ thống hoặc có thể đăng nhập bằng tài khoản Google/Github
- **Quên mật khẩu**: Chức năng cho phép người dùng lấy lại mật khẩu qua email đã đăng ký.

### 2. Trang Chủ (`index.html`)

- Hiển thị các khóa học nổi bật và các tài nguyên mới nhất.
- Cung cấp các liên kết nhanh đến những trang chức năng chính.

### 3. Khóa Học (`courses.html`)

- **Xem danh sách**: Hiện thị tất cả các khóa học có sẵn trên hệ thống.
- **Tìm kiếm & Lọc**: Người dùng có thể tìm kiếm khóa học theo tên hoặc lọc theo danh mục.
- **Xem chi tiết**: Khi nhấp vào một khóa học, người dùng sẽ được chuyển đến trang chi tiết (`course-detail.html`) để xem thông tin đầy đủ, bao gồm:
  - Mô tả khóa học.
  - Danh sách các chương (module) và bài học (lesson).
  - Thời lượng và cấp độ.
- **Vào học**: Bắt đầu học các bài học và làm các bài trắc nghiệm (quiz) liên quan.

### 4. Blog (`blog.html`)

- **Xem danh sách Blog**: Hiển thị tất cả các bài viết đã được duyệt từ các tác giả khác nhau.
- **Tìm kiếm & Lọc**: Tìm kiếm bài viết theo chủ đề hoặc từ khóa.
- **Xem chi tiết Blog**: Đọc toàn bộ nội dung của một bài viết.
- **Viết Blog**: Người dùng có thể tự tạo bài viết của riêng mình. Sau khi tạo, bài viết sẽ ở trạng thái "Chờ duyệt".

### 5. Blog Của Tôi (`my-blog.html`)

- **Quản lý bài viết cá nhân**: Trang này chỉ dành cho người dùng đã đăng nhập.
- **Hiển thị danh sách**: Liệt kê tất cả các bài viết do chính người dùng đó tạo.
- **Lọc theo trạng thái**:
  - `Tất cả`: Hiển thị mọi bài viết.
  - `Đã xuất bản`: Các bài viết đã được Admin duyệt.
  - `Chờ duyệt`: Các bài viết đang chờ Admin duyệt.
- **Chỉnh sửa & Xóa**: Người dùng có toàn quyền chỉnh sửa hoặc xóa các bài viết của mình.

### 6. Hồ Sơ Cá Nhân (`profile.html`)

- **Xem thông tin**: Hiển thị các thông tin cá nhân như Tên, Email, Ảnh đại diện.
- **Cập nhật thông tin**: Cho phép người dùng thay đổi thông tin cá nhân và mật khẩu.
- **Xem tiến độ và quản lý tài nguyên đã lưu**: Cho phép người dùng xem các khóa học đang học hay đã hoàn thành và xem/xóa các tài nguyên đã được lưu.

### 7. Trang Tài Nguyên (`resources.html`)

- **Truy cập đa dạng**: Cung cấp một thư viện tài nguyên học tập phong phú được phân loại theo các tab:

  - `Tài liệu`: Các bài viết, hướng dẫn chuyên sâu.
  - `Ví dụ mã nguồn`: Các đoạn code mẫu có thể xem trực tiếp trong một modal.
  - `Video hướng dẫn`: Các video bài giảng.

- **Tìm kiếm**: Người dùng có thể tìm kiếm tài nguyên trong tab đang hoạt động.
- **Lưu tài nguyên (Bookmark)**: Nếu đã đăng nhập, người dùng có thể nhấn nút "Lưu" để đánh dấu các tài nguyên quan trọng và xem lại chúng trong trang Hồ sơ cá nhân.

### 8. Trợ lý AI

- Đây là một chatbot được tích hợp để hỗ trợ người dùng.
- **Cách sử dụng**: Nhấp vào biểu tượng AI, nhập câu hỏi liên quan đến bài học hoặc các vấn đề về lập trình, AI sẽ đưa ra câu trả lời gợi ý.

---

## II. Hướng Dẫn Dành Cho Quản Trị Viên (Admin)

Phần này mô tả các chức năng trong trang quản trị (`admin.html`) để quản lý toàn bộ hệ thống.

### 1. Cách Truy Cập

1.  Đăng nhập bằng tài khoản Admin mặc định:
    - **Email**: `codemaster@gmail.com`
    - **Mật khẩu**: `codemaster123`
2.  Hoặc, một tài khoản thường có thể được cấp quyền Admin bằng cách:
    - Đăng ký tài khoản mới.
    - Truy cập vào Firebase Realtime Database, tìm đến `users/{user_id}` của tài khoản đó và đổi giá trị của trường `role` từ `2` thành `1`.

### 2. Bảng Điều Khiển (Dashboard)

- **Thống kê tổng quan**: Hiển thị các số liệu quan trọng như:
  - Tổng số người dùng.
  - Tổng số khóa học.
  - Tổng số bài viết.
  - Tổng số học viên.
- **Hoạt động gần đây**: Log các hành động quan trọng vừa diễn ra trên hệ thống.
- **Biểu đồ**: Trực quan hóa dữ liệu về người dùng mới, các khóa học phổ biến...

### 3. Quản Lý Người Dùng

- **Xem danh sách**: Hiển thị toàn bộ người dùng trong hệ thống.
- **Tìm kiếm và Lọc**: Dễ dàng tìm kiếm người dùng theo tên/email hoặc lọc theo vai trò (Admin/User).
- **Các thao tác chính**:
  - **Chỉnh sửa**: Thay đổi thông tin của người dùng, có thể phân quyền người dùng.
  - **Thay đổi trạng thái**: `Kích hoạt` hoặc `Tạm khóa` tài khoản. Tài khoản bị khóa sẽ không thể đăng nhập.
  - **Xóa**: Xóa vĩnh viễn người dùng khỏi hệ thống.

### 4. Quản Lý Khóa Học

- **Xem danh sách**: Hiển thị tất cả khóa học dưới dạng lưới (grid).
- **Thêm khóa học**: Tạo một khóa học mới bằng cách điền các thông tin như Tiêu đề, Mô tả, Cấp độ, Ảnh bìa...
- **Sửa khóa học**: Cập nhật thông tin của một khóa học đã có.
- **Xóa khóa học**: Xóa một khóa học và toàn bộ nội dung liên quan (module, lesson, quiz).
- **Quản lý chi tiết khóa học**: Với mỗi khóa học, Admin có thể:
  - Thêm/Sửa/Xóa các **Chương (Module)**.
  - Thêm/Sửa/Xóa các **Bài học (Lesson)** trong mỗi chương.
  - Thêm/Sửa/Xóa các **Câu hỏi trắc nghiệm (Quiz)** cho mỗi bài học.

### 5. Quản Lý Blog

- **Xem danh sách**: Hiển thị tất cả bài viết trên hệ thống dưới dạng bảng.
- **Lọc và Tìm kiếm**:
  - Lọc bài viết theo trạng thái: `Đã đăng`, `Chờ duyệt`.
  - Lọc theo `Chủ đề` (tags).
  - Tìm kiếm theo `Tiêu đề`, `Tác giả`.
- **Duyệt bài viết**:
  - Lọc các bài viết có trạng thái "Chờ duyệt".
  - Nhấn vào nút **Duyệt bài** (biểu tượng dấu tick) để chuyển trạng thái bài viết thành "published" và cho phép hiển thị công khai.
- **Các thao tác khác**:
  - **Xem chi tiết**: Đọc toàn bộ nội dung bài viết trong một modal.
  - **Chỉnh sửa**: Cập nhật nội dung, tiêu đề, tags của bất kỳ bài viết nào.
  - **Xóa**: Xóa vĩnh viễn một bài viết.
  - **Thêm bài viết**: Admin có thể tự tạo và đăng bài viết mới trực tiếp từ trang quản trị.

### 7. Quản Lý Bình Luận

- **Xem báo cáo vi phạm**: Hiển thị các bình luận bị người dùng khác báo cáo, giúp Admin nhanh chóng xử lý các nội dung không phù hợp.
- **Quản lý tất cả bình luận**:
  - Xem danh sách toàn bộ bình luận trên hệ thống.
  - Lọc bình luận theo trạng thái (`Hiển thị`/`Đã ẩn`).
  - Tìm kiếm bình luận theo nội dung hoặc tên người dùng.
- **Các thao tác với bình luận**:
  - **Ẩn/Hiện**: Thay đổi trạng thái hiển thị của bình luận.
  - **Xóa**: Xóa vĩnh viễn bình luận.
  - **Bỏ qua báo cáo**: Giữ lại bình luận và xóa báo cáo vi phạm nếu thấy không hợp lệ.

### 8. Cài Đặt

- **Cập nhật thông tin cá nhân**: Admin có thể thay đổi Tên hiển thị và Ảnh đại diện của mình.
- **Đổi mật khẩu**: Thay đổi mật khẩu đăng nhập vào trang quản trị.
- **Tùy chọn ứng dụng**:
  - Cấu hình các tùy chọn như tự động chuyển hướng đến trang admin sau khi đăng nhập
  - Dark mode cho trang admin
  - Cài đặt giới hạn số lần tải tài liệu
  - Quản lý cài đặt thông báo.
