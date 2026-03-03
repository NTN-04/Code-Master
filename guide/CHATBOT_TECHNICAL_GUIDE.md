# 🤖 CodeMaster AI Chatbot - Giải Thích Kỹ Thuật

> Tài liệu này giải thích **từng giai đoạn nâng cấp** chatbot, với flow chi tiết và lý do kỹ thuật đằng sau mỗi quyết định.

---

## 📁 Các file liên quan

| File                    | Vai trò                                             |
| ----------------------- | --------------------------------------------------- |
| `assets/js/chat-ai.js`  | Frontend – xử lý UI, gọi API, hiển thị kết quả      |
| `api/gemini-chat.js`    | Backend – nhận request, gọi Gemini, trả về response |
| `assets/css/course.css` | Giao diện chatbot widget                            |

---

## 🏗️ Kiến trúc tổng quan

```
Người dùng
    │
    │ gõ câu hỏi
    ▼
[chat-ai.js]  ──── POST request ────▶  [gemini-chat.js]
(Frontend)         JSON body:              (Vercel Serverless)
                   - question                      │
                   - context (trang hiện tại)      │ gọi Gemini API
                   - conversationHistory           ▼
                                         [Google Gemini 2.5 Flash]
                                                   │
                   JSON response:                  │
                   - answer       ◀────────────────┘
                   - suggestions
    │
    ▼
Hiển thị Streaming
+ Quick Replies
+ Feedback Buttons
```

---

## 📦 Phase 1 – Conversation Memory + Full Page Context

### Vấn đề cũ

Mỗi lần gửi tin, chatbot **không nhớ** những gì đã nói trước đó. Hỏi "thế còn cách khác?" → AI không biết "cách khác" của cái gì.

### Giải pháp

Lưu toàn bộ lịch sử trò chuyện trong một **mảng** ở client:

```javascript
// chat-ai.js
let conversationHistory = []; // Mảng lưu lịch sử
const MAX_HISTORY = 10; // Giữ tối đa 10 lượt hỏi-đáp
```

**Khi người dùng gửi câu hỏi**, lịch sử được gửi kèm lên server:

```javascript
body: JSON.stringify({
  type: "chat",
  question: "thế còn cách khác?",
  context: getFullPageContext(), // ← Context trang web
  conversationHistory: conversationHistory, // ← Toàn bộ lịch sử
});
```

**Trên server** (gemini-chat.js), lịch sử được **chuyển** sang định dạng Gemini hiểu:

```javascript
// Gemini dùng "user" và "model", KHÔNG dùng "assistant"
const contents = conversationHistory.map((msg) => ({
  role: msg.role === "assistant" ? "model" : "user",
  parts: [{ text: msg.content }],
}));
```

> ⚠️ **Lưu ý quan trọng:** Gemini API bắt buộc dùng `role: "model"` thay vì `"assistant"` như OpenAI. Đây là điểm khác biệt dễ gây lỗi.

### Full Page Context là gì?

Hàm `getFullPageContext()` **tự động quét trang web** và thu thập:

```javascript
{
  url: "/course-detail?id=abc",       // URL hiện tại
  pageTitle: "Bài học: JavaScript",   // Tiêu đề tab
  lessonTitle: "Closure trong JS",    // Tên bài học
  content: "Closure là...",           // Nội dung bài (tối đa 2000 ký tự)
  codeExamples: "function foo() {}", // Code mẫu trong bài
  structure: "H1: ...\nH2: ..."       // Cấu trúc heading
}
```

Context này được **nhúng vào system prompt** để AI hiểu đang dạy bài gì, tránh trả lời chung chung.

---

## 📦 Phase 2 – Streaming Effect + Quick Replies

### Vấn đề cũ

AI trả lời xong mới hiện **tất cả cùng lúc** → cảm giác chờ đợi, đột ngột.

### 2a. Streaming Effect (Typing Animation)

Thay vì chờ xong rồi hiện, ta **hiện từng ký tự** như người đang gõ:

```
Flow:
API trả về text đầy đủ
        │
        ▼
Lấy plain text (bỏ HTML tags)
        │
        ▼
Vòng lặp: hiện từng ký tự, delay 15ms
        │
        ▼
Kết thúc: render lại full Markdown (code blocks, bold, v.v.)
        │
        ▼
Xóa class "streaming" (tắt cursor nhấp nháy)
```

**Code thực thi:**

