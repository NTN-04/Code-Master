// Courses page functionality
document.addEventListener("DOMContentLoaded", function () {
  // Initialize progress bars
  initProgressBars();

  // Initialize course filtering
  initCourseFiltering();
});

// Initialize progress bars with stored values
function initProgressBars() {
  const progressBars = document.querySelectorAll(".progress-bar");

  progressBars.forEach((bar) => {
    const courseLink = bar
      .closest(".course-card")
      .querySelector('a[href^="courses/"]');
    if (courseLink) {
      const href = courseLink.getAttribute("href");
      const courseId = href.split("/").pop().replace(".html", "");

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

// Initialize course filtering and search
function initCourseFiltering() {
  const searchInput = document.getElementById("course-search");
  const levelFilter = document.getElementById("filter-level");
  const categoryFilter = document.getElementById("filter-category");
  const courseCards = document.querySelectorAll(".course-card");
  const noResults = document.querySelector(".no-results");

  // Function to filter courses based on search and filter criteria
  function filterCourses() {
    const searchTerm = searchInput.value.toLowerCase();
    const levelValue = levelFilter.value;
    const categoryValue = categoryFilter.value;

    let visibleCount = 0;

    courseCards.forEach((card) => {
      const title = card.querySelector("h3").textContent.toLowerCase();
      const description = card.querySelector("p").textContent.toLowerCase();
      const level = card.getAttribute("data-level");
      const category = card.getAttribute("data-category");

      // Check if card matches all criteria
      const matchesSearch =
        title.includes(searchTerm) || description.includes(searchTerm);
      const matchesLevel = levelValue === "all" || level === levelValue;
      const matchesCategory =
        categoryValue === "all" || category === categoryValue;

      // Show or hide the card based on matching criteria
      if (matchesSearch && matchesLevel && matchesCategory) {
        card.style.display = "block";
        visibleCount++;
      } else {
        card.style.display = "none";
      }
    });

    // Show or hide the "no results" message
    if (visibleCount === 0) {
      noResults.style.display = "flex";
      noResults.style.gap = "5px";
    } else {
      noResults.style.display = "none";
    }
  }

  // Add event listeners to inputs and selects
  searchInput.addEventListener("input", filterCourses);
  levelFilter.addEventListener("change", filterCourses);
  categoryFilter.addEventListener("change", filterCourses);

  // Apply animations to cards
  courseCards.forEach((card) => {
    card.classList.add("animated");
  });
}

// Calculate and update course completion based on completed lessons
function updateCourseCompletion(courseId) {
  // Get completed lessons for this course
  const completedLessons = JSON.parse(
    localStorage.getItem(`${courseId}-completed-lessons`) || "[]"
  );

  // In a real application, we would know the total number of lessons per course
  // For now, we'll use a hardcoded mapping
  const totalLessonsMap = {
    "html-css": 15,
    javascript: 18,
    react: 20,
    "react-native": 22,
    flutter: 25,
    sql: 14,
    mongodb: 16,
    python: 18,
    "machine-learning": 30,
  };

  const totalLessons = totalLessonsMap[courseId] || 15; // Default to 15 if not found

  // Calculate progress percentage
  const progressPercentage =
    totalLessons > 0
      ? Math.round((completedLessons.length / totalLessons) * 100)
      : 0;

  // Update progress in localStorage
  localStorage.setItem(`course-progress-${courseId}`, progressPercentage);

  // Update UI if on courses page
  const courseCard = document.querySelector(
    `.course-card a[href="courses/${courseId}.html"]`
  );
  if (courseCard) {
    const progressBar = courseCard
      .closest(".course-card")
      .querySelector(".progress-bar");
    if (progressBar) {
      const progressElement = progressBar.querySelector(".progress");
      const progressText = progressBar.nextElementSibling;

      if (progressElement && progressText) {
        progressElement.style.width = `${progressPercentage}%`;
        progressText.textContent = `${progressPercentage}% Hoàn Thành`;
      }
    }
  }

  return progressPercentage;
}

// Add course recommendation system (simplified version)
function recommendCourses() {
  // Get all courses the user has started
  const allCourses = [
    "html-css",
    "javascript",
    "react",
    "react-native",
    "flutter",
    "sql",
    "mongodb",
    "python",
    "machine-learning",
  ];
  const startedCourses = [];

  allCourses.forEach((courseId) => {
    const progress = parseInt(
      localStorage.getItem(`course-progress-${courseId}`) || "0"
    );
    if (progress > 0) {
      startedCourses.push({
        id: courseId,
        progress: progress,
      });
    }
  });

  // Sort by progress
  startedCourses.sort((a, b) => b.progress - a.progress);

  // Get related courses to recommend based on the most advanced course
  if (startedCourses.length > 0) {
    const topCourse = startedCourses[0].id;

    // Define related courses (in a real app, this would come from a recommendation engine)
    const relatedCoursesMap = {
      "html-css": ["javascript", "react"],
      javascript: ["react", "nodejs"],
      react: ["react-native", "redux"],
      "react-native": ["flutter", "mobile-design"],
      flutter: ["mobile-design", "dart"],
      sql: ["mongodb", "database-design"],
      mongodb: ["nodejs", "database-design"],
      python: ["machine-learning", "data-science"],
      "machine-learning": ["deep-learning", "ai-ethics"],
    };

    return relatedCoursesMap[topCourse] || [];
  }

  return [];
}
