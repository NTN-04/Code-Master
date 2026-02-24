/**
 * Roadmap Widget Component
 * Hiển thị gợi ý lộ trình học tập cá nhân hóa bằng AI
 */

import {
  getPersonalizedRoadmap,
  clearRoadmapCache,
} from "../roadmap-service.js";
import { loadingSkeleton } from "../utils/loading-skeleton.js";
import {
  showOnboardingSurvey,
  checkUserPreferences,
} from "./onboarding-survey.js";

// Widget state
let widgetContainer = null;
let currentUserId = null;

/**
 * Khởi tạo roadmap widget
 * @param {string} containerId - ID của container element
 * @param {string} userId - ID người dùng
 */
export async function initRoadmapWidget(containerId, userId) {
  widgetContainer = document.getElementById(containerId);
  if (!widgetContainer) {
    console.warn("Roadmap widget container not found:", containerId);
    return;
  }

  currentUserId = userId;

  // Render widget structure
  renderWidgetStructure();

  // Load recommendations
  await loadRecommendations();

  // Listen for preferences update
  window.addEventListener("preferencesUpdated", handlePreferencesUpdated);
}

/**
 * Render cấu trúc widget
 */
function renderWidgetStructure() {
  widgetContainer.innerHTML = `
    <div class="roadmap-widget">
      <div class="roadmap-header">
        <div class="roadmap-title">
          <i class="fas fa-robot"></i>
          <h3>Lộ trình dành cho bạn</h3>
        </div>
        <button class="roadmap-refresh" id="roadmap-refresh" title="Làm mới gợi ý">
          <i class="fas fa-sync-alt"></i>
        </button>
      </div>
      <div class="roadmap-summary" id="roadmap-summary"></div>
      <div class="roadmap-courses" id="roadmap-courses"></div>
      <div class="roadmap-actions" id="roadmap-actions"></div>
    </div>
  `;

  // Add refresh handler
  const refreshBtn = document.getElementById("roadmap-refresh");
  if (refreshBtn) {
    refreshBtn.onclick = handleRefresh;
  }
}

/**
 * Load recommendations từ service
 */
async function loadRecommendations() {
  const coursesContainer = document.getElementById("roadmap-courses");
  const summaryContainer = document.getElementById("roadmap-summary");
  const actionsContainer = document.getElementById("roadmap-actions");

  if (!coursesContainer) return;

  // Show skeleton loading
  coursesContainer.innerHTML = `
    <div class="roadmap-skeleton">
      ${Array(2)
        .fill(
          `
        <div class="skeleton-card">
          <div class="skeleton-image"></div>
          <div class="skeleton-content">
            <div class="skeleton-title"></div>
            <div class="skeleton-text"></div>
            <div class="skeleton-badge"></div>
          </div>
        </div>
      `,
        )
        .join("")}
    </div>
  `;
  summaryContainer.innerHTML = `<div class="skeleton-text wide"></div>`;

  try {
    // Check if user has preferences
    const preferences = await checkUserPreferences(currentUserId);

    if (!preferences) {
      // Show prompt to complete survey
      renderNoPreferencesState(
        coursesContainer,
        summaryContainer,
        actionsContainer,
      );
      return;
    }

    // Fetch recommendations
    const result = await getPersonalizedRoadmap(currentUserId);

    if (!result || result.courses.length === 0) {
      renderEmptyState(coursesContainer, summaryContainer);
      return;
    }

    // Render results
    renderRecommendations(
      result,
      coursesContainer,
      summaryContainer,
      actionsContainer,
    );
  } catch (error) {
    console.error("Error loading recommendations:", error);
    renderErrorState(coursesContainer, summaryContainer);
  }
}

/**
 * Render khi chưa có preferences
 */
function renderNoPreferencesState(
  coursesContainer,
  summaryContainer,
  actionsContainer,
) {
  summaryContainer.innerHTML = `
    <p class="roadmap-prompt">
      <i class="fas fa-lightbulb"></i>
      Hãy cho chúng tôi biết về bạn để nhận gợi ý học tập phù hợp!
    </p>
  `;

  coursesContainer.innerHTML = `
    <div class="roadmap-no-preferences">
      <div class="no-pref-icon">
        <i class="fas fa-user-graduate"></i>
      </div>
      <p>Hoàn thành khảo sát nhanh (30 giây) để AI gợi ý lộ trình học phù hợp với bạn.</p>
    </div>
  `;

  actionsContainer.innerHTML = `
    <button class="btn-start-survey" id="btn-start-survey">
      <i class="fas fa-clipboard-list"></i>
      Bắt đầu khảo sát
    </button>
  `;

  document.getElementById("btn-start-survey").onclick = () => {
    showOnboardingSurvey(currentUserId);
  };
}

