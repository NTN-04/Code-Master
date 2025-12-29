// Trang My Blog - Quản lý bài đăng cá nhân cho người dùng đã đăng nhập
import {
  ref,
  get,
  onValue,
  remove,
  update,
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-database.js";
import { auth, database } from "./firebaseConfig.js";
import { uploadToCloudinary } from "./cloudinary-service.js";
import { openModal, closeModal, attachModalDismiss } from "./utils/modal.js";
import { showFloatingNotification as showToast } from "./utils/notifications.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-auth.js";

// Các phần tử DOM
const blogListEl = document.getElementById("blog-list");
const statusFilterBtns = document.querySelectorAll(".status-filter button");
const noPostsMessage = document.getElementById("no-posts-message");
const searchInput = document.getElementById("search-input");
const searchBtn = document.getElementById("search-btn");
const blogBackBtn = document.querySelector(".blog-back");

// Biến
let currentUser = null;
let userBlogs = [];
let currentFilter = "all"; // Bộ lọc mặc định: tất cả bài viết
let searchQuery = "";
const BLOGS_PER_PAGE = 4; // phân trang
let currentPage = 1;

// Kiểm tra trạng thái đăng nhập và chuyển hướng nếu chưa đăng nhập
async function checkAuth() {
  // Lấy user từ Firebase Auth
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      userBlogs = []; // Xóa dữ liệu bài viết khi đăng xuất
      window.location.href = "login.html";
      return;
    }
    currentUser = user;
    // Lấy thông tin user từ database
    const userRef = ref(database, "users/" + currentUser.uid);
    const userSnap = await get(userRef);
    const userData = userSnap.exists() ? userSnap.val() : {};

    document.getElementById("user-name").textContent =
      currentUser.displayName || userData.username || "Ẩn danh";
    document.getElementById("user-email").textContent = currentUser.email;

    // Tải avatar người dùng
    const userAvatar = document.getElementById("user-avatar");
    const base64 = localStorage.getItem("profile-avatar-" + currentUser.uid);
    if (userData.avatar) {
      userAvatar.src = userData.avatar;
      // Đồng bộ lại localStorage nếu cần
      localStorage.setItem(
        "profile-avatar-" + currentUser.uid,
        userData.avatar
      );
    } else if (base64) {
      userAvatar.src = base64;
    } else {
      userAvatar.src = "assets/images/avatar-default.jpg";
    }

    // Lấy các bài viết của người dùng
    fetchUserBlogs();
  });
}

// Lấy các blog thuộc về người dùng hiện tại
function fetchUserBlogs() {
  const blogsRef = ref(database, "blogs");

  onValue(blogsRef, (snapshot) => {
    userBlogs = []; // reset mảng trước khi đỗ lại data
    const data = snapshot.val();

    if (data) {
      Object.keys(data).forEach((key) => {
        const blog = data[key];
        if (blog.authorId === currentUser.uid) {
          userBlogs.push({
            id: key,
            ...blog,
          });
        }
      });

      // Sắp xếp blog theo ngày tạo (mới nhất lên đầu)
      userBlogs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      // Áp dụng bộ lọc hiện tại và hiện thị blog
      filterAndRenderBlogs();
    } else {
      showNoPostsMessage();
    }
  });
}

// Lọc và hiển thị blog
function filterAndRenderBlogs() {
  let filteredBlogs = [...userBlogs];

  // Áp dụng bộ lọc trạng thái (nếu kp all)
  if (currentFilter !== "all") {
    filteredBlogs = filteredBlogs.filter(
      (blog) => blog.status === currentFilter
    );
  }

  // Áp dụng tìm kiếm nếu có
  if (searchQuery.trim() !== "") {
    const query = searchQuery.toLowerCase().trim();
    filteredBlogs = filteredBlogs.filter(
      (blog) =>
        blog.title.toLowerCase().includes(query) ||
        blog.description.toLowerCase().includes(query) ||
        (blog.tags &&
          blog.tags.some((tag) => tag.toLowerCase().includes(query)))
    );
  }

  // Hiển thị thông báo nếu không có bài viết nào phù hợp
  if (filteredBlogs.length === 0) {
    showNoPostsMessage();
    return;
  }

  // Ẩn thông báo không có bài viết
  noPostsMessage.style.display = "none";

  // Hiển thị danh sách blog đã lọc
  renderBlogs(filteredBlogs);

  // Cập nhật số lượng bài viết theo trạng thái
  updateStatusCounts();
}

