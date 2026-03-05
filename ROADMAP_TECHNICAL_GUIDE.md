# Hệ Thống Gợi Ý Lộ Trình Học Tập - Tài Liệu Kỹ Thuật

> **Mục đích:** Tài liệu này giải thích chi tiết cơ chế hoạt động của tính năng **Gợi Ý Lộ Trình Học Tập Cá Nhân Hóa**

---

## 1. Tổng Quan Tính Năng

### 1.1. Tính năng là gì?

Khi người dùng đăng nhập vào CodeMaster, hệ thống tự động **phân tích hành vi học tập** và **đề xuất 2–3 khóa học phù hợp nhất** hiển thị dạng widget "Lộ Trình Gợi Ý". Khác với việc hiển thị khóa học ngẫu nhiên, hệ thống xem xét:

- Sở thích (frontend, backend, mobile…)
- Trình độ hiện tại (beginner, intermediate, advanced)
- Tiến độ học tập thực tế
- Trạng thái đăng ký khóa học

### 1.2. Vấn đề giải quyết (Bối cảnh thực tế)

**Giải pháp (Solution B):** Mở rộng vùng gợi ý ra toàn bộ khóa học liên quan:

| Trạng Thái Khóa | Ý Nghĩa                        | Ưu Tiên Gợi Ý |
| --------------- | ------------------------------ | ------------- |
| `inProgress`    | Đang học (0% < tiến độ < 100%) | **Cao nhất**  |
| `notStarted`    | Đã đăng ký nhưng chưa học (0%) | Trung bình    |
| `available`     | Chưa đăng ký, khóa mới         | Thấp nhất     |
| `completed`     | Đã hoàn thành (100%)           | Không gợi ý   |

---

## 2. Kiến Trúc Tổng Quát

```
┌─────────────────────────────────────────────────────────────────────┐
│                        TRÌNH DUYỆT (Client)                          │
│                                                                       │
│   ┌──────────────────┐      ┌──────────────────────────────────┐    │
│   │  roadmap-widget  │ ───▶ │       roadmap-service.js          │    │
│   │ (Hiển thị UI)    │ ◀─── │  (Thu thập dữ liệu & gọi API)    │    │
│   └──────────────────┘      └──────────────┬─────────────────┘    │
│                                             │                         │
│                              ┌──────────────▼──────────────────┐    │
│                              │     Firebase Realtime Database    │    │
│                              │  - users/{uid}/preferences        │    │
│                              │  - enrollments/{uid}              │    │
│                              │  - userProgress/{uid}/courses     │    │
│                              │  - courses/                       │    │
│                              └─────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                                       │ HTTP POST
                                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    VERCEL SERVERLESS (Server)                         │
│                                                                       │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                   api/gemini-chat.js                         │   │
│   │                                                               │   │
│   │   ┌──────────────────┐      ┌──────────────────────────┐    │   │
│   │   │ handleRoadmap    │ ───▶ │    Gemini 2.5 Flash API   │    │   │
│   │   │ Recommendation() │ ◀─── │  (Google AI)              │    │   │
│   │   └────────┬─────────┘      └──────────────────────────┘    │   │
│   │            │ (nếu AI lỗi)                                      │   │
│   │            ▼                                                    │   │
│   │   ┌──────────────────┐                                         │   │
│   │   │ buildSmart       │  ← Thuật toán dự phòng nội bộ          │   │
│   │   │ Recommendation() │                                         │   │
│   │   └──────────────────┘                                         │   │
│   └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.1. Các thành phần chính

| Thành Phần           | File                                     | Vai Trò                                              |
| -------------------- | ---------------------------------------- | ---------------------------------------------------- |
| **Frontend Service** | `assets/js/roadmap-service.js`           | Thu thập dữ liệu từ Firebase, gọi API, quản lý cache |
| **Backend API**      | `api/gemini-chat.js`                     | Nhận dữ liệu, gọi Gemini AI, trả kết quả             |
| **UI Widget**        | `assets/js/components/roadmap-widget.js` | Hiển thị gợi ý lên giao diện người dùng              |
| **AI Model**         | Google Gemini 2.5 Flash                  | Phân tích và sinh gợi ý tự nhiên                     |
| **Database**         | Firebase Realtime Database               | Lưu trữ thông tin user, khóa học, tiến độ            |
| **Cache**            | `utils/cache-manager.js`                 | Cache kết quả 1 giờ, tránh gọi API liên tục          |

---

## 3. Luồng Dữ Liệu Chi Tiết (Data Flow)

### Bước 1: Khởi tạo — Thu thập dữ liệu song song

```
getPersonalizedRoadmap(userId)
         │
         ├── Promise.all([...]) ← Song song để tối ưu tốc độ
         │        │
         │        ├── getUserPreferences(userId)
         │        │         └── Firebase: users/{uid}/preferences
         │        │             → { level: "beginner", interests: ["frontend"] }
         │        │
         │        ├── getEnrolledCoursesWithProgress(userId)
         │        │         ├── Firebase: enrollments/{uid}
         │        │         ├── Firebase: userProgress/{uid}/courses
         │        │         └── Firebase: courses/
         │        │             → { inProgress: [...], notStarted: [...], completed: [...] }
         │        │
         │        └── getEnrolledCourseIds(userId)
         │                  └── Firebase: enrollments/{uid}
         │                      → Set { "course1", "course2", ... }
         │
         └── getAvailableCourses(enrolledIds)
                   └── Firebase: courses/ (lọc bỏ enrolled)
                       → [ { id, title, category, level, ... } ]
