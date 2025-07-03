import { database } from "../firebaseConfig.js";
import {
  ref,
  get,
  set,
  update,
  remove,
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-database.js";

export default class CoursesManager {
  constructor(adminPanel) {
    this.adminPanel = adminPanel;
    this.courses = [];
    this.currentManagingCourseId = null;
    this.currentManagingModuleId = null;
    this.currentManagingLessonIdx = null;
  }

  // Tải dữ liệu khóa học
  async loadData() {
    try {
      // Thử tải từ Firebase trước
      const coursesRef = ref(database, "courses");
      const snapshot = await get(coursesRef);

      if (snapshot.exists()) {
        // Lấy từ Firebase
        this.courses = Object.entries(snapshot.val()).map(([id, data]) => ({
          id,
          ...data,
        }));
      } else {
        // Nếu không có thì import từ file JSON vào Firebase
        await this.importCoursesToFirebase();
      }

      this.renderCoursesGrid();
    } catch (error) {
      console.error("Error loading courses:", error);
      this.adminPanel.showNotification("Lỗi tải dữ liệu khóa học", "error");
    }
  }

  async importCoursesToFirebase() {
    try {
      const response = await fetch("./data/db_courses.json");
      const data = await response.json();
      const courses = data.courses || [];

      // Import khóa học vào Firebase
      const coursesRef = ref(database, "courses");
      const coursesData = {};

      courses.forEach((course) => {
        coursesData[course.id] = {
          title: course.title,
          description: course.description,
          level: course.level,
          category: course.category,
          duration: course.duration,
          lessons: course.lessons,
          progress: course.progress || 0,
          image: course.image,
          tag: course.tag,
          url: course.url,
          createdAt: new Date().toISOString().slice(0, 10),
          updatedAt: new Date().toISOString().slice(0, 10),
          status: "active",
        };
      });

      await set(coursesRef, coursesData);
      this.courses = courses;

      this.adminPanel.showNotification(
        "Đã import khóa học vào Firebase",
        "success"
      );
    } catch (error) {
      console.error("Error importing courses:", error);
      this.adminPanel.showNotification("Lỗi import khóa học", "error");
    }
  }

  renderCoursesGrid() {
    const grid = document.getElementById("admin-courses-grid");
    if (!grid) return;

    grid.innerHTML = "";

    this.courses.forEach((course) => {
      const courseCard = this.createCourseCard(course);
      grid.appendChild(courseCard);
    });
  }

  createCourseCard(course) {
    const div = document.createElement("div");
    div.className = "admin-course-card";

    div.innerHTML = `
      <div class="course-card-image">
        <img src="${course.image}" alt="${
      course.title
    }" onerror="this.src='./assets/images/img-course/html-css.png'">
      </div>
      <div class="course-card-content">
        <h3 class="course-card-title">${course.title}</h3>
        <div class="course-card-meta">
          <span><i class="fas fa-signal"></i> ${this.getLevelText(
            course.level
          )}</span>
          <span><i class="fas fa-clock"></i> ${course.duration}</span>
          <span><i class="fas fa-book"></i> ${course.lessons} bài</span>
        </div>
        <p class="course-card-description line-clamp-2">${
          course.description
        }</p>
        <div class="course-card-actions">
          <div class="action-buttons">
            <button class="btn-action btn-edit" onclick="adminPanel.courses.editCourse('${
              course.id
            }')" title="Chỉnh sửa">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn-action btn-delete" onclick="adminPanel.courses.deleteCourse('${
              course.id
            }')" title="Xóa">
              <i class="fas fa-trash"></i>
            </button>
            <button class="btn-action btn-detail" onclick="adminPanel.courses.openCourseDetailManager('${
              course.id
            }')" title="Quản lý chi tiết">
              <i class="fas fa-tasks"></i>
            </button>
          </div>
        </div>
      </div>
    `;

    return div;
  }

  getLevelText(level) {
    const levels = {
      beginner: "Người mới",
      intermediate: "Trung cấp",
      advanced: "Nâng cao",
    };
    return levels[level] || level;
  }

  getCategoryText(category) {
    const categories = {
      web: "Phát Triển Web",
      mobile: "Phát Triển Mobile",
      data: "Khoa Học Dữ Liệu",
      ai: "Trí Tuệ Nhân Tạo",
    };
    return categories[category] || "Khác";
  }

  async editCourse(courseId) {
    const course = this.courses.find((c) => c.id === courseId);
    if (!course) return;

    // Đổ dữ liệu khóa học vào modal
    document.getElementById("course-id").value = courseId;
    document.getElementById("course-title").value = course.title || "";
    document.getElementById("course-description").value =
      course.description || "";
    document.getElementById("course-level").value = course.level || "beginner";
    document.getElementById("course-duration").value = course.duration || "";
    document.getElementById("course-lessons").value = course.lessons || "";
    document.getElementById("course-category").value = course.category || "web";
    document.getElementById("course-image").value = course.image || "";
    document.getElementById("course-featured").checked = !!course.featured;

    // Cập nhật tiêu đề modal
    document.getElementById("course-modal-title").textContent =
      "Chỉnh sửa khóa học";

    // Ẩn custom id và required
    document.getElementById("form-custom-id").style.display = "none";
    document.getElementById("course-custom-id").required = false;
    document.getElementById("form-featured").style.display = "flex"; // Hiện trường featured

    // Hiện modal
    this.adminPanel.showModal("course-modal");
  }

  async deleteCourse(courseId) {
    if (!confirm("Bạn có chắc chắn muốn xóa khóa học này?")) return;

    const course = this.courses.find((c) => c.id === courseId);

    try {
      const courseRef = ref(database, `courses/${courseId}`);
      await remove(courseRef);

      // Ghi log hoạt động
      await this.adminPanel.logActivity(
        "course",
        "Xóa khóa học",
        `Đã xóa khóa học "${course?.title || courseId}"`,
        "fas fa-trash"
      );

      this.adminPanel.showNotification("Đã xóa khóa học", "success");
      this.loadData();
    } catch (error) {
      console.error("Error deleting course:", error);
      this.adminPanel.showNotification("Lỗi xóa khóa học", "error");
    }
  }

  // Hiển thị modal thêm
  showAddModal() {
    // Xóa dữ liệu form
    document.getElementById("course-form").reset();
    document.getElementById("course-id").value = "";
    document.getElementById("form-custom-id").style.display = "block"; // Hiện id
    document.getElementById("course-custom-id").required = true;
    document.getElementById("form-featured").style.display = "none"; // Ẩn trường featured
    document.getElementById("course-modal-title").textContent = "Thêm khóa học";

    this.adminPanel.showModal("course-modal");
  }

  // Xử lý submit form thêm/sửa
  async handleFormSubmit(e) {
    e.preventDefault();

    const courseId = document.getElementById("course-id").value;
    const customId = document
      .getElementById("course-custom-id")
      ?.value.toLowerCase()
      .trim();

    const courseData = {
      title: document.getElementById("course-title").value,
      description: document.getElementById("course-description").value,
      level: document.getElementById("course-level").value,
      duration: document.getElementById("course-duration").value,
      lessons: parseInt(document.getElementById("course-lessons").value),
      category: document.getElementById("course-category").value,
      image: document.getElementById("course-image").value,
      updatedAt: new Date().toISOString().slice(0, 10),
    };

    try {
      if (courseId) {
        // Cập nhật khóa học đã có (edit course)
        courseData.featured =
          document.getElementById("course-featured").checked;

        const courseRef = ref(database, `courses/${courseId}`);
        await update(courseRef, courseData);
        // Ghi lại hoạt động
        await this.adminPanel.logActivity(
          "course",
          "Cập nhật khóa học",
          `Đã cập nhật khóa học mới ${courseData.title}`,
          "fas fa-edit"
        );
        this.adminPanel.showNotification(
          "Cập nhật khóa học thành công",
          "success"
        );
      } else {
        // Thêm khóa học mới
        const newCourseId = customId || `course-${Date.now()}`;
        const courseRef = ref(database, `courses/${newCourseId}`);
        await set(courseRef, {
          id: newCourseId,
          ...courseData,
          createdAt: new Date().toISOString().slice(0, 10),
          progress: 0,
          tag: this.getCategoryText(courseData.category),
          url: `courses/${newCourseId}.html`,
          featured: false,
        });

        // Ghi lại hoạt động
        await this.adminPanel.logActivity(
          "course",
          "Thêm khóa học",
          `Đã thêm khóa học mới ${courseData.title}`,
          "fas fa-book"
        );
        this.adminPanel.showNotification("Thêm khóa học thành công", "success");
      }

      this.adminPanel.hideModal("course-modal");
      this.loadData();
    } catch (error) {
      console.error("Error saving course:", error);
      this.adminPanel.showNotification("Lỗi lưu khóa học", "error");
    }
  }

  // Quản lý chi tiết cho khóa học
  async openCourseDetailManager(courseId) {
    // Lưu courseId đang quản lý
    this.currentManagingCourseId = courseId;
    // Hiện modal
    this.adminPanel.showModal("course-detail-modal");
    // Load dữ liệu module/bài học/quiz
    await this.loadCourseModules(courseId);
  }

  // Load module/bài học/quiz từ Firebase
  async loadCourseModules(courseId) {
    const modulesContainer = document.getElementById("course-modules-list");
    if (!modulesContainer) return;
    modulesContainer.innerHTML =
      '<div class="loading-courses"><span class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></span> Đang tải module...</div>';
    try {
      const modulesRef = ref(database, `course_modules/${courseId}`);
      const snapshot = await get(modulesRef);
      modulesContainer.innerHTML = "";
      if (snapshot.exists()) {
        const modules = Object.entries(snapshot.val()).map(([id, data]) => ({
          id,
          ...data,
        }));
        modules.forEach((module) => {
          const moduleDiv = document.createElement("div");
          moduleDiv.className = "admin-module-item";
          moduleDiv.innerHTML = `
            <div class="module-card">
              <span class="module-title">${module.title}</span>
              <div class="module-actions">
                <button class="btn-action btn-edit" onclick="adminPanel.courses.editModule('${courseId}','${module.id}')" title="Sửa module"><i class="fas fa-edit"></i></button>
                <button class="btn-action btn-delete" onclick="adminPanel.courses.deleteModule('${courseId}','${module.id}')" title="Xóa module"><i class="fas fa-trash"></i></button>
                <button class="btn-action btn-lesson" onclick="adminPanel.courses.openLessonsManager('${courseId}','${module.id}')" title="Quản lý bài học"><i class="fas fa-list"></i></button>
              </div>
            </div>
          `;
          modulesContainer.appendChild(moduleDiv);
        });
      } else {
        modulesContainer.innerHTML =
          '<div class="no-modules">Chưa có module nào cho khóa học này.</div>';
      }
    } catch (error) {
      modulesContainer.innerHTML =
        '<div class="module-error">Lỗi tải module.</div>';
    }
  }

  // Thêm module mới cho khóa học
  async addModule(courseId, moduleTitle) {
    if (!moduleTitle) return;
    try {
      const modulesRef = ref(database, `course_modules/${courseId}`);
      const snapshot = await get(modulesRef);
      // Tạo id module mới dạng moduleN
      let nextId = 1;
      if (snapshot.exists()) {
        const keys = Object.keys(snapshot.val());
        const nums = keys
          .map((k) => parseInt(k.replace("module", "")))
          .filter((n) => !isNaN(n));
        nextId = nums.length > 0 ? Math.max(...nums) + 1 : 1;
      }
      const newModuleId = `module${nextId}`;
      await set(ref(database, `course_modules/${courseId}/${newModuleId}`), {
        title: moduleTitle,
        lessons: [],
      });
      // await this.adminPanel.logActivity(
      //   "course",
      //   "Thêm module",
      //   `Thêm module "${moduleTitle}" cho khóa học ${courseId}`
      // );
      this.adminPanel.showNotification("Đã thêm module mới", "success");
      await this.loadCourseModules(courseId);
    } catch (error) {
      this.adminPanel.showNotification("Lỗi thêm module", "error");
    }
  }

  // Sửa module (chỉ sửa title)
  async editModule(courseId, moduleId) {
    const newTitle = prompt("Nhập tiêu đề mới cho module:");
    if (!newTitle) return;
    try {
      await update(ref(database, `course_modules/${courseId}/${moduleId}`), {
        title: newTitle,
      });
      // await this.adminPanel.logActivity(
      //   "course",
      //   "Sửa module",
      //   `Sửa module ${moduleId} thành "${newTitle}" cho khóa học ${courseId}`
      // );

      this.adminPanel.showNotification("Đã cập nhật module", "success");
      await this.loadCourseModules(courseId);
    } catch (error) {
      this.adminPanel.showNotification("Lỗi cập nhật module", "error");
    }
  }

  // Xóa module
  async deleteModule(courseId, moduleId) {
    if (!confirm("Bạn có chắc chắn muốn xóa module này?")) return;
    try {
      await remove(ref(database, `course_modules/${courseId}/${moduleId}`));
      // await this.adminPanel.logActivity(
      //   "course",
      //   "Xóa module",
      //   `Xóa module ${moduleId} khỏi khóa học ${courseId}`
      // );
      this.adminPanel.showNotification("Đã xóa module", "success");
      await this.loadCourseModules(courseId);
    } catch (error) {
      this.adminPanel.showNotification("Lỗi xóa module", "error");
    }
  }

  // Quản lý bài học
  async openLessonsManager(courseId, moduleId) {
    this.currentManagingCourseId = courseId;
    this.currentManagingModuleId = moduleId;
    // Đặt tiêu đề modal
    document.getElementById(
      "lesson-manager-title"
    ).textContent = `Quản lý bài học - ${moduleId}`;
    // Hiện modal
    this.adminPanel.showModal("lesson-manager-modal");
    // Load danh sách bài học
    await this.loadLessonsList(courseId, moduleId);
    // Gắn sự kiện nút thêm bài học
    const addLessonBtn = document.getElementById("add-lesson-btn");
    if (addLessonBtn) {
      addLessonBtn.onclick = async () => {
        await this.showLessonForm("add");
      };
    }
  }

  // Load danh sách bài học vào modal
  async loadLessonsList(courseId, moduleId) {
    const lessonsList = document.getElementById("lessons-list");
    lessonsList.innerHTML =
      '<div class="loading-courses"><span class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></span> Đang tải bài học...</div>';
    try {
      const moduleRef = ref(database, `course_modules/${courseId}/${moduleId}`);
      const snapshot = await get(moduleRef);
      lessonsList.innerHTML = "";
      if (snapshot.exists() && Array.isArray(snapshot.val().lessons)) {
        const lessons = snapshot.val().lessons;
        if (lessons.length === 0) {
          lessonsList.innerHTML =
            '<div class="no-lessons">Chưa có bài học nào.</div>';
        } else {
          lessons.forEach((lesson, idx) => {
            const div = document.createElement("div");
            div.className = "admin-lesson-item";
            div.innerHTML = `
              <div class="lesson-card">
                <span class="lesson-title">${lesson.title}</span>
                <span class="lesson-duration">${lesson.duration || ""}</span>
                <div class="lesson-actions">
                  <button class="btn-action btn-edit" title="Sửa" onclick="adminPanel.courses.showLessonForm('edit', ${idx})"><i class="fas fa-edit"></i></button>
                  <button class="btn-action btn-delete" title="Xóa" onclick="adminPanel.courses.deleteLesson('${courseId}','${moduleId}',${idx})"><i class="fas fa-trash"></i></button>
                  <button class="btn-action btn-quiz" title="Quiz" onclick="adminPanel.courses.openQuizManager('${courseId}','${moduleId}',${idx})"><i class="fas fa-question"></i></button>
                </div>
              </div>
            `;
            lessonsList.appendChild(div);
          });
        }
      } else {
        lessonsList.innerHTML =
          '<div class="no-lessons">Chưa có bài học nào.</div>';
      }
    } catch (error) {
      lessonsList.innerHTML =
        '<div class="lesson-error">Lỗi tải bài học.</div>';
    }
  }

  // Hiện form thêm/sửa bài học (dùng prompt đơn giản, có thể mở rộng thành form đẹp)
  async showLessonForm(type, idx = null) {
    const courseId = this.currentManagingCourseId;
    const moduleId = this.currentManagingModuleId;
    const moduleRef = ref(
      database,
      `course_modules/${courseId}/${moduleId}/lessons`
    );
    let lessons = [];
    const snapshot = await get(moduleRef);
    if (snapshot.exists()) lessons = snapshot.val();
    if (!Array.isArray(lessons)) lessons = [];
    let title = "",
      content = "",
      duration = "",
      video = "";
    if (type === "edit" && idx !== null && lessons[idx]) {
      title = lessons[idx].title;
      content = lessons[idx].content;
      duration = lessons[idx].duration;
      video = lessons[idx].video;
    }
    title = prompt("Tiêu đề bài học:", title) || title;
    if (!title) return;
    content = prompt("Nội dung bài học:", content) || content;
    duration = prompt("Thời lượng:", duration) || duration;
    video = prompt("Link video:", video) || video;
    if (type === "add") {
      lessons.push({
        id: `${moduleId}.${lessons.length + 1}`,
        title,
        content,
        duration,
        video,
        quiz: [],
      });
    } else if (type === "edit" && idx !== null && lessons[idx]) {
      lessons[idx] = { ...lessons[idx], title, content, duration, video };
    }
    await set(moduleRef, lessons);
    await this.loadLessonsList(courseId, moduleId);
    this.adminPanel.showNotification(
      type === "add" ? "Đã thêm bài học" : "Đã cập nhật bài học",
      "success"
    );
  }

  // Xóa bài học
  async deleteLesson(courseId, moduleId, idx) {
    const moduleRef = ref(
      database,
      `course_modules/${courseId}/${moduleId}/lessons`
    );
    const snapshot = await get(moduleRef);
    if (!snapshot.exists()) return;
    let lessons = snapshot.val();
    if (!Array.isArray(lessons) || idx < 0 || idx >= lessons.length) return;
    if (!confirm("Bạn có chắc chắn muốn xóa bài học này?")) return;
    lessons.splice(idx, 1);
    await set(moduleRef, lessons);
    await this.loadLessonsList(courseId, moduleId);
    this.adminPanel.showNotification("Đã xóa bài học", "success");
  }

  // Quản lý quiz
  async openQuizManager(courseId, moduleId, lessonIdx) {
    this.currentManagingCourseId = courseId;
    this.currentManagingModuleId = moduleId;
    this.currentManagingLessonIdx = lessonIdx;
    // Đặt tiêu đề modal
    document.getElementById("quiz-manager-title").textContent =
      "Quiz - " + (lessonIdx + 1);
    this.adminPanel.showModal("quiz-manager-modal");
    await this.loadQuizList(courseId, moduleId, lessonIdx);
    // Gắn sự kiện nút thêm quiz
    const addQuizBtn = document.getElementById("add-quiz-btn");
    if (addQuizBtn) {
      addQuizBtn.onclick = async () => {
        await this.showQuizForm("add");
      };
    }
  }

  async loadQuizList(courseId, moduleId, lessonIdx) {
    const quizList = document.getElementById("quiz-list");
    quizList.innerHTML =
      '<div class="loading-courses"><span class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></span> Đang tải quiz...</div>';
    try {
      const lessonRef = ref(
        database,
        `course_modules/${courseId}/${moduleId}/lessons`
      );
      const snapshot = await get(lessonRef);
      quizList.innerHTML = "";
      if (snapshot.exists()) {
        const lessons = snapshot.val();
        if (
          Array.isArray(lessons) &&
          lessons[lessonIdx] &&
          Array.isArray(lessons[lessonIdx].quiz)
        ) {
          const quizArr = lessons[lessonIdx].quiz;
          if (quizArr.length === 0) {
            quizList.innerHTML = '<div class="no-quiz">Chưa có quiz nào.</div>';
          } else {
            quizArr.forEach((quiz, idx) => {
              const div = document.createElement("div");
              div.className = "admin-quiz-item";
              div.innerHTML = `
                <div class="quiz-card">
                  <span class="quiz-question">${quiz.question}</span>
                  <div class="quiz-actions">
                    <button class="btn-action btn-edit" title="Sửa" onclick="adminPanel.courses.showQuizForm('edit', ${idx})"><i class="fas fa-edit"></i></button>
                    <button class="btn-action btn-delete" title="Xóa" onclick="adminPanel.courses.deleteQuiz('${courseId}','${moduleId}',${lessonIdx},${idx})"><i class="fas fa-trash"></i></button>
                  </div>
                </div>
              `;
              quizList.appendChild(div);
            });
          }
        } else {
          quizList.innerHTML = '<div class="no-quiz">Chưa có quiz nào.</div>';
        }
      }
    } catch (error) {
      quizList.innerHTML = '<div class="quiz-error">Lỗi tải quiz.</div>';
    }
  }

  async showQuizForm(type, idx = null) {
    const courseId = this.currentManagingCourseId;
    const moduleId = this.currentManagingModuleId;
    const lessonIdx = this.currentManagingLessonIdx;
    const lessonRef = ref(
      database,
      `course_modules/${courseId}/${moduleId}/lessons`
    );
    let lessons = [];
    const snapshot = await get(lessonRef);
    if (snapshot.exists()) lessons = snapshot.val();
    if (!Array.isArray(lessons) || !lessons[lessonIdx]) return;
    let quizArr = lessons[lessonIdx].quiz;
    if (!Array.isArray(quizArr)) quizArr = [];
    let question = "",
      options = ["", "", "", ""],
      answer = 0;
    if (type === "edit" && idx !== null && quizArr[idx]) {
      question = quizArr[idx].question;
      options = quizArr[idx].options;
      answer = quizArr[idx].answer;
    }
    question = prompt("Câu hỏi:", question) || question;
    if (!question) return;
    for (let i = 0; i < 4; i++) {
      options[i] = prompt(`Đáp án ${i + 1}:`, options[i] || "") || options[i];
    }
    answer =
      parseInt(
        prompt("Số thứ tự đáp án đúng (1-4):", (answer + 1).toString())
      ) - 1;
    if (isNaN(answer) || answer < 0 || answer > 3) return;
    if (type === "add") {
      quizArr.push({ question, options, answer });
    } else if (type === "edit" && idx !== null && quizArr[idx]) {
      quizArr[idx] = { question, options, answer };
    }
    lessons[lessonIdx].quiz = quizArr;
    await set(lessonRef, lessons);
    await this.loadQuizList(courseId, moduleId, lessonIdx);
    this.adminPanel.showNotification(
      type === "add" ? "Đã thêm quiz" : "Đã cập nhật quiz",
      "success"
    );
  }

  async deleteQuiz(courseId, moduleId, lessonIdx, quizIdx) {
    const lessonRef = ref(
      database,
      `course_modules/${courseId}/${moduleId}/lessons`
    );
    const snapshot = await get(lessonRef);
    if (!snapshot.exists()) return;
    let lessons = snapshot.val();
    if (
      !Array.isArray(lessons) ||
      !lessons[lessonIdx] ||
      !Array.isArray(lessons[lessonIdx].quiz)
    )
      return;
    if (!confirm("Bạn có chắc chắn muốn xóa quiz này?")) return;
    lessons[lessonIdx].quiz.splice(quizIdx, 1);
    await set(lessonRef, lessons);
    await this.loadQuizList(courseId, moduleId, lessonIdx);
    this.adminPanel.showNotification("Đã xóa quiz", "success");
  }

  setupEventListeners() {
    // Thêm event listener cho form submit
    const courseForm = document.getElementById("course-form");
    if (courseForm) {
      courseForm.addEventListener("submit", this.handleFormSubmit.bind(this));
    }

    // Nút thêm khóa học
    const addCourseBtn = document.getElementById("add-course-btn");
    if (addCourseBtn) {
      addCourseBtn.addEventListener("click", this.showAddModal.bind(this));
    }

    // Nút thêm module
    const addModuleBtn = document.getElementById("add-module-btn");
    if (addModuleBtn) {
      addModuleBtn.addEventListener("click", async () => {
        const courseId = this.currentManagingCourseId;
        const title = prompt("Nhập tiêu đề module mới:");
        if (title) await this.addModule(courseId, title);
      });
    }
  }
}
