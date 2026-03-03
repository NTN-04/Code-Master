import { auth, database } from "./firebaseConfig.js";
import { uploadToCloudinary } from "./cloudinary-service.js";
import {
  updateProfile,
  onAuthStateChanged,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  deleteUser,
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-auth.js";
import {
  ref,
  get,
  update,
  remove,
  query,
  orderByChild,
  equalTo,
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-database.js";
import progressManager from "./progress-manager.js";
import { formatDate, formatDateTime } from "./utils/date.js";
import { sanitizeText } from "./utils/sanitize.js";
import { showFloatingNotification as showNotification } from "./utils/notifications.js";
import { initRoadmapWidget } from "./components/roadmap-widget.js";

// Chức năng Trang Hồ Sơ
document.addEventListener("DOMContentLoaded", function () {
  // Khởi tạo tabs
  initTabs();

  // Load số liệu thống kê
  loadProfileStats();

  // Load khóa học của tôi
  loadUserCourses();

  // Load AI Roadmap Widget
  loadRoadmapWidget();

  // Load lịch sử mua hàng
  loadPurchaseHistory();

  // Load tài nguyên đã lưu
  loadSavedResources();

  // Khởi tạo xử lý biểu mẫu cài đặt
  loadUserSetting();
  initSettingsForms();
  // xác thực form thay đổi password
  checkFormPasswordChange();

  // Khởi tạo xác thực user progress bar
  progressManager.initAuth();
});

// Khởi tạo điều hướng tab
function initTabs() {
  const tabButtons = document.querySelectorAll(".profile-tabs .tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  // Thêm sự kiện click cho các nút tab
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      // Loại bỏ lớp active từ tất cả các nút và nội dung
      tabButtons.forEach((btn) => btn.classList.remove("active"));
      tabContents.forEach((content) => content.classList.remove("active"));

      // Thêm lớp active cho nút được nhấp vào
      button.classList.add("active");

      // Hiển thị nội dung tương ứng
      const tabId = button.getAttribute("data-tab");
      const tabContent = document.getElementById(tabId);
      if (tabContent) {
        tabContent.classList.add("active");
      }
    });
  });
}

// Khởi tạo lọc/tìm kiếm khóa học của tôi (khi render xong)
function initCourseFilters() {
  // Lọc theo trạng thái
  const filterBtns = document.querySelectorAll(".courses-filter .filter-btn");
  const courseCards = document.querySelectorAll(".user-courses .course-card");
  filterBtns.forEach((btn) => {
    btn.addEventListener("click", function () {
      filterBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const filter = btn.getAttribute("data-filter");
      courseCards.forEach((card) => {
        if (filter === "all" || card.getAttribute("data-status") === filter) {
          card.style.display = "";
        } else {
          card.style.display = "none";
        }
      });
    });
  });
  // Tìm kiếm
  const searchInput = document.getElementById("course-search");
  if (searchInput) {
    searchInput.addEventListener("input", function () {
      const searchTerm = this.value.toLowerCase().trim();
      courseCards.forEach((card) => {
        const title = card.querySelector("h3")?.textContent.toLowerCase() || "";
        const desc = card.querySelector("p")?.textContent.toLowerCase() || "";
        if (title.includes(searchTerm) || desc.includes(searchTerm)) {
          card.style.display = "";
        } else {
          card.style.display = "none";
        }
      });
    });
  }
}

// Khởi tạo bộ lọ/tìm kiếm tài nguyên đã lưu
function initResourceFilters() {
  // Lọc theo loại tài nguyên
  const filterBtns = document.querySelectorAll(".resources-filter .filter-btn");
  const resourceItems = document.querySelectorAll(
    ".saved-resources .resource-item",
  );
  filterBtns.forEach((btn) => {
    btn.addEventListener("click", function () {
      filterBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const filter = btn.getAttribute("data-filter");
      resourceItems.forEach((item) => {
        if (filter === "all" || item.getAttribute("data-type") === filter) {
          item.style.display = "flex";
        } else {
          item.style.display = "none";
        }
      });
    });
  });

  // Tìm kiếm tài nguyên
  const searchInput = document.getElementById("resource-search");
  if (searchInput) {
    searchInput.addEventListener("input", function () {
      const searchTerm = this.value.toLowerCase().trim();
      resourceItems.forEach((item) => {
        const title = item.querySelector("h3")?.textContent.toLowerCase() || "";
        const desc = item.querySelector("p")?.textContent.toLowerCase() || "";
        if (title.includes(searchTerm) || desc.includes(searchTerm)) {
          item.style.display = "flex";
        } else {
          item.style.display = "none";
        }
      });
    });
  }
}