// Hiển thị danh sách blog
function renderBlogs(blogs) {
  blogListEl.innerHTML = "";

  // Phân trang
  const totalBlogs = blogs.length;
  const totalPages = Math.ceil(totalBlogs / BLOGS_PER_PAGE);
  if (currentPage > totalPages) currentPage = 1;
  const startIdx = (currentPage - 1) * BLOGS_PER_PAGE;
  const endIdx = startIdx + BLOGS_PER_PAGE;
  const blogsToShow = blogs.slice(startIdx, endIdx);

  blogsToShow.forEach((blog) => {
    const blogCard = createBlogCard(blog);
    blogListEl.appendChild(blogCard);
  });

  // render phân trang
  renderPagination(totalPages);
}

// Tạo phần tử blog card
function createBlogCard(blog) {
  const blogCard = document.createElement("li");
  blogCard.className = "blog-card";
  blogCard.dataset.id = blog.id;

  // Tạo HTML cho tags
  let tagsHtml = "";
  if (blog.tags && blog.tags.length > 0) {
    tagsHtml = blog.tags
      .map((tag) => `<span class="blog-tag">${tag}</span>`)
      .join("");
  }

  // Lớp trạng thái và text trạng thái dựa vào status của blog
  let statusClass = "";
  let statusText = "";

  switch (blog.status) {
    case "published":
      statusClass = "status-published";
      statusText = "Đã xuất bản";
      break;
    case "pending":
      statusClass = "status-pending";
      statusText = "Chờ duyệt";
      break;
    default:
      statusClass = "status-pending";
      statusText = "Chờ duyệt"; // chờ duyệt
  }

  // Tạo HTML cho blog card
  blogCard.innerHTML = `
    <div class="blog-info">
      <h3 class="blog-title">${blog.title}</h3>
      <div class="blog-meta">
        <span><i class="far fa-calendar"></i> ${blog.createdAt}</span>
        <span><i class="far fa-eye"></i> ${blog.views || 0}</span>
        <span class="blog-status ${statusClass}">
          <i class="far fa-circle"></i> ${statusText}
        </span>
      </div>
      <div class="blog-tags">${tagsHtml}</div>
      <p class="blog-content">${(blog.content || "").slice(0, 120)}</p>
      <div class="blog-actions">
        <a href="blog-detail.html?id=${
          blog.id
        }" class="blog-action blog-view" title="Xem bài viết">
          <i class="far fa-eye"></i> Xem
        </a>
        <button class="blog-action blog-edit" title="Chỉnh sửa">
          <i class="far fa-edit"></i> Sửa
        </button>
        <button class="blog-action blog-delete" title="Xóa bài viết">
          <i class="far fa-trash-alt"></i> Xóa
        </button>
      </div>
    </div>
    ${
      blog.image
        ? `<img src="${blog.image}" alt="${blog.title}" class="blog-image">`
        : ""
    }
  `;

  // Thêm sự kiện cho nút sửa và xóa
  const editBtn = blogCard.querySelector(".blog-edit");
  const deleteBtn = blogCard.querySelector(".blog-delete");

  editBtn.addEventListener("click", () => {
    handleEditBlog(blog);
  });

  deleteBtn.addEventListener("click", () => {
    deleteBlog(blog.id, blog.title);
  });

  return blogCard;
}