```javascript
async function streamMessage(role, text, suggestions = []) {
  // 1. Tạo bubble với class "streaming" (hiện cursor ▋)
  bubble.className = "msg-bubble streaming";

  // 2. Chuyển markdown → plain text để stream từng ký tự
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = marked.parse(text);
  const plainText = tempDiv.textContent;

  // 3. Vòng lặp hiển thị từng ký tự
  for (let i = 0; i < plainText.length; i++) {
    bubble.textContent += plainText[i];
    await sleep(15); // 15ms/ký tự ≈ ~67 ký tự/giây

    // Dừng lâu hơn ở dấu câu → tự nhiên hơn
    if ([".", "!", "?", "\n"].includes(plainText[i])) {
      await sleep(100);
    }
  }

  // 4. Render lại full markdown sau khi stream xong
  bubble.innerHTML = marked.parse(text);
  bubble.classList.remove("streaming"); // Tắt cursor
}
```

**CSS cursor nhấp nháy:**

```css
.msg-bubble.streaming::after {
  content: "▋";
  animation: blink 0.8s infinite;
}
@keyframes blink {
  0%,
  50% {
    opacity: 1;
  }
  51%,
  100% {
    opacity: 0;
  }
}
```

> 💡 **Tại sao stream plain text rồi render lại markdown?**  
> Nếu stream HTML trực tiếp, các thẻ HTML bị hiện ra lộn xộn (ví dụ: `<cod`, `<code`, `<code>`...). Giải pháp: stream text thô, sau đó render markdown một lần khi xong.

### 2b. Quick Replies

Sau mỗi câu trả lời, hiện các **nút gợi ý** để người dùng click thay vì gõ tay.

**Flow:**

```
AI trả lời xong
      │
      ▼
Backend đã extract suggestions từ response
      │
      ├─ Có suggestions? ──▶ Hiển thị nút từ server
      │
      └─ Không có?       ──▶ showContextualQuickReplies()
                              (Tạo gợi ý dựa trên title trang)
```

**Backend extract suggestions:** Server yêu cầu AI luôn kết thúc bằng format:

```
💡 **Bạn có thể hỏi thêm:**
- Câu hỏi gợi ý 1
- Câu hỏi gợi ý 2
- Câu hỏi gợi ý 3
```

Sau đó `extractSuggestions()` dùng **Regex** để tách ra:

```javascript
const suggestionsMatch = answer.match(
  /(?:Bạn có thể hỏi thêm)[:\s]*\n?([-•*]\s*.+\n?)+/gi,
);
```

Phần gợi ý được **tách ra khỏi answer** bằng `cleanAnswerText()` trước khi gửi về frontend, để chatbox không hiển thị trùng.

---

## 📦 Phase 3 – Guardrails + Feedback

### 3a. Guardrails (Bộ lọc chủ đề)

**Vấn đề:** Không có kiểm soát → người dùng có thể hỏi bất cứ thứ gì, AI có thể trả lời linh tinh.

**Giải pháp 2 lớp:**

#### Lớp 1 – Fast check trên Server (trước khi gọi Gemini)

```javascript
function checkOffTopic(question) {
  const offTopicPatterns = [
    /\b(chính trị|bầu cử|đảng)\b/i, // Chính trị
    /\b(tôn giáo|phật|chúa)\b/i, // Tôn giáo
    /\b(giết|bom|khủng bố)\b/i, // Bạo lực
    /\b(sex|porn|khiêu dâm)\b/i, // Nội dung 18+
    /\b(cá độ|cờ bạc|ma túy)\b/i, // Cờ bạc / ma túy
  ];
  // ...
}
```

Nếu match → **ngay lập tức trả về lỗi**, KHÔNG gọi Gemini → tiết kiệm API cost.

#### Lớp 2 – System Prompt (trong Gemini)

```
QUY TẮC QUAN TRỌNG:
1. CHỈ trả lời về lập trình, công nghệ, và nội dung học tập
2. Từ chối lịch sự nếu câu hỏi về: chính trị, tôn giáo, bạo lực...
```

Lớp 2 bắt các trường hợp tinh tế mà Regex không phát hiện được.

**Flow kiểm tra:**

```
Nhận question
      │
      ▼
checkOffTopic()  ──── Match ────▶  Trả về message từ chối
      │                            + suggestions mặc định
      │ Không match
      ▼
Gọi Gemini API (có system prompt guardrails)
      │
      ▼
Trả về answer + suggestions
```

### 3b. Feedback Buttons (👍 / 👎)

Sau mỗi câu trả lời của AI, hiện 2 nút đánh giá **bên trong bubble**:

