export default async function handler(req, res) {
  // Thêm header CORS cho mọi request
  res.setHeader("Access-Control-Allow-Origin", "*");
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
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

  try {
    const { question, context } = req.body;
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
