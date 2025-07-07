import { auth, database } from "./firebaseConfig.js";
import {
  ref,
  get,
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-database.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-auth.js";

const progressManager = {
  currentUser: null,

  initAuth() {
    onAuthStateChanged(auth, (user) => {
      this.currentUser = user;
      this.initProgressBars();
    });
  },

  async initProgressBars(selector = ".progress-bar") {
    const bars = document.querySelectorAll(selector);
    if (!bars.length) return;

    if (!this.currentUser) {
      // Ẩn progress bar khi chưa đăng nhập
      bars.forEach((bar) => {
        const progressContainer = bar.closest(".progress-container");
        if (progressContainer) progressContainer.style.display = "none";
      });
      return;
    }

    for (const bar of bars) {
      const courseId = bar.getAttribute("data-course-id");
      if (!courseId) continue;
      try {
        const progressRef = ref(
          database,
          `userProgress/${this.currentUser.uid}/courses/${courseId}/progress`
        );
        const snapshot = await get(progressRef);
        const progressValue = snapshot.exists() ? snapshot.val() : 0;
        this.updateProgressBarUI(bar, progressValue);
      } catch (err) {
        this.updateProgressBarUI(bar, 0);
      }
    }
  },

  updateProgressBarUI(bar, progressValue) {
    const progressContainer = bar.closest(".progress-container");
    const progressElement = bar.querySelector(".progress");
    const progressText = bar.nextElementSibling;
    // Luôn hiển thị progress bar nếu đã đăng nhập
    if (progressContainer) {
      progressContainer.style.display = "block";
    }
    if (progressElement && progressText) {
      progressElement.style.width = `${progressValue}%`;
      progressText.textContent = `${progressValue}% Hoàn Thành`;
    }
    bar.setAttribute("data-progress", progressValue);
  },
};

export default progressManager;