// Hàm load số liệu thống kê profile
function loadProfileStats() {
  onAuthStateChanged(auth, async (user) => {
    if (!user) return;
    try {
      const progressRef = ref(database, `userProgress/${user.uid}/courses`);
      const progressSnap = await get(progressRef);
      if (!progressSnap.exists()) return;

      const userCoursesProgress = progressSnap.val();
      const courseIds = Object.keys(userCoursesProgress);

      let inProgress = 0;
      let completed = 0;
      let totalProgress = 0;

      courseIds.forEach((courseId) => {
        const progress = userCoursesProgress[courseId]?.progress || 0;
        totalProgress += progress;
        if (progress >= 100) {
          completed++;
        } else {
          inProgress++;
        }
      });

      // Tính tiến độ trung bình
      const avgProgress =
        courseIds.length > 0 ? Math.round(totalProgress / courseIds.length) : 0;

      // Cập nhật vào giao diện
      const stats = document.querySelectorAll(".profile-stats .stat-value");
      if (stats.length >= 3) {
        stats[0].textContent = inProgress; // Khóa học đang học
        stats[1].textContent = completed; // Khóa học đã hoàn thành
        stats[2].textContent = avgProgress + "%"; // Tiến độ trung bình
      }
    } catch (err) {
      console.error("Lỗi khi load profile stats:", err);
    }
  });
}

/* ===  CÀI ĐẶT TÀI KHOẢN === */
// Tải dữ liệu người dùng từ Realtime Database và hiển thị lên form
function loadUserSetting() {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      const userRef = ref(database, "users/" + user.uid);
      const snapshot = await get(userRef);
      let data = {};
      if (snapshot.exists()) {
        data = snapshot.val();
      }
      // Hiển thị lên form
      document.querySelector(".profile-username").textContent =
        data.username || user.displayName || "";
      document.querySelector(".profile-email").textContent =
        data.email || user.email || "";
      // document.getElementById("full-name").value =
      //   user.displayName || data.username || "";
      document.getElementById("email").value = data.email || user.email || "";
      document.getElementById("username").value =
        data.username || user.displayName || "";
      document.getElementById("bio").value = data.bio || "";
      // Lấy ảnh đại diện từ local
      const base64Image = localStorage.getItem("profile-avatar-" + user.uid);
      const avatarImg = document.querySelector(".profile-avatar img");
      avatarImg.src =
        data.avatar || base64Image || "assets/images/avatar-default.jpg";
    } else {
      window.location.href = "login.html";
    }
  });
}

