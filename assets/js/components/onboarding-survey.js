/**
 * Onboarding Survey Component
 * Hiển thị khảo sát cho user mới để cá nhân hóa lộ trình học tập
 */

import { database } from "../firebaseConfig.js";
import {
  ref,
  update,
  get,
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-database.js";
import { showFloatingNotification as showToast } from "../utils/notifications.js";

// Load CSS dynamically
function loadSurveyCSS() {
  if (document.getElementById("onboarding-survey-css")) return;

  const rootPath = typeof getRootPath === "function" ? getRootPath() : "./";
  const link = document.createElement("link");
  link.id = "onboarding-survey-css";
  link.rel = "stylesheet";
  link.href = rootPath + "assets/css/onboarding.css";
  document.head.appendChild(link);
}

// Survey questions configuration
const SURVEY_QUESTIONS = [
  {
    id: "level",
    title: "Kinh nghiệm lập trình của bạn?",
    subtitle: "Giúp chúng tôi gợi ý khóa học phù hợp với trình độ của bạn",
    type: "single",
    options: [
      {
        value: "beginner",
        label: "Mới bắt đầu",
        icon: "fa-seedling",
        description: "Chưa biết gì về lập trình",
      },
      {
        value: "basic",
        label: "Biết cơ bản",
        icon: "fa-leaf",
        description: "Đã học qua HTML, CSS hoặc ngôn ngữ khác",
      },
      {
        value: "intermediate",
        label: "Trung cấp",
        icon: "fa-tree",
        description: "Có thể tự xây dựng dự án nhỏ",
      },
      {
        value: "advanced",
        label: "Nâng cao",
        icon: "fa-mountain",
        description: "Đã làm việc với nhiều công nghệ",
      },
    ],
  },
  {
    id: "interests",
    title: "Bạn muốn học lĩnh vực nào?",
    subtitle: "Chọn một hoặc nhiều lĩnh vực bạn quan tâm",
    type: "multiple",
    options: [
      {
        value: "web",
        label: "Phát triển Web",
        icon: "fa-globe",
        description: "HTML, CSS, JavaScript, React...",
      },
      {
        value: "mobile",
        label: "Ứng dụng Mobile",
        icon: "fa-mobile-alt",
        description: "React Native, Flutter...",
      },
      {
        value: "database",
        label: "Cơ sở dữ liệu",
        icon: "fa-database",
        description: "SQL, MongoDB...",
      },
      {
        value: "data-science",
        label: "Khoa học dữ liệu",
        icon: "fa-chart-line",
        description: "Python, Machine Learning...",
      },
    ],
  },
  {
    id: "goal",
    title: "Mục tiêu học tập của bạn?",
    subtitle: "Giúp chúng tôi ưu tiên nội dung phù hợp",
    type: "single",
    options: [
      {
        value: "job",
        label: "Tìm việc làm",
        icon: "fa-briefcase",
        description: "Xây dựng portfolio, chuẩn bị phỏng vấn",
      },
      {
        value: "upgrade",
        label: "Nâng cao kỹ năng",
        icon: "fa-arrow-up",
        description: "Học thêm công nghệ mới",
      },
      {
        value: "project",
        label: "Làm dự án cá nhân",
        icon: "fa-lightbulb",
        description: "Hiện thực hóa ý tưởng của bạn",
      },
      {
        value: "explore",
        label: "Khám phá",
        icon: "fa-compass",
        description: "Tìm hiểu xem lập trình có phù hợp không",
      },
    ],
  },
];

// Current state
let currentStep = 0;
let answers = {};
let surveyModal = null;
let currentUserId = null;
let isEditMode = false;

/**
 * Kiểm tra user đã làm survey chưa
 */
export async function checkUserPreferences(userId) {
  try {
    const userRef = ref(database, `users/${userId}/preferences`);
    const snapshot = await get(userRef);
    return snapshot.exists() ? snapshot.val() : null;
  } catch (error) {
    console.error("Error checking preferences:", error);
    return null;
  }
}

/**
 * Hiển thị survey modal
 */
export function showOnboardingSurvey(userId, options = {}) {
  // Load CSS first
  loadSurveyCSS();

  currentUserId = userId;
  currentStep = 0;
  answers = {};
  isEditMode = options.editMode || false;

  // Nếu edit mode, load existing preferences
  if (isEditMode && options.existingPreferences) {
    answers = { ...options.existingPreferences };
  }

  createSurveyModal();
  renderCurrentStep();

  // Show modal
  surveyModal.classList.add("show");
  document.body.style.overflow = "hidden";
}

/**
 * Tạo modal HTML
 */
function createSurveyModal() {
  // Remove existing modal if any
  const existing = document.getElementById("onboarding-survey-modal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "onboarding-survey-modal";
  modal.className = "onboarding-modal";
  modal.innerHTML = `
    <div class="onboarding-modal-content">
      <div class="onboarding-header">
        <div class="onboarding-logo">
          <i class="fas fa-robot"></i>
          <span>AI Roadmap</span>
        </div>
        <button class="onboarding-skip" id="survey-skip">
          ${isEditMode ? "Hủy" : "Bỏ qua"} <i class="fas fa-times"></i>
        </button>
      </div>
      
      <div class="onboarding-progress">
        ${SURVEY_QUESTIONS.map(
          (_, i) => `
          <div class="progress-dot ${i === 0 ? "active" : ""}" data-step="${i}"></div>
        `,
        ).join("")}
      </div>
      
      <div class="onboarding-body" id="survey-body">
        <!-- Content rendered dynamically -->
      </div>
      
      <div class="onboarding-footer">
        <button class="btn-survey btn-prev" id="survey-prev" style="visibility: hidden;">
          <i class="fas fa-arrow-left"></i> Quay lại
        </button>
        <button class="btn-survey btn-next" id="survey-next">
          Tiếp tục <i class="fas fa-arrow-right"></i>
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  surveyModal = modal;

  // Event listeners
  document.getElementById("survey-skip").onclick = handleSkip;
  document.getElementById("survey-prev").onclick = handlePrev;
  document.getElementById("survey-next").onclick = handleNext;

  // Close on backdrop click (only in edit mode)
  if (isEditMode) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeSurvey();
    });
  }
}

/**
 * Render step hiện tại
 */
function renderCurrentStep() {
  const question = SURVEY_QUESTIONS[currentStep];
  const body = document.getElementById("survey-body");

  // Update progress dots
  document.querySelectorAll(".progress-dot").forEach((dot, i) => {
    dot.classList.toggle("active", i <= currentStep);
    dot.classList.toggle("completed", i < currentStep);
  });

  // Update buttons
  const prevBtn = document.getElementById("survey-prev");
  const nextBtn = document.getElementById("survey-next");

  prevBtn.style.visibility = currentStep > 0 ? "visible" : "hidden";

  const isLastStep = currentStep === SURVEY_QUESTIONS.length - 1;
  nextBtn.innerHTML = isLastStep
    ? `Hoàn thành <i class="fas fa-check"></i>`
    : `Tiếp tục <i class="fas fa-arrow-right"></i>`;

  // Render question
  body.innerHTML = `
    <div class="survey-question">
      <h2 class="question-title">${question.title}</h2>
      <p class="question-subtitle">${question.subtitle}</p>
      
      <div class="options-grid ${question.type === "multiple" ? "multi-select" : ""}">
        ${question.options
          .map(
            (opt) => `
          <div class="option-card ${isOptionSelected(question.id, opt.value) ? "selected" : ""}" 
               data-value="${opt.value}">
            <div class="option-icon">
              <i class="fas ${opt.icon}"></i>
            </div>
            <div class="option-content">
              <span class="option-label">${opt.label}</span>
              <span class="option-desc">${opt.description}</span>
            </div>
            ${
              question.type === "multiple"
                ? `<div class="option-checkbox">
                <i class="fas fa-check"></i>
              </div>`
                : ""
            }
          </div>
        `,
          )
          .join("")}
      </div>
    </div>
  `;

  // Add click handlers to options
  body.querySelectorAll(".option-card").forEach((card) => {
    card.onclick = () => handleOptionClick(question, card.dataset.value);
  });
}

/**
 * Kiểm tra option đã được chọn chưa
 */
function isOptionSelected(questionId, value) {
  const answer = answers[questionId];
  if (Array.isArray(answer)) {
    return answer.includes(value);
  }
  return answer === value;
}

/**
 * Xử lý click option
 */
function handleOptionClick(question, value) {
  if (question.type === "multiple") {
    // Multiple selection
    if (!answers[question.id]) {
      answers[question.id] = [];
    }
    const index = answers[question.id].indexOf(value);
    if (index > -1) {
      answers[question.id].splice(index, 1);
    } else {
      answers[question.id].push(value);
    }
  } else {
    // Single selection
    answers[question.id] = value;
  }

  renderCurrentStep();
}

/**
 * Xử lý nút Previous
 */
function handlePrev() {
  if (currentStep > 0) {
    currentStep--;
    renderCurrentStep();
  }
}

/**
 * Xử lý nút Next/Complete
 */
async function handleNext() {
  const question = SURVEY_QUESTIONS[currentStep];

  // Validate current step
  const answer = answers[question.id];
  if (!answer || (Array.isArray(answer) && answer.length === 0)) {
    showToast("Vui lòng chọn một câu trả lời", "warning");
    return;
  }

  if (currentStep < SURVEY_QUESTIONS.length - 1) {
    // Go to next step
    currentStep++;
    renderCurrentStep();
  } else {
    // Complete survey
    await saveSurveyResults();
  }
}

/**
 * Xử lý skip survey
 */
function handleSkip() {
  if (isEditMode) {
    closeSurvey();
    return;
  }

  // Confirm skip
  if (
    confirm("Bỏ qua khảo sát? Bạn vẫn có thể cập nhật sau trong trang cá nhân.")
  ) {
    // Lưu flag để không hiện lại survey
    if (currentUserId) {
      localStorage.setItem(`survey_skipped_${currentUserId}`, "true");
    }

    closeSurvey();
    showToast("Bạn có thể cập nhật sở thích học tập trong Profile", "info");
  }
}

/**
 * Lưu kết quả survey vào Firebase
 */
async function saveSurveyResults() {
  if (!currentUserId) {
    showToast("Có lỗi xảy ra, vui lòng thử lại", "error");
    return;
  }

  const nextBtn = document.getElementById("survey-next");
  nextBtn.disabled = true;
  nextBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Đang lưu...`;

  try {
    const preferences = {
      level: answers.level || "beginner",
      interests: answers.interests || ["web"],
      goal: answers.goal || "explore",
      surveyCompletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const userRef = ref(database, `users/${currentUserId}`);
    await update(userRef, { preferences });

    // Update localStorage
    const userData = JSON.parse(
      localStorage.getItem("codemaster_user") || "{}",
    );
    userData.preferences = preferences;
    localStorage.setItem("codemaster_user", JSON.stringify(userData));

    // Xóa flag skip nếu có (user đã hoàn thành survey)
    localStorage.removeItem(`survey_skipped_${currentUserId}`);

    showToast(
      isEditMode
        ? "Đã cập nhật sở thích học tập!"
        : "Chào mừng bạn! Lộ trình học tập đã được cá nhân hóa.",
      "success",
    );

    closeSurvey();

    // Dispatch event for other components to react
    window.dispatchEvent(
      new CustomEvent("preferencesUpdated", { detail: preferences }),
    );
  } catch (error) {
    console.error("Error saving preferences:", error);
    showToast("Có lỗi khi lưu, vui lòng thử lại", "error");
    nextBtn.disabled = false;
    nextBtn.innerHTML = `Hoàn thành <i class="fas fa-check"></i>`;
  }
}

/**
 * Đóng survey modal
 */
function closeSurvey() {
  if (surveyModal) {
    surveyModal.classList.remove("show");
    document.body.style.overflow = "";
    setTimeout(() => {
      surveyModal.remove();
      surveyModal = null;
    }, 300);
  }
}

// Export for global access
export default {
  checkUserPreferences,
  showOnboardingSurvey,
};