```

### Bước 2: Phân loại khóa học

Hàm `getEnrolledCoursesWithProgress()` phân loại mỗi khóa đã đăng ký:

```
Với mỗi courseId trong enrollments/{uid}:
    progress = userProgress/{uid}/courses/{courseId}.progress

    if progress === 100  →  completed[]
    else if progress > 0  →  inProgress[]   (sắp xếp: % cao nhất lên đầu)
    else (progress === 0)  →  notStarted[]
```

### Bước 3: Gọi AI hoặc tính toán nội bộ

```
fetchAIRecommendations(preferences, enrolledCourses, availableCourses)
         │
         │  Gửi HTTP POST đến Vercel API:
         │  {
         │    type: "roadmap",
         │    preferences: { level, interests },
         │    enrolledCourses: { inProgress, notStarted, completed },
         │    availableCourses: [...]
         │  }
         │
         ▼
   handleRoadmapRecommendation()  (Server)
         │
         ├── Tạo prompt cho Gemini
         ├── Gọi Gemini 2.5 Flash
         ├── Parse JSON response
         │
         └── (Nếu AI lỗi/timeout) → buildSmartRecommendation()
                                           ↓
                                     Thuật toán nội bộ
```

### Bước 4: Render kết quả

```
getPersonalizedRoadmap()  →  {
    recommendations: [ { courseId, reason } ],
    summary: "Bạn đang học React (75%)...",
    courses: [ { id, title, image, progress, reason, ... } ],
    fromCache: false
}
         │
         ▼
   roadmap-widget.js  →  Hiển thị cards trên giao diện
```

---

## 4. Thuật Toán Chấm Điểm (Scoring Algorithm)

Khi AI gặp lỗi hoặc timeout, hệ thống kích hoạt **thuật toán chấm điểm nội bộ** (`buildSmartRecommendation`).

### 4.1. Điểm cơ sở (Base Score) theo trạng thái

```
inProgress   → Base: 200  (đang học dở, cần hoàn thành)
notStarted   → Base: 100  (đã đăng ký nhưng chưa bắt đầu)
available    → Base:  50  (chưa đăng ký, khóa mới)
```

### 4.2. Điểm cộng thêm (Bonus Score)

```
+100  Khớp category với sở thích người dùng
 +30  Khớp level chính xác (beginner = beginner)
 +15  Khớp level liền kề (beginner ↔ intermediate)
 +50  Tiến độ > 50% (gần hoàn thành, khuyến khích tiếp tục)
 +10  Là khóa nổi bật (featured = true)
