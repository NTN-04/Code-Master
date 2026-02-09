# 📚 Loading Skeleton System - Hướng Dẫn Sử Dụng

## 🎯 Giới Thiệu

**Loading Skeleton Manager** là một hệ thống loading thống nhất cho toàn bộ dự án CodeMaster, cung cấp trải nghiệm loading mượt mà và nhất quán cho người dùng.

---

## 🚀 Cách Sử Dụng

### 1. Import vào file

```javascript
import loadingSkeleton from "./utils/loading-skeleton.js";
```

### 2. Sử Dụng Các Methods

#### **Courses Grid**

```javascript
// Hiển thị skeleton loading cho courses (6 cards mặc định)
loadingSkeleton.showCourses(".courses-grid", 6);

// Ẩn skeleton
loadingSkeleton.hide(".courses-grid");
```

#### **Blogs List**

```javascript
// Hiển thị skeleton loading cho blogs (4 cards mặc định)
loadingSkeleton.showBlogs("#blog-list", 4);

// Ẩn skeleton
loadingSkeleton.hide("#blog-list");
```

#### **Resources Grid**

```javascript
// Hiển thị skeleton loading cho resources
loadingSkeleton.showResources(".resources-grid", 6);

// Ẩn skeleton
loadingSkeleton.hide(".resources-grid");
```

#### **Course Intro Page**

```javascript
// Hiển thị skeleton cho main content và sidebar
loadingSkeleton.showCourseIntro("#course-intro-main", "#course-intro-sidebar");

// Ẩn skeleton từ cả 2 containers
loadingSkeleton.hide("#course-intro-main");
loadingSkeleton.hide("#course-intro-sidebar");
```

#### **Loading Spinner**

```javascript
// Hiển thị loading spinner đơn giản
loadingSkeleton.showSpinner(".container", "Đang tải dữ liệu...");

// Ẩn spinner
loadingSkeleton.hide(".container");
```

---

## 📦 API Methods

### `showCourses(container, count)`

Hiển thị skeleton loading cho courses grid.

- **container**: `string | HTMLElement` - Selector hoặc DOM element
- **count**: `number` - Số lượng skeleton cards (default: 6)

### `showBlogs(container, count)`

Hiển thị skeleton loading cho blogs list.

- **container**: `string | HTMLElement` - Selector hoặc DOM element
- **count**: `number` - Số lượng skeleton cards (default: 4)

### `showResources(container, count)`

Hiển thị skeleton loading cho resources grid.

- **container**: `string | HTMLElement` - Selector hoặc DOM element
- **count**: `number` - Số lượng skeleton cards (default: 6)

### `showCourseIntro(mainContainer, sidebarContainer)`

Hiển thị skeleton loading cho course intro page.

- **mainContainer**: `string | HTMLElement` - Main content container
- **sidebarContainer**: `string | HTMLElement` - Sidebar container

### `showSpinner(container, message)`

Hiển thị loading spinner.

- **container**: `string | HTMLElement` - Selector hoặc DOM element
- **message**: `string` - Loading message (default: "Đang tải...")

### `hide(container)`

Ẩn loading skeleton và hiển thị content.

- **container**: `string | HTMLElement` - Selector hoặc DOM element

### `showAndHideContent(loadingContainer, contentContainer)`

Hiển thị loading và ẩn content.

- **loadingContainer**: Container chứa loading
- **contentContainer**: Container chứa content

### `hideAndShowContent(loadingContainer, contentContainer)`

Ẩn loading và hiển thị content.

- **loadingContainer**: Container chứa loading
- **contentContainer**: Container chứa content

### `showCustom(container, template, count)`

Hiển thị custom skeleton từ template.

- **container**: `string | HTMLElement` - Selector hoặc DOM element
- **template**: `string` - HTML template
- **count**: `number` - Số lượng skeleton (default: 1)

### `createCustomCard(options)`

