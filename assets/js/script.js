// DOM Elements
document.addEventListener("DOMContentLoaded", function () {
  // Progress Bar Initialization
  initProgressBars();

  // Animation on scroll
  initScrollAnimations();
});

// Initialize progress bars with stored values or defaults
function initProgressBars() {
  const progressBars = document.querySelectorAll(".progress-bar");

  progressBars.forEach((bar) => {
    const courseId = getCourseIdFromBar(bar);
    const storedProgress =
      localStorage.getItem(`course-progress-${courseId}`) || 0;
    const progressValue = parseInt(storedProgress);

    updateProgressBar(bar, progressValue);
  });
}

// Get course ID from the progress bar or its parent elements
function getCourseIdFromBar(bar) {
  // Find the closest parent course card and get its ID or use a default ID
  const courseCard = bar.closest(".course-card");
  if (courseCard) {
    const courseLink = courseCard.querySelector('a[href^="courses/"]');
    if (courseLink) {
      // Extract course ID from the href attribute
      const href = courseLink.getAttribute("href");
      return href.split("/").pop().replace(".html", "");
    }
  }

  // If we can't find a proper ID, generate one based on the bar's position
  const allBars = document.querySelectorAll(".progress-bar");
  return Array.from(allBars).indexOf(bar).toString();
}

// Update progress bar width and text
function updateProgressBar(bar, progressValue) {
  const progressElement = bar.querySelector(".progress");
  const progressText = bar.nextElementSibling;

  if (progressElement && progressText) {
    progressElement.style.width = `${progressValue}%`;
    progressText.textContent = `${progressValue}% Hoàn Thành`;
  }

  // Also update the data attribute for future reference
  bar.setAttribute("data-progress", progressValue);
}

// Simulate progress update (this would be called from course pages)
function updateCourseProgress(courseId, newProgress) {
  localStorage.setItem(`course-progress-${courseId}`, newProgress);

  // If we're on a page with progress bars, update them
  const progressBars = document.querySelectorAll(".progress-bar");
  progressBars.forEach((bar) => {
    const barCourseId = getCourseIdFromBar(bar);
    if (barCourseId === courseId) {
      updateProgressBar(bar, newProgress);
    }
  });
}

// Animation on scroll
function initScrollAnimations() {
  const elementsToAnimate = document.querySelectorAll(
    ".course-card, .path-card, .resource-card"
  );

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("animated");
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.1,
    }
  );

  elementsToAnimate.forEach((element) => {
    observer.observe(element);
  });
}

// Navigation active link handling
// document.querySelectorAll("nav a").forEach((link) => {
//   if (link.getAttribute("href") === location.pathname.split("/").pop()) {
//     link.classList.add("active");
//   }
// });

// Search functionality (for future implementation)
function searchCourses(query) {
  // This function would be implemented when we have a search feature
  console.log(`Đang tìm kiếm: ${query}`);
  // Implementation would filter courses based on the query
}

// Sample function to simulate course completion for demo purposes
function completeCourseDemo(courseId, percentage) {
  updateCourseProgress(courseId, percentage);

  // Show a congratulatory message if course is complete
  if (percentage >= 100) {
    alert(`Chúc mừng! Bạn đã hoàn thành khóa học.`);
  }
}
