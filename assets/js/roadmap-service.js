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
 * Gọi AI API để lấy gợi ý lộ trình
 */
export async function fetchAIRecommendations(
  preferences,
  completedCourses,
  availableCourses,
) {
  try {
    // Debug: Log data being sent
    console.log("[Roadmap] Sending to API:", {
      preferences,
      completedCoursesCount: completedCourses?.length || 0,
      availableCoursesCount: availableCourses?.length || 0,
    });

    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "roadmap",
        preferences,
        completedCourses,
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
 * Main function: Lấy lộ trình gợi ý cho user
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
    const [preferences, completedCourses, enrolledIds] = await Promise.all([
      getUserPreferences(userId),
      getCompletedCourses(userId),
      getEnrolledCourseIds(userId),
    ]);

    // Get available courses (excluding enrolled)
    const availableCourses = await getAvailableCourses(enrolledIds);

    if (availableCourses.length === 0) {
      return {
        recommendations: [],
        summary: "Bạn đã đăng ký tất cả các khóa học hiện có!",
        courses: [],
        fromCache: false,
      };
    }

    // Call AI API
    const aiResult = await fetchAIRecommendations(
      preferences,
      completedCourses,
      availableCourses,
    );

    if (!aiResult || !aiResult.recommendations) {
      // Fallback: return featured/beginner courses
      return getFallbackRecommendations(availableCourses, preferences);
    }

    // Map courseIds to full course data
    const recommendedCourses = [];
    for (const rec of aiResult.recommendations) {
      const course = availableCourses.find((c) => c.id === rec.courseId);
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
 * Fallback recommendations khi AI không hoạt động
 */
function getFallbackRecommendations(availableCourses, preferences) {
  let recommended = [...availableCourses];

  // Filter by user interests if available
  if (preferences?.interests?.length > 0) {
    const filtered = recommended.filter((c) =>
      preferences.interests.includes(c.category),
    );
    if (filtered.length > 0) recommended = filtered;
  }

  // Sort by level based on user level
  const levelOrder = {
    beginner: ["beginner", "intermediate", "advanced"],
    basic: ["beginner", "intermediate", "advanced"],
    intermediate: ["intermediate", "advanced", "beginner"],
    advanced: ["advanced", "intermediate", "beginner"],
  };

  const userLevel = preferences?.level || "beginner";
  const order = levelOrder[userLevel] || levelOrder.beginner;

  recommended.sort((a, b) => {
    const aIdx = order.indexOf(a.level);
    const bIdx = order.indexOf(b.level);
    // Featured courses first
    if (a.featured && !b.featured) return -1;
    if (!a.featured && b.featured) return 1;
    return aIdx - bIdx;
  });

  // Take top 3
  const topCourses = recommended.slice(0, 3).map((course) => ({
    ...course,
    reason: "Khóa học phổ biến phù hợp với trình độ của bạn",
  }));

  return {
    recommendations: topCourses.map((c) => ({
      courseId: c.id,
      reason: c.reason,
    })),
    summary:
      "Dựa trên trình độ và sở thích của bạn, đây là những khóa học gợi ý.",
    courses: topCourses,
    fromCache: false,
    isFallback: true,
  };
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
  getAvailableCourses,
  getPersonalizedRoadmap,
  clearRoadmapCache,
};