// Hàm render phân trang
function renderPagination(totalPages) {
  const pagination = document.getElementById("blog-pagination");
  if (!pagination) return;
  if (totalPages <= 1) {
    pagination.innerHTML = "";
    return;
  }

  let html = "";
  // Prev
  html += `<button class="page-btn btn-prev"${
    currentPage === 1 ? "disable" : ""
  } >
  <i class="fa-solid fa-arrow-left"></i></button>`;
  // Số trang
  for (let i = 1; i <= totalPages; i++) {
    html += `<button class="page-btn${
      i === currentPage
    } ? 'active' : '' " data-page=${i}>
      ${i}
    </button>`;
  }
  // Next
  html += `<button class="page-btn btn-next" ${
    currentPage === totalPages ? "disable" : ""
  } >
  <i class="fa-solid fa-arrow-right"></i></button>`;

  pagination.innerHTML = html;

  // Sự kiện các nút
  pagination.document.querySelectorAll(".page-btn").forEach((btn) => {
    btn.onclick = function () {
      currentPage = Number(this.getAttribute("data-page"));
      filterAndRenderBlogs();
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
  });
  // prev/next
  const nextBtn = document.querySelector(".btn-next");
  const prevBtn = document.querySelector(".btn-prev");
  if (prevBtn) {
    prevBtn.onclick = function () {
      if (currentPage > 1) {
        currentPage--;
        filterAndRenderBlogs();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    };
  }
  if (nextBtn) {
    nextBtn.onclick = function () {
      if (currentPage < totalPages) {
        currentPage++;
        filterAndRenderBlogs();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    };
  }
}

// Sửa bài viết
function handleEditBlog(blog) {
  // DOM
  const editBlogModal = document.getElementById("edit-blog-modal");
  const closeEditModal = document.getElementById("close-post-modal");
  const editBlogForm = document.getElementById("blog-post-form");
  const editTitleInput = document.getElementById("edit-title");
  const editContent = document.getElementById("edit-content");
  const editTagsInput = document.getElementById("edit-tags");
  const editImageInput = document.getElementById("edit-image");
  const editImagePreview = document.getElementById("image-preview");

  if (editBlogModal) {
    openModal(editBlogModal, { display: "flex" });
    // Đóng modal backdrop và btn close
    attachModalDismiss(editBlogModal, { closeOnBackdrop: true });
  }

  // SimpleMDE
  if (!window.simpleMDE) {
    window.simpleMDE = new window.SimpleMDE({
      element: editContent,
      toolbar: [
        "bold",
        "italic",
        "heading",
        "|",
        "quote",
        "unordered-list",
        "ordered-list",
        "|",
        "link",
        "image",
        "code",
        {
          name: "inline-code",
          action: function (editor) {
            var cm = editor.codemirror;
            var selection = cm.getSelection();
            if (selection) {
              cm.replaceSelection("`" + selection + "`");
            } else {
              cm.replaceSelection("`your code here`");
            }
          },
          className: "fa fa-keyboard",
          title: "Chèn code nội tuyến",
        },
        "|",
        "preview",
        "side-by-side",
        "fullscreen",
        "|",
        "guide",
      ],
      placeholder: "Nhập nội dung Markdown của bạn ở đây...",
      spellChecker: false,
      status: false,
    });
  }
  const mde = simpleMDE;

  // đỗ dữ liệu vào form
  editTitleInput.value = blog.title;
  editTagsInput.value = (blog.tags || []).join(", ");
  mde.value(blog.content || "");
  if (blog.image) {
    editImagePreview.src = blog.image;
    editImagePreview.style.display = "block";
  } else {
    editImagePreview.style.display = "none";
  }

  // hiển thị ảnh preview (không dùng Base64)
  editImageInput.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast("Ảnh tối đa 5MB", "error");
      return;
    }
    const url = URL.createObjectURL(file);
    editImagePreview.src = url;
    editImagePreview.style.display = "block";
    editImageInput._selectedFile = file;
    localStorage.removeItem("myBlog-edit-image");
  };

  // Xử lý submit
  editBlogForm.onsubmit = async (e) => {
    e.preventDefault();
    // Validate
    if (!editTitleInput.value.trim()) {
      showToast("Vui lòng nhập tiêu đề!", "warning");
      return;
    }
    if (!mde.value().trim()) {
      showToast("Vui lòng nhập nội dung!", "warning");
      return;
    }
    // Chuẩn bị dữ liệu
    const tags = editTagsInput.value
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    // Tạo object dữ liệu update
    const blogData = {
      title: editTitleInput.value.trim(),
      content: mde.value(),
      tags,
      updatedAt: new Date().toLocaleDateString("vi-VN"),
      status: "pending",
    };
    // Nếu có ảnh mới thì upload Cloudinary, không thì giữ nguyên ảnh cũ
    if (editImageInput._selectedFile) {
      const url = await uploadToCloudinary(editImageInput._selectedFile);
      if (!url) {
        showToast("Upload ảnh thất bại", "error");
        return;
      }
      blogData.image = url;
    }
    try {
      // Cập nhật Firebase
      const blogRef = ref(database, `blogs/${blog.id}`);
      await update(blogRef, blogData);

      e.target.reset();
      // Xóa tham chiếu file tạm
      editImageInput._selectedFile = null;
      showToast("Đã lưu thay đổi, chờ duyệt lại!", "success");

      closeModal(editBlogModal);
      fetchUserBlogs(); // reload lại danh sách
    } catch (err) {
      console.error("Lỗi: ", err);
      showToast("Có lỗi khi lưu!", "error");
    }
  };
}

// Xóa blog khỏi Firebase
function deleteBlog(blogId, blogTitle) {
  const blogRef = ref(database, `blogs/${blogId}`);

  const confirmation = confirm(
    `Bạn có chắc chắn muốn xóa bài viết "${blogTitle}"?`
  );

  if (confirmation) {
    remove(blogRef)
      .then(() => {
        showToast("Xóa bài viết thành công", "success");
      })
      .catch((error) => {
        console.error("Lỗi khi xóa blog:", error);
        showToast("Xóa bài viết thất bại", "error");
      });
  }
}

// Hiển thị thông báo (toast)
// function showToast(message, type = "info") {
//   const toastContainer =
//     document.getElementById("toast-container") || createToastContainer();

//   const toast = document.createElement("div");
//   toast.className = `toast toast-${type}`;
//   toast.innerHTML = `
//     <div class="toast-content">
//       <i class="${getToastIcon(type)}"></i>
//       <span>${message}</span>
//     </div>
//   `;

//   toastContainer.appendChild(toast);

//   setTimeout(() => {
//     toast.classList.add("show");
//   }, 10);

//   setTimeout(() => {
//     toast.classList.remove("show");
//     setTimeout(() => {
//       toast.remove();
//     }, 300);
//   }, 4000);
// }

// // Tạo toast container nếu chưa có
// function createToastContainer() {
//   const container = document.createElement("div");
//   container.id = "toast-container";
//   document.body.appendChild(container);
//   return container;
// }

// // Lấy icon phù hợp cho từng loại toast
// function getToastIcon(type) {
//   switch (type) {
//     case "success":
//       return "fas fa-check-circle";
//     case "error":
//       return "fas fa-exclamation-circle";
//     case "warning":
//       return "fas fa-exclamation-triangle";
//     default:
//       return "fas fa-info-circle";
//   }
// }

// Hiển thị thông báo khi không có bài viết
function showNoPostsMessage() {
  noPostsMessage.style.display = "flex";
  blogListEl.innerHTML = "";
}

// Cập nhật số lượng bài viết theo trạng thái
function updateStatusCounts() {
  const allCount = userBlogs.length;
  const publishedCount = userBlogs.filter(
    (blog) => blog.status === "published"
  ).length;
  const pendingCount = userBlogs.filter(
    (blog) => blog.status === "pending"
  ).length;

  document.getElementById("all-count").textContent = allCount;
  document.getElementById("published-count").textContent = publishedCount;
  document.getElementById("pending-count").textContent = pendingCount;
}

// Các sự kiện
function addEventListeners() {
  // Nút lọc trạng thái
  statusFilterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      // Bỏ class active ở tất cả các nút
      statusFilterBtns.forEach((b) => b.classList.remove("active"));

      // Thêm class active cho nút được bấm
      btn.classList.add("active");

      // Cập nhật bộ lọc hiện tại
      currentFilter = btn.dataset.status;

      // Áp dụng bộ lọc
      filterAndRenderBlogs();
    });
  });

  // Tìm kiếm
  searchBtn.addEventListener("click", performSearch);
  searchInput.addEventListener("input", (e) => {
    performSearch();
  });

  // Nút quay lại
  blogBackBtn.addEventListener("click", () => {
    window.location.href = "blog.html";
  });
}

// Thực hiện tìm kiếm
function performSearch() {
  searchQuery = searchInput.value;
  filterAndRenderBlogs();
}

// Khởi tạo trang
function initPage() {
  checkAuth();
  addEventListeners();
}

// Bắt đầu khi DOM đã sẵn sàng
document.addEventListener("DOMContentLoaded", initPage);