// Khởi tạo xử lý biểu mẫu cài đặt
function initSettingsForms() {
  // Xử lý biểu mẫu thông tin cá nhân
  const personalInfoForm = document.querySelector(
    "#settings .settings-section:nth-child(1) form",
  );

  // Nếu người dùng chọn ảnh mới
  const fileInput = document.getElementById("profile-picture");
  let selectedFile = null; // Lưu tạm file để dùng khi submit

  // Khi chọn ảnh, hiển thị review ngay
  if (fileInput) {
    fileInput.addEventListener("change", function () {
      if (fileInput.files && fileInput.files[0]) {
        // Kiểm tra kích thước file (tối đa 5MB)
        if (fileInput.files[0].size > 5 * 1024 * 1024) {
          showNotification("Kích thước file quá lớn (tối đa 5MB)", "error");
          return;
        }
        selectedFile = fileInput.files[0];
        const url = URL.createObjectURL(selectedFile);
        const avatarReview = document.querySelector(
          ".profile-picture-upload img",
        );
        if (avatarReview) avatarReview.src = url;
      }
    });
  }

  if (personalInfoForm) {
    personalInfoForm.addEventListener("submit", async function (e) {
      e.preventDefault();

      // const displayName = document.getElementById("full-name").value.trim();
      const bio = document.getElementById("bio").value.trim();
      const username = document.getElementById("username").value.trim();

      // Hiển thị trạng thái đang xử lý
      const submitBtn = personalInfoForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Đang cập nhật...';

      try {
        const user = auth.currentUser;
        if (user) {
          // Nếu có file ảnh, upload Cloudinary
          let avatarUrl = "";
          if (selectedFile) {
            avatarUrl = await uploadToCloudinary(selectedFile);
            if (!avatarUrl) {
              showNotification("Upload ảnh thất bại", "error");
              return;
            }
            const avatarImg = document.querySelector(".profile-avatar img");
            if (avatarImg) avatarImg.src = avatarUrl;
          }

          // Đồng bộ lại với local
          let localStoreDataUser = localStorage.getItem("codemaster_user");
          let userData = {};
          if (localStoreDataUser) {
            userData = JSON.parse(localStoreDataUser);
          }
          userData.displayName = username;
          localStorage.setItem("codemaster_user", JSON.stringify(userData));

          // Cập nhật trên Firebase Auth
          await updateProfile(user, {
            displayName: username,
          });

          // Cập nhật trên Realtime Database ( username, bio, avatar)
          const updateData = {
            username: username,
            bio: bio,
          };
          if (avatarUrl) {
            updateData.avatar = avatarUrl;
          }
          const userRef = ref(database, "users/" + user.uid);
          await update(userRef, updateData);

          showNotification("Thông tin cá nhân đã được cập nhật thành công!");
        }
      } catch (err) {
        showNotification("Có lỗi khi cập nhật hồ sơ: " + err.message, "error");
      } finally {
        // Khôi phục nút submit
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    });
  }

  // Xử lý biểu mẫu thay đổi mật khẩu
  const passwordForm = document.querySelector(
    "#settings .settings-section:nth-child(2) form",
  );
  if (passwordForm) {
    passwordForm.addEventListener("submit", async function (e) {
      e.preventDefault();

      const currentPassword = document.getElementById("current-password").value;
      const newPassword = document.getElementById("new-password").value;
      const confirmPassword = document.getElementById("confirm-password").value;

      // Validation
      if (!currentPassword || !newPassword || !confirmPassword) {
        showNotification("Vui lòng nhập đầy đủ thông tin!", "error");
        return;
      }

      if (newPassword !== confirmPassword) {
        showNotification("Mật khẩu xác nhận không khớp!", "error");
        return;
      }

      if (newPassword.length < 6) {
        showNotification("Mật khẩu mới phải có ít nhất 6 ký tự!", "error");
        return;
      }

      if (currentPassword === newPassword) {
        showNotification("Mật khẩu mới phải khác mật khẩu hiện tại!", "error");
        return;
      }

      // Hiển thị trạng thái đang xử lý
      const submitBtn = passwordForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Đang cập nhật...';

      try {
        const user = auth.currentUser;
        // Xác thực lại với mật khẩu hiện tại
        const credential = EmailAuthProvider.credential(
          user.email,
          currentPassword,
        );
        await reauthenticateWithCredential(user, credential);

        // Cập nhật mật khẩu mới
        await updatePassword(user, newPassword);

        // Đặt lại giá trị trường
        document.getElementById("current-password").value = "";
        document.getElementById("new-password").value = "";
        document.getElementById("confirm-password").value = "";

        showNotification("Mật khẩu đã được cập nhật thành công!");
      } catch (error) {
        let errorMessage = "Có lỗi khi cập nhật mật khẩu: ";

        switch (error.code) {
          case "auth/wrong-password":
            errorMessage = "Mật khẩu hiện tại không đúng!";
            break;
          case "auth/weak-password":
            errorMessage = "Mật khẩu mới quá yếu!";
            break;
          case "auth/requires-recent-login":
            errorMessage =
              "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại!";
            setTimeout(() => {
              window.location.href = "login.html";
            }, 2000);
            break;
          case "auth/too-many-requests":
            errorMessage = "Quá nhiều yêu cầu. Vui lòng thử lại sau!";
            break;
          default:
            errorMessage += error.message;
        }

        showNotification(errorMessage, "error");
        console.error("Password update error:", error);
      } finally {
        // Khôi phục nút submit
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    });
  }

  // Xử lý biểu mẫu tùy chọn thông báo
  const notificationForm = document.querySelector(
    "#settings .settings-section:nth-child(3) form",
  );
  if (notificationForm) {
    notificationForm.addEventListener("submit", function (e) {
      e.preventDefault();

      // Hiển thị thông báo
      showNotification("Tùy chọn thông báo đã được lưu!");
    });
  }

  // xử lý xóa tài khoản
  handleDeleteAccount();
}

// Xử lý xóa tài khoản
function handleDeleteAccount() {
  const deleteBtn = document.getElementById("delete-account-btn");
  if (!deleteBtn) return;

  deleteBtn.addEventListener("click", function (e) {
    e.preventDefault();
    // Nếu đã có form xác nhận thì không thêm nữa
    if (document.querySelector(".danger-inline-confirm")) return;

    // Tạo form xác nhận inline
    const confirmDiv = document.createElement("div");
    confirmDiv.className = "danger-inline-confirm";
    confirmDiv.innerHTML = `
      <label>Nhập <b>XÓA TÀI KHOẢN</b> để xác nhận:</label>
      <input type="text" id="delete-confirm-text" placeholder="Nhập XÓA TÀI KHOẢN">
      <label>Nhập mật khẩu tài khoản:</label>
      <input type="password" id="delete-confirm-password" placeholder="Mật khẩu hiện tại">
      <div class="validation-message" id="delete-validation-message"></div>
      <div class="danger-actions">
        <button class="btn btn-danger" id="delete-confirm-btn" disabled>Xác Nhận Xóa</button>
        <button class="btn btn-outline" id="delete-cancel-btn">Hủy</button>
      </div>
    `;
    deleteBtn.parentNode.appendChild(confirmDiv);

    // Xử lý xác nhận
    const confirmText = confirmDiv.querySelector("#delete-confirm-text");
    const confirmPassword = confirmDiv.querySelector(
      "#delete-confirm-password",
    );
    const confirmBtn = confirmDiv.querySelector("#delete-confirm-btn");
    const cancelBtn = confirmDiv.querySelector("#delete-cancel-btn");
    const validationMsg = confirmDiv.querySelector(
      "#delete-validation-message",
    );

    function validate() {
      let valid = true;
      if (confirmText.value.trim().toUpperCase() !== "XÓA TÀI KHOẢN") {
        validationMsg.textContent = "Bạn phải nhập chính xác: XÓA TÀI KHOẢN";
        valid = false;
      } else if (confirmPassword.value.trim().length < 6) {
        validationMsg.textContent = "Mật khẩu phải từ 6 ký tự trở lên";
        valid = false;
      } else {
        validationMsg.textContent = "Xác nhận hợp lệ";
        validationMsg.className = "validation-message valid";
      }
      confirmBtn.disabled = !valid;
      if (!valid) validationMsg.className = "validation-message";
    }

    confirmText.addEventListener("input", validate);
    confirmPassword.addEventListener("input", validate);

    cancelBtn.addEventListener("click", function () {
      confirmDiv.remove();
    });

    confirmBtn.addEventListener("click", async function () {
      confirmBtn.disabled = true;
      confirmBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Đang xóa...';
      try {
        // Xác thực lại và xóa tài khoản
        const user = auth.currentUser;
        if (!user) throw new Error("Bạn chưa đăng nhập!");
        const credential = EmailAuthProvider.credential(
          user.email,
          confirmPassword.value,
        );
        await reauthenticateWithCredential(user, credential);

        // Xóa vĩnh viễn dữ liệu trong database
        const userRef = ref(database, "users/" + user.uid);
        await remove(userRef);

        // Xóa tài khoản Firebase Auth
        await deleteUser(user);

        localStorage.clear();
        showNotification(
          "Tài khoản đã được xóa vĩnh viễn. Tạm biệt!",
          "success",
        );
        setTimeout(() => (window.location.href = "index.html"), 2000);
      } catch (err) {
        console.error("Delete account error:", err);

        let errorMessage = "Có lỗi khi xóa tài khoản: ";

        switch (err.code) {
          case "auth/wrong-password":
            errorMessage = "Mật khẩu không đúng!";
            break;
          case "auth/requires-recent-login":
            errorMessage =
              "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại!";
            setTimeout(() => (window.location.href = "login.html"), 2000);
            break;
          case "auth/too-many-requests":
            errorMessage = "Quá nhiều yêu cầu. Vui lòng thử lại sau!";
            break;
          default:
            errorMessage += err.message;
        }

        showNotification(errorMessage, "error");
      } finally {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = "Xác Nhận Xóa";
      }
    });
  });
}

// Kiểm tra và ẩn form thay đổi password khi login gg/github
function checkFormPasswordChange() {
  onAuthStateChanged(auth, (user) => {
    const passwordSection = document.querySelector(
      "#settings .settings-section:nth-child(2)",
    );

    if (user && passwordSection) {
      const providerData = user.providerData[0];
      if (providerData.providerId !== "password") {
        // Ẩn form khi đăng nhập bằng Google/GitHub
        passwordSection.style.display = "none";

        // Thêm thông báo
        const infoDiv = document.createElement("div");
        infoDiv.className = "settings-section";
        infoDiv.innerHTML = `
          <h3>Thay Đổi Mật Khẩu</h3>
          <div class="info-message">
            <i class="fas fa-info-circle"></i>
            <p>Tài khoản của bạn đăng nhập bằng ${
              providerData.providerId === "google.com" ? "Google" : "GitHub"
            }. 
            Để thay đổi mật khẩu, vui lòng truy cập trang cài đặt của ${
              providerData.providerId === "google.com" ? "Google" : "GitHub"
            }.</p>
          </div>
        `;
        passwordSection.parentNode.insertBefore(
          infoDiv,
          passwordSection.nextSibling,
        );
      }
    }
  });
}

/* === COURSE HỌC CỦA TÔI === */

// Load AI Roadmap Widget
function loadRoadmapWidget() {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      initRoadmapWidget("roadmap-widget-container", user.uid);
    }
  });
}

