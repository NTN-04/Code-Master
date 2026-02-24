import { database } from "./firebaseConfig.js";
import loadingSkeleton from "./utils/loading-skeleton.js";
import {
  ref,
  get,
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-database.js";

// Chức năng trang blog
document.addEventListener("DOMContentLoaded", function () {
  // Tải data blog
  loadBlogsFromDatabase();
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
    (b) => b.status === "published" || b.status === "đã duyệt",
  );

  // Lọc theo tag/chủ đề
  if (filterTag) {
    filtered = filtered.filter((b) =>
      (b.tags || []).some((t) => t.toLowerCase().includes(filterTag)),
    );
  }

  // Lọc theo từ khóa tìm kiếm
  if (searchTerm) {
    filtered = filtered.filter(
      (b) =>
        (b.title && b.title.toLowerCase().includes(searchTerm)) ||
        (b.content && b.content.toLowerCase().includes(searchTerm)) ||
        (b.authorName && b.authorName.toLowerCase().includes(searchTerm)),
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

  // Remove loading state để enable interaction
  loadingSkeleton.hide(blogList);

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
          120,
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
    loadingSkeleton.showBlogs(blogList, 4);
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
