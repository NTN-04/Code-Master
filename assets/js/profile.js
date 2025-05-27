// Chức năng Trang Hồ Sơ
document.addEventListener("DOMContentLoaded", function () {
  // Khởi tạo tabs
  initTabs();

  // Khởi tạo bộ lọc khóa học
  initCourseFilters();

  // Khởi tạo bộ lọc tài nguyên
  initResourceFilters();

  // Khởi tạo chức năng tìm kiếm
  initSearch();

  // Khởi tạo xử lý biểu mẫu cài đặt
  initSettingsForms();
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

// Khởi tạo bộ lọc khóa học
function initCourseFilters() {
  const filterButtons = document.querySelectorAll(
    ".courses-filter .filter-btn"
  );
  const courseCards = document.querySelectorAll(".course-card");

  // Thêm sự kiện click cho các nút lọc
  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      // Loại bỏ lớp active từ tất cả các nút
      filterButtons.forEach((btn) => btn.classList.remove("active"));

      // Thêm lớp active cho nút được nhấp vào
      button.classList.add("active");

      // Lọc khóa học
      const filterValue = button.getAttribute("data-filter");

      courseCards.forEach((card) => {
        if (filterValue === "all") {
          card.style.display = "flex";
        } else {
          const cardStatus = card.getAttribute("data-status");
          card.style.display = cardStatus === filterValue ? "flex" : "none";
        }
      });
    });
  });
}

// Khởi tạo bộ lọc tài nguyên
function initResourceFilters() {
  const filterButtons = document.querySelectorAll(
    ".resources-filter .filter-btn"
  );
  const resourceItems = document.querySelectorAll(".resource-item");

  // Thêm sự kiện click cho các nút lọc
  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      // Loại bỏ lớp active từ tất cả các nút
      filterButtons.forEach((btn) => btn.classList.remove("active"));

      // Thêm lớp active cho nút được nhấp vào
      button.classList.add("active");

      // Lọc tài nguyên
      const filterValue = button.getAttribute("data-filter");

      resourceItems.forEach((item) => {
        if (filterValue === "all") {
          item.style.display = "flex";
        } else {
          const itemType = item.getAttribute("data-type");
          item.style.display = itemType === filterValue ? "flex" : "none";
        }
      });
    });
  });
}

// Khởi tạo chức năng tìm kiếm
function initSearch() {
  // Tìm kiếm khóa học
  const courseSearchInput = document.getElementById("course-search");
  if (courseSearchInput) {
    courseSearchInput.addEventListener("input", function () {
      const searchTerm = this.value.toLowerCase().trim();
      const courseCards = document.querySelectorAll(".course-card");

      courseCards.forEach((card) => {
        const courseTitle = card.querySelector("h3").textContent.toLowerCase();
        const shouldShow = courseTitle.includes(searchTerm);
        card.style.display = shouldShow ? "flex" : "none";
      });
    });
  }

  // Tìm kiếm tài nguyên
  const resourceSearchInput = document.getElementById("resource-search");
  if (resourceSearchInput) {
    resourceSearchInput.addEventListener("input", function () {
      const searchTerm = this.value.toLowerCase().trim();
      const resourceItems = document.querySelectorAll(".resource-item");

      resourceItems.forEach((item) => {
        const resourceTitle = item
          .querySelector("h3")
          .textContent.toLowerCase();
        const resourceDesc = item.querySelector("p").textContent.toLowerCase();
        const shouldShow =
          resourceTitle.includes(searchTerm) ||
          resourceDesc.includes(searchTerm);
        item.style.display = shouldShow ? "flex" : "none";
      });
    });
  }
}

// Khởi tạo xử lý biểu mẫu cài đặt
function initSettingsForms() {
  // Xử lý biểu mẫu thông tin cá nhân
  const personalInfoForm = document.querySelector(
    "#settings .settings-section:nth-child(1) form"
  );
  if (personalInfoForm) {
    personalInfoForm.addEventListener("submit", function (e) {
      e.preventDefault();

      // Hiển thị thông báo
      showNotification("Thông tin cá nhân đã được cập nhật thành công!");
    });
  }

  // Xử lý biểu mẫu thay đổi mật khẩu
  const passwordForm = document.querySelector(
    "#settings .settings-section:nth-child(2) form"
  );
  if (passwordForm) {
    passwordForm.addEventListener("submit", function (e) {
      e.preventDefault();

      const currentPassword = document.getElementById("current-password").value;
      const newPassword = document.getElementById("new-password").value;
      const confirmPassword = document.getElementById("confirm-password").value;

      if (newPassword !== confirmPassword) {
        showNotification("Mật khẩu xác nhận không khớp!", "error");
        return;
      }

      if (newPassword.length < 6) {
        showNotification("Mật khẩu mới phải có ít nhất 6 ký tự!", "error");
        return;
      }

      // Đặt lại giá trị trường
      document.getElementById("current-password").value = "";
      document.getElementById("new-password").value = "";
      document.getElementById("confirm-password").value = "";

      // Hiển thị thông báo
      showNotification("Mật khẩu đã được cập nhật thành công!");
    });
  }

  // Xử lý biểu mẫu tùy chọn thông báo
  const notificationForm = document.querySelector(
    "#settings .settings-section:nth-child(3) form"
  );
  if (notificationForm) {
    notificationForm.addEventListener("submit", function (e) {
      e.preventDefault();

      // Hiển thị thông báo
      showNotification("Tùy chọn thông báo đã được lưu!");
    });
  }

  // Xử lý nút tạm ngưng và xóa tài khoản
  const suspendButton = document.querySelector(".btn-outline-danger");
  if (suspendButton) {
    suspendButton.addEventListener("click", function () {
      if (confirm("Bạn có chắc chắn muốn tạm ngưng tài khoản không?")) {
        showNotification("Tài khoản đã được tạm ngưng!");
      }
    });
  }

  const deleteButton = document.querySelector(".btn-danger");
  if (deleteButton) {
    deleteButton.addEventListener("click", function () {
      if (
        confirm(
          "Bạn có chắc chắn muốn xóa tài khoản? Hành động này không thể hoàn tác!"
        )
      ) {
        showNotification("Tài khoản đã được xóa!");
      }
    });
  }
}

// Hiển thị thông báo
function showNotification(message, type = "success") {
  // Kiểm tra xem đã có thông báo nào chưa
  let notification = document.querySelector(".notification");

  // Nếu chưa có, tạo một thông báo mới
  if (!notification) {
    notification = document.createElement("div");
    notification.classList.add("notification");
    document.body.appendChild(notification);
  }

  // Đặt lớp kiểu và nội dung thông báo
  notification.className = "notification";
  notification.classList.add(type);
  notification.textContent = message;

  // Hiển thị thông báo
  notification.classList.add("show");

  // Tự động ẩn thông báo sau 3 giây
  setTimeout(() => {
    notification.classList.remove("show");
  }, 4000);
}

// Xử lý xóa dấu trang
const removeBookmarkButtons = document.querySelectorAll(".remove-bookmark");
if (removeBookmarkButtons) {
  removeBookmarkButtons.forEach((button) => {
    button.addEventListener("click", function () {
      const resourceItem = this.closest(".resource-item");
      if (
        resourceItem &&
        confirm("Bạn có chắc muốn xóa dấu trang này không?")
      ) {
        resourceItem.classList.add("fade-out");

        // Xóa phần tử sau khi hoàn thành hiệu ứng
        setTimeout(() => {
          resourceItem.remove();
        }, 300);
      }
    });
  });
}