```

### 4.3. Mở rộng danh mục (Category Expansion)

Để tránh gợi ý quá hẹp, hệ thống mở rộng sở thích theo nhóm liên quan:

```javascript
// Ví dụ: user thích "frontend"
// Hệ thống match với tất cả: frontend, web, javascript, html, css, react
categoryRelations = {
  web: ["frontend", "backend", "web", "javascript", "html", "css", "react"],
  frontend: ["frontend", "web", "javascript", "html", "css", "react"],
  backend: ["backend", "nodejs", "database", "api"],
  mobile: ["mobile", "flutter", "react-native"],
  database: ["database", "sql", "mongodb", "backend"],
  "data-science": ["data-science", "python", "machine-learning"],
};
```

### 4.4. Ví dụ tính điểm thực tế

**Tình huống:** User level = `beginner`, interests = `["frontend"]`

| Khóa Học       | Trạng Thái       | Base | +Category       | +Level         | +Progress | Tổng    |
| -------------- | ---------------- | ---- | --------------- | -------------- | --------- | ------- |
| React cơ bản   | inProgress (75%) | 200  | +100 (frontend) | +30            | +50       | **380** |
| HTML/CSS       | notStarted       | 100  | +100 (frontend) | +30            | 0         | **230** |
| NodeJS Backend | notStarted       | 100  | 0               | +15 (adjacent) | 0         | **115** |
| Flutter Mobile | available        | 50   | 0               | +30            | 0         | **80**  |
| Python DS      | available        | 50   | 0               | +30            | 0         | **80**  |

**Kết quả:** Gợi ý React (380), HTML/CSS (230), NodeJS (115) → Chính xác và có nghĩa!

---

## 5. Prompt Engineering cho Gemini AI

### 5.1. Cấu trúc prompt

Prompt được thiết kế ngắn gọn, có cấu trúc rõ ràng để Gemini trả về JSON chính xác:

```
User: beginner level, interests: frontend

IN_PROGRESS (continue these first!): react-101|React cơ bản|frontend|beginner|75%;

ENROLLED_NOT_STARTED: html-css|HTML & CSS|frontend|beginner

NEW_COURSES: nodejs|NodeJS Backend|backend|intermediate

Select 2-3 courses. Prioritize:
  1) IN_PROGRESS (must continue)
  2) ENROLLED matching interests
  3) NEW matching interests.

Return JSON only:
{
  "recommendations": [{"courseId":"id","reason":"vì sao - 10 words"}],
  "summary": "1 sentence summary"
}
```

### 5.2. Lý do thiết kế prompt ngắn

| Vấn đề                           | Giải pháp                       |
| -------------------------------- | ------------------------------- |
| Token limit gây lỗi `MAX_TOKENS` | Giới hạn `maxOutputTokens: 250` |
| AI trả về text thay vì JSON      | Yêu cầu rõ "Return JSON only"   |
| Gợi ý không đúng ưu tiên         | Đánh số thứ tự ưu tiên 1,2,3    |
| Category không khớp              | Truyền cả category vào prompt   |

### 5.3. Xử lý response không hợp lệ

Hàm `parseJsonResponse()` xử lý nhiều định dạng AI có thể trả về:

````
Trường hợp 1: JSON thuần { "recommendations": [...] }  → Parse trực tiếp
Trường hợp 2: Markdown ```json {...} ```                → Tách code block
Trường hợp 3: JSON lẫn trong text                      → Regex extract {}
Trường hợp 4: JSON bị cắt đứt do limit                → Cố gắng repair
Trường hợp 5: Thất bại hoàn toàn                       → Dùng Smart Fallback
````

---

## 6. Cơ Chế Cache

```
Người dùng mở trang
       │
       ▼
Cache còn hiệu lực? (< 1 giờ)
       │
    Có ── ▶  Trả cache ngay (không gọi Firebase, không gọi AI)
       │
    Không
       │
       ▼
Gọi Firebase + Gemini AI (3-5 giây)
       │
       ▼
Lưu vào cache với key: "ai_roadmap_{userId}"
       │
       ▼