async function loadUserCourses() {
  const userCoursesContainer = document.querySelector(".user-courses");
  if (!userCoursesContainer) return;
  userCoursesContainer.innerHTML =
    '<div class="loading-courses"><i class="loading-spinner fas fa-spinner fa-spin"></i> Đang tải khóa học của bạn...</div>';

  // Đảm bảo user đã đăng nhập
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "login.html";
    }
    try {
      // Lấy danh sách courseId user đã học
      const progressRef = ref(database, `userProgress/${user.uid}/courses`);
      const progressSnap = await get(progressRef);
      if (!progressSnap.exists()) {
        userCoursesContainer.innerHTML = `<div class="no-courses-message">
            <i class="fas fa-graduation-cap"></i>
            <h3>Bạn chưa học khóa học nào</h3>
          </div>`;
        return;
      }
      // {courseId: {progress, lastAccessed, ...}}
      const userCoursesProgress = progressSnap.val();
      const courseIds = Object.keys(userCoursesProgress);
      if (courseIds.length === 0) {
        userCoursesContainer.innerHTML =
          '<div class="no-courses-message"><i class="fas fa-graduation-cap" ></i><h3>Bạn chưa học khóa học nào</h3></div>';
        return;
      }
      // Lấy thông tin chi tiết các khóa học
      const coursesRef = ref(database, "courses");
      const coursesSnap = await get(coursesRef);
      const allCourses = coursesSnap.exists() ? coursesSnap.val() : {};
      // Lấy categories để hiển thị icon/tên
      const categoriesRef = ref(database, "categories");
      const categoriesSnap = await get(categoriesRef);
      const categoriesData = categoriesSnap.exists()
        ? categoriesSnap.val()
        : {};

      // Render danh sách
      let html = "";
      courseIds.forEach((courseId) => {
        const course = allCourses[courseId];
        if (!course) return;
        const progress = userCoursesProgress[courseId]?.progress || 0;
        const firstAccessed =
          userCoursesProgress[courseId]?.firstAccessed || null;
        const lastAccessed =
          userCoursesProgress[courseId]?.lastAccessed || null;
        const isCompleted = progress >= 100;
        const category = categoriesData[course.category] || {};
        const categoryName = category.name || course.category;
        const categoryIcon = category.icon || "📚";
        // Map level
        const levelMap = {
          beginner: "Người Mới",
          intermediate: "Trung Cấp",
          advanced: "Nâng Cao",
        };
        const levelText = levelMap[course.level] || course.level;
        html += `
        <div class="course-card" data-status="${
          isCompleted ? "completed" : "in-progress"
        }" data-course-id="${courseId}">
          <div class="course-image">
            <img src="${course.image}" alt="${course.title}" loading="lazy" />
            <div class="course-tag">${categoryIcon} ${categoryName}</div>
          </div>
          <div class="course-info">
            <h3>${course.title}</h3>
            <div class="skill-level"><span class="level ${
              course.level
            }">${levelText}</span></div>
            <p class="line-clamp-2">${course.description}</p>
            <div class="course-meta">
              <span><i class="far fa-clock"></i> Truy cập gần nhất: ${formatDate(
                lastAccessed,
              )}</span>
              <span><i class="far fa-file-alt"></i> Bắt đầu học: ${formatDate(
                firstAccessed,
              )}</span>
            </div>
            <div class="progress-container">
              <div class="progress-bar" data-progress="${progress}" data-course-id="${courseId}">
                <div class="progress"></div>
              </div>
              <span class="progress-text">${progress}% Hoàn Thành</span>
            </div>
            <div class="course-actions">
              <a href="course-detail.html?id=${courseId}" class="btn btn-primary">${
                isCompleted ? "Xem lại" : "Tiếp tục học"
              }
              </a> 
             </div>
          </div>
          ${
            isCompleted
              ? `<div class="course-completion-badge"><i class="fas fa-certificate"></i></div>`
              : ""
          }
        </div>
        `;
      });
      userCoursesContainer.innerHTML = html;

      // Khởi tạo progress bar UI
      progressManager.initProgressBars(".user-courses .progress-bar");

      // Khởi tạo filter/tìm kiếm sau khi load
      initCourseFilters();
    } catch (err) {
      userCoursesContainer.innerHTML =
        '<div class="error-message"><i class="fas fa-exclamation-triangle"></i> Lỗi khi tải khóa học của bạn.</div>';
      console.error(err);
    }
  });
}

