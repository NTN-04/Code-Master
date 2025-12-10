import { auth, database } from "./firebaseConfig.js";
import { uploadToCloudinary } from "./cloudinary-service.js";
import { openModal, closeModal, attachModalDismiss } from "./utils/modal.js";
import { showFloatingNotification as showNotification } from "./utils/notifications.js";
import {
  ref,
  get,
  push,
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-database.js";

// Chức năng trang blog
document.addEventListener("DOMContentLoaded", function () {
  // Tải data blog
  loadBlogsFromDatabase();

  // thiết lặp modal đăng bài
  setupPostModal();
});

// Khởi tạo biến trạng thái
let filterTag = "";
let searchTerm = "";
let blogsArray = [];
// Phân trang
const BLOGS_PER_PAGE = 4;
let currentPage = 1;
// biến lưu users
let usersMap = {};

async function loadUsersMap() {
  const usersRef = ref(database, "users");
  const snap = await get(usersRef);
  if (snap.exists()) {
    usersMap = snap.val();
  } else {
    usersMap = {};
  }
}

// Tải bài viết từ Firebase Realtime Database
async function loadBlogsFromDatabase() {
  try {
    showBlogsLoading();

    await loadUsersMap();

    const blogsRef = ref(database, "blogs");
    const snapshot = await get(blogsRef);

    if (snapshot.exists()) {
      const blogsData = snapshot.val();
      renderBlogsData(blogsData);
      renderSidebarTags(blogsData);
      // khởi tạo filter
      initBlogFiltering();
    } else {
      showNoBlogsMessage();
    }
  } catch (error) {
    console.error("Lỗi khi tải blog:", error);
    showErrorMessage();
  }
}

// Hiển thị ds bài viết
function renderBlogsData(blogsData) {
  const blogList = document.getElementById("blog-list");
  if (!blogList) return;

  // Nếu blogsData không truyền vào (undefined), dùng blogsArray đã lưu
  let dataArr;
  if (blogsData) {
    dataArr = Object.entries(blogsData)
      .map(([id, b]) => ({ ...b, id })) // Gán id từ key
      .sort((a, b) => {
        // Nếu createdAt là chuỗi "dd/mm/yyyy" chuyển về timestamp
        const ta = Date.parse(a.createdAt.split("/").reverse().join("-"));
        const tb = Date.parse(b.createdAt.split("/").reverse().join("-"));
        return tb - ta;
      });
    blogsArray = dataArr;
  } else {
    dataArr = blogsArray;
  }

  let filtered = dataArr;
  // Chỉ lấy và render bài đã duyệt
  filtered = filtered.filter(
    (b) => b.status === "published" || b.status === "đã duyệt"
  );

  // Lọc theo tag/chủ đề
  if (filterTag) {
    filtered = filtered.filter((b) =>
      (b.tags || []).some((t) => t.toLowerCase().includes(filterTag))
    );
  }

  // Lọc theo từ khóa tìm kiếm
  if (searchTerm) {
    filtered = filtered.filter(
      (b) =>
        (b.title && b.title.toLowerCase().includes(searchTerm)) ||
        (b.content && b.content.toLowerCase().includes(searchTerm)) ||
        (b.authorName && b.authorName.toLowerCase().includes(searchTerm))
    );
  }

  // Phân trang
  const totalBlogs = filtered.length;
  const totalPages = Math.ceil(totalBlogs / BLOGS_PER_PAGE);
  if (currentPage > totalPages) currentPage = 1;
  const startIdx = (currentPage - 1) * BLOGS_PER_PAGE;
  const endIdx = startIdx + BLOGS_PER_PAGE;
  const blogsToShow = filtered.slice(startIdx, endIdx);

  blogList.innerHTML = blogsToShow.length
    ? blogsToShow.map(createBlogCard).join("")
    : "<li>Chưa có bài viết nào.</li>";

  // Render phân trang
  renderPagination(totalPages);
  // click card
  addBlogCardClickEvents();
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

  // Nút Prev
  html += `<button class="page-btn btn-prev"${
    currentPage === 1 ? " disabled" : ""
  } data-nav="prev">
    <i class="fa-solid fa-arrow-left"></i>
  </button>`;

  // Nút số trang
  for (let i = 1; i <= totalPages; i++) {
    html += `
      <button class="page-btn${
        i === currentPage ? " active" : ""
      }" data-page="${i}">${i}
      </button>
    `;
  }

  // Nút Next
  html += `<button class="page-btn btn-next"${
    currentPage === totalPages ? " disabled" : ""
  } data-nav="next">
    <i class="fa-solid fa-arrow-right"></i>
  </button>`;

  pagination.innerHTML = html;

  // Gán sự kiện click cho nút trang
  pagination.querySelectorAll(".page-btn").forEach((btn) => {
    btn.onclick = function () {
      currentPage = Number(this.getAttribute("data-page"));
      renderBlogsData();
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
  });

  // Sự kiện cho nút Prev/Next
  const prevBtn = pagination.querySelector(".btn-prev");
  const nextBtn = pagination.querySelector(".btn-next");
  if (prevBtn) {
    prevBtn.onclick = function () {
      if (currentPage > 1) {
        currentPage--;
        renderBlogsData();
        // hiệu ứng cuộn
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    };
  }
  if (nextBtn) {
    nextBtn.onclick = function () {
      if (currentPage < totalPages) {
        currentPage++;
        renderBlogsData();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    };
  }
}

// Hiển thị động sidebar
function renderSidebarTags(blogsData) {
  const sidebar = document.querySelector(".blog-topic-list");
  if (!sidebar) return;

  // Lấy tất cả tags từ blogs
  const tagSet = new Set(); // set() lưu value không trùng lặp
  Object.values(blogsData).forEach((b) => {
    (b.tags || []).forEach((tag) => tagSet.add(tag.trim()));
  });

  // Nếu không có tag nào, giữ nguyên mặc định
  if (tagSet.size === 0) return;

  // Tạo HTML cho tag
  sidebar.innerHTML = Array.from(tagSet)
    .map((tag) => `<span class="blog-topic">${escapeHTML(tag)}</span>`)
    .join("");
}

// Tạo HTML cho một thẻ blog
function createBlogCard(b) {
  // lấy thông tin người dùng từ user nếu có
  const user = usersMap[b.authorId] || {};
  const authorAvatar =
    user.avatar || b.authorAvatar || "assets/images/avatar-default.jpg";
  const authorName = user.username || b.authorName || "Ẩn danh";
  return `
    <li class="blog-card" data-id="${b.id}">
      <img class="blog-avatar" src="${authorAvatar}" alt="avatar">
      <div class="blog-info">
        <span>${escapeHTML(authorName)}</span>
        <div class="blog-title">${escapeHTML(b.title)}</div>
        
        <div class="blog-tags">
          ${(b.tags || [])
            .map((t) => `<span class="blog-tag">${escapeHTML(t)}</span>`)
            .join(" ")}
        </div>
        <div class="blog-content">${escapeHTML(b.content || "").slice(
          0,
          120
        )}...</div>
        <div class="blog-meta"> 
          <span>${b.createdAt}</span>
          <span>${estimateReadTime(b.content)}</span>
          <span>${b.views || 0} lượt xem</span>
          <div class="blog-actions">
          <span><i class="fa-regular fa-thumbs-up"></i> ${b.likes || 0} </span>
        </div>
        </div>
        
      </div>
      ${
        b.image
          ? `<img src="${b.image}" alt="${b.title}" class="blog-image">`
          : ""
      }
    </li>
  `;
}

// Lăng nghe sự kiện click vao card
function addBlogCardClickEvents() {
  document.querySelectorAll(".blog-card").forEach((card) => {
    card.addEventListener("click", function () {
      const id = this.getAttribute("data-id");
      if (id) window.location.href = `blog-detail.html?id=${id}`;
    });
  });
}
// Hiển thị skeleton loading cho blog
function showBlogsLoading() {
  const blogList = document.getElementById("blog-list");
  if (blogList) {
    let skeletonHTML = "";
    for (let i = 0; i < 3; i++) {
      skeletonHTML += `<li class="blog-card skeleton"></li>`;
    }
    blogList.innerHTML = skeletonHTML;
  }
}
// Hiển thị thông báo khi không có blog
function showNoBlogsMessage() {
  const blogList = document.getElementById("blog-list");
  if (blogList) {
    blogList.innerHTML = `<li>Chưa có bài viết nào.</li>`;
  }
}
// Hiển thị thông báo lỗi
function showErrorMessage() {
  const blogList = document.getElementById("blog-list");
  if (blogList) {
    blogList.innerHTML = `<li>Không thể tải bài viết. Vui lòng thử lại sau.</li>`;
  }
}

// Escape HTML
function escapeHTML(str) {
  if (!str) return "";
  return str.replace(/[&<>"]|'/g, function (c) {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c];
  });
}

// Ước tính số phút đọc
function estimateReadTime(content) {
  if (!content) return "1 phút đọc";
  const words = content.split(/\s+/).length;
  const min = Math.max(1, Math.round(words / 200));
  return `${min} phút đọc`;
}

// Khởi tạo filter/tìm kiếm (
function initBlogFiltering() {
  // Lọc theo tag/chủ đề
  document.querySelectorAll(".blog-topic").forEach((tagEl) => {
    tagEl.addEventListener("click", function () {
      filterTag = this.textContent.trim().toLowerCase();
      currentPage = 1;
      // Thay đổi title và mô tả
      const label = this.textContent.trim();
      const heading = document.querySelector(".blog-heading h1");
      const desc = document.querySelector(".blog-desc");
      if (heading)
        heading.textContent = `Tag: ${
          label.charAt(0).toUpperCase() + label.slice(1)
        }`;
      if (desc) desc.textContent = `Các bài viết thuộc chủ đề "${label}"`;
      renderBlogsData();
    });
  });
  // Xem tất cả
  const viewAllBtn = document.getElementById("view-all");
  if (viewAllBtn) {
    viewAllBtn.addEventListener("click", function (e) {
      e.preventDefault();
      filterTag = "";
      currentPage = 1;
      // Trả lại tiêu đề và mô tả mặc định
      const heading = document.querySelector(".blog-heading h1");
      const desc = document.querySelector(".blog-desc");
      if (heading) heading.textContent = "Bài viết mới";
      if (desc)
        desc.textContent =
          "Tổng hợp các bài viết chia sẻ về kinh nghiệm, kiến thức và kĩ năng học lập trình và các kỹ thuật lập trình web.";
      renderBlogsData();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }
  // Tìm kiếm
  const searchInput = document.getElementById("blog-search");
  if (searchInput) {
    searchInput.addEventListener("input", function () {
      searchTerm = this.value.trim().toLowerCase();
      currentPage = 1;
      renderBlogsData();
    });
  }
}

// ===== Modal Đăng Bài Viết ===== //

// Xử lý chọn ảnh: preview bằng object URL, không lưu Base64
const postImageInput = document.getElementById("post-image");
const imagePreview = document.getElementById("image-preview");

if (postImageInput) {
  postImageInput.addEventListener("change", function (e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) {
      showNotification("Ảnh tối đa 5MB", "error");
      return;
    }
    postImageInput._selectedFile = file;
    if (imagePreview) {
      const url = URL.createObjectURL(file);
      imagePreview.src = url;
      imagePreview.style.display = "block";
    }
  });
}

let simpleMde = null;

//  Thiết lặp modal
function setupPostModal() {
  const blogCta = document.querySelector(".blog-cta");
  const openModalBtn = document.getElementById("open-post-modal");
  const postModal = document.getElementById("post-modal");
  const closeModalBtn = document.getElementById("close-post-modal");
  const postForm = document.getElementById("blog-post-form");

  if (!openModalBtn || !postModal || !closeModalBtn || !postForm) return;

  // Luôn kiểm tra trạng thái đăng nhập khi DOMContentLoaded
  auth.onAuthStateChanged((user) => {
    if (!user) {
      blogCta.style.display = "none";
    } else {
      const userData = JSON.parse(localStorage.getItem("codemaster_user"));

      if (userData && userData.role == "1") {
        blogCta.style.display = "none";
      } else {
        blogCta.style.display = "block";
      }
    }
  });

  // Khởi tạo SimpleMDE khi mở modal lần đầu
  // Đóng modal (backdrop click, buttons)
  attachModalDismiss(postModal, { closeOnBackdrop: true });

  openModalBtn.onclick = () => {
    const user = auth.currentUser;
    if (!user) {
      showNotification("Bạn cần đăng nhập để đăng bài!", "error");
      window.location.href = "login.html";
      return;
    }
    openModal(postModal, { display: "flex" });
    if (!simpleMde) {
      // Thiết lặp simpleMDE
      simpleMde = new SimpleMDE({
        element: document.getElementById("post-content"),
        // Cấu hình thanh công cụ
        toolbar: [
          "bold", // In đậm
          "italic", // In nghiêng
          "heading", // Tiêu đề
          "|", // Dấu phân cách (separator)
          "quote", // Trích dẫn
          "unordered-list", // Danh sách không thứ tự
          "ordered-list", // Danh sách có thứ tự
          "|",
          "link", // Liên kết
          "image", // Hình ảnh
          "code", // BIỂU TƯỢNG CHÈN CODE (thường là `< >`)
          {
            name: "inline-code", // Tên nút
            action: function (editor) {
              // Lấy văn bản được chọn
              var cm = editor.codemirror;
              var selection = cm.getSelection();

              // Nếu có văn bản được chọn, bao quanh nó bằng dấu huyền
              if (selection) {
                cm.replaceSelection("`" + selection + "`");
              } else {
                // Nếu không có văn bản được chọn, chèn cú pháp mẫu
                cm.replaceSelection("`your code here`");
              }
            },
            className: "fa fa-keyboard", // Icon của nút
            title: "Chèn code nội tuyến", // Chú thích khi di chuột qua
          },
          "|",
          "preview", // Xem trước (hình con mắt)
          "side-by-side", // Chế độ xem song song
          "fullscreen", // Toàn màn hình
          "|",
          "guide", // Hướng dẫn Markdown
        ],

        // Các tùy chọn khác có thể có (ví dụ)
        placeholder: "Nhập nội dung Markdown của bạn ở đây...",
        spellChecker: false, // Tắt kiểm tra chính tả của trình duyệt (mặc định là true)
        status: false, // Ẩn thanh trạng thái dưới cùng
      });
    }
  };

  postForm.onsubmit = handlePostFormSubmit;
}

// Xử lý form submit
async function handlePostFormSubmit(e) {
  e.preventDefault();

  if (!simpleMde) {
    showNotification(
      "Vui lòng mở modal và nhập nội dung trước khi đăng bài!",
      "error"
    );
    return;
  }
  const user = auth.currentUser;
  if (!user) {
    showNotification("Bạn cần đăng nhập để đăng bài!", "error");
    return;
  }

  // Chuẩn bị dữ liệu
  const title = document.getElementById("post-title").value.trim();
  const content = simpleMde.value();
  if (!content.trim()) {
    showNotification("Vui lòng nhập nội dung bài viết!", "warning");
    return;
  }
  const tags = document
    .getElementById("post-tags")
    .value.split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  // Upload ảnh nếu có file
  let image = "";
  if (postImageInput && postImageInput._selectedFile) {
    image = await uploadToCloudinary(postImageInput._selectedFile);
    if (!image) {
      showNotification("Upload ảnh thất bại", "error");
      return;
    }
  }
  // Lấy thông tin user avatar từ database
  const userRef = ref(database, "users/" + user.uid);
  const userSnap = await get(userRef);
  const userData = userSnap.exists() ? userSnap.val() : {};

  const blogData = {
    title,
    content,
    tags,
    image, // lưu URL Cloudinary
    authorId: user.uid,
    authorName: user.displayName || "Ẩn danh",
    // Lấy ảnh đại diện
    authorAvatar:
      userData.avatar ||
      localStorage.getItem("profile-avatar-" + user.uid) ||
      "assets/images/avatar-default.jpg",
    createdAt: new Date().toLocaleDateString("vi-VN"),
    status: "pending",
  };

  try {
    await push(ref(database, "blogs"), blogData);
    showNotification("Đăng bài thành công! Chờ admin duyệt bài.", "success");
    e.target.reset();
    simpleMde.value("");
    closeModal(document.getElementById("post-modal"));

    // Xóa tham chiếu file tạm sau khi đăng thành công
    if (postImageInput) postImageInput._selectedFile = null;
    if (imagePreview) imagePreview.style.display = "none";

    loadBlogsFromDatabase();
  } catch (err) {
    showNotification("Có lỗi khi đăng bài. Vui lòng thử lại!", "error");
  }
}