```
┌─────────────────────────────────┐
│  Closure là một function có     │
│  khả năng nhớ được outer scope  │
│  của nó, ngay cả khi...         │
│                                 │
│  ─────────────────────────────  │
│  👍 Like    👎 Dislike           │
└─────────────────────────────────┘

        Sau khi click:

┌─────────────────────────────────┐
│  ...nội dung câu trả lời...     │
│                                 │
│  ─────────────────────────────  │
│  👍 [active]  👎              ✓ Cảm ơn! │
└─────────────────────────────────┘
```

**Khi click:**

1. Disable cả 2 nút (tránh click nhiều lần)
2. Icon chuyển từ `far fa-thumbs-up` → `fas fa-thumbs-up` (outline → filled)
3. Log feedback ra console (có thể mở rộng gửi lên Firebase sau)

```javascript
console.log("[Feedback]", {
  type: "like",
  answer: answerText.substring(0, 100),
  timestamp: new Date().toISOString(),
  page: window.location.pathname,
});
```

---

## 🔄 Full Flow – Khi người dùng gửi câu hỏi

```
1. Người dùng gõ câu hỏi → nhấn Enter
           │
2. removeQuickReplies()  ← Xóa nút gợi ý cũ
           │
3. appendMsg("user", question) ← Hiện tin nhắn user
           │
4. conversationHistory.push({role:"user", content:question})
           │
5. Hiện spinner "Đang suy nghĩ..."
           │
6. fetch POST → api/gemini-chat
           │     body: { type:"chat", question, context, conversationHistory }
           │
7. [SERVER] handler() nhận request
           │
8. [SERVER] checkOffTopic(question)
           ├── Off-topic? → Trả ngay { answer, suggestions }
           └── OK → tiếp tục
           │
9. [SERVER] Build systemInstruction (persona + context + guardrails)
           │
10.[SERVER] Build contents[] từ conversationHistory
           │
11.[SERVER] Gọi Gemini API
           │
12.[SERVER] extractSuggestions(answer)
           │
13.[SERVER] cleanAnswerText(answer)
           │
14.[SERVER] Trả về { answer, suggestions }
           │
15.[CLIENT] Xóa spinner
           │
16.[CLIENT] streamMessage("ai", answer, suggestions)
           ├── Stream từng ký tự (15ms/char)
           ├── Dừng 100ms ở dấu câu
           ├── Render full markdown
           └── Xóa class "streaming"
           │
17.[CLIENT] addFeedbackButtons() ← Thêm nút 👍/👎
           │
18.[CLIENT] showQuickReplies(suggestions) ← Hiện nút gợi ý
           │
19.[CLIENT] conversationHistory.push({role:"assistant", content:answer})
           │
20. Người dùng đọc + click Quick Reply hoặc gõ câu tiếp theo
           │ (Vòng lặp từ bước 1)
```

---

## ⚙️ Các tham số có thể tùy chỉnh

| Tham số             | File             | Mặc định | Ý nghĩa                               |
| ------------------- | ---------------- | -------- | ------------------------------------- |
| `TYPING_SPEED`      | `chat-ai.js`     | `15` ms  | Tốc độ hiệu ứng typing                |
| `STREAMING_ENABLED` | `chat-ai.js`     | `true`   | Bật/tắt streaming                     |
| `MAX_HISTORY`       | `chat-ai.js`     | `10`     | Số lượt hội thoại lưu                 |
| `maxOutputTokens`   | `gemini-chat.js` | `1024`   | Độ dài tối đa câu trả lời             |
| `temperature`       | `gemini-chat.js` | `0.4`    | Độ sáng tạo (0=chính xác, 1=sáng tạo) |

---

## 🐛 Các lỗi hay gặp & Cách fix

| Lỗi                            | Nguyên nhân                                | Fix                                        |
| ------------------------------ | ------------------------------------------ | ------------------------------------------ |
| `"role must be user or model"` | Gemini không chấp nhận `role: "assistant"` | Đổi sang `role: "model"`                   |
| Quick replies không hiện       | Backend không trả về `suggestions`         | Kiểm tra `data.suggestions` trong response |
| Streaming bị vỡ HTML           | Stream trực tiếp HTML                      | Stream plain text, render markdown sau     |
| CORS error                     | Domain không trong whitelist               | Thêm domain vào `WHITELIST_DOMAINS`        |
| AI trả lời ngoài chủ đề        | Guardrails chưa đủ chặt                    | Thêm pattern vào `offTopicPatterns[]`      |
