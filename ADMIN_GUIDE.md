# Admin Panel Guide - CodeMaster Platform

## Tổng quan
Admin Panel là hệ thống quản trị hoàn chỉnh cho nền tảng học lập trình CodeMaster, cho phép quản trị viên quản lý người dùng, khóa học, tài liệu và theo dõi hoạt động hệ thống.

## Đăng nhập Admin
- URL: `/admin.html`
- Yêu cầu: Tài khoản có `role = 1` (Admin)
- Bảo mật: Tự động redirect nếu không có quyền

## Tài khoản Admin mẫu
```json
{
  "email": "admin@codemaster.com",
  "password": "Admin123@",
  "role": 1
}
```

## Chức năng chính

### 1. Dashboard
- **Thống kê tổng quan**: Người dùng, khóa học, tài liệu
- **Biểu đồ**: Doanh thu, người dùng hoạt động
- **Hoạt động gần đây**: Log activities từ Firebase
- **Thông báo hệ thống**: Cảnh báo và thông tin quan trọng

### 2. Quản lý Người dùng
#### Danh sách người dùng
- Hiển thị tất cả users từ Firebase
- Tìm kiếm theo tên, email
- Lọc theo trạng thái (active/inactive/banned)
- Phân trang tự động

#### Thao tác với người dùng
- **Thêm mới**: Form validation đầy đủ
- **Chỉnh sửa**: Cập nhật thông tin, role, status
- **Xóa**: Soft delete với xác nhận
- **Thay đổi trạng thái**: Active/Inactive/Banned

### 3. Quản lý Khóa học
#### Danh sách khóa học
- Load từ Firebase collection `courses`
- Hiển thị: title, category, level, status, progress
- Tìm kiếm và lọc nâng cao

#### Thao tác với khóa học
- **Thêm khóa học**: Form với validation
  - Title (bắt buộc, max 200 chars)
  - Description (max 1000 chars)
  - Level: beginner/intermediate/advanced
  - Category: web/mobile/data/ai
  - Duration, lessons, status
- **Chỉnh sửa khóa học**: Cập nhật thông tin
- **Xóa khóa học**: Với xác nhận
- **Thay đổi trạng thái**: active/inactive/draft

### 4. Quản lý Tài liệu
#### Danh sách tài liệu
- Load từ Firebase collection `resources`
- Types: document/video/audio/link
- Categories: tutorial/reference/example/tool

#### Thao tác với tài liệu
- **Thêm tài liệu**: Upload hoặc link URL
- **Chỉnh sửa**: Cập nhật metadata
- **Xóa**: Với xác nhận
- **Theo dõi downloads**: Statistics

## Cấu trúc Firebase

### Collections
```
users/
├── $userId/
│   ├── name: string
│   ├── email: string
│   ├── role: number (1=admin, 2=user)
│   ├── status: string (active/inactive/banned)
│   └── ...

courses/
├── $courseId/
│   ├── title: string
│   ├── description: string
│   ├── level: string
│   ├── category: string
│   ├── status: string
│   └── ...

resources/
├── $resourceId/
│   ├── title: string
│   ├── type: string
│   ├── category: string
│   ├── url: string
│   └── ...

activities/
├── $activityId/
│   ├── userId: string
│   ├── action: string
│   ├── timestamp: string
│   └── details: string
```

### Firebase Rules
File: `/data/firebase_rules.json`
- **Admin access**: Toàn quyền read/write
- **User access**: Chỉ đọc public data, chỉnh sửa profile riêng
- **Security**: Validate role trước khi cho phép thao tác

## Security Features

### 1. Authentication Guard
File: `/assets/js/admin-guard.js`
```javascript
// Kiểm tra authentication
await checkAuth()

// Kiểm tra admin role
const isAdmin = await checkAdminRole(user.uid)

// Redirect nếu không có quyền
if (!isAdmin) {
  window.location.href = 'login.html'
}
```

### 2. Loading Screen
- Hiển thị loading khi verify quyền
- Ngăn flash content trước khi auth complete
- Smooth transition vào admin panel

### 3. Activity Logging
Tự động log mọi hoạt động admin:
```javascript
await this.logActivity({
  userId: currentUser.uid,
  action: 'USER_CREATED',
  details: `Created user: ${userData.email}`,
  timestamp: new Date().toISOString()
})
```

## Technical Implementation

### 1. Architecture
- **MVC Pattern**: AdminPanel class as controller
- **Modular Design**: Separate methods cho từng chức năng
- **Event-driven**: Modern event listeners
- **Promise-based**: Async/await cho Firebase operations

### 2. Error Handling
```javascript
try {
  await firebaseOperation()
  this.showSuccess('Operation completed')
} catch (error) {
  console.error('Error:', error)
  this.showError('Operation failed')
}
```

### 3. Form Validation
- Client-side validation
- Required field checking
- Format validation (email, etc.)
- Max length constraints

### 4. Real-time Updates
- Listen to Firebase changes
- Auto-refresh data lists
- Live activity feed
- Notification system

## Styling & UI

### 1. Responsive Design
- Mobile-friendly admin panel
- Collapsible sidebar
- Touch-friendly buttons
- Adaptive layouts

### 2. Theme
- Primary color: #4a6fff
- Success: #22c55e
- Warning: #f59e0b
- Danger: #ef4444
- Modern gradients và shadows

### 3. Components
- Modal dialogs
- Data tables với sorting
- Form controls
- Loading states
- Toast notifications

## Development Guidelines

### 1. Adding New Features
1. Update AdminPanel class
2. Add corresponding Firebase rules
3. Create UI components
4. Implement error handling
5. Add activity logging

### 2. Database Operations
```javascript
// Always use Firebase SDK
import { ref, get, set, update, remove } from 'firebase/database'

// Pattern for CRUD operations
async createItem(data) {
  const itemRef = ref(database, `collection/${itemId}`)
  await set(itemRef, data)
  await this.logActivity('ITEM_CREATED', `Created: ${data.name}`)
}
```

### 3. Best Practices
- Always validate user input
- Log important actions
- Handle errors gracefully
- Provide user feedback
- Maintain data consistency

## Deployment

### 1. File Structure
```
admin.html              # Main admin page
assets/css/admin.css    # Admin styling
assets/js/admin.js      # Main admin logic
assets/js/admin-guard.js # Security middleware
```

### 2. Firebase Configuration
- Update rules in Firebase Console
- Deploy database structure
- Set up authentication
- Configure security rules

### 3. Testing
- Test all CRUD operations
- Verify role-based access
- Check responsive design
- Validate form submissions
- Test error scenarios

## Troubleshooting

### Common Issues
1. **Login fails**: Check Firebase auth config
2. **Permission denied**: Verify user role in database
3. **Data not loading**: Check Firebase rules
4. **UI breaks**: Verify CSS imports

### Debug Mode
Add to console for debugging:
```javascript
// Enable detailed logging
window.adminDebug = true
```

## Future Enhancements
- [ ] Bulk operations for users/courses
- [ ] Advanced analytics dashboard
- [ ] Email notification system
- [ ] Backup/restore functionality
- [ ] API integration for external systems
- [ ] Role-based permissions (multiple admin levels)

---

**Phát triển bởi**: CodeMaster Team  
**Cập nhật lần cuối**: June 2025  
**Version**: 1.0.0