/** TÀI NGUYÊN ĐÃ LƯU */

// Tải và render danh sách tài nguyên đã lưu trong tab "tài nguyên đã lưu"
async function loadSavedResources() {
  const savedResourcesContainer = document.querySelector(".saved-resources");
  if (!savedResourcesContainer) return;
  savedResourcesContainer.innerHTML =
    '<div class="loading-courses"><i class="loading-spinner fas fa-spinner fa-spin"></i> Đang tải tài nguyên đã lưu...</div>';

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      savedResourcesContainer.innerHTML =
        '<div class="no-courses-message">Bạn cần đăng nhập để xem tài nguyên đã lưu.</div>';
      return;
    }
    try {
      // Lấy danh sách resourceId đã bookmark
      const bookmarksRef = ref(database, `bookmarks/${user.uid}`);
      const bookmarksSnap = await get(bookmarksRef);
      if (!bookmarksSnap.exists()) {
        savedResourcesContainer.innerHTML =
          '<div class="no-courses-message">Bạn chưa lưu tài nguyên nào.</div>';
        return;
      }
      const bookmarksObj = bookmarksSnap.val(); // { resourceId: {type, date} }
      const bookmarkIds = Object.keys(bookmarksObj);

      // Lấy toàn bộ resources
      const resourcesRef = ref(database, "resources");
      const resourcesSnap = await get(resourcesRef);
      if (!resourcesSnap.exists()) {
        savedResourcesContainer.innerHTML =
          '<div class="no-courses-message">Không tìm thấy dữ liệu tài nguyên.</div>';
        return;
      }
      const allResources = resourcesSnap.val();
      // Lọc các resource đã lưu
      const savedList = bookmarkIds
        .map((id) => {
          const resource = allResources[id];
          if (!resource) return null;
          return {
            id,
            ...resource,
            type: bookmarksObj[id]?.type || resource.type,
            date: bookmarksObj[id]?.date || "",
          };
        })
        .filter((r) => r && r.title); // loại bỏ null
      if (savedList.length === 0) {
        savedResourcesContainer.innerHTML =
          '<div class="no-courses-message">Bạn chưa lưu tài nguyên nào.</div>';
        return;
      }

      const icons = {
        documentation: "fa-solid fa-book",
        examples: "fa-solid fa-explosion",
        videos: "fa-solid fa-video",
      };

      // Render ra UI
      savedResourcesContainer.innerHTML = savedList
        .map(
          (item) => `
        <div class="resource-item" data-type="${item.type}">
                <div class="resource-icon">
                  <i class="${icons[item.type]}"></i>
                </div>
                <div class="resource-details">
                  <h3>${item.title}</h3>
                  <p>
                    ${item.description || ""}
                  </p>
                  <div class="resource-meta">
                    <span
                      ><i class="far fa-bookmark"></i> Đã lưu vào: 
                      ${formatDate(item.date)}</span
                    >
                  </div>
                </div>
                <div class="resource-actions">
                  <a href="${item.url}" class="btn btn-outline">Xem</a>
                  <button class="btn-icon remove-bookmark" data-id="${item.id}">
                    <i class="fa-solid fa-trash"></i>
                  </button>
                </div>
        </div>
      `,
        )
        .join("");

      // Khởi tạo lọc/tìm kiếm tài nguyên
      initResourceFilters();
      // Xóa lưu
      removeBookmark();
    } catch (err) {
      savedResourcesContainer.innerHTML =
        '<div class="error-message">Lỗi tải tài nguyên đã lưu: ' +
        err.message +
        "</div>";
    }
  });
}
// Thêm sự kiện xóa bookmark
function removeBookmark() {
  document.querySelectorAll(".remove-bookmark").forEach((btn) => {
    btn.addEventListener("click", async function () {
      if (confirm("Bạn có chắc muốn xóa dấu trang này không?")) {
        onAuthStateChanged(auth, async (user) => {
          if (!user) {
            showNotification("Bạn cần đăng nhập để xóa bookmark!", "error");
            return;
          }
          try {
            const bookmarkRef = ref(
              database,
              `bookmarks/${user.uid}/${btn.dataset.id}`,
            );
            await remove(bookmarkRef);
            showNotification("Đã xóa tài nguyên đã lưu.");
            loadSavedResources();

            // Đổi icon trên trang tài nguyên về chưa lưu (nếu đang mở)
            const bookmarkBtn = document.querySelector(
              `.btn-bookmark[onclick*="${btn.dataset.id}"]`,
            );
            if (bookmarkBtn) {
              const icon = bookmarkBtn.querySelector("i");
              if (icon) {
                icon.classList.remove("fas");
                icon.classList.add("far");
              }
            }
          } catch (err) {
            showNotification("Lỗi khi xóa bookmark!", "error");
          }
        });
      }
    });
  });
}

