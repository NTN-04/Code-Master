import { auth, database } from "../firebaseConfig.js";
import { uploadToCloudinary } from "../cloudinary-service.js";
import {
  ref,
  get,
  set,
  update,
  remove,
  onValue,
  off,
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-database.js";
import { sanitizeText } from "../utils/sanitize.js";
import { batchAppend, lazyImage } from "../utils/render.js";
import {
  summarizeCourseModules,
  formatMinutesToDuration,
} from "../utils/time.js";
import { getAllTemplates } from "../ide/ide-config.js";
import {
  broadcastNotification,
  getNotificationServerEndpoint,
  NOTIFICATION_TYPES,
} from "../utils/notifications.js";

export default class CoursesManager {
  constructor(adminPanel) {
    this.adminPanel = adminPanel;
    this.courses = [];
    this.currentManagingCourseId = null;
    this.currentManagingModuleId = null;
    this.currentManagingLessonIdx = null;
    // Listener management
    this.coursesListenerRef = null;
    this.coursesListenerCallback = null;
    // Debounce render to avoid excessive reflows
    this._renderTimer = null;
    // Image file selected for upload
    this.imageFile = null;
    // SimpleMDE instance
    this.courseMDE = null;
    // Flag to check if events are initialized
    this.eventsInitialized = false;
  }

  // Tải dữ liệu khóa học
  async loadData() {
    // Init events cho modal
    this.initCourseModalEvents();

    // Hiển thị loading
    this.showCoursesLoading();

    // Xóa lăng nghe realtime nếu có
    this.cleanupListener();

    // Tạo mới listener
    this.coursesListenerRef = ref(database, "courses");
    this.coursesListenerCallback = (snapshot) => {
      if (snapshot.exists()) {
        this.courses = Object.entries(snapshot.val()).map(([id, data]) => ({
          id,
          ...data,
        }));
      } else {
        this.courses = [];
      }
      // Debounce rendering to batch DOM updates
      clearTimeout(this._renderTimer);
      this._renderTimer = setTimeout(() => this.renderCoursesGrid(), 50);
    };
    onValue(this.coursesListenerRef, this.coursesListenerCallback, (error) => {
      // console.error("Error loading courses:", error);
      this.adminPanel.showNotification("Lỗi tải dữ liệu khóa học", "error");
    });
  }

  cleanupListener() {
    if (this.coursesListenerRef && this.coursesListenerCallback) {
      // off chỉ khi đã có ref và callback
      off(this.coursesListenerRef, this.coursesListenerCallback);
      this.coursesListenerRef = null;
      this.coursesListenerCallback = null;
    }
    // Clear any pending render timers
    if (this._renderTimer) {
      clearTimeout(this._renderTimer);
      this._renderTimer = null;
    }
  }

  showCoursesLoading() {
    const coursesGrid = document.getElementById("admin-courses-grid");
    if (coursesGrid) {
      coursesGrid.innerHTML = `
      <div class="loading-courses">
            <span class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></span>
            <span>Đang tải danh sách khóa học...</span>
        </div>
      `;
    }
  }

  // Hàm lấy tổng số bài học và tổng thời lượng, có cache
  async getCourseStats(courseId) {
    const modulesRef = ref(database, `course_modules/${courseId}`);
    const snap = await get(modulesRef);
    const summary = snap.exists()
      ? summarizeCourseModules(snap.val())
      : {
          totalLessons: 0,
          totalMinutes: 0,
          durationText: formatMinutesToDuration(0),
        };

    // cập nhật lại node courses
    await update(ref(database, `courses/${courseId}`), {
      lessons: summary.totalLessons,
      duration: summary.durationText,
    });

    return {
      totalLessons: summary.totalLessons,
      durationText: summary.durationText,
    };
  }

  async renderCoursesGrid() {
    const grid = document.getElementById("admin-courses-grid");
    if (!grid) return;

    // sắp xếp theo ngày mới nhất
    const coursesArray = this.courses.sort((a, b) => {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    const nodes = coursesArray.map((course) => this.createCourseCard(course));
    grid.textContent = "";
    batchAppend(grid, nodes);
  }

  createCourseCard(course) {
    const div = document.createElement("div");
    div.className = "admin-course-card";

    // Image wrapper
    const imgWrap = document.createElement("div");
    imgWrap.className = "course-card-image";
    const img = lazyImage(
      course.image,
      sanitizeText(course.title || "Course image"),
      "./assets/images/img-course/html-css.png",
    );
    imgWrap.appendChild(img);

    // Content
    const content = document.createElement("div");
    content.className = "course-card-content";

    const titleEl = document.createElement("h3");
    titleEl.className = "course-card-title";
    titleEl.textContent = course.title || "(Không có tiêu đề)";

    const meta = document.createElement("div");
    meta.className = "course-card-meta";
    const levelSpan = document.createElement("span");
    levelSpan.innerHTML = `<i class="fas fa-signal"></i> ${sanitizeText(
      this.getLevelText(course.level),
    )}`;
    const clockSpan = document.createElement("span");
    clockSpan.innerHTML = `<i class="fas fa-clock"></i> ${sanitizeText(
      course.duration || "",
    )}`;
    const lessonsSpan = document.createElement("span");
    lessonsSpan.innerHTML = `<i class="fas fa-book"></i> ${Number(
      course.lessons || 0,
    )} bài`;
    meta.append(levelSpan, clockSpan, lessonsSpan);

    const actionsWrap = document.createElement("div");
    actionsWrap.className = "course-card-actions";
    const actionBtns = document.createElement("div");
    actionBtns.className = "action-buttons";

    const btnEdit = document.createElement("button");
    btnEdit.className = "btn-action btn-edit";
    btnEdit.title = "Chỉnh sửa";
    btnEdit.innerHTML = '<i class="fas fa-edit"></i>';
    btnEdit.addEventListener("click", () => this.editCourse(course.id));

    const btnDelete = document.createElement("button");
    btnDelete.className = "btn-action btn-delete";
    btnDelete.title = "Xóa";
    btnDelete.innerHTML = '<i class="fas fa-trash"></i>';
    btnDelete.addEventListener("click", () => this.deleteCourse(course.id));

    const btnDetail = document.createElement("button");
    btnDetail.className = "btn-action btn-detail";
    btnDetail.title = "Quản lý chi tiết";
    btnDetail.innerHTML = '<i class="fas fa-tasks"></i>';
    btnDetail.addEventListener("click", () =>
      this.openCourseDetailManager(course.id),
    );

    actionBtns.append(btnEdit, btnDelete, btnDetail);
    actionsWrap.appendChild(actionBtns);

    content.append(titleEl, meta, actionsWrap);
    div.append(imgWrap, content);
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

    // Reset tabs về tab đầu tiên
    this.resetTabs();

    // Render options cho IDE Template select
    this.renderIdeTemplateOptions();

    // Đổ dữ liệu khóa học vào modal
    document.getElementById("course-id").value = courseId;
    document.getElementById("course-title").value = course.title || "";
    document.getElementById("course-description").value =
      course.description || "";
    document.getElementById("course-level").value = course.level || "beginner";
    document.getElementById("course-duration").value = course.duration || "";
    document.getElementById("course-lessons").value = course.lessons || "";
    document.getElementById("course-category").value = course.category || "web";
    document.getElementById("course-ide-template").value =
      course.ideTemplate || "";

    // Dữ liệu giá
    document.getElementById("course-original-price").value =
      course.originalPrice || 0;
    document.getElementById("course-price").value = course.price || 0;
    document.getElementById("course-video-intro").value =
      course.videoIntro || "";

    // SimpleMDE
    if (this.courseMDE) {
      this.courseMDE.value(course.detailedDescription || "");
    }

    // Dynamic Lists
    this.renderDynamicList("outcomes-list", course.learningOutcomes || []);
    this.renderDynamicList("requirements-list", course.requirements || []);

    // Không set lại file input khi edit
    const imageInput = document.getElementById("course-image");
    if (imageInput) imageInput.value = "";
    const preview = document.getElementById("course-image-preview");
    if (preview) {
      preview.src = "";
      preview.style.display = "none";
    }

    document.getElementById("course-featured").checked = !!course.featured;

    // Cập nhật tiêu đề modal
    document.getElementById("course-modal-title").textContent =
      "Chỉnh sửa khóa học";

    // Ẩn custom id và required
    document.getElementById("form-custom-id").style.display = "none";
    document.getElementById("course-custom-id").required = false;
    document.getElementById("course-image").required = false;
    document.getElementById("form-featured").style.display = "flex"; // Hiện trường featured

    // Hiện modal
    this.adminPanel.showModal("course-modal");
    // Refresh SimpleMDE để hiển thị đúng
    setTimeout(() => {
      if (this.courseMDE) this.courseMDE.codemirror.refresh();
    }, 200);
  }

  async deleteCourse(courseId) {
    if (!confirm("Bạn có chắc chắn muốn xóa khóa học này?")) return;

    const course = this.courses.find((c) => c.id === courseId);

    try {
      // Xóa khóa học
      const courseRef = ref(database, `courses/${courseId}`);
      await remove(courseRef);
      // Xóa module và bài học của khóa học
      await remove(ref(database, `course_modules/${courseId}`));

      // Xóa tiến trình liên quan đến khóa học
      const userProgressRef = ref(database, "userProgress");
      const userProgressSnap = await get(userProgressRef);
      if (userProgressSnap.exists()) {
        const userProgressData = userProgressSnap.val();
        for (const userId in userProgressData) {
          if (
            userProgressData[userId].courses &&
            userProgressData[userId].courses[courseId]
          ) {
            await remove(
              ref(database, `userProgress/${userId}/courses/${courseId}`),
            );
          }
        }
      }

      // Ghi log hoạt động
      await this.adminPanel.logActivity(
        "course",
        "Xóa khóa học",
        `Đã xóa khóa học "${course?.title || courseId}"`,
        "fas fa-trash",
      );

      this.adminPanel.showNotification("Đã xóa khóa học", "success");
      // this.loadData();
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
    document.getElementById("course-image").required = true;
    document.getElementById("form-featured").style.display = "none"; // Ẩn trường featured
    document.getElementById("course-modal-title").textContent = "Thêm khóa học";

    // Render options cho IDE Template select
    this.renderIdeTemplateOptions();

    // Reset các trường giá và video
    document.getElementById("course-original-price").value = "";
    document.getElementById("course-price").value = "";
    document.getElementById("course-video-intro").value = "";
    document.getElementById("course-ide-template").value = "";
    if (this.courseMDE) {
      this.courseMDE.value("");
    }
    this.renderDynamicList("outcomes-list", []);
    this.renderDynamicList("requirements-list", []);

    // Reset tabs
    this.resetTabs();

    // Xóa file input khi mở modal
    const imageInput = document.getElementById("course-image");
    if (imageInput) imageInput.value = "";
    const preview = document.getElementById("course-image-preview");
    if (preview) {
      preview.src = "";
      preview.style.display = "none";
    }
    this.imageFile = null;

    this.adminPanel.showModal("course-modal");
    // Refresh SimpleMDE
    setTimeout(() => {
      if (this.courseMDE) this.courseMDE.codemirror.refresh();
    }, 200);

    // xử lý file ảnh và hiện preview
    this.setupCourseImage();
  }

  // Helper: Reset tabs
  resetTabs() {
    const tabs = document.querySelectorAll(".modal-tabs .tab-btn");
    const contents = document.querySelectorAll(".tab-content");
    tabs.forEach((t) => t.classList.remove("active"));
    contents.forEach((c) => c.classList.remove("active"));

    // Active tab đầu tiên
    if (tabs[0]) tabs[0].classList.add("active");
    if (contents[0]) contents[0].classList.add("active");
  }

  /**
   * Render các options cho IDE Template select
   * Lấy danh sách templates từ ide-config.js
   */
  renderIdeTemplateOptions() {
    const select = document.getElementById("course-ide-template");
    if (!select) return;

    // Lấy giá trị hiện tại để restore sau khi render
    const currentValue = select.value;

    // Xóa các options cũ (trừ option đầu tiên "Không sử dụng IDE")
    select.innerHTML =
      '<option value="">Không sử dụng IDE (CodeEditor)</option>';

    // Lấy danh sách templates và render
    const templates = getAllTemplates();
    templates.forEach((template) => {
      const option = document.createElement("option");
      option.value = template.id;
      option.textContent = template.name;
      select.appendChild(option);
    });

    // Restore giá trị nếu có
    if (currentValue) {
      select.value = currentValue;
    }
  }

  // Helper: Render dynamic list inputs
  renderDynamicList(containerId, items) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";
    items.forEach((item) => {
      this.addDynamicInput(container, item);
    });
  }

  // Helper: Add single dynamic input
  addDynamicInput(container, value = "") {
    const div = document.createElement("div");
    div.className = "dynamic-input-group";
    div.style.display = "flex";
    div.style.marginBottom = "5px";
    div.style.gap = "5px";

    const input = document.createElement("input");
    input.type = "text";
    input.className = "form-control"; // Giả sử có class này hoặc style mặc định
    input.value = value;
    input.style.flex = "1";

    const btnRemove = document.createElement("button");
    btnRemove.type = "button";
    btnRemove.className = "btn btn-danger btn-sm";
    btnRemove.innerHTML = '<i class="fas fa-times"></i>';
    btnRemove.onclick = () => div.remove();

    div.appendChild(input);
    div.appendChild(btnRemove);
    container.appendChild(div);
  }

  // Helper: Collect data from dynamic list
  getDynamicListValues(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return [];
    const inputs = container.querySelectorAll("input");
    return Array.from(inputs)
      .map((input) => input.value.trim())
      .filter((val) => val !== "");
  }

  // Khởi tạo các sự kiện cho Modal Khóa học (Tabs, Dynamic Buttons)
  initCourseModalEvents() {
    if (this.eventsInitialized) return;

    // Tabs
    const tabs = document.querySelectorAll(".modal-tabs .tab-btn");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const targetId = tab.getAttribute("data-tab");
        // Deactive all
        document
          .querySelectorAll(".modal-tabs .tab-btn")
          .forEach((t) => t.classList.remove("active"));
        document
          .querySelectorAll(".tab-content")
          .forEach((c) => c.classList.remove("active"));
        // Active current
        tab.classList.add("active");
        const targetContent = document.getElementById(targetId);
        if (targetContent) {
          targetContent.classList.add("active");
        }
      });
    });

    // Dynamic Buttons
    const addOutcomeBtn = document.getElementById("add-outcome-btn");
    if (addOutcomeBtn) {
      addOutcomeBtn.onclick = () => {
        const container = document.getElementById("outcomes-list");
        this.addDynamicInput(container);
      };
    }

    const addRequirementBtn = document.getElementById("add-requirement-btn");
    if (addRequirementBtn) {
      addRequirementBtn.onclick = () => {
        const container = document.getElementById("requirements-list");
        this.addDynamicInput(container);
      };
    }

    // Init SimpleMDE nếu chưa có
    if (!this.courseMDE && document.getElementById("course-detailed-desc")) {
      this.courseMDE = new SimpleMDE({
        element: document.getElementById("course-detailed-desc"),
        spellChecker: false,
        status: false,
        placeholder: "Nhập mô tả chi tiết khóa học...",
      });
    }

    this.eventsInitialized = true;
  }

  // xử lý dữ liệu ảnh trước khi submit
  imageFile = null;
  setupCourseImage() {
    // Luôn gắn event change cho input file, không bị lặp event
    const imageInput = document.getElementById("course-image");
    const preview = document.getElementById("course-image-preview");
    if (!imageInput) return;
    // Xóa event cũ nếu có
    if (imageInput._previewEventHandler) {
      imageInput.removeEventListener("change", imageInput._previewEventHandler);
    }
    // Gắn event mới
    imageInput._previewEventHandler = (e) => {
      const file = imageInput.files[0];
      if (!file) {
        if (preview) {
          preview.src = "";
          preview.style.display = "none";
        }
        this.imageFile = null;
        return;
      }
      if (!file.type.startsWith("image/")) {
        this.adminPanel.showNotification("Chỉ chấp nhận file ảnh!", "error");
        imageInput.value = "";
        if (preview) {
          preview.src = "";
          preview.style.display = "none";
        }
        this.imageFile = null;
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        this.adminPanel.showNotification("Ảnh tối đa 5MB!", "error");
        imageInput.value = "";
        if (preview) {
          preview.src = "";
          preview.style.display = "none";
        }
        this.imageFile = null;
        return;
      }
      this.imageFile = file;
      if (preview) {
        const objectUrl = URL.createObjectURL(file);
        preview.src = objectUrl;
        preview.style.display = "block";
      }
    };
    imageInput.addEventListener("change", imageInput._previewEventHandler);
  }

  // Helper: Thu thập dữ liệu từ form
  getCourseFormData(imageUrl) {
    // Lấy giá trị ideTemplate
    const ideTemplateValue = document
      .getElementById("course-ide-template")
      .value.trim();

    const formData = {
      title: document.getElementById("course-title").value.trim(),
      description: document.getElementById("course-description").value.trim(),
      level: document.getElementById("course-level").value,
      duration: document.getElementById("course-duration").value.trim(),
      lessons: parseInt(document.getElementById("course-lessons").value) || 0,
      category: document.getElementById("course-category").value,
      image: imageUrl,
      updatedAt: new Date().toISOString().slice(0, 10),
      originalPrice:
        Number(document.getElementById("course-original-price").value) || 0,
      price: Number(document.getElementById("course-price").value) || 0,
      videoIntro:
        document.getElementById("course-video-intro").value.trim() || "",
      detailedDescription: this.courseMDE ? this.courseMDE.value().trim() : "",
      learningOutcomes: this.getDynamicListValues("outcomes-list"),
      requirements: this.getDynamicListValues("requirements-list"),
      // ideTemplate: lưu giá trị hoặc null để xóa khỏi database khi update
      ideTemplate: ideTemplateValue || null,
    };

    return formData;
  }

  // Helper: Validate dữ liệu khóa học
  validateCourseData(courseData, isEditMode, customId) {
    if (!courseData.title) {
      this.adminPanel.showNotification("Vui lòng nhập tên khóa học", "error");
      return false;
    }

    // Validate ID only if adding new course
    if (!isEditMode) {
      if (!customId) {
        this.adminPanel.showNotification("Vui lòng nhập ID khóa học", "error");
        return false;
      }
      if (!/^[a-z0-9-]+$/.test(customId)) {
        this.adminPanel.showNotification(
          "ID khóa học chỉ chứa chữ thường, số và dấu gạch ngang",
          "error",
        );
        return false;
      }
    }

    if (courseData.price < 0) {
      this.adminPanel.showNotification("Giá khóa học không được âm", "error");
      return false;
    }
    if (courseData.lessons < 0) {
      this.adminPanel.showNotification("Số bài học không được âm", "error");
      return false;
    }

    return true;
  }

  // Xử lý submit form thêm/sửa
  async handleFormSubmit(e) {
    e.preventDefault();

    const courseId = document.getElementById("course-id").value;
    const customId = document
      .getElementById("course-custom-id")
      ?.value.toLowerCase()
      .trim();

    // Xử lý ảnh: nếu có file mới chọn thì upload Cloudinary, nếu không giữ ảnh cũ khi edit
    let imageUrl = "";
    try {
      if (this.imageFile) {
        const { uploadToCloudinary } = await import("../cloudinary-service.js");
        imageUrl = await uploadToCloudinary(this.imageFile);
        if (!imageUrl) {
          this.adminPanel.showNotification("Upload ảnh thất bại", "error");
          return;
        }
      } else if (courseId) {
        const course = this.courses.find((c) => c.id === courseId);
        imageUrl = course ? course.image || "" : "";
      }
    } catch (err) {
      this.adminPanel.showNotification("Lỗi upload ảnh", "error");
      return;
    }

    // Thu thập dữ liệu
    const courseData = this.getCourseFormData(imageUrl);

    // Validate dữ liệu
    if (!this.validateCourseData(courseData, !!courseId, customId)) {
      return;
    }

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
          "fas fa-edit",
        );
        this.adminPanel.showNotification(
          "Cập nhật khóa học thành công",
          "success",
        );
      } else {
        // Thêm khóa học mới
        const newCourseId = customId || `course-${Date.now()}`;
        const courseRef = ref(database, `courses/${newCourseId}`);
        await set(courseRef, {
          id: newCourseId,
          ...courseData,
          createdAt: new Date().toISOString().slice(0, 10),
          tag: this.getCategoryText(courseData.category),
          featured: false,
        });

        await this.notifyNewCourse(newCourseId, courseData);

        // Ghi lại hoạt động
        await this.adminPanel.logActivity(
          "course",
          "Thêm khóa học",
          `Đã thêm khóa học mới ${courseData.title}`,
          "fas fa-book",
        );
        this.adminPanel.showNotification("Thêm khóa học thành công", "success");
      }

      this.adminPanel.hideModal("course-modal");
      // Reset image state
      this.imageFile = null;
      // this.loadData();
    } catch (error) {
      console.error("Error saving course:", error);
      this.adminPanel.showNotification("Lỗi lưu khóa học", "error");
    }
  }

  async notifyNewCourse(courseId, courseData) {
    const payload = {
      type: NOTIFICATION_TYPES.NEW_COURSE,
      title: "Khóa học mới",
      message: `Khóa học mới "${courseData.title}" vừa ra mắt. Vào học ngay nhé!`,
      link: `course-intro.html?id=${courseId}`,
      data: {
        courseId,
        courseName: courseData.title,
        category: courseData.category,
      },
    };

    // Production path: server-side dispatch nếu endpoint được cấu hình.
    const endpoint = getNotificationServerEndpoint();
    if (endpoint) {
      try {
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) {
          throw new Error("Admin token is missing. Vui lòng đăng nhập lại.");
        }

        const headers = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        };

        const response = await fetch(`${endpoint}/new-course`, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          return;
        }

        const errorBody = await response.text();
        throw new Error(
          `Server notification dispatch failed: ${response.status} ${errorBody}`,
        );
      } catch (error) {
        console.error("Server notification dispatch error", error);
        this.adminPanel.showNotification(
          "Không thể gửi thông báo khóa học mới qua server.",
          "error",
        );
        return;
      }
    }

    // Fallback hiện tại: broadcast trực tiếp đến user thường (không admin).
    const usersRef = ref(database, "users");
    const usersSnap = await get(usersRef);
    if (!usersSnap.exists()) return;

    const userIds = Object.entries(usersSnap.val())
      .filter(([_, user]) => Number(user?.role) !== 1)
      .map(([uid]) => uid);

    if (userIds.length === 0) return;

    await broadcastNotification(userIds, payload);
  }

  // Quản lý chi tiết cho khóa học (module)
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

      this.adminPanel.showNotification("Đã thêm chương mới", "success");
      await this.loadCourseModules(courseId);
    } catch (error) {
      this.adminPanel.showNotification("Lỗi thêm chương", "error");
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

      this.adminPanel.showNotification("Đã cập nhật chương", "success");
      await this.loadCourseModules(courseId);
    } catch (error) {
      this.adminPanel.showNotification("Lỗi cập nhật chương", "error");
    }
  }

  // Xóa module
  async deleteModule(courseId, moduleId) {
    if (!confirm("Bạn có chắc chắn muốn xóa module này?")) return;
    try {
      await remove(ref(database, `course_modules/${courseId}/${moduleId}`));
      this.adminPanel.showNotification("Đã xóa chương", "success");
      await this.loadCourseModules(courseId);
    } catch (error) {
      this.adminPanel.showNotification("Lỗi xóa chương", "error");
    }
  }

  // Quản lý bài học
  async openLessonsManager(courseId, moduleId) {
    this.currentManagingCourseId = courseId;
    this.currentManagingModuleId = moduleId;

    // Trích xuất số module từ moduleId (module1 -> '1')
    const moduleNumber = moduleId.replace(/\D/g, "");
    // Đặt tiêu đề modal
    document.getElementById("lesson-manager-title").textContent =
      `Quản lý bài học - Chương ${moduleNumber}`;
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

  // Hiện form thêm/sửa bài học
  async showLessonForm(type, idx = null) {
    const courseId = this.currentManagingCourseId;
    const moduleId = this.currentManagingModuleId;

    const moduleRef = ref(
      database,
      `course_modules/${courseId}/${moduleId}/lessons`,
    );
    let lessons = [];
    const snapshot = await get(moduleRef);
    if (snapshot.exists()) lessons = snapshot.val();
    if (!Array.isArray(lessons)) lessons = [];

    // Thiết lập tiêu đề modal và giá trị ban đầu
    const formTitle = document.getElementById("lesson-form-title");
    const titleInput = document.getElementById("lesson-title");
    const contentTextarea = document.getElementById("lesson-content");
    const durationInput = document.getElementById("lesson-duration");
    const videoInput = document.getElementById("lesson-video");
    const saveButton = document.getElementById("save-lesson-btn");

    // Đặt tiêu đề và nội dung form
    if (type === "add") {
      formTitle.textContent = "Thêm bài học mới";
      titleInput.value = "";
      contentTextarea.value = "";
      durationInput.value = "";
      videoInput.value = "";
    } else if (type === "edit" && idx !== null && lessons[idx]) {
      formTitle.textContent = "Chỉnh sửa bài học";
      titleInput.value = lessons[idx].title || "";
      contentTextarea.value = lessons[idx].content || "";
      durationInput.value = lessons[idx].duration || "";
      videoInput.value = lessons[idx].video || "";
    }

    // Hiện form
    this.adminPanel.showModal("lesson-form-modal");

    // Focus vào trường đầu tiên
    setTimeout(() => titleInput.focus(), 300);

    // Xử lý sự kiện submit form bài học
    const handleSubmit = async (e) => {
      e.preventDefault();

      const title = titleInput.value.trim();
      const content = contentTextarea.value.trim();
      const duration = durationInput.value.trim();
      const video = videoInput.value.trim();

      if (!title) {
        this.adminPanel.showNotification(
          "Vui lòng nhập đầy đủ trường",
          "error",
        );
        return;
      }

      // Thay đổi nút lưu thành trạng thái loading
      saveButton.disabled = true;
      saveButton.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Đang lưu...';

      try {
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
          lessons[idx] = {
            ...lessons[idx],
            title,
            content,
            duration,
            video,
          };
        }

        await set(moduleRef, lessons);
        // Sau khi thêm/sửa cập nhật lại số bài học và thời lượng cho khóa học
        await this.getCourseStats(courseId);
        await this.loadLessonsList(courseId, moduleId);

        this.adminPanel.showNotification(
          type === "add" ? "Đã thêm bài học mới" : "Đã cập nhật bài học",
          "success",
        );

        this.adminPanel.hideModal("lesson-form-modal");
      } catch (error) {
        console.error("Lỗi khi lưu bài học:", error);
        this.adminPanel.showNotification(
          "Đã xảy ra lỗi khi lưu bài học",
          "error",
        );
      } finally {
        saveButton.disabled = false;
        saveButton.innerHTML = '<i class="fas fa-save"></i> Lưu bài học';
      }
    };
    // Gán sự kiện submit cho form
    const form = document.getElementById("lesson-form");
    form.onsubmit = handleSubmit; // dùng onsubmit để tránh lặp sự kiện
  }

  // Xóa bài học
  async deleteLesson(courseId, moduleId, idx) {
    const moduleRef = ref(
      database,
      `course_modules/${courseId}/${moduleId}/lessons`,
    );
    const snapshot = await get(moduleRef);
    if (!snapshot.exists()) return;
    let lessons = snapshot.val();
    if (!Array.isArray(lessons) || idx < 0 || idx >= lessons.length) return;
    if (!confirm("Bạn có chắc chắn muốn xóa bài học này?")) return;
    lessons.splice(idx, 1);
    await set(moduleRef, lessons);
    // Cập nhật lại bài học và thời lượng cho khóa học
    await this.getCourseStats(courseId);
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
        `course_modules/${courseId}/${moduleId}/lessons`,
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

  async showQuizForm(type, quizIdx = null) {
    const courseId = this.currentManagingCourseId;
    const moduleId = this.currentManagingModuleId;
    const lessonIdx = this.currentManagingLessonIdx;

    const lessonRef = ref(
      database,
      `course_modules/${courseId}/${moduleId}/lessons`,
    );
    let lessons = [];
    const snapshot = await get(lessonRef);
    if (snapshot.exists()) lessons = snapshot.val();
    if (!Array.isArray(lessons) || !lessons[lessonIdx]) return;
    let quizArr = lessons[lessonIdx].quiz || [];
    if (!Array.isArray(quizArr)) quizArr = [];

    // Thiết lập tiêu đề modal và giá trị ban đầu
    const formTitle = document.getElementById("quiz-form-title");
    const questionInput = document.getElementById("quiz-question");
    const option1Input = document.getElementById("quiz-option1");
    const option2Input = document.getElementById("quiz-option2");
    const option3Input = document.getElementById("quiz-option3");
    const option4Input = document.getElementById("quiz-option4");
    const saveButton = document.getElementById("save-quiz-btn");
    const radioButtons = document.querySelectorAll(
      'input[name="correct-answer"]',
    );

    // Đặt tiêu đề và nội dung form
    if (type === "add") {
      formTitle.textContent = "Thêm câu hỏi quiz";
      questionInput.value = "";
      option1Input.value = "";
      option2Input.value = "";
      option3Input.value = "";
      option4Input.value = "";
      radioButtons[0].checked = true;
    } else if (type === "edit" && quizIdx !== undefined && quizArr[quizIdx]) {
      const quiz = quizArr[quizIdx];
      formTitle.textContent = "Chỉnh sửa câu hỏi quiz";
      questionInput.value = quiz.question || "";

      // đổ dữ liệu đáp án
      option1Input.value = quiz.options[0] || "";
      option2Input.value = quiz.options[1] || "";
      option3Input.value = quiz.options[2] || "";
      option4Input.value = quiz.options[3] || "";

      // Chọn đáp án đúng
      const correctAnswer = quiz.answer;
      if (correctAnswer >= 0 && correctAnswer < 4) {
        radioButtons[correctAnswer].checked = true;
      }
    }
    // Hiện form
    this.adminPanel.showModal("quiz-form-modal");

    // Focus vào trường đầu tiên
    setTimeout(() => questionInput.focus(), 300);

    // Xử lý sự kiện submit form quiz
    const handleQuizSubmit = async (e) => {
      e.preventDefault();

      const question = questionInput.value.trim();
      const options = [
        option1Input.value.trim(),
        option2Input.value.trim(),
        option3Input.value.trim(),
        option4Input.value.trim(),
      ];

      // Lấy đáp án đúng từ radio button
      let answer = 0;
      for (let i = 0; i < radioButtons.length; i++) {
        if (radioButtons[i].checked) {
          answer = parseInt(radioButtons[i].value);
          break;
        }
      }

      // Kiểm tra dữ liệu hợp lệ
      if (!question) {
        this.adminPanel.showNotification("Vui lòng nhập câu hỏi", "error");
        return;
      }

      if (options.some((opt) => !opt)) {
        this.adminPanel.showNotification(
          "Vui lòng nhập đầy đủ các đáp án",
          "error",
        );
        return;
      }

      saveButton.disabled = true;
      saveButton.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Đang lưu...';

      try {
        // Cập nhật dữ liệu quiz
        if (type === "add") {
          quizArr.push({ question, options, answer });
        } else if (type === "edit" && quizIdx !== null && quizArr[quizIdx]) {
          quizArr[quizIdx] = { question, options, answer };
        }

        // Cập nhật bài học với quiz mới vào firebase
        lessons[lessonIdx].quiz = quizArr;
        await set(lessonRef, lessons);

        // Cập nhật UI
        await this.loadQuizList(courseId, moduleId, lessonIdx);

        this.adminPanel.showNotification(
          type === "add" ? "Đã thêm quiz mới" : "Đã cập nhật quiz",
          "success",
        );

        this.adminPanel.hideModal("quiz-form-modal");
      } catch (error) {
        console.error("Lỗi khi lưu quiz:", error);
        this.adminPanel.showNotification("Đã xảy ra lỗi khi lưu quiz", "error");
      } finally {
        saveButton.disabled = false;
        saveButton.innerHTML = '<i class="fas fa-save"></i> Lưu quiz';
      }
    };
    // sự kiện submit
    const quizForm = document.getElementById("quiz-form");
    quizForm.onsubmit = handleQuizSubmit;
  }

  async deleteQuiz(courseId, moduleId, lessonIdx, quizIdx) {
    const lessonRef = ref(
      database,
      `course_modules/${courseId}/${moduleId}/lessons`,
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

    // Sự kiện nút refresh-courses
    const refresh = document.querySelector(".refresh-courses");
    if (refresh) {
      refresh.addEventListener("click", () => {
        this.loadData();
      });
    }
  }
}
