/**
 * Roadmap Service
 * Service để lấy dữ liệu và gọi AI API cho lộ trình học tập cá nhân hóa
 */

import { database } from "./firebaseConfig.js";
import {
  ref,
  get,
  onValue,
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-database.js";
import { cacheManager } from "./utils/cache-manager.js";

// API endpoint
const API_ENDPOINT = "https://code-master-dev.vercel.app/api/gemini-chat";

// Cache key
const ROADMAP_CACHE_KEY = (userId) => `ai_roadmap_${userId}`;
const ROADMAP_CACHE_DURATION = 60 * 60 * 1000; // 1 giờ

/**
 * Lấy preferences của user từ Firebase
 */
export async function getUserPreferences(userId) {
  try {
    const userRef = ref(database, `users/${userId}/preferences`);
    const snapshot = await get(userRef);
    return snapshot.exists() ? snapshot.val() : null;
  } catch (error) {
    console.error("Error fetching user preferences:", error);
    return null;
  }
}

/**
 * Lấy danh sách khóa học đã hoàn thành (progress = 100%)
 */
export async function getCompletedCourses(userId) {
  try {
    const progressRef = ref(database, `userProgress/${userId}/courses`);
    const snapshot = await get(progressRef);

    if (!snapshot.exists()) return [];

    const coursesProgress = snapshot.val();
    const completedIds = [];

    // Lọc các khóa có progress = 100
    Object.keys(coursesProgress).forEach((courseId) => {
      if (coursesProgress[courseId]?.progress === 100) {
        completedIds.push(courseId);
      }
    });

    // Lấy thông tin chi tiết của các khóa đã hoàn thành
    if (completedIds.length === 0) return [];

    const coursesRef = ref(database, "courses");
    const coursesSnap = await get(coursesRef);

    if (!coursesSnap.exists()) return [];

    const allCourses = coursesSnap.val();
    const completedCourses = [];

    completedIds.forEach((id) => {
      if (allCourses[id]) {
        completedCourses.push({
          id,
          title: allCourses[id].title,
          category: allCourses[id].category,
          level: allCourses[id].level,
        });
      }
    });

    return completedCourses;
  } catch (error) {
    console.error("Error fetching completed courses:", error);
    return [];
  }
}

/**
 * SOLUTION B: Lấy khóa học đã enroll với thông tin progress chi tiết
 * Phân loại: inProgress (đang học), notStarted (chưa bắt đầu), completed (hoàn thành)
 */
export async function getEnrolledCoursesWithProgress(userId) {
  try {
    // 1. Lấy danh sách khóa đã enroll
    const enrollRef = ref(database, `enrollments/${userId}`);
    const enrollSnap = await get(enrollRef);
    if (!enrollSnap.exists()) return { inProgress: [], notStarted: [], completed: [] };

    const enrolledIds = Object.keys(enrollSnap.val());

    // 2. Lấy progress của user
    const progressRef = ref(database, `userProgress/${userId}/courses`);
    const progressSnap = await get(progressRef);
    const progressData = progressSnap.exists() ? progressSnap.val() : {};

    // 3. Lấy thông tin chi tiết các khóa học
    const coursesRef = ref(database, "courses");
    const coursesSnap = await get(coursesRef);
    if (!coursesSnap.exists()) return { inProgress: [], notStarted: [], completed: [] };

    const allCourses = coursesSnap.val();

    // 4. Phân loại khóa học
    const inProgress = [];
    const notStarted = [];
    const completed = [];

    enrolledIds.forEach((id) => {
      const course = allCourses[id];
      if (!course || course.lessons === 0) return;

      const progress = progressData[id]?.progress || 0;
      const courseData = {
        id,
        title: course.title,
        category: course.category,
        level: course.level,
        description: course.description,
        image: course.image,
        duration: course.duration,
        lessons: course.lessons,
        featured: course.featured,
        progress, // Thêm progress để scoring
      };

      if (progress === 100) {
        completed.push(courseData);
      } else if (progress > 0) {
        inProgress.push(courseData);
      } else {
        notStarted.push(courseData);
      }
    });

    // Sort inProgress by progress descending (gần hoàn thành trước)
    inProgress.sort((a, b) => b.progress - a.progress);

    return { inProgress, notStarted, completed };
  } catch (error) {
    console.error("Error fetching enrolled courses with progress:", error);
    return { inProgress: [], notStarted: [], completed: [] };
  }
}

/**
 * Lấy danh sách khóa học user đã enroll
 */
export async function getEnrolledCourseIds(userId) {
  try {
    const enrollRef = ref(database, `enrollments/${userId}`);
    const snapshot = await get(enrollRef);

    if (!snapshot.exists()) return new Set();

    return new Set(Object.keys(snapshot.val()));
  } catch (error) {
    console.error("Error fetching enrolled courses:", error);
    return new Set();
  }
}

/**
 * Lấy tất cả khóa học có sẵn (trừ những khóa đã enroll)
 */
export async function getAvailableCourses(enrolledIds = new Set()) {
  try {
    const coursesRef = ref(database, "courses");
    const snapshot = await get(coursesRef);

    if (!snapshot.exists()) return [];

    const allCourses = snapshot.val();
    const available = [];

    Object.keys(allCourses).forEach((id) => {
      // Bỏ qua khóa đã enroll
      if (enrolledIds.has(id)) return;

      const course = allCourses[id];
      // Chỉ lấy khóa có nội dung (lessons > 0)
      if (course.lessons > 0) {
        available.push({
          id,
          title: course.title,
          category: course.category,
          level: course.level,
          description: course.description,
          image: course.image,
          duration: course.duration,
          lessons: course.lessons,
          featured: course.featured,
        });
      }
    });

    return available;
  } catch (error) {
    console.error("Error fetching available courses:", error);
    return [];
  }
}

/**
 * Lấy thông tin chi tiết của một khóa học theo ID
 */
export async function getCourseById(courseId) {
  try {
    const courseRef = ref(database, `courses/${courseId}`);
    const snapshot = await get(courseRef);
    return snapshot.exists() ? { id: courseId, ...snapshot.val() } : null;
  } catch (error) {
    console.error("Error fetching course:", error);
    return null;
  }
}

/**
 * SOLUTION B: Gọi AI API với data structure mới
 * Gửi cả enrolledCourses (inProgress, notStarted, completed) và availableCourses
 */
export async function fetchAIRecommendations(
  preferences,
  enrolledCourses, // { inProgress, notStarted, completed }
  availableCourses,
) {
  try {
    // Debug: Log data being sent
    console.log("[Roadmap] Sending to API:", {
      preferences,
      inProgressCount: enrolledCourses?.inProgress?.length || 0,
      notStartedCount: enrolledCourses?.notStarted?.length || 0,
      completedCount: enrolledCourses?.completed?.length || 0,
      availableCoursesCount: availableCourses?.length || 0,
    });

    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "roadmap",
        preferences,
        enrolledCourses, // New structure: { inProgress, notStarted, completed }
        availableCourses,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("[Roadmap] API Error Response:", errorData);
      throw new Error(
        `API error: ${response.status} - ${errorData.error || "Unknown"}`,
      );
    }

    const data = await response.json();
    console.log("[Roadmap] API Success:", data);
    return data;
  } catch (error) {
    console.error("Error fetching AI recommendations:", error);
    return null;
  }
}