Tạo skeleton card tùy chỉnh.

- **options**: `Object` - Cấu hình skeleton
  - `hasImage`: `boolean` - Có image không (default: true)
  - `hasAvatar`: `boolean` - Có avatar không (default: false)
  - `hasIcon`: `boolean` - Có icon không (default: false)
  - `titleLines`: `number` - Số dòng title (default: 1)
  - `textLines`: `number` - Số dòng text (default: 2)
  - `className`: `string` - Custom class name

---

## 🎨 Custom Skeleton

### Tạo Custom Skeleton Card

```javascript
const customSkeleton = loadingSkeleton.createCustomCard({
  hasImage: true,
  hasAvatar: false,
  hasIcon: true,
  titleLines: 2,
  textLines: 3,
  className: "custom-skeleton-card",
});

loadingSkeleton.showCustom(".container", customSkeleton, 4);
```

### Sử Dụng Template Có Sẵn

```javascript
import { SKELETON_TEMPLATES } from "./utils/loading-skeleton.js";

// Sử dụng template courseCard
loadingSkeleton.showCustom(".container", SKELETON_TEMPLATES.courseCard, 3);

// Sử dụng template blogCard
loadingSkeleton.showCustom(".container", SKELETON_TEMPLATES.blogCard, 2);
```

---

## 📝 Ví Dụ Thực Tế

### Courses Page

```javascript
import loadingSkeleton from "./utils/loading-skeleton.js";

async function loadCourses() {
  const grid = document.querySelector(".courses-grid");

  // Hiển thị loading
  loadingSkeleton.showCourses(grid, 6);

  try {
    const data = await fetchCoursesData();

    // Render data
    renderCourses(data);

    // Ẩn loading
    loadingSkeleton.hide(grid);
  } catch (error) {
    console.error(error);
    loadingSkeleton.hide(grid);
  }
}
```

### Blog Page

```javascript
import loadingSkeleton from "./utils/loading-skeleton.js";

async function loadBlogs() {
  const list = document.getElementById("blog-list");

  // Hiển thị loading
  loadingSkeleton.showBlogs(list, 4);

  try {
    const blogs = await fetchBlogsData();
    renderBlogs(blogs);
    loadingSkeleton.hide(list);
  } catch (error) {
    console.error(error);
    loadingSkeleton.hide(list);
  }
}
```

### Course Intro Page

```javascript
import loadingSkeleton from "./utils/loading-skeleton.js";

async function loadCourseIntro() {
  const main = document.getElementById("course-intro-main");
  const sidebar = document.getElementById("course-intro-sidebar");

  // Hiển thị skeleton
  loadingSkeleton.showCourseIntro(main, sidebar);

  try {
    const courseData = await fetchCourseData();
    renderCourseIntro(courseData);

    // Ẩn skeleton
    loadingSkeleton.hide(main);
    loadingSkeleton.hide(sidebar);
  } catch (error) {
    console.error(error);
  }
}
```

---

## 🎯 Best Practices

### 1. ✅ Luôn Ẩn Loading Trong finally

```javascript
try {
  loadingSkeleton.showCourses(grid);
  const data = await fetchData();
  renderData(data);
} catch (error) {
  console.error(error);
} finally {
  loadingSkeleton.hide(grid); // ✅ Đảm bảo luôn ẩn
}
```

### 2. ✅ Sử Dụng Đúng Type Skeleton

```javascript
// ❌ Sai: Dùng courses skeleton cho blog
loadingSkeleton.showCourses("#blog-list");

// ✅ Đúng: Dùng blogs skeleton cho blog
loadingSkeleton.showBlogs("#blog-list");
```

### 3. ✅ Đặt Số Lượng Skeleton Hợp Lý

```javascript
// ✅ Courses: 6 cards (2 hàng x 3 cột)
loadingSkeleton.showCourses(grid, 6);

// ✅ Blogs: 4 cards (phân trang)
loadingSkeleton.showBlogs(list, 4);

// ✅ Resources: 6 cards
loadingSkeleton.showResources(grid, 6);
```

