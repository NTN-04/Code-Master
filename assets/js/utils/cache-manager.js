/**
 * Cache Manager - Quản lý cache dữ liệu khóa học
 * Sử dụng sessionStorage để cache trong phiên làm việc
 * Tự động invalidate cache sau thời gian nhất định
 */

const CACHE_PREFIX = "codemaster_";
const CACHE_DURATION = 15 * 60 * 1000; // 15 phút

export const cacheManager = {
  /**
   * Lưu dữ liệu vào cache
   * @param {string} key - Khóa cache
   * @param {any} data - Dữ liệu cần cache
   */
  set(key, data) {
    try {
      const cacheData = {
        data: data,
        timestamp: Date.now(),
        version: "1.0", // Để invalidate cache khi cần
      };
      sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify(cacheData));
    } catch (error) {
      console.warn("Cache set failed:", error);
      // Nếu storage đầy, xóa cache cũ
      this.clearOldCache();
    }
  },

  /**
   * Lấy dữ liệu từ cache
   * @param {string} key - Khóa cache
   * @returns {any|null} - Dữ liệu hoặc null nếu không tồn tại/hết hạn
   */
  get(key) {
    try {
      const cached = sessionStorage.getItem(CACHE_PREFIX + key);
      if (!cached) return null;

      const cacheData = JSON.parse(cached);
      const age = Date.now() - cacheData.timestamp;

      // Kiểm tra thời gian hết hạn
      if (age > CACHE_DURATION) {
        this.remove(key);
        return null;
      }

      return cacheData.data;
    } catch (error) {
      console.warn("Cache get failed:", error);
      return null;
    }
  },

  /**
   * Xóa một cache cụ thể
   * @param {string} key - Khóa cache cần xóa
   */
  remove(key) {
    try {
      sessionStorage.removeItem(CACHE_PREFIX + key);
    } catch (error) {
      console.warn("Cache remove failed:", error);
    }
  },

  /**
   * Xóa tất cả cache cũ hơn thời gian cho phép
   */
  clearOldCache() {
    try {
      const keys = Object.keys(sessionStorage);
      keys.forEach((key) => {
        if (key.startsWith(CACHE_PREFIX)) {
          const cached = sessionStorage.getItem(key);
          if (cached) {
            try {
              const cacheData = JSON.parse(cached);
              const age = Date.now() - cacheData.timestamp;
              if (age > CACHE_DURATION) {
                sessionStorage.removeItem(key);
              }
            } catch (e) {
              // Xóa cache lỗi
              sessionStorage.removeItem(key);
            }
          }
        }
      });
    } catch (error) {
      console.warn("Clear old cache failed:", error);
    }
  },

  /**
   * Xóa toàn bộ cache
   */
  clearAll() {
    try {
      const keys = Object.keys(sessionStorage);
      keys.forEach((key) => {
        if (key.startsWith(CACHE_PREFIX)) {
          sessionStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.warn("Clear all cache failed:", error);
    }
  },

  /**
   * Kiểm tra xem cache có tồn tại và còn hạn không
   * @param {string} key - Khóa cache
   * @returns {boolean}
   */
  has(key) {
    return this.get(key) !== null;
  },

  /**
   * Lấy thời gian còn lại của cache (ms)
   * @param {string} key - Khóa cache
   * @returns {number} - Thời gian còn lại hoặc 0
   */
  getRemainingTime(key) {
    try {
      const cached = sessionStorage.getItem(CACHE_PREFIX + key);
      if (!cached) return 0;

      const cacheData = JSON.parse(cached);
      const age = Date.now() - cacheData.timestamp;
      const remaining = CACHE_DURATION - age;

      return remaining > 0 ? remaining : 0;
    } catch (error) {
      return 0;
    }
  },

  /**
   * Clear cache theo pattern
   * @param {string} pattern - Pattern để match (ví dụ: "enrollment_userId")
   */
  clearByPattern(pattern) {
    try {
      const keys = Object.keys(sessionStorage);
      const fullPattern = CACHE_PREFIX + pattern;
      let cleared = 0;

      keys.forEach((key) => {
        if (key.startsWith(fullPattern)) {
          sessionStorage.removeItem(key);
          cleared++;
        }
      });

      if (cleared > 0) {
      }
    } catch (error) {
      console.warn("Clear by pattern failed:", error);
    }
  },

  /**
   * Clear tất cả cache liên quan đến user
   * @param {string} userId - User ID
   */
  clearUserCache(userId) {
    try {
      const patterns = [
        `enrollment_${userId}`,
        `user_profile_${userId}`,
        `user_progress_${userId}`,
        `user_enrollments_${userId}`,
        `user_stats_${userId}`,
      ];

      let totalCleared = 0;
      patterns.forEach((pattern) => {
        const keys = Object.keys(sessionStorage);
        keys.forEach((key) => {
          if (key.startsWith(CACHE_PREFIX + pattern)) {
            sessionStorage.removeItem(key);
            totalCleared++;
          }
        });
      });
    } catch (error) {
      console.warn("Clear user cache failed:", error);
    }
  },
};

// Export các hằng số để sử dụng ở nơi khác
export const CACHE_KEYS = {
  // Courses
  COURSE_DATA: (courseId) => `course_${courseId}`,
  COURSE_MODULES: (courseId) => `modules_${courseId}`,
  ALL_COURSES: "all_courses",

  // User-specific (🔒 Security: Clear on logout/switch)
  ENROLLMENT_STATUS: (userId, courseId) => `enrollment_${userId}_${courseId}`,
  USER_PROFILE: (userId) => `user_profile_${userId}`,
  USER_PROGRESS: (userId) => `user_progress_${userId}`,
  USER_ENROLLMENTS: (userId) => `user_enrollments_${userId}`,
  USER_STATS: (userId) => `user_stats_${userId}`,

  // Public data
  CATEGORIES: "categories",
  LEARNING_PATHS: "learning_paths",
};