Trả kết quả về UI
```

**Lợi ích:**

- Tránh gọi Gemini API liên tục (giảm chi phí, tránh rate limit)
- Trang tải nhanh (< 100ms) khi dùng cache
- User có thể click "Làm mới" (`forceRefresh = true`) để cập nhật

---

## 7. Xử Lý Lỗi & Độ Bền Hệ Thống (Fault Tolerance)

```
Gọi Gemini API
       │
       ├── Thất bại? (500, timeout, network error)
       │           └── Dùng buildSmartRecommendation() ngay lập tức
       │
       ├── Trả về MAX_TOKENS?
       │           └── Dùng buildSmartRecommendation()
       │
       ├── JSON không parse được?
       │           └── Dùng buildSmartRecommendation()
       │
       └── Thành công → Trả recommendations từ AI

buildSmartRecommendation() không bao giờ thất bại
(thuần JavaScript, không phụ thuộc mạng)
```

**Hệ thống luôn trả về kết quả** — không bao giờ trả lỗi cho người dùng.

---

## 8. Case Study Thực Tế

### Case 1: Người dùng học dở nhiều khóa

**Hồ sơ:**

- Level: `intermediate`
- Interests: `["backend", "database"]`
- Đang học: NodeJS (60%), MongoDB (45%)
- Chưa bắt đầu: SQL cơ bản
- Khóa mới: React, Flutter

**Kết quả scoring:**

```
NodeJS Backend  → inProgress (200) + category backend (+100) + level (+30) + progress>50 (+50) = 380 ✅
MongoDB         → inProgress (200) + category database (+100) + level (+15) + progress<50 (0)  = 315 ✅
SQL cơ bản      → notStarted (100) + category database (+100) + level (+30)                   = 230 ✅
React           → available  (50)  + 0 + level (+30)                                          = 80  ❌
Flutter         → available  (50)  + 0 + level (+30)                                          = 80  ❌
```

**Gợi ý:** NodeJS (tiếp tục, 60%), MongoDB (tiếp tục, 45%), SQL (bắt đầu ngay)

---

### Case 2: Người dùng mới, chưa đăng ký khóa nào

**Hồ sơ:**

- Level: `beginner`
- Interests: `["frontend"]`
- Enrolled: Không có
- Available: 10 khóa

**Kết quả:** Toàn bộ khóa xử lý với base score = 50. Các khóa frontend/beginner nổi lên nhờ +100 và +30.

**Gợi ý:** HTML/CSS (180), JavaScript (180), React (130)

---

### Case 3: Người dùng đã hoàn thành gần hết

**Hồ sơ:**

- Completed: 8 khóa
- inProgress: 1 khóa (React Advanced, 90%)
- available: 1 khóa (Flutter)

**Kết quả:**

```
React Advanced  → inProgress (200) + progress>50 (+50) = 250 ✅ (Hoàn thành gần rồi!)
Flutter         → available (50)                        = 50
```

**Summary:** _"Bạn đang học React Advanced (90%). Hãy hoàn thành để tiếp tục!"_

---

### Case 4: AI trả về lỗi (Fallback activation)

**Tình huống:** Gemini API timeout

```
1. API timeout sau 10 giây
2. catch(err) kích hoạt
3. buildSmartRecommendation() chạy ngay (0ms, thuần JS)
4. Trả kết quả cho người dùng, isFallback: true
5. Người dùng không biết AI đã lỗi
```

---

## 9. Cấu Trúc Dữ Liệu JSON

### Request gửi lên API

```json
{
  "type": "roadmap",
  "preferences": {
    "level": "beginner",
    "interests": ["frontend", "web"]
  },
  "enrolledCourses": {
    "inProgress": [
      {
        "id": "react-101",
        "title": "React Cơ Bản",
        "category": "frontend",
        "level": "beginner",
        "progress": 75
      }
    ],
    "notStarted": [
      {
        "id": "html-css",
        "title": "HTML & CSS",
        "category": "frontend",
        "level": "beginner",
        "progress": 0
      }
    ],
    "completed": [
      {
        "id": "intro-it",
        "title": "Nhập môn IT",
        "category": "general",
        "level": "beginner"
      }
    ]
  },
  "availableCourses": [
    {
      "id": "nodejs-adv",
      "title": "NodeJS Nâng Cao",
      "category": "backend",
      "level": "intermediate",
      "featured": true
    }
  ]
}
```

### Response trả về từ API

```json
{
  "recommendations": [
    { "courseId": "react-101", "reason": "Bạn đã học 75%, hoàn thành ngay!" },
    { "courseId": "html-css", "reason": "Nền tảng quan trọng cho frontend" }
  ],
  "summary": "Tập trung hoàn thành React và củng cố HTML/CSS để vững nền tảng.",
  "isFallback": false
}
```

---

## 10. Điểm Kỹ Thuật Nổi Bật (Cho Báo Cáo Phản Biện)

### 10.1. Tại sao dùng Vercel Serverless thay vì gọi AI trực tiếp từ frontend?

- **Bảo mật:** API Key Gemini không lộ ra client
- **CORS control:** Chỉ whitelist domain được phép gọi
- **Rate limiting:** Có thể thêm middleware kiểm soát số lần gọi

### 10.2. Tại sao cần fallback thuật toán nội bộ?

- AI có thể lỗi, chậm, hoặc trả về JSON không hợp lệ
- Trải nghiệm người dùng không bị ảnh hưởng khi AI downtime
- Giảm số lần gọi API (tiết kiệm quota)

### 10.3. Tại sao dùng Promise.all() khi lấy dữ liệu?

```javascript
// Tuần tự: 300ms + 300ms + 300ms = 900ms
const pref = await getUserPreferences();
const enrolled = await getEnrolledCoursesWithProgress();
const ids = await getEnrolledCourseIds();

