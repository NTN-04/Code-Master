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

  // Build context - super simplified
  const userLevel = preferences?.level || "beginner";
  const userInterests = preferences?.interests?.[0] || "frontend";

  // Course list dạng ngắn nhất: "id:title:level"
  const courseStr = availableCourses
    .slice(0, 5) // Chỉ lấy tối đa 5 khóa
    .map((c) => `${c.id}|${c.level}`)
    .join(",");

  // Prompt cực ngắn
  const prompt = `Pick 1-2 courses for ${userLevel} user interested in ${userInterests}.
Courses: ${courseStr}
Return JSON only: {"recommendations":[{"courseId":"id","reason":"5 words max"}],"summary":"10 words max"}`;

  try {
    const geminiRes = await fetch(`${apiUrl}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 150,
        },
      }),
    });

    const responseData = await geminiRes.json();
    const finishReason = responseData.candidates?.[0]?.finishReason;
    const rawText = responseData.candidates?.[0]?.content?.parts?.[0]?.text;

    console.log("[Roadmap] Finish:", finishReason, "Raw:", rawText?.substring(0, 200));

    // Nếu MAX_TOKENS hoặc parse fail → dùng smart fallback
    if (finishReason === "MAX_TOKENS" || !rawText) {
      return res.status(200).json(
        buildSmartRecommendation(availableCourses, preferences)
      );
    }

    let result = parseJsonResponse(rawText);

    if (!result || !result.recommendations?.length) {
      return res.status(200).json(
        buildSmartRecommendation(availableCourses, preferences)
      );
    }

    console.log("[Roadmap] AI Success:", result.recommendations.length);
    return res.status(200).json(result);
  } catch (err) {
    console.error("[Roadmap] Error:", err.message);
    return res.status(200).json(
      buildSmartRecommendation(availableCourses, preferences)
    );
  }
}

/**
 * Smart fallback - gợi ý dựa trên logic đơn giản
 */
function buildSmartRecommendation(courses, preferences) {
  const userLevel = preferences?.level || "beginner";
  const userInterests = preferences?.interests || [];

  // Scoring: level match + category match
  const scored = courses.map((c) => {
    let score = 0;
    // Level matching
    if (c.level === userLevel) score += 10;
    if (c.level === "beginner" && userLevel === "basic") score += 5;
    if (c.level === "intermediate" && userLevel === "advanced") score += 3;
    // Category matching
    if (userInterests.includes(c.category)) score += 8;
    // Featured bonus
    if (c.featured) score += 2;
    return { ...c, score };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  const top = scored.slice(0, Math.min(2, scored.length));

  const levelText = {
    beginner: "người mới bắt đầu",
    basic: "cơ bản",
    intermediate: "trung cấp",
    advanced: "nâng cao",
  };

  return {
    recommendations: top.map((c) => ({
      courseId: c.id,
      reason: `Phù hợp với trình độ ${levelText[c.level] || c.level} của bạn`,
    })),
    summary: `Dựa trên sở thích${userInterests.length ? ` (${userInterests[0]})` : ""} và trình độ của bạn, đây là các khóa học gợi ý.`,
    isFallback: true,
  };
}

/**
 * Parse JSON từ AI response - xử lý nhiều format
 */
function parseJsonResponse(rawText) {
  const text = rawText.trim();

  // Case 1: JSON thuần túy
  try {
    return JSON.parse(text);
  } catch {
    // continue
  }

  // Case 2: Markdown fence ```json...```
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {
      // continue
    }
  }

  // Case 3: Extract JSON object từ text
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      // Case 4: JSON bị truncate - cố gắng sửa
      let broken = jsonMatch[0];
      // Thêm closing quotes và brackets
      if (!broken.endsWith("}")) {
        broken = broken.replace(/[^"}\]]*$/, "") + '"}]}';
      }
      try {
        return JSON.parse(broken);
      } catch {
        // continue
      }
    }
  }

  return null;
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
