// Tiện ích xử lý thời lượng học
// Lưu ý: các hàm đều trả về giá trị an toàn để dùng trực tiếp trên UI

// Đổi chuỗi thời lượng về tổng phút, hỗ trợ "1:20", "1:20:00", "1 giờ 20 phút"
export function parseDurationToMinutes(input) {
  if (input === null || input === undefined) return 0;
  if (typeof input === "number" && Number.isFinite(input)) {
    return Math.max(0, Math.round(input));
  }

  const raw = String(input).trim();
  if (!raw) return 0;
  const normalized = raw.toLowerCase();

  // Ưu tiên parse dạng có dấu hai chấm (hh:mm:ss hoặc mm:ss)
  const timeLike = normalized.replace(/[^0-9:]/g, "");
  if (timeLike.includes(":")) {
    const parts = timeLike.split(":").map((part) => parseInt(part, 10) || 0);
    if (parts.length === 2) {
      const [minutes, seconds] = parts;
      const totalSeconds = minutes * 60 + seconds;
      return Math.round(Math.max(0, totalSeconds) / 60);
    }
    if (parts.length === 3) {
      const [hours, minutes, seconds] = parts;
      const totalSeconds = hours * 3600 + minutes * 60 + seconds;
      return Math.round(Math.max(0, totalSeconds) / 60);
    }
    if (parts.length === 1) {
      return Math.max(0, parts[0]);
    }
  }

  // Parse dạng chữ "1 giờ 30 phút"
  let totalMinutes = 0;
  const hourMatch = normalized.match(/(\d+)\s*(giờ|gio|h)/);
  if (hourMatch) {
    totalMinutes += parseInt(hourMatch[1], 10) * 60;
  }
  const minuteMatch = normalized.match(/(\d+)\s*(phút|phut|p)/);
  if (minuteMatch) {
    totalMinutes += parseInt(minuteMatch[1], 10);
  }

  if (totalMinutes > 0) return totalMinutes;

  // Fallback: lấy số đầu tiên trong chuỗi
  const plainNumber = parseInt(normalized.replace(/[^0-9]/g, ""), 10);
  return Math.max(0, plainNumber || 0);
}

// Chuyển tổng phút về chuỗi "X giờ Y phút"
export function formatMinutesToDuration(totalMinutes) {
  const safeMinutes = Number.isFinite(totalMinutes)
    ? Math.max(0, Math.round(totalMinutes))
    : 0;
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  const parts = [];
  if (hours > 0) parts.push(`${hours} giờ`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes} phút`);
  return parts.join(" ");
}

// Tính tổng số bài học và thời lượng từ danh sách bài học
export function summarizeLessons(lessons = []) {
  let totalLessons = 0;
  let totalMinutes = 0;
  lessons.forEach((lesson) => {
    if (!lesson) return;
    totalLessons += 1;
    totalMinutes += parseDurationToMinutes(lesson.duration || 0);
  });
  return { totalLessons, totalMinutes };
}

// Tổng hợp số liệu thời lượng theo module của một khóa học
export function summarizeCourseModules(modules = {}) {
  let totalLessons = 0;
  let totalMinutes = 0;
  Object.values(modules || {}).forEach((module) => {
    const lessonList = Array.isArray(module?.lessons) ? module.lessons : [];
    const { totalLessons: moduleLessons, totalMinutes: moduleMinutes } =
      summarizeLessons(lessonList);
    totalLessons += moduleLessons;
    totalMinutes += moduleMinutes;
  });

  return {
    totalLessons,
    totalMinutes,
    durationText: formatMinutesToDuration(totalMinutes),
  };
}