/**
 * Main function: Lấy lộ trình gợi ý cho user (SOLUTION B)
 * Gợi ý cả khóa đang học, chưa bắt đầu, và khóa mới
 * @param {string} userId - ID người dùng
 * @param {boolean} forceRefresh - Bỏ qua cache nếu true
 * @returns {Promise<Object>} - { recommendations, summary, courses }
 */
export async function getPersonalizedRoadmap(userId, forceRefresh = false) {
  // Check cache first
  if (!forceRefresh) {
    const cached = cacheManager.get(ROADMAP_CACHE_KEY(userId));
    if (cached) {
      console.log("Returning cached roadmap");
      return cached;
    }
  }

  try {
    // Fetch all required data in parallel
    const [preferences, enrolledWithProgress, enrolledIds] = await Promise.all([
      getUserPreferences(userId),
      getEnrolledCoursesWithProgress(userId),
      getEnrolledCourseIds(userId),
    ]);

    // Get available courses (chưa enroll)
    const availableCourses = await getAvailableCourses(enrolledIds);

    // Destructure enrolled courses
    const { inProgress, notStarted, completed } = enrolledWithProgress;

    console.log("[Roadmap] Course stats:", {
      inProgress: inProgress.length,
      notStarted: notStarted.length,
      available: availableCourses.length,
      completed: completed.length,
    });

    // Nếu không có gì để gợi ý
    const totalRecommendable = inProgress.length + notStarted.length + availableCourses.length;
    if (totalRecommendable === 0) {
      return {
        recommendations: [],
        summary: completed.length > 0
          ? `Tuyệt vời! Bạn đã hoàn thành ${completed.length} khóa học. Hãy quay lại sau để xem khóa mới!`
          : "Bạn đã đăng ký tất cả các khóa học hiện có!",
        courses: [],
        fromCache: false,
      };
    }

    // Call AI API với data mới
    const aiResult = await fetchAIRecommendations(
      preferences,
      { inProgress, notStarted, completed }, // Gửi cả 3 loại
      availableCourses,
    );

    if (!aiResult || !aiResult.recommendations) {
      // Fallback: dùng local scoring
      return getSmartRecommendations(inProgress, notStarted, availableCourses, preferences);
    }

    // Map courseIds to full course data từ tất cả các nguồn
    const allCourses = [...inProgress, ...notStarted, ...availableCourses];
    const recommendedCourses = [];
    
    for (const rec of aiResult.recommendations) {
      const course = allCourses.find((c) => c.id === rec.courseId);
      if (course) {
        recommendedCourses.push({
          ...course,
          reason: rec.reason,
        });
      }
    }

    const result = {
      recommendations: aiResult.recommendations,
      summary: aiResult.summary,
      courses: recommendedCourses,
      fromCache: false,
    };

    // Cache the result
    cacheManager.set(ROADMAP_CACHE_KEY(userId), result);

    return result;
  } catch (error) {
    console.error("Error getting personalized roadmap:", error);
    return null;
  }
}

