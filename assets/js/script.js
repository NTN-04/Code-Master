// DOM Elements
document.addEventListener("DOMContentLoaded", function () {
  // Khởi tạo thanh tiến trình
  initProgressBars();

  // Animation on scroll
  initScrollAnimations();
});

// Khởi tạo thanh tiến trình với giá trị đã lưu
function initProgressBars() {
  const progressBars = document.querySelectorAll(".progress-bar");

  progressBars.forEach((bar) => {
    const courseId = bar.getAttribute("data-course-id");

    if (courseId) {
      const storedProgress =
        localStorage.getItem(`course-progress-${courseId}`) || 0;
      const progressValue = parseInt(storedProgress);

      const progressElement = bar.querySelector(".progress");
      const progressText = bar.nextElementSibling;

      if (progressElement && progressText) {
        progressElement.style.width = `${progressValue}%`;
        progressText.textContent = `${progressValue}% Hoàn Thành`;
      }

      bar.setAttribute("data-progress", progressValue);
    }
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

// Search functionality (for future implementation)
function searchCourses(query) {
  // This function would be implemented when we have a search feature
  console.log(`Đang tìm kiếm: ${query}`);
  // Implementation would filter courses based on the query
}
