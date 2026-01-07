// --- AI Chatbot ---
document.addEventListener("DOMContentLoaded", () => {
  const chat = document.getElementById("ai-chatbot");
  const openBtn = document.getElementById("ai-chat-open");
  const closeBtn = document.getElementById("ai-chat-close");
  const form = document.getElementById("ai-chat-form");
  const input = document.getElementById("ai-chat-input");
  const messages = document.getElementById("ai-chat-messages");

  if (!chat) return;

  // Open chat from original button
  if (openBtn) openBtn.onclick = () => chat.classList.add("open");
  closeBtn.onclick = () => chat.classList.remove("open");

  form.onsubmit = async (e) => {
    e.preventDefault();
    const question = input.value.trim();
    if (!question) return;
    appendMsg("user", question);
    input.value = "";
    appendMsg("ai", "<i class='fas fa-spinner fa-spin'></i> Đang trả lời...");

    try {
      // Gọi API Gemini đã deploy trên Vercel
      const res = await fetch(
        "https://code-master-dev.vercel.app/api/gemini-chat", // endpoint
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question,
            context: getLessonContext(),
          }),
        }
      );
      const data = await res.json();
      messages.removeChild(messages.lastElementChild);
      appendMsg("ai", data.answer || "Xin lỗi, tôi chưa có câu trả lời.");
    } catch (err) {
      messages.removeChild(messages.lastElementChild);
      appendMsg("ai", "Có lỗi khi kết nối AI.");
    }
    messages.scrollTop = messages.scrollHeight;
  };

  // hàm gửi tin nhắn
  function appendMsg(role, text) {
    const msg = document.createElement("div");
    msg.className = "ai-msg " + role;
    msg.innerHTML = `<div class="msg-bubble">${marked.parse(text)}</div>`;
    messages.appendChild(msg);
    messages.scrollTop = messages.scrollHeight;
  }

  // hàm lấy bối cảnh bài học
  function getLessonContext() {
    const title =
      document.querySelector(".lesson-content h2")?.textContent || "";
    const content = document.querySelector(".lesson-text p")?.textContent || "";
    return `Tiêu đề: ${title}\nNội dung: ${content}`;
  }
});