// ==================== PURCHASE HISTORY ====================

// Format currency
function formatCurrency(amount) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);
}

// Get status config for display
function getOrderStatusConfig(status) {
  const configs = {
    pending: {
      class: "status-pending",
      text: "Chờ thanh toán",
      icon: "fas fa-clock",
    },
    completed: {
      class: "status-completed",
      text: "Hoàn thành",
      icon: "fas fa-check-circle",
    },
    failed: {
      class: "status-failed",
      text: "Thất bại",
      icon: "fas fa-times-circle",
    },
    cancelled: {
      class: "status-cancelled",
      text: "Đã hủy",
      icon: "fas fa-ban",
    },
    refunded: {
      class: "status-refunded",
      text: "Hoàn tiền",
      icon: "fas fa-undo",
    },
  };
  return (
    configs[status] || { class: "", text: status, icon: "fas fa-info-circle" }
  );
}

// Load purchase history
async function loadPurchaseHistory() {
  const container = document.getElementById("purchase-list");
  if (!container) return;

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-sign-in-alt"></i>
          <p>Vui lòng đăng nhập để xem lịch sử mua hàng</p>
        </div>
      `;
      return;
    }

    try {
      // Query orders for current user using orderByChild and equalTo
      const ordersRef = ref(database, "orders");
      const userOrdersQuery = query(
        ordersRef,
        orderByChild("userId"),
        equalTo(user.uid),
      );
      const ordersSnap = await get(userOrdersQuery);

      let userOrders = [];
      if (ordersSnap.exists()) {
        userOrders = Object.entries(ordersSnap.val())
          .map(([id, order]) => ({ id, ...order }))
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      }

      if (userOrders.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <i class="fas fa-shopping-cart"></i>
            <p>Bạn chưa có đơn hàng nào</p>
            <a href="courses.html" class="btn btn-primary">Khám phá khóa học</a>
          </div>
        `;
        return;
      }

      // Load courses for reference
      const coursesSnap = await get(ref(database, "courses"));
      const courses = coursesSnap.exists() ? coursesSnap.val() : {};

      // Render orders
      container.innerHTML = userOrders
        .map((order) => renderOrderCard(order, courses))
        .join("");

      // Initialize purchase filters
      initPurchaseFilters();
    } catch (error) {
      console.error("Error loading purchase history:", error);
      container.innerHTML = `
        <div class="error-state">
          <i class="fas fa-exclamation-triangle"></i>
          <p>Lỗi tải lịch sử mua hàng: ${error.message}</p>
        </div>
      `;
    }
  });
}

