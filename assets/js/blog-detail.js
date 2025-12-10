import { auth, database } from "./firebaseConfig.js";
import {
  ref,
  get,
  update,
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-database.js";
import CommentSystem from "./comment-system.js";
import { showFloatingNotification as showNotification } from "./utils/notifications.js";

document.addEventListener("DOMContentLoaded", function () {
  // Hiện thị nội dung bài blog
  renderBlogDetail();
});

// Biến lưu bình luận
let commentSystem = null;

// Lấy id bài viết từ URL
function getBlogId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
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

// Hàm render chi tiết bài viết
async function renderBlogDetail() {
  const main = document.querySelector(".blog-detail-content");
  const sidebar = document.createElement("aside");
  sidebar.className = "blog-detail-sidebar";

  // Hiển thị trạng thái đang tải
  main.innerHTML = `
    <div class="loading" >
      <span class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></span>
      <span>Đang tải bài viết...</span>
    </div>
  `;

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

  // Lấy thông tin user mới nhất từ bảng users (nếu có)
  let userData = null;
  if (blog.authorId) {
    const userRef = ref(database, "users/" + blog.authorId);
    const userSnap = await get(userRef);
    if (userSnap.exists()) {
      userData = userSnap.val();
    }
  }

  // Ưu tiên lấy avatar,name từ users, nêu k có lấy từ blog
  const authorName = userData?.username || blog.authorName || "Ẩn danh";
  const authorAvatar =
    userData?.avatar || blog.authorAvatar || "assets/images/avatar-default.jpg";

  // Tăng lượt xem
  // Kiểm tra sessionStorage để tránh tăng view khi F5
  const viewedKey = `blog_viewed_${blogId}`;
  if (!sessionStorage.getItem(viewedKey)) {
    update(blogRef, { views: (blog.views || 0) + 1 });
    sessionStorage.setItem(viewedKey, "1");
  }

  // Lấy user hiện tại
  const user = auth.currentUser;

  // Kiểm tra trạng thái like
  const isLiked = user && blog.likedUsers && blog.likedUsers[user.uid];
  const likeCount = blog.likes || 0;
  // Lấy số lượng bình luận từ localStorage (nếu có)
  const commentCount = localStorage.getItem(`blog_comment_count_${blogId}`);

  // Nếu bài viết đang chờ duyệt và là chủ bài viết, hiển thị cảnh báo
  let pendingAlert = "";
  if (blog.status === "pending" && user && user.uid === blog.authorId) {
    pendingAlert = `
    <div class="blog-alert" style="background:#fff3cd;color:#856404;border:1px solid #ffeeba;padding:12px 16px;border-radius:6px;margin-bottom:16px;display:flex;align-items:center;gap:8px;">
      <i class="fas fa-exclamation-circle"></i>
      Bài viết của bạn đang chờ duyệt, chỉ bạn mới xem được!
    </div>
  `;
  }

  // Render HTML (main content)
  main.innerHTML = `
    ${pendingAlert}
    <div class="blog-detail-card">
      <div class="blog-detail-meta-row">
        <div class="blog-detail-meta-author">
          <span>Tác giả:</span>
          <a href="#" class="blog-detail-author-link">${escapeHTML(
            authorName
          )}</a>
        </div>
        <span class="blog-detail-date">${blog.createdAt}</span>
        <span class="blog-detail-views"><i class="fa-regular fa-eye"></i> ${
          blog.views || 0
        }</span>
        
        <span class="blog-detail-share"><i class="fa-solid fa-share"></i> 1</span>
      </div>
       <div class="blog-detail-tags">
        ${(blog.tags || [])
          .map((t) => `<span class="blog-tag">${escapeHTML(t)}</span>`)
          .join(" ")}
      </div>
      <div class="blog-detail-title">${escapeHTML(blog.title)}</div>
      ${
        blog.image
          ? `<img class="blog-detail-image" src="${blog.image}" alt="cover">`
          : ""
      }
      <div class="blog-detail-content-view">
        ${
          blog.content ? marked.parse(blog.content) : "<i>Không có nội dung</i>"
        }
      </div>
     
    </div>
  `;
  // Render sidebar
  sidebar.innerHTML = `
    <div class="blog-sidebar-author-card">
      <div class="blog-sidebar-author-avatar">
        <img src="${authorAvatar}" alt="avatar">
      </div>
      <div class="blog-sidebar-author-info">
        <div class="blog-sidebar-author-name">${escapeHTML(authorName)}</div>
        <div class="blog-sidebar-author-location">${
          blog.authorLocation || ""
        }</div>
        <div class="blog-sidebar-author-meta">
          <span id="blog-like-btn" style="cursor:pointer; color:${
            isLiked ? "#4a6fff" : "#888"
          }">
            <i class="fa-regular fa-thumbs-up"></i> 
            <span id="like-count"> ${likeCount}</span>
          </span> 
           | <span id="blog-comment-btn">
              <i class="fa-regular fa-comments"></i>
              <span id="comment-count">${commentCount || ""}</span>
            </span>
        </div>
      </div>
    </div>
    <div class="blog-sidebar-related">
      <div class="blog-sidebar-related-title">BÀI VIẾT CÙNG TÁC GIẢ</div>
      <div class="blog-sidebar-related-list" id="related-blogs"></div>
    </div>
  `;

  // Thêm sidebar vào DOM
  const container = document.querySelector(".blog-detail-container");
  if (container && !document.querySelector(".blog-detail-sidebar")) {
    container.appendChild(sidebar);
  }

  // Gắn sự kiện like
  const likeBtn = document.getElementById("blog-like-btn");
  if (likeBtn) {
    likeBtn.addEventListener("click", () => handleLike(blogRef, blog));
  }

  initCommentButton();

  // Lấy và render bài viết cùng tác giả
  if (blog.authorId) {
    const blogsRef = ref(database, "blogs");
    const allBlogsSnap = await get(blogsRef);
    if (allBlogsSnap.exists()) {
      const allBlogs = Object.entries(allBlogsSnap.val())
        .map(([id, data]) => ({ id, ...data }))
        .filter((b) => b.authorId === blog.authorId && b.id !== blogId)
        .slice(0, 5);
      const relatedList = document.getElementById("related-blogs");
      if (relatedList) {
        relatedList.innerHTML = allBlogs.length
          ? allBlogs
              .map(
                (b) => `
            <a class="related-blog-item" href="/blog-detail.html?id=${b.id}">
              <img src="${
                b.image || "assets/images/avatar-default.jpg"
              }" alt="thumb">
              <span>${escapeHTML(b.title)}</span>
            </a>
          `
              )
              .join("")
          : `<p style="margin: 0; color: #ccc">Không có bài viết </p>`;
      }
    }
  }
}

// Hàm xử lý like
async function handleLike(blogRef, blog) {
  const user = auth.currentUser;
  if (!user || !user.uid) {
    showNotification("Bạn cần đăng nhập để like bài viết!", "warning");
    window.location.href = "login.html";
    return;
  }
  const userId = user.uid;
  const likeBtn = document.getElementById("blog-like-btn");
  const likeCountEl = document.getElementById("like-count");

  if (blog.likedUsers && blog.likedUsers[userId]) return;

  const newLike = (blog.likes || 0) + 1;
  const updates = {
    likes: newLike,
    [`likedUsers/${userId}`]: true,
  };
  await update(blogRef, updates);

  // Cập nhật giao diện và trạng thái
  likeCountEl.textContent = newLike;
  likeBtn.style.color = "#4a6fff";
  likeBtn.style.pointerEvents = "none"; // Không cho click nữa

  // Cập nhật biến blog trong JS để lần click tiếp theo không thực hiện lại
  if (!blog.likedUsers) blog.likedUsers = {};
  blog.likedUsers[userId] = true;
}

// Cạp nhật số lượng bình luận
function updateBlogCommentCount() {
  if (commentSystem) {
    const count = Array.from(commentSystem.comments.values()).filter(
      (c) => c.status === "active"
    ).length;
    document.getElementById("comment-count").textContent = count;
    // Lưu vào localStorage với key riêng cho từng blog
    localStorage.setItem(`blog_comment_count_${getBlogId()}`, count);
  }
}
window.updateBlogCommentCount = updateBlogCommentCount;

function initCommentButton() {
  // Gắn sự kiện click cho comment
  const commentBtn = document.getElementById("blog-comment-btn");
  const commentPanel = document.getElementById("blog-comments-panel");
  const commentOverlay = document.querySelector(".comments-overlay");

  if (commentBtn && commentPanel) {
    commentBtn.addEventListener("click", () => {
      // Thêm class active để panel trượt ra
      commentOverlay.classList.add("active");
      commentPanel.classList.add("active");
      // Xóa nội dung cũ trước khi render lại
      if (commentSystem) {
        commentSystem.destroy();
      }
      // Khởi tạo hệ thống bình luận cho blog (courseId là blogId, lessonId là "blog")
      commentSystem = new CommentSystem(
        getBlogId(),
        "blog",
        commentPanel,
        true
      );
      document.body.style.overflow = "hidden";
    });
  }
}