/**
 * SOLUTION B: Smart recommendations with priority scoring
 * Ưu tiên: inProgress > notStarted > available
 * Matching: category + level
 */
function getSmartRecommendations(inProgress, notStarted, available, preferences) {
  const userLevel = preferences?.level || "beginner";
  const userInterests = preferences?.interests || [];

  // Category mapping để mở rộng matching
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

  // Scoring function
  const scoreCourse = (course, baseScore) => {
    let score = baseScore;
    const category = (course.category || "").toLowerCase();
    const level = (course.level || "").toLowerCase();

    // Category match (+100)
    if (expandedInterests.has(category)) score += 100;

    // Level match (+30 exact, +15 adjacent)
    if (level === userLevel) score += 30;
    else if (
      (userLevel === "beginner" && level === "intermediate") ||
      (userLevel === "intermediate" && (level === "beginner" || level === "advanced")) ||
      (userLevel === "advanced" && level === "intermediate")
    ) {
      score += 15;
    }

    // Progress bonus for inProgress courses
    if (course.progress && course.progress > 50) score += 50;

    // Featured bonus
    if (course.featured) score += 10;

    return { ...course, score, categoryMatched: expandedInterests.has(category) };
  };

  // Score all courses với base score theo loại
  const scoredInProgress = inProgress.map((c) => scoreCourse(c, 200));
  const scoredNotStarted = notStarted.map((c) => scoreCourse(c, 100));
  const scoredAvailable = available.map((c) => scoreCourse(c, 50));

  // Combine và sort
  const allScored = [...scoredInProgress, ...scoredNotStarted, ...scoredAvailable];
  allScored.sort((a, b) => b.score - a.score);

  // Lấy top 3
  const top = allScored.slice(0, 3);

  // Generate summary dựa trên kết quả
  let summary;
  const hasInProgress = scoredInProgress.length > 0;
  const topCategoryMatch = top.filter((c) => c.categoryMatched).length;

  if (hasInProgress && top[0].progress) {
    summary = `Bạn đang học ${top[0].title} (${top[0].progress}%). Hãy hoàn thành để tiếp tục lộ trình!`;
  } else if (topCategoryMatch > 0) {
    const interestText = userInterests.length > 0 ? userInterests[0] : "lập trình";
    summary = `Dựa trên sở thích ${interestText} và trình độ của bạn, đây là các khóa học gợi ý.`;
  } else {
    summary = "Đây là các khóa học phù hợp với trình độ hiện tại của bạn.";
  }

  // Generate reasons
  const recommendations = top.map((course) => {
    let reason;
    if (course.progress && course.progress > 0) {
      reason = `Bạn đã học ${course.progress}% - hãy hoàn thành!`;
    } else if (course.score >= 200 && course.categoryMatched) {
      reason = `Phù hợp với sở thích ${course.category} của bạn`;
    } else if (course.score >= 100) {
      reason = "Khóa học bạn đã đăng ký - bắt đầu ngay!";
    } else {
      reason = `Khóa học mới phù hợp trình độ ${course.level}`;
    }
    return { courseId: course.id, reason };
  });

  return {
    recommendations,
    summary,
    courses: top.map((c) => ({ ...c, reason: recommendations.find((r) => r.courseId === c.id)?.reason })),
    fromCache: false,
    isFallback: true,
  };
}

/**
 * Fallback recommendations khi AI không hoạt động (legacy - kept for compatibility)
 */
function getFallbackRecommendations(availableCourses, preferences) {
  // Redirect to new smart recommendations
  return getSmartRecommendations([], [], availableCourses, preferences);
}

/**
 * Clear roadmap cache for a user
 */
export function clearRoadmapCache(userId) {
  cacheManager.remove(ROADMAP_CACHE_KEY(userId));
}

export default {
  getUserPreferences,
  getCompletedCourses,
  getEnrolledCoursesWithProgress,
  getAvailableCourses,
  getPersonalizedRoadmap,
  clearRoadmapCache,
};