// Render single order card
function renderOrderCard(order, courses) {
  const course = courses[order.courseId] || {};
  const statusConfig = getOrderStatusConfig(order.status);
  const createdDate = formatDateTime(order.createdAt);

  // Sanitize user-input data
  const safeOrderId = sanitizeText(order.orderId || "");
  const safeCourseTitle = sanitizeText(
    course.title || order.courseId || "Khóa học",
  );
  const safeCourseLevel = sanitizeText(course.level || "N/A");
  const safePaymentMethod = sanitizeText(order.paymentMethod || "VietQR");
  const safeThumbnail = sanitizeText(
    course.thumbnail || "./assets/images/default-course.png",
  );

  return `
    <div class="purchase-card" data-status="${sanitizeText(order.status)}" data-order-id="${safeOrderId}">
      <div class="purchase-header">
        <div class="order-info">
          <span class="order-id">
            <i class="fas fa-receipt"></i>
            ${safeOrderId}
          </span>
          <span class="order-date">${createdDate}</span>
        </div>
        <span class="order-status ${statusConfig.class}">
          <i class="${statusConfig.icon}"></i>
          ${statusConfig.text}
        </span>
      </div>
      
      <div class="purchase-body">
        <div class="course-thumbnail">
          <img src="${safeThumbnail}" alt="${safeCourseTitle}">
        </div>
        <div class="course-info">
          <h4>${safeCourseTitle}</h4>
          <p class="course-level">
            <i class="fas fa-signal"></i>
            ${safeCourseLevel}
          </p>
        </div>
        <div class="order-amount">
          <span class="amount">${formatCurrency(order.amount)}</span>
          <span class="payment-method">
            <i class="fas fa-qrcode"></i>
            ${safePaymentMethod}
          </span>
        </div>
      </div>
      
      <div class="purchase-footer">
        ${
          order.status === "pending"
            ? `
          <a href="checkout.html?courseId=${sanitizeText(order.courseId)}&orderId=${safeOrderId}" class="btn btn-primary btn-sm">
            <i class="fas fa-credit-card"></i>
            Tiếp tục thanh toán
          </a>
        `
            : ""
        }
        ${
          order.status === "completed"
            ? `
          <a href="course-intro.html?id=${sanitizeText(order.courseId)}" class="btn btn-outline btn-sm">
            <i class="fas fa-play"></i>
            Vào học ngay
          </a>
        `
            : ""
        }
        <button class="btn btn-secondary btn-sm btn-view-detail" data-order='${JSON.stringify(order).replace(/'/g, "&#39;")}'>
          <i class="fas fa-eye"></i>
          Chi tiết
        </button>
      </div>
    </div>
  `;
}

