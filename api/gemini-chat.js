export default async function handler(req, res) {
  // Danh sách các domain có thể truy cập tài nguyên
  const WHITELIST_DOMAINS = [
    "https://code-master-dev.vercel.app",
    "http://127.0.0.1:5500",
  ];
  // Thêm header CORS cho mọi request
  const origin = req.headers.origin;
  if (WHITELIST_DOMAINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Xử lý preflight request (OPTIONS)
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const GEMINI_API_URL =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

  try {
    const {
      type,
      question,
      context,
      conversationHistory,
      preferences,
      completedCourses,
      availableCourses,
    } = req.body;

    // Debug log
    console.log("[API] Request type:", type);
    console.log(
      "[API] Available courses count:",
      availableCourses?.length || 0,
    );
    console.log(
      "[API] Conversation history length:",
      conversationHistory?.length || 0,
    );

    // Xử lý theo loại request
    if (type === "roadmap") {
      // AI Roadmap Recommendation
      return handleRoadmapRecommendation(res, GEMINI_API_URL, GEMINI_API_KEY, {
        preferences,
        completedCourses,
        availableCourses,
      });
    }

    // ============================================
    // PHASE 1: Multi-turn Chat với Conversation Memory
    // ============================================
    if (!question) return res.status(400).json({ error: "Missing question" });

    // Xử lý chat với conversation history
    return handleChatWithMemory(res, GEMINI_API_URL, GEMINI_API_KEY, {
      question,
      context,
      conversationHistory,
    });
  } catch (err) {
    res.status(500).json({ error: "AI server error" });
  }
}

/**
 * Xử lý gợi ý lộ trình học tập cá nhân hóa
 */
async function handleRoadmapRecommendation(res, apiUrl, apiKey, data) {
  const { preferences, completedCourses, availableCourses } = data;

  // Validate input
  if (!availableCourses || availableCourses.length === 0) {
    return res.status(400).json({ error: "No available courses provided" });
  }

  // Build context strings
  const levelMap = {
    beginner: "Mới bắt đầu",
    basic: "Biết cơ bản",
    intermediate: "Trung cấp",
    advanced: "Nâng cao",
  };

  const goalMap = {
    job: "Tìm việc làm",
    upgrade: "Nâng cao kỹ năng",
    project: "Làm dự án cá nhân",
    explore: "Khám phá",
  };

  const userLevel = preferences?.level
    ? levelMap[preferences.level] || preferences.level
    : "Chưa xác định";

  const userInterests = preferences?.interests?.length
    ? preferences.interests.join(", ")
    : "Chưa xác định";

  const userGoal = preferences?.goal
    ? goalMap[preferences.goal] || preferences.goal
    : "Chưa xác định";

  const completedList =
    completedCourses?.length > 0
      ? completedCourses
          .map((c) => `- ${c.title} (${c.category}, ${c.level})`)
          .join("\n")
      : "Chưa hoàn thành khóa học nào";

  const availableList = availableCourses
    .map(
      (c) =>
        `- ID: ${c.id}, Tên: ${c.title}, Category: ${c.category}, Level: ${c.level}, Mô tả: ${c.description}`,
    )
    .join("\n");

  const prompt = `
Bạn là cố vấn học tập AI cho nền tảng CodeMaster. Nhiệm vụ: Gợi ý khóa học phù hợp nhất cho người dùng.

**THÔNG TIN NGƯỜI DÙNG:**
- Trình độ: ${userLevel}
- Lĩnh vực quan tâm: ${userInterests}
- Mục tiêu học tập: ${userGoal}

**KHÓA HỌC ĐÃ HOÀN THÀNH:**
${completedList}

**DANH SÁCH KHÓA HỌC CÓ THỂ HỌC (chỉ chọn trong danh sách này):**
${availableList}

**YÊU CẦU:**
1. Chọn 1-3 khóa học phù hợp nhất từ danh sách trên (nếu ít hơn 3 khóa thì chọn tất cả)
2. Ưu tiên theo: trình độ phù hợp → lĩnh vực quan tâm → mục tiêu học tập
3. Với người mới (beginner): ưu tiên khóa beginner trong lĩnh vực quan tâm
4. Với người đã học: gợi ý khóa level cao hơn hoặc lĩnh vực liên quan

QUAN TRỌNG: Chỉ trả về JSON thuần túy, không có markdown, không có backtick, không có giải thích thêm.
Định dạng bắt buộc:
{"recommendations":[{"courseId":"ID_KHOA_HOC","reason":"Lý do ngắn gọn 1-2 câu"}],"summary":"Tóm tắt lộ trình 2-3 câu"}
`;

  try {
    const geminiRes = await fetch(`${apiUrl}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1024,
        },
      }),
    });

    const responseData = await geminiRes.json();

    // Debug log để dễ trace lỗi trên Vercel
    console.log("[Roadmap] Gemini HTTP status:", geminiRes.status);
    console.log("[Roadmap] Candidates:", JSON.stringify(responseData.candidates?.length));
    console.log("[Roadmap] FinishReason:", responseData.candidates?.[0]?.finishReason);

    const rawText = responseData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      const blockReason = responseData.promptFeedback?.blockReason || "unknown";
      console.error("[Roadmap] Empty response. Block reason:", blockReason);
      return res.status(500).json({
        error: "Empty AI response",
        details: `Block reason: ${blockReason}`,
      });
    }

    console.log("[Roadmap] Raw text (first 300 chars):", rawText.substring(0, 300));

    // Parse JSON - xử lý nhiều trường hợp model trả về
    let result;
    try {
      // Trường hợp 1: JSON thuần túy
      result = JSON.parse(rawText.trim());
    } catch {
      // Trường hợp 2: JSON bọc trong markdown ```json ... ```
      const fenceMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/i);
      if (fenceMatch) {
        try {
          result = JSON.parse(fenceMatch[1].trim());
        } catch {
          // ignore, try next
        }
      }

      // Trường hợp 3: Tìm object JSON đầu tiên trong text
      if (!result) {
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            result = JSON.parse(jsonMatch[0]);
          } catch {
            // ignore
          }
        }
      }

      if (!result) {
        console.error("[Roadmap] Cannot parse JSON from:", rawText);
        throw new Error("Cannot parse JSON from AI response");
      }
    }

    // Validate cấu trúc
    if (!result.recommendations || !Array.isArray(result.recommendations)) {
      console.error("[Roadmap] Invalid structure:", JSON.stringify(result));
      return res.status(500).json({ error: "Invalid recommendation format" });
    }

    console.log("[Roadmap] Success, recommendations:", result.recommendations.length);
    return res.status(200).json(result);
  } catch (err) {
    console.error("[Roadmap] Error:", err.message || err);
    return res.status(500).json({
      error: "AI recommendation failed",
      details: err.message || "Unknown error",
    });
  }
}

/**
 * PHASE 1 + 2 + 3: Xử lý chat với Memory, Guardrails, và Suggestions
 */
async function handleChatWithMemory(res, apiUrl, apiKey, data) {
  const { question, context, conversationHistory } = data;

  // ============================================
  // PHASE 3: Guardrails - Kiểm tra chủ đề
  // ============================================
  const offTopicCheck = checkOffTopic(question);
  if (offTopicCheck.isOffTopic) {
    return res.status(200).json({
      answer: offTopicCheck.message,
      suggestions: [
        "Hỏi về bài học hiện tại",
        "Giải thích code trong bài",
        "Cho tôi ví dụ thực tế",
      ],
    });
  }

  // Parse context
  let parsedContext = {};
  try {
    parsedContext = context ? JSON.parse(context) : {};
  } catch {
    parsedContext = { content: context || "" };
  }

  // ============================================
  // System Instruction với Guardrails
  // ============================================
  const systemInstruction = `Bạn là "CodeMaster AI" - trợ lý học tập thông minh cho nền tảng học lập trình CodeMaster.

**TÍNH CÁCH:**
- Thân thiện, nhiệt tình như một người bạn học cùng
- Giải thích đơn giản, dễ hiểu cho người mới
- Đưa ra ví dụ code thực tế khi cần thiết
- Khuyến khích và động viên người học

**QUY TẮC QUAN TRỌNG:**
1. CHỈ trả lời về lập trình, công nghệ, và nội dung học tập trên CodeMaster
2. Từ chối lịch sự nếu câu hỏi về: chính trị, tôn giáo, bạo lực, nội dung người lớn, hoặc không liên quan đến học lập trình
3. Nếu câu hỏi mơ hồ, hỏi lại để làm rõ thay vì đoán
4. Trả lời bằng tiếng Việt, ngắn gọn nhưng đầy đủ (tối đa 300 từ)
5. Sử dụng markdown cho code blocks: \`\`\`language
6. Cuối câu trả lời, LUÔN gợi ý 2-3 câu hỏi tiếp theo liên quan

**FORMAT TRẢ LỜI:**
[Câu trả lời chính]

---
💡 **Bạn có thể hỏi thêm:**
- [Gợi ý 1]
- [Gợi ý 2]  
- [Gợi ý 3]

**BỐI CẢNH BÀI HỌC:**
- Trang: ${parsedContext.pageTitle || "Không xác định"}
- Bài học: ${parsedContext.lessonTitle || "Không có"}
- Cấu trúc: ${parsedContext.structure || "Không có"}
${parsedContext.codeExamples ? `- Code mẫu: ${parsedContext.codeExamples.substring(0, 500)}` : ""}`;

  // Build conversation contents
  const contents = [];

  if (conversationHistory && conversationHistory.length > 0) {
    for (const msg of conversationHistory) {
      const role = msg.role === "assistant" ? "model" : "user";
      contents.push({
        role,
        parts: [{ text: msg.content }],
      });
    }
  }

  const lastMsg = conversationHistory?.[conversationHistory.length - 1];
  if (!lastMsg || lastMsg.content !== question) {
    contents.push({
      role: "user",
      parts: [{ text: question }],
    });
  }

  try {
    const geminiRes = await fetch(`${apiUrl}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemInstruction }],
        },
        contents,
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 1024,
          topP: 0.9,
        },
      }),
    });

    const responseData = await geminiRes.json();

    console.log(
      "[Chat] Response status:",
      geminiRes.status,
      responseData.candidates ? "OK" : "No candidates",
    );

    let answer =
      responseData.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Xin lỗi, tôi đang gặp sự cố. Vui lòng thử lại sau nhé!";

    // ============================================
    // PHASE 2: Extract suggestions từ câu trả lời
    // ============================================
    const suggestions = extractSuggestions(answer, parsedContext);

    // Loại bỏ phần suggestions từ answer nếu đã extract được
    answer = cleanAnswerText(answer);

    return res.status(200).json({ answer, suggestions });
  } catch (err) {
    console.error("Chat with memory error:", err.message || err);
    return res.status(500).json({
      error: "AI chat failed",
      answer: "Có lỗi xảy ra khi xử lý. Vui lòng thử lại!",
      suggestions: ["Thử hỏi lại", "Đặt câu hỏi khác"],
    });
  }
}

/**
 * Lọc câu hỏi ngoài chủ đề (chính trị, bạo lực, 18+...)
 */
function checkOffTopic(question) {
  const lowerQ = question.toLowerCase();

  // Các từ khóa off-topic
  const offTopicPatterns = [
    // Chính trị
    /\b(chính trị|bầu cử|đảng|chủ tịch|thủ tướng|quốc hội)\b/i,
    // Tôn giáo
    /\b(tôn giáo|phật|chúa|allah|đạo|nhà thờ|chùa)\b/i,
    // Bạo lực
    /\b(giết|đánh|bom|khủng bố|vũ khí|súng)\b/i,
    // Nội dung người lớn
    /\b(sex|porn|khiêu dâm|18\+|người lớn)\b/i,
    // Cờ bạc, ma túy
    /\b(cá độ|cờ bạc|casino|ma túy|thuốc lắc)\b/i,
  ];

  for (const pattern of offTopicPatterns) {
    if (pattern.test(lowerQ)) {
      return {
        isOffTopic: true,
        message:
          "Xin lỗi, tôi chỉ có thể hỗ trợ các câu hỏi về lập trình và học tập. Bạn có thể hỏi tôi về bài học hiện tại hoặc các khái niệm lập trình nhé! 😊",
      };
    }
  }

  // Các câu hỏi chung chung không liên quan
  const generalOffTopic = [
    /^(bạn là ai|tên bạn là gì|bạn bao nhiêu tuổi)/i,
    /^(thời tiết|dự báo|hôm nay là ngày)/i,
    /^(kể chuyện|hát|rap|thơ)/i,
  ];

  for (const pattern of generalOffTopic) {
    if (pattern.test(lowerQ)) {
      return {
        isOffTopic: true,
        message:
          "Mình là CodeMaster AI - trợ lý học lập trình của bạn! 🤖 Mình chuyên giúp bạn hiểu bài học, giải thích code, và trả lời câu hỏi về lập trình. Bạn đang học gì, để mình hỗ trợ nhé?",
      };
    }
  }

  return { isOffTopic: false };
}

/**
 * Trích xuất gợi ý từ AI response
 */
function extractSuggestions(answer, context) {
  const suggestions = [];

  // Tìm phần "Bạn có thể hỏi thêm" trong answer
  const suggestionsMatch = answer.match(
    /(?:Bạn có thể hỏi thêm|Câu hỏi gợi ý|Hỏi thêm)[:\s]*\n?([-•*]\s*.+\n?)+/gi,
  );

  if (suggestionsMatch) {
    const lines = suggestionsMatch[0].split("\n");
    for (const line of lines) {
      const cleanLine = line.replace(/^[-•*]\s*/, "").trim();
      if (cleanLine && cleanLine.length > 5 && cleanLine.length < 60) {
        suggestions.push(cleanLine);
      }
    }
  }

  // Nếu không tìm được, tạo suggestions mặc định dựa trên context
  if (suggestions.length === 0) {
    const lessonTitle = context.lessonTitle || "";

    if (lessonTitle.toLowerCase().includes("javascript")) {
      suggestions.push("Cho ví dụ thực tế", "Best practices?", "Lỗi hay gặp?");
    } else if (lessonTitle.toLowerCase().includes("html")) {
      suggestions.push("Semantic HTML là gì?", "Thuộc tính quan trọng?");
    } else if (lessonTitle.toLowerCase().includes("css")) {
      suggestions.push("Flexbox vs Grid?", "Responsive design?");
    } else {
      suggestions.push(
        "Giải thích thêm?",
        "Cho ví dụ code",
        "Bài tập thực hành?",
      );
    }
  }

  return suggestions.slice(0, 3);
}

/**
 * Làm sạch answer text, loại bỏ phần suggestions
 */
function cleanAnswerText(answer) {
  // Loại bỏ phần "Bạn có thể hỏi thêm" ở cuối
  return answer
    .replace(
      /\n*---\n*💡?\s*\*?\*?Bạn có thể hỏi thêm\*?\*?[:\s]*\n?([-•*]\s*.+\n?)+/gi,
      "",
    )
    .replace(
      /\n*💡?\s*\*?\*?Câu hỏi gợi ý\*?\*?[:\s]*\n?([-•*]\s*.+\n?)+/gi,
      "",
    )
    .trim();
}