// Song song: max(300, 300, 300) = 300ms
const [pref, enrolled, ids] = await Promise.all([...]);  ← Nhanh hơn 3x
```

### 10.4. Tại sao cache 1 giờ?

- Dữ liệu tiến độ học tập không thay đổi trong vài phút
- 1 giờ cân bằng giữa "tươi mới" và "hiệu năng"
- User có thể force refresh > Luôn có dữ liệu mới khi cần

### 10.5. Category Expansion — ý tưởng thiết kế

Người dùng chọn sở thích "web" không có nghĩa họ chỉ muốn khóa có tag "web". Họ cũng cần JavaScript, HTML, React. Bằng cách mở rộng interest, hệ thống gợi ý chính xác hơn và bao quát hơn.

---

## 11. Sơ Đồ Toàn Bộ Luồng (Summary Flow)

```
[User vào trang]
      │
      ▼
[Kiểm tra Cache]
      │
   Hit ──▶ [Trả cache, render UI ngay]
      │
   Miss
      │
      ▼
[Thu thập data song song từ Firebase]
  - Preferences (sở thích, trình độ)
  - Enrolled courses + progress → phân loại inProgress/notStarted/completed
  - Available courses (chưa đăng ký)
      │
      ▼
[Có khóa để gợi ý không?]
      │
  Không ──▶ [Thông báo "Đã đăng ký/hoàn thành hết"]
      │
   Có
      │
      ▼
[Gửi data lên Vercel Serverless API]
      │
      ▼
[Xây dựng Prompt → Gọi Gemini 2.5 Flash]
      │
      ├── Thành công → Parse JSON
      │       │
      │       ├── Hợp lệ  ──▶ [Kết quả từ AI]
      │       └── Lỗi/rỗng ──▶ [buildSmartRecommendation()]
      │
      └── Lỗi mạng/timeout ──▶ [buildSmartRecommendation()]
                                          │
                                          ▼
                               [Thuật toán chấm điểm]
                               Base: inProgress(200) > notStarted(100) > available(50)
                               Bonus: +category(100) +level(30) +progress(50) +featured(10)
                               Sort descending → Top 3
      │
      ▼
[Map courseId → full course data]
      │
      ▼
[Lưu Cache 1 giờ]
      │
      ▼
[Render Roadmap Widget lên UI]
```

---
