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
      enrolledCourses, // New structure { inProgress, notStarted, completed }
      availableCourses,
    } = req.body;

    // Debug log
    console.log("[API] Request type:", type);
    console.log(
      "[API] Available courses count:",
      availableCourses?.length || 0,
    );
    console.log("[API] Enrolled courses:", {
      inProgress: enrolledCourses?.inProgress?.length || 0,
      notStarted: enrolledCourses?.notStarted?.length || 0,
      completed:
        enrolledCourses?.completed?.length || completedCourses?.length || 0,
    });
    console.log(
      "[API] Conversation history length:",
      conversationHistory?.length || 0,
    );

    // Xử lý theo loại request
    if (type === "roadmap") {
      // AI Roadmap Recommendation với data structure mới
      return handleRoadmapRecommendation(res, GEMINI_API_URL, GEMINI_API_KEY, {
        preferences,
        enrolledCourses: enrolledCourses || {
          inProgress: [],
          notStarted: [],
          completed: completedCourses || [],
        },
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
 * SOLUTION B: Xử lý gợi ý lộ trình học tập - bao gồm cả khóa đang học và chưa bắt đầu
 */
async function handleRoadmapRecommendation(res, apiUrl, apiKey, data) {
  const { preferences, enrolledCourses, availableCourses } = data;
  const {
    inProgress = [],
    notStarted = [],
    completed = [],
  } = enrolledCourses || {};

  // Tổng số khóa có thể gợi ý
  const totalRecommendable =
    inProgress.length + notStarted.length + (availableCourses?.length || 0);

  console.log("[Roadmap] Data stats:", {
    inProgress: inProgress.length,
    notStarted: notStarted.length,
    available: availableCourses?.length || 0,
    completed: completed.length,
  });

  if (totalRecommendable === 0) {
    return res.status(200).json({
      recommendations: [],
      summary:
        completed.length > 0
          ? `Tuyệt vời! Bạn đã hoàn thành ${completed.length} khóa học.`
          : "Bạn đã đăng ký tất cả khóa học hiện có!",
    });
  }

  // Build context
  const userLevel = preferences?.level || "beginner";
  const userInterests = preferences?.interests || [];

  // Tạo prompt cho AI với data mới (tối ưu ngắn gọn)
  const formatCourses = (courses, maxCount = 3) =>
    courses
      .slice(0, maxCount)
      .map(
        (c) =>
          `${c.id}|${c.title}|${c.category}|${c.level}${c.progress !== undefined ? `|${c.progress}%` : ""}`,
      )
      .join("; ");

  let prompt = `User: ${userLevel} level, interests: ${userInterests.join(", ") || "general"}\n`;

  if (inProgress.length > 0) {
    prompt += `IN_PROGRESS (continue these first!): ${formatCourses(inProgress)}\n`;
  }
  if (notStarted.length > 0) {
    prompt += `ENROLLED_NOT_STARTED: ${formatCourses(notStarted)}\n`;
  }
  if (availableCourses?.length > 0) {
    prompt += `NEW_COURSES: ${formatCourses(availableCourses)}\n`;
  }

  prompt += `\nSelect 2-3 courses. Prioritize: 1) IN_PROGRESS (must continue), 2) ENROLLED matching interests, 3) NEW matching interests.
Return JSON only: {"recommendations":[{"courseId":"id","reason":"vì sao - 10 words"}],"summary":"1 sentence summary"}`;

  try {
    const geminiRes = await fetch(`${apiUrl}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 250,
        },
      }),
    });

    const responseData = await geminiRes.json();
    const finishReason = responseData.candidates?.[0]?.finishReason;
    const rawText = responseData.candidates?.[0]?.content?.parts?.[0]?.text;

    console.log(
      "[Roadmap] Finish:",
      finishReason,
      "Length:",
      rawText?.length || 0,
    );

    if (finishReason === "MAX_TOKENS" || !rawText) {
      return res
        .status(200)
        .json(
          buildSmartRecommendation(
            inProgress,
            notStarted,
            availableCourses,
            preferences,
          ),
        );
    }

    let result = parseJsonResponse(rawText);

    if (!result || !result.recommendations?.length) {
      return res
        .status(200)
        .json(
          buildSmartRecommendation(
            inProgress,
            notStarted,
            availableCourses,
            preferences,
          ),
        );
    }

    console.log("[Roadmap] AI Success:", result.recommendations.length);
    return res.status(200).json(result);
  } catch (err) {
    console.error("[Roadmap] Error:", err.message);
    return res
      .status(200)
      .json(
        buildSmartRecommendation(
          inProgress,
          notStarted,
          availableCourses,
          preferences,
        ),
      );
  }
}

/**
 * SOLUTION B: Smart fallback với priority scoring
 * Ưu tiên: inProgress > notStarted > available
 */
function buildSmartRecommendation(
  inProgress,
  notStarted,
  available,
  preferences,
) {
  const userLevel = preferences?.level || "beginner";
  const userInterests = preferences?.interests || [];

  // Category relations (mở rộng matching)
  const categoryRelations = {
    web: ["frontend", "backend", "web", "javascript", "html", "css", "react"],
    frontend: ["frontend", "web", "javascript", "html", "css", "react"],
    backend: ["backend", "nodejs", "database", "api"],
    mobile: ["mobile", "flutter", "react-native"],
    database: ["database", "sql", "mongodb", "backend"],
    "data-science": ["data-science", "python", "machine-learning"],
  };

  // Expand interests
  const expandedInterests = new Set();
  userInterests.forEach((interest) => {
    const related = categoryRelations[interest] || [interest];
    related.forEach((cat) => expandedInterests.add(cat.toLowerCase()));
  });

  // Map level tiếng Anh → tiếng Việt
  const levelTextMap = {
    beginner: "cơ bản",
    basic: "cơ bản",
    intermediate: "trung cấp",
    advanced: "nâng cao",
  };

  // Scoring function - thêm status để phân biệt loại khóa
  const scoreCourse = (course, baseScore, status) => {
    let score = baseScore;
    const category = (course.category || "").toLowerCase();
    const level = (course.level || "").toLowerCase();

    // Category match (+100)
    if (expandedInterests.has(category)) score += 100;

    // Level match (+30 exact, +15 adjacent)
    if (level === userLevel) score += 30;
    else if (
      (userLevel === "beginner" && level === "intermediate") ||
      (userLevel === "intermediate" &&
        (level === "beginner" || level === "advanced")) ||
      (userLevel === "advanced" && level === "intermediate")
    ) {
      score += 15;
    }

    // Progress bonus cho inProgress
    if (course.progress && course.progress > 50) score += 50;

    // Featured bonus
    if (course.featured) score += 10;

    return {
      ...course,
      score,
      status, // "inProgress" | "notStarted" | "available"
      isEnrolled: status !== "available",
      categoryMatched: expandedInterests.has(category),
      levelText: levelTextMap[level] || level,
    };
  };

  // Score all courses với base score và status theo loại
  const scoredInProgress = (inProgress || []).map((c) =>
    scoreCourse(c, 200, "inProgress"),
  );
  const scoredNotStarted = (notStarted || []).map((c) =>
    scoreCourse(c, 100, "notStarted"),
  );
  const scoredAvailable = (available || []).map((c) =>
    scoreCourse(c, 50, "available"),
  );

  // Combine và sort
  const allScored = [
    ...scoredInProgress,
    ...scoredNotStarted,
    ...scoredAvailable,
  ];
  allScored.sort((a, b) => b.score - a.score);

  // Lấy top 3
  const top = allScored.slice(0, 3);

  // Generate summary
  let summary;
  const hasInProgress = scoredInProgress.length > 0;
  const topCategoryMatch = top.filter((c) => c.categoryMatched).length;

  if (hasInProgress && top[0].progress) {
    summary = `Bạn đang học ${top[0].title} (${top[0].progress}%). Hãy hoàn thành để tiếp tục!`;
  } else if (topCategoryMatch > 0) {
    const interestText =
      userInterests.length > 0 ? userInterests[0] : "lập trình";
    summary = `Dựa trên sở thích ${interestText} và trình độ, đây là gợi ý cho bạn.`;
  } else {
    summary = "Đây là các khóa học phù hợp với trình độ của bạn.";
  }

  // Generate reasons - phân biệt rõ từng trường hợp
  const recommendations = top.map((course) => {
    let reason;

    // Case 1: Đang học dở (inProgress) - có progress > 0
    if (course.status === "inProgress" && course.progress > 0) {
      reason = `Đã học ${course.progress}% - hãy hoàn thành!`;
    }
    // Case 2: Đã đăng ký, chưa bắt đầu, khớp sở thích
    else if (course.status === "notStarted" && course.categoryMatched) {
      reason = `Phù hợp sở thích ${course.category} - bắt đầu ngay!`;
    }
    // Case 3: Đã đăng ký, chưa bắt đầu, không khớp sở thích
    else if (course.status === "notStarted") {
      reason = "Khóa đã đăng ký - bắt đầu ngay!";
    }
    // Case 4: Chưa đăng ký, khớp sở thích
    else if (course.status === "available" && course.categoryMatched) {
      reason = `Phù hợp sở thích ${course.category}`;
    }
    // Case 5: Chưa đăng ký, khớp trình độ
    else if (course.status === "available") {
      reason = `Phù hợp trình độ ${course.levelText}`;
    }
    // Fallback
    else {
      reason = "Khóa học phù hợp với bạn";
    }

    return { courseId: course.id, reason };
  });

  return {
    recommendations,
    summary,
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
