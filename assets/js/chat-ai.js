// --- AI Chatbot với Conversation Memory + Streaming + Quick Replies ---
document.addEventListener("DOMContentLoaded", () => {
  const chat = document.getElementById("ai-chatbot");
  const openBtn = document.getElementById("ai-chat-open");
  const closeBtn = document.getElementById("ai-chat-close");
  const form = document.getElementById("ai-chat-form");
  const input = document.getElementById("ai-chat-input");
  const messages = document.getElementById("ai-chat-messages");

  if (!chat) return;

  // ============================================
  // PHASE 1: Conversation Memory
  // ============================================
  let conversationHistory = [];
  const MAX_HISTORY = 10;

  // ============================================
  // PHASE 2: Streaming config
  // ============================================
  const STREAMING_ENABLED = true;
  const TYPING_SPEED = 15; // ms per character

  // Open chat
  if (openBtn) openBtn.onclick = () => chat.classList.add("open");
  closeBtn.onclick = () => chat.classList.remove("open");

  // Thêm UI elements
  addClearHistoryButton();
  showInitialQuickReplies();

  form.onsubmit = async (e) => {
    e.preventDefault();
    const question = input.value.trim();
    if (!question) return;

    // Xóa quick replies cũ
    removeQuickReplies();

    // Hiển thị tin nhắn người dùng
    appendMsg("user", question);
    input.value = "";

    // Thêm vào lịch sử
    conversationHistory.push({ role: "user", content: question });

    // Hiển thị trạng thái đang xử lý
    const loadingMsg = appendMsg(
      "ai",
      "<i class='fas fa-spinner fa-spin'></i> Đang suy nghĩ...",
    );

    try {
      const res = await fetch(
        "https://code-master-dev.vercel.app/api/gemini-chat",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "chat",
            question,
            context: getFullPageContext(),
            conversationHistory: conversationHistory.slice(-MAX_HISTORY * 2),
          }),
        },
      );

      const data = await res.json();
      messages.removeChild(loadingMsg);

      const answer = data.answer || "Xin lỗi, tôi chưa có câu trả lời.";
      const suggestions = data.suggestions || [];

      // PHASE 2: Streaming effect
      if (STREAMING_ENABLED) {
        await streamMessage("ai", answer, suggestions);
      } else {
        const msgEl = appendMsg("ai", answer);
        addFeedbackButtons(msgEl, answer);
        if (suggestions.length > 0) {
          showQuickReplies(suggestions);
        }
      }

      // Lưu vào lịch sử
      conversationHistory.push({ role: "assistant", content: answer });

      if (conversationHistory.length > MAX_HISTORY * 2) {
        conversationHistory = conversationHistory.slice(-MAX_HISTORY * 2);
      }
    } catch (err) {
      messages.removeChild(loadingMsg);
      appendMsg("ai", "Có lỗi khi kết nối AI. Vui lòng thử lại.");
      console.error("Chat AI Error:", err);
    }

    messages.scrollTop = messages.scrollHeight;
  };

  // ============================================
  // PHASE 2: Streaming Message Effect
  // Hiển thị từng ký tự như ChatGPT
  // ============================================
  async function streamMessage(role, text, suggestions = []) {
    const msg = document.createElement("div");
    msg.className = "ai-msg " + role;
    const bubble = document.createElement("div");
    bubble.className = "msg-bubble streaming";
    msg.appendChild(bubble);
    messages.appendChild(msg);

    // Parse markdown trước
    let parsedText;
    try {
      parsedText = marked.parse(text);
    } catch {
      parsedText = text;
    }

    // Tạo container tạm để lấy text thuần
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = parsedText;
    const plainText = tempDiv.textContent || "";

    // Stream từng ký tự
    let currentText = "";
    for (let i = 0; i < plainText.length; i++) {
      currentText += plainText[i];
      bubble.textContent = currentText;
      messages.scrollTop = messages.scrollHeight;

      // Tốc độ typing
      await sleep(TYPING_SPEED);

      // Tạm dừng dài hơn ở dấu chấm câu
      if ([".", "!", "?", "\n"].includes(plainText[i])) {
        await sleep(100);
      }
    }

    // Sau khi stream xong, hiển thị full markdown
    bubble.innerHTML = parsedText;
    bubble.classList.remove("streaming");

    // PHASE 3: Thêm nút feedback
    addFeedbackButtons(msg, text);

    // PHASE 2: Hiển thị quick replies
    if (suggestions.length > 0) {
      showQuickReplies(suggestions);
    } else {
      // Tạo suggestions mặc định dựa trên context
      showContextualQuickReplies();
    }

    messages.scrollTop = messages.scrollHeight;
    return msg;
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ============================================
  // PHASE 2: Quick Reply Suggestions
  // Gợi ý câu hỏi nhanh
  // ============================================
  function showQuickReplies(suggestions) {
    removeQuickReplies();

    const container = document.createElement("div");
    container.className = "quick-replies";

    suggestions.forEach((text) => {
      const btn = document.createElement("button");
      btn.className = "quick-reply-btn";
      btn.textContent = text;
      btn.onclick = () => {
        input.value = text;
        form.dispatchEvent(new Event("submit"));
      };
      container.appendChild(btn);
    });

    messages.appendChild(container);
    messages.scrollTop = messages.scrollHeight;
  }

  function showInitialQuickReplies() {
    const initialSuggestions = [
      "Giải thích bài học này",
      "Cho tôi ví dụ code",
      "Khái niệm quan trọng là gì?",
    ];
    showQuickReplies(initialSuggestions);
  }

  function showContextualQuickReplies() {
    // Gợi ý dựa trên nội dung trang
    const pageTitle = document.title.toLowerCase();
    let suggestions = [];

    if (pageTitle.includes("javascript") || pageTitle.includes("js")) {
      suggestions = [
        "Giải thích thêm",
        "Cho ví dụ thực tế",
        "Bài tập thực hành?",
      ];
    } else if (pageTitle.includes("html") || pageTitle.includes("css")) {
      suggestions = ["Demo trực quan?", "Best practices?", "Lỗi thường gặp?"];
    } else if (pageTitle.includes("react") || pageTitle.includes("node")) {
      suggestions = [
        "So sánh với cách khác?",
        "Use case thực tế?",
        "Debug như nào?",
      ];
    } else {
      suggestions = ["Giải thích thêm?", "Cho tôi ví dụ", "Tóm tắt ngắn gọn"];
    }

    showQuickReplies(suggestions);
  }

  function removeQuickReplies() {
    const existing = messages.querySelectorAll(".quick-replies");
    existing.forEach((el) => el.remove());
  }

  // ============================================
  // Feedback Buttons (like / dislike)
  // Thu thập phản hồi từ người dùng
  // ============================================
  function addFeedbackButtons(msgElement, answerText) {
    const bubble = msgElement.querySelector(".msg-bubble");
    if (!bubble || msgElement.querySelector(".feedback-btns")) return;

    const feedbackDiv = document.createElement("div");
    feedbackDiv.className = "feedback-btns";

    const likeBtn = document.createElement("button");
    likeBtn.className = "feedback-btn like";
    likeBtn.innerHTML = '<i class="far fa-thumbs-up"></i>';
    likeBtn.title = "Hữu ích";
    likeBtn.onclick = () => handleFeedback(feedbackDiv, "like", answerText);

    const dislikeBtn = document.createElement("button");
    dislikeBtn.className = "feedback-btn dislike";
    dislikeBtn.innerHTML = '<i class="far fa-thumbs-down"></i>';
    dislikeBtn.title = "Chưa tốt";
    dislikeBtn.onclick = () =>
      handleFeedback(feedbackDiv, "dislike", answerText);

    feedbackDiv.appendChild(likeBtn);
    feedbackDiv.appendChild(dislikeBtn);
    bubble.appendChild(feedbackDiv);
  }

  function handleFeedback(container, type, answerText) {
    // Hiệu ứng đã chọn
    container.querySelectorAll(".feedback-btn").forEach((btn) => {
      btn.disabled = true;
      btn.classList.remove("selected");
    });

    const selectedBtn = container.querySelector(`.feedback-btn.${type}`);
    if (selectedBtn) {
      selectedBtn.classList.add("selected");
      selectedBtn.querySelector("i").classList.remove("far");
      selectedBtn.querySelector("i").classList.add("fas");
    }

    // Hiển thị thông báo cảm ơn
    const thanks = document.createElement("span");
    thanks.className = "feedback-thanks";
    thanks.textContent = type === "like" ? " Cảm ơn!" : " Sẽ cải thiện!";
    container.appendChild(thanks);

    // Log feedback (có thể gửi lên server sau)
    console.log("[Feedback]", {
      type,
      answer: answerText.substring(0, 100),
      timestamp: new Date().toISOString(),
      page: window.location.pathname,
    });

    // TODO: Gửi feedback lên Firebase
    // saveFeedbackToFirebase(type, answerText);
  }

  // ============================================
  // Hàm gửi tin nhắn lên UI
  // ============================================
  function appendMsg(role, text) {
    const msg = document.createElement("div");
    msg.className = "ai-msg " + role;

    let parsedText;
    try {
      parsedText = marked.parse(text);
    } catch {
      parsedText = text;
    }

    msg.innerHTML = `<div class="msg-bubble">${parsedText}</div>`;
    messages.appendChild(msg);
    messages.scrollTop = messages.scrollHeight;
    return msg;
  }

  // ============================================
  // PHASE 1: Full Page Context
  // ============================================
  function getFullPageContext() {
    const context = {
      url: window.location.pathname,
      pageTitle: document.title,
    };

    const lessonTitle =
      document.querySelector(".lesson-content h2")?.textContent ||
      document.querySelector(".course-title")?.textContent ||
      document.querySelector("h1")?.textContent ||
      "";
    context.lessonTitle = lessonTitle.trim();

    const contentSelectors = [
      ".lesson-text",
      ".lesson-content",
      ".course-content",
      ".blog-content",
      "article",
      "main",
    ];

    let mainContent = "";
    for (const selector of contentSelectors) {
      const el = document.querySelector(selector);
      if (el) {
        mainContent = el.textContent || "";
        break;
      }
    }
    context.content = mainContent.trim().substring(0, 2000);

    const codeBlocks = document.querySelectorAll("pre code, .code-block");
    if (codeBlocks.length > 0) {
      const codes = Array.from(codeBlocks)
        .map((el) => el.textContent?.trim())
        .filter(Boolean)
        .join("\n---\n");
      context.codeExamples = codes.substring(0, 1000);
    }

    const headings = document.querySelectorAll("h1, h2, h3");
    context.structure = Array.from(headings)
      .map((h) => `${h.tagName}: ${h.textContent?.trim()}`)
      .slice(0, 10)
      .join("\n");

    return JSON.stringify(context);
  }

  // ============================================
  // Nút xóa lịch sử hội thoại
  // ============================================
  function addClearHistoryButton() {
    const header = chat.querySelector(".ai-chat-header, #ai-chat-header");
    if (!header || header.querySelector(".clear-history-btn")) return;

    const clearBtn = document.createElement("button");
    clearBtn.className = "clear-history-btn";
    clearBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
    clearBtn.title = "Xóa lịch sử hội thoại";
    clearBtn.onclick = (e) => {
      e.stopPropagation();
      if (confirm("Xóa toàn bộ lịch sử hội thoại?")) {
        conversationHistory = [];
        messages.innerHTML = `
          <div class="ai-msg ai">
            <div class="msg-bubble">
              Xin chào! Tôi là trợ lý AI của CodeMaster. 
              Tôi có thể giúp bạn giải đáp thắc mắc về bài học hiện tại. 
              Hãy hỏi tôi bất cứ điều gì! 🚀
            </div>
          </div>
        `;
        showInitialQuickReplies();
      }
    };

    const closeBtnEl = header.querySelector(".ai-chat-close, #ai-chat-close");
    if (closeBtnEl) {
      header.insertBefore(clearBtn, closeBtnEl);
    } else {
      header.appendChild(clearBtn);
    }
  }
});
