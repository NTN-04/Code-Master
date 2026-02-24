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

    // Xử lý theo loại request
    if (type === "roadmap") {
      // AI Roadmap Recommendation
      return handleRoadmapRecommendation(res, GEMINI_API_URL, GEMINI_API_KEY, {
        preferences,
        completedCourses,
        availableCourses,
      });
    }

    // Default: Chat assistant
    if (!question) return res.status(400).json({ error: "Missing question" });

    const prompt = `
Bạn là trợ lý AI cho nền tảng học lập trình. Hãy trả lời ngắn gọn, dễ hiểu, ưu tiên giải thích cho người mới học.
Câu hỏi: ${question}
Bối cảnh bài học: ${context || "Không có"}
`;

    const geminiRes = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 512 },
      }),
    });
    const data = await geminiRes.json();
    const answer =
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Xin lỗi, tôi chưa có câu trả lời.";
    res.status(200).json({ answer });
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
Bạn là cố vấn học tập AI cho nền tảng CodeMaster. Nhiệm vụ: Gợi ý 2-3 khóa học phù hợp nhất cho người dùng.

**THÔNG TIN NGƯỜI DÙNG:**
- Trình độ: ${userLevel}
- Lĩnh vực quan tâm: ${userInterests}
- Mục tiêu học tập: ${userGoal}

**KHÓA HỌC ĐÃ HOÀN THÀNH:**
${completedList}

**DANH SÁCH KHÓA HỌC CÓ THỂ HỌC:**
${availableList}

**YÊU CẦU:**
1. Chọn 2-3 khóa học phù hợp nhất từ danh sách trên
2. Ưu tiên theo: trình độ phù hợp → lĩnh vực quan tâm → mục tiêu học tập
3. Với người mới (beginner): ưu tiên khóa beginner trong lĩnh vực quan tâm
4. Với người đã học: gợi ý khóa level cao hơn hoặc lĩnh vực liên quan

**TRẢ VỀ ĐÚNG ĐỊNH DẠNG JSON (không markdown, không backticks):**
{
  "recommendations": [
    {"courseId": "id_khóa_học", "reason": "Lý do ngắn gọn (1-2 câu tiếng Việt)"}
  ],
  "summary": "Tóm tắt ngắn gọn về lộ trình gợi ý (2-3 câu tiếng Việt)"
}
`;

  try {
    const geminiRes = await fetch(`${apiUrl}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 800,
          responseMimeType: "application/json",
        },
      }),
    });

    const responseData = await geminiRes.json();
    const rawText = responseData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      return res.status(500).json({ error: "Empty AI response" });
    }

    // Parse JSON response
    let result;
    try {
      result = JSON.parse(rawText);
    } catch (parseErr) {
      // Try to extract JSON from the response
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Invalid JSON response");
      }
    }

    // Validate result structure
    if (!result.recommendations || !Array.isArray(result.recommendations)) {
      return res.status(500).json({ error: "Invalid recommendation format" });
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error("Roadmap recommendation error:", err.message || err);
    return res.status(500).json({
      error: "AI recommendation failed",
      details: err.message || "Unknown error",
    });
  }
}