/**
 * Render recommendations
 */
function renderRecommendations(
  result,
  coursesContainer,
  summaryContainer,
  actionsContainer,
) {
  // Summary
  summaryContainer.innerHTML = `
    <p class="ai-summary">
      <i class="fas fa-magic"></i>
      ${result.summary}
      ${result.fromCache ? '<span class="cache-badge">Từ bộ nhớ đệm</span>' : ""}
    </p>
  `;

  // Course cards
  const coursesHTML = result.courses
    .map((course) => createRecommendationCard(course))
    .join("");
  coursesContainer.innerHTML = `<div class="roadmap-grid">${coursesHTML}</div>`;

  // Update preferences button
  actionsContainer.innerHTML = `
    <button class="btn-update-preferences" id="btn-update-preferences">
      <i class="fas fa-sliders-h"></i>
      Cập nhật sở thích
    </button>
  `;

  document.getElementById("btn-update-preferences").onclick = async () => {
    const prefs = await checkUserPreferences(currentUserId);
    showOnboardingSurvey(currentUserId, {
      editMode: true,
      existingPreferences: prefs,
    });
  };
}

/**
 * Tạo card gợi ý khóa học
 */
function createRecommendationCard(course) {
  const rootPath = typeof getRootPath === "function" ? getRootPath() : "./";
  const introUrl = `${rootPath}course-intro.html?id=${course.id}`;

  // Level mapping
  const levelMap = {
    beginner: { text: "Người mới", class: "beginner" },
    intermediate: { text: "Trung cấp", class: "intermediate" },
    advanced: { text: "Nâng cao", class: "advanced" },
  };
  const level = levelMap[course.level] || { text: course.level, class: "" };

  return `
    <div class="recommendation-card">
      <a href="${introUrl}" class="rec-card-link">
        <div class="rec-card-image">
          <img src="${course.image}" alt="${course.title}" loading="lazy" />
          <span class="rec-level-badge ${level.class}">${level.text}</span>
        </div>
        <div class="rec-card-content">
          <h4 class="rec-card-title">${course.title}</h4>
          <div class="rec-card-meta">
            <span><i class="far fa-clock"></i> ${course.duration}</span>
            <span><i class="far fa-file-alt"></i> ${course.lessons} bài</span>
          </div>
          <div class="rec-card-reason">
            <i class="fas fa-robot"></i>
            <span>${course.reason}</span>
          </div>
        </div>
      </a>
    </div>
  `;
}

/**
 * Render empty state
 */
function renderEmptyState(coursesContainer, summaryContainer) {
  summaryContainer.innerHTML = "";
  coursesContainer.innerHTML = `
    <div class="roadmap-empty">
      <i class="fas fa-graduation-cap"></i>
      <p>Bạn đã khám phá hết các khóa học! Hãy quay lại sau để xem khóa mới.</p>
    </div>
  `;
}

/**
 * Render error state
 */
function renderErrorState(coursesContainer, summaryContainer) {
  summaryContainer.innerHTML = "";
  coursesContainer.innerHTML = `
    <div class="roadmap-error">
      <i class="fas fa-exclamation-triangle"></i>
      <p>Không thể tải gợi ý. Vui lòng thử lại sau.</p>
      <button class="btn-retry" onclick="document.getElementById('roadmap-refresh').click()">
        <i class="fas fa-redo"></i> Thử lại
      </button>
    </div>
  `;
}

/**
 * Handle refresh
 */
async function handleRefresh() {
  const refreshBtn = document.getElementById("roadmap-refresh");
  if (refreshBtn) {
    refreshBtn.classList.add("spinning");
    refreshBtn.disabled = true;
  }

  // Clear cache and reload
  clearRoadmapCache(currentUserId);
  await loadRecommendations();

  if (refreshBtn) {
    refreshBtn.classList.remove("spinning");
    refreshBtn.disabled = false;
  }
}

/**
 * Handle preferences updated event
 */
function handlePreferencesUpdated(event) {
  // Clear cache and reload recommendations
  clearRoadmapCache(currentUserId);
  loadRecommendations();
}

/**
 * Destroy widget
 */
export function destroyRoadmapWidget() {
  window.removeEventListener("preferencesUpdated", handlePreferencesUpdated);
  if (widgetContainer) {
    widgetContainer.innerHTML = "";
    widgetContainer = null;
  }
  currentUserId = null;
}

export default {
  initRoadmapWidget,
  destroyRoadmapWidget,
};
