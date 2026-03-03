# AI Personalized Roadmap System

Hệ thống gợi ý khóa học cá nhân hóa sử dụng Gemini AI.

---

## 1. Tổng Quan

**Mục đích:** Gợi ý khóa học phù hợp dựa trên:

- Sở thích học tập (từ survey)
- Khóa học đã hoàn thành
- Mục tiêu cá nhân

**Tính năng:**

- Onboarding Survey (3 bước) cho user mới
- AI Recommendations từ Gemini
- Cache 1 giờ + Fallback khi AI lỗi
- Dark mode support

---

## 2. Cấu Trúc File

| File                                        | Chức năng                    |
| ------------------------------------------- | ---------------------------- |
| `assets/js/components/onboarding-survey.js` | Modal khảo sát user          |
| `assets/js/components/roadmap-widget.js`    | Widget hiển thị gợi ý        |
| `assets/js/roadmap-service.js`              | Service gọi API + xử lý data |
| `assets/css/onboarding.css`                 | Styles survey                |
| `assets/css/roadmap.css`                    | Styles widget                |
| `api/gemini-chat.js`                        | API xử lý `type: "roadmap"`  |
| `assets/js/auth.js`                         | Trigger survey cho user mới  |

---

## 3. Firebase Schema

**Path:** `users/{userId}/preferences`

```javascript
{
  level: "beginner",              // beginner | basic | intermediate | advanced
  interests: ["web", "mobile"],   // web | mobile | database | data-science | devops | game
  goal: "job",                    // job | upgrade | project | explore
  surveyCompletedAt: "ISO date",
  updatedAt: "ISO date"
}
```

---

## 4. Quy Trình Hoạt Động

### Flow 1: User Mới → Survey

```
User đăng nhập
    ↓
auth.js: check preferences === null?
    ↓ YES
Import onboarding-survey.js
    ↓
Hiện modal 3 bước:
  1. Chọn level (single)
  2. Chọn interests (multiple)
  3. Chọn goal (single)
    ↓
Lưu vào Firebase: users/{userId}/preferences
```

### Flow 2: Profile Page → Recommendations

```
User vào profile.html
    ↓
profile.js → initRoadmapWidget()
    ↓
roadmap-widget.js: hiện loading skeleton
    ↓
roadmap-service.js: getPersonalizedRecommendations()
    ↓
Check cache (TTL 1h)
    ↓ MISS
Fetch song song:
  - getUserPreferences()
  - getUserCompletedCourses()
  - getAllCourses()
    ↓
POST /api/gemini-chat { type: "roadmap", ... }
    ↓
Gemini trả về: { recommendations, summary }
    ↓
Cache + render cards
```

---

## 5. API Endpoint

**Request:**

```javascript
POST /api/gemini-chat
{
  type: "roadmap",
  preferences: { level, interests, goal },
  completedCourses: [{ id, title, category }],
  availableCourses: [{ id, title, category, level }]
}
```

**Response:**

```javascript
{
  recommendations: [
    { courseId: "javascript", reason: "Lý do gợi ý..." }
  ],
  summary: "Tổng quan lộ trình..."
}
```

---

## 6. Sử Dụng

### Thêm widget vào trang khác

```html
<link rel="stylesheet" href="assets/css/roadmap.css" />
<div id="roadmap-container"></div>

<script type="module">
  import { initRoadmapWidget } from "./assets/js/components/roadmap-widget.js";
  initRoadmapWidget("roadmap-container", userId);
</script>
```

### Trigger survey thủ công

```javascript
import { showOnboardingSurvey } from "./assets/js/components/onboarding-survey.js";

showOnboardingSurvey(userId, {
  editMode: true,
  onComplete: (prefs) => console.log(prefs),
});
```

### Force refresh

```javascript
import { clearRecommendationsCache } from "./assets/js/roadmap-service.js";
clearRecommendationsCache(userId);
```

---

## 7. Fallback Logic

```
AI Response → thành công → hiển thị
    ↓ lỗi
Lọc courses theo interests + level → hiển thị
    ↓ không có preferences
Gợi ý mặc định: HTML-CSS, Python
```

---

## 8. Troubleshooting

| Vấn đề            | Nguyên nhân             | Giải pháp                                                            |
| ----------------- | ----------------------- | -------------------------------------------------------------------- |
| Survey không hiện | User đã có preferences  | Check Firebase hoặc `showOnboardingSurvey(userId, {editMode: true})` |
| Widget trống      | API lỗi / chưa có prefs | `clearRecommendationsCache()` + kiểm tra Network tab                 |
| Dark mode lỗi     | CSS chưa load           | Check `data-theme` attribute + CSS link                              |
