import { database } from "./firebaseConfig.js";
import {
  ref,
  get,
  update,
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-database.js";

// Lấy id bài viết từ URL
function getBlogId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

// DOM
const backBtn = document.querySelector(".blog-back");
// Quay lại trang blog
if (backBtn) {
  backBtn.onclick = () => window.history.back();
}

// Hàm render chi tiết bài viết
async function renderBlogDetail() {
  const main = document.querySelector(".blog-detail-content");

  // lấy ID blog
  const blogId = getBlogId();
  if (!blogId || !main) return;

  // Lấy dữ liệu từ Firebase
  const blogRef = ref(database, `blogs/${blogId}`);
  const snapshot = await get(blogRef);

  if (!snapshot.exists()) {
    main.innerHTML =
      "<div class='blog-notfound'>Không tìm thấy bài viết.</div>";
    return;
  }

  const blog = snapshot.val();

  // Tăng lượt xem
  // Kiểm tra sessionStorage để tránh tăng view khi F5
  const viewedKey = `blog_viewed_${blogId}`;
  if (!sessionStorage.getItem(viewedKey)) {
    update(blogRef, { views: (blog.views || 0) + 1 });
    sessionStorage.setItem(viewedKey, "1");
  }

  // Render HTML
  main.innerHTML = `
    <div class="blog-detail-header">
      <div class="blog-detail-title">${escapeHTML(blog.title)}</div>
      <div class="blog-detail-meta">
        <img class="blog-avatar" src="${
          blog.authorAvatar || "assets/images/avatar-default.jpg"
        }" alt="avatar">
        <div class="blog-meta-info">
          <span class="blog-author">${escapeHTML(
            blog.authorName || "Ẩn danh"
          )}</span>
          <span class="blog-date">${
            blog.createdAt ? new Date(blog.createdAt).toLocaleDateString() : ""
          }</span>
          <span class="blog-views"><i class="fa-regular fa-eye"></i> ${
            (blog.views || 0) + 1
          } lượt xem</span>
        </div>
      </div>
      <div class="blog-tags">
        ${(blog.tags || [])
          .map((t) => `<span class="blog-tag">${escapeHTML(t)}</span>`)
          .join(" ")}
      </div>
    </div>
    <div class="blog-detail-content-view">
      ${blog.content ? marked.parse(blog.content) : "<i>Không có nội dung</i>"}
    </div>
  `;
}

// Escape HTML để tránh XSS
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

// Gọi hàm khi trang load
renderBlogDetail();