### 4. ✅ Sử Dụng Container Đúng

```javascript
// ✅ Đúng: Pass element hoặc selector
loadingSkeleton.showCourses(".courses-grid");
loadingSkeleton.showCourses(document.querySelector(".courses-grid"));

// ❌ Sai: Pass string không phải selector
loadingSkeleton.showCourses("courses-grid"); // Thiếu dấu .
```

---

## 🔧 CSS Classes

### Loading State Classes

- `.skeleton` - Base skeleton class với animation
- `.skeleton-card` - Course/blog skeleton card
- `.skeleton-resource-card` - Resource skeleton card
- `.skeleton-image` - Image placeholder
- `.skeleton-avatar` - Avatar placeholder
- `.skeleton-icon` - Icon placeholder
- `.skeleton-title` - Title placeholder
- `.skeleton-text` - Text placeholder
- `.skeleton-badge` - Badge placeholder
- `.skeleton-button` - Button placeholder
- `.loading-state` - Container trong trạng thái loading

### Custom CSS

```css
/* Custom skeleton cho component mới */
.my-custom-skeleton {
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
  height: 200px;
  border-radius: 8px;
}
```

---

## 📊 Files Đã Cập Nhật

### ✅ Đã Tích Hợp Loading Skeleton:

1. **course-intro.js** - Course intro page skeleton
2. **courses.js** - Courses grid skeleton
3. **blog.js** - Blog list skeleton
4. **resources.js** - Resources grid skeleton
5. **featured-courses.js** - Featured courses skeleton

### 📁 Cấu Trúc Files:

```
assets/
├── js/
│   ├── utils/
│   │   └── loading-skeleton.js  ← Skeleton manager
│   ├── course-intro.js          ← Sử dụng skeleton
│   ├── courses.js               ← Sử dụng skeleton
│   ├── blog.js                  ← Sử dụng skeleton
│   ├── resources.js             ← Sử dụng skeleton
│   └── featured-courses.js      ← Sử dụng skeleton
└── css/
    └── style.css                 ← Skeleton styles
```

---

## 🎉 Lợi Ích

✅ **Thống nhất** - Skeleton giống nhau trên toàn hệ thống
✅ **Dễ bảo trì** - Chỉnh sửa 1 nơi, áp dụng mọi nơi
✅ **Tái sử dụng** - Import và dùng bất kỳ đâu
✅ **Linh hoạt** - Tùy chỉnh dễ dàng
✅ **Performance** - Không duplicate code
✅ **UX tốt hơn** - Loading mượt mà, nhất quán

---

## 🚀 Migration Checklist

Khi thêm skeleton cho component mới:

- [ ] Import `loadingSkeleton` vào file
- [ ] Thay thế code loading cũ bằng `loadingSkeleton.show*()`
- [ ] Thay thế code hide loading bằng `loadingSkeleton.hide()`
- [ ] Test loading state
- [ ] Test hide loading
- [ ] Kiểm tra responsive
- [ ] Update documentation nếu cần

---

## 📞 Support

Nếu gặp vấn đề hoặc cần hỗ trợ:

1. Kiểm tra xem đã import đúng chưa
2. Kiểm tra selector/element có tồn tại không
3. Kiểm tra console logs
4. Xem lại documentation này

---

## 🎓 Summary

**Loading Skeleton System** giúp:

- ✅ Tạo loading state nhất quán
- ✅ Dễ dàng tái sử dụng
- ✅ Giảm code duplicate
- ✅ Cải thiện UX
- ✅ Dễ bảo trì và mở rộng

**Sử dụng đơn giản:**

```javascript
// Show loading
loadingSkeleton.showCourses(container, 6);

// Hide loading
loadingSkeleton.hide(container);
```

Vậy là xong! 🎉