// Initialize purchase filter buttons
function initPurchaseFilters() {
  const filterBtns = document.querySelectorAll(".purchase-filter .filter-btn");
  const purchaseCards = document.querySelectorAll(".purchase-card");

  filterBtns.forEach((btn) => {
    btn.addEventListener("click", function () {
      filterBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const filter = btn.getAttribute("data-filter");
      purchaseCards.forEach((card) => {
        if (filter === "all" || card.getAttribute("data-status") === filter) {
          card.style.display = "";
        } else {
          card.style.display = "none";
        }
      });
    });
  });

  // View detail buttons
  document.querySelectorAll(".btn-view-detail").forEach((btn) => {
    btn.addEventListener("click", function () {
      const order = JSON.parse(this.dataset.order);
      showOrderDetailModal(order);
    });
  });
}

// Show order detail modal
function showOrderDetailModal(order) {
  const statusConfig = getOrderStatusConfig(order.status);
  const createdDate = formatDateTime(order.createdAt);
  const completedDate = order.completedAt
    ? formatDateTime(order.completedAt)
    : null;

  // Sanitize data for XSS protection
  const safeOrderId = sanitizeText(order.orderId || "");
  const safeCourseName = sanitizeText(order.courseName || order.courseId || "");
  const safeCourseId = sanitizeText(order.courseId || "");
  const safePaymentMethod = sanitizeText(order.paymentMethod || "VietQR");
  const safeTransferContent = order.transferContent
    ? sanitizeText(order.transferContent)
    : null;

  // Create modal if not exists
  let modal = document.getElementById("order-detail-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "order-detail-modal";
    modal.className = "modal-overlay";
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="modal-content order-modal">
      <div class="modal-header">
        <h3><i class="fas fa-receipt"></i> Chi tiết đơn hàng</h3>
        <button class="modal-close" onclick="document.getElementById('order-detail-modal').classList.remove('active')">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="modal-body">
        <div class="order-detail-section">
          <h4>Thông tin đơn hàng</h4>
          <div class="detail-row">
            <span class="label">Mã đơn hàng:</span>
            <span class="value"><code>${safeOrderId}</code></span>
          </div>
          <div class="detail-row">
            <span class="label">Trạng thái:</span>
            <span class="value order-status ${statusConfig.class}">
              <i class="${statusConfig.icon}"></i> ${statusConfig.text}
            </span>
          </div>
          <div class="detail-row">
            <span class="label">Số tiền:</span>
            <span class="value amount">${formatCurrency(order.amount)}</span>
          </div>
          <div class="detail-row">
            <span class="label">Phương thức:</span>
            <span class="value">${safePaymentMethod}</span>
          </div>
          <div class="detail-row">
            <span class="label">Ngày tạo:</span>
            <span class="value">${createdDate}</span>
          </div>
          ${
            completedDate
              ? `
            <div class="detail-row">
              <span class="label">Ngày hoàn thành:</span>
              <span class="value">${completedDate}</span>
            </div>
          `
              : ""
          }
          ${
            safeTransferContent
              ? `
            <div class="detail-row">
              <span class="label">Nội dung CK:</span>
              <span class="value"><code>${safeTransferContent}</code></span>
            </div>
          `
              : ""
          }
        </div>

        <div class="order-detail-section">
          <h4>Thông tin khóa học</h4>
          <div class="detail-row">
            <span class="label">Khóa học:</span>
            <span class="value">${safeCourseName}</span>
          </div>
        </div>

        ${
          order.status === "pending"
            ? `
          <div class="order-actions">
            <a href="checkout.html?courseId=${safeCourseId}&orderId=${safeOrderId}" class="btn btn-primary">
              <i class="fas fa-credit-card"></i>
              Tiếp tục thanh toán
            </a>
          </div>
        `
            : ""
        }
      </div>
    </div>
  `;

  modal.classList.add("active");

  // Close on backdrop click
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.classList.remove("active");
    }
  });
}
