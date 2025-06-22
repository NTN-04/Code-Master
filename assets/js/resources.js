import { auth, database } from "./firebaseConfig.js";
import {
  ref,
  set,
  get,
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-database.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-auth.js";

// Chức năng trang Tài Nguyên
document.addEventListener("DOMContentLoaded", function () {
  // Khởi tạo tab
  initTabs();

  // Load data
  loadResourcesFromFirebase();

  // Khởi tạo chức năng tìm kiếm
  initSearch();

  // Hook và sự kiện chuyển tab
  patchTabSwitchForPaging();
});

// Tự động kích hoạt tab nếu có dấu thăng (hash) trong URL
// Ví dụ: /resources.html#documentation
document.addEventListener("DOMContentLoaded", function () {
  const hash = window.location.hash.replace("#", "");
  if (hash) {
    const tabBtn = document.querySelector(`.tab-btn[data-tab="${hash}"]`);
    const tabContent = document.getElementById(hash);
    if (tabBtn && tabContent) {
      // Remove active from all
      document
        .querySelectorAll(".tab-btn")
        .forEach((btn) => btn.classList.remove("active"));
      document
        .querySelectorAll(".tab-content")
        .forEach((tab) => tab.classList.remove("active"));
      // Activate
      tabBtn.classList.add("active");
      tabContent.classList.add("active");
    }
  }
});

// Khởi tạo điều hướng tab
function initTabs() {
  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  // Thêm sự kiện click cho các nút tab
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      // Xóa class active khỏi tất cả nút và nội dung
      tabButtons.forEach((btn) => btn.classList.remove("active"));
      tabContents.forEach((content) => content.classList.remove("active"));

      // Thêm class active cho nút được click
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

// Khởi tạo chức năng tìm kiếm
function initSearch() {
  const searchInput = document.getElementById("resource-search");
  if (searchInput) {
    searchInput.addEventListener(
      "input",
      debounce(function () {
        const query = searchInput.value.toLowerCase().trim();
        searchResources(query);
      }, 300)
    );
  }
}

/* -- xử lý phân trang cho 'ví dụ mã nguồn' -- */

// số lượng card trên mỗi trang
const EXAMPLES_PER_PAGE = 3;
let currentExamplePage = 1;

// Hàm render phân trang
function renderPagination(filtered = false) {
  const examplesTab = document.getElementById("examples");
  const examplesGrid = examplesTab.querySelector(".examples-grid");
  let allExamples = Array.from(examplesGrid.querySelectorAll(".example-card"));

  // lấy danh sách hiện thị đã lọc (tìm kiếm)
  if (filtered) {
    allExamples = allExamples.filter((card) => card.style.display !== "none");
  }

  // tính tổng số trang
  const totalPages = Math.ceil(allExamples.length / EXAMPLES_PER_PAGE);

  // ẩn/hiện các card theo trang
  allExamples.forEach((card, id) => {
    if (
      id >= (currentExamplePage - 1) * EXAMPLES_PER_PAGE &&
      id < currentExamplePage * EXAMPLES_PER_PAGE
    ) {
      card.style.display = "";
    } else {
      card.style.display = "none";
    }
  });

  // Render nút phân trang
  let pagination = document.getElementById("examples-pagination");
  if (!pagination) {
    pagination = document.createElement("div");
    pagination.id = "examples-pagination";
    pagination.className = "pagination";
    examplesTab.appendChild(pagination);
  }
  pagination.innerHTML = "";

  if (totalPages <= 1) {
    pagination.style.display = "none";
    return;
  }
  pagination.style.display = "flex";

  // Nút prev
  const prevBtn = document.createElement("button");
  prevBtn.className = "btn btn-prev";
  prevBtn.innerHTML = `<i class="fa-solid fa-arrow-left"></i>`;
  prevBtn.disabled = currentExamplePage === 1;
  prevBtn.onclick = function () {
    if (currentExamplePage > 1) {
      currentExamplePage--;
      renderPagination();
    }
  };
  pagination.appendChild(prevBtn);

  // Nút số trang
  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement("button");
    btn.textContent = i;
    if (i === currentExamplePage) btn.className = "active";
    btn.onclick = () => {
      currentExamplePage = i;
      renderPagination();
    };
    pagination.appendChild(btn);
  }

  // Nút next
  const nextBtn = document.createElement("button");
  nextBtn.className = "btn btn-next";
  nextBtn.innerHTML = `<i class="fa-solid fa-arrow-right"></i>`;
  nextBtn.disabled = currentExamplePage === totalPages;
  nextBtn.onclick = function () {
    if (currentExamplePage < totalPages) {
      currentExamplePage++;
      renderPagination();
    }
  };
  pagination.appendChild(nextBtn);
}

// Gọi khi tab 'ví dụ mã nguồn' đc active
function handleExampleTabPaging() {
  const examplesTab = document.getElementById("examples");
  if (examplesTab.classList.contains("active")) {
    renderPagination();
  }
}

// Hook và sự kiện chuyển tab
function patchTabSwitchForPaging() {
  const tabButtons = document.querySelectorAll(".tab-btn");
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      setTimeout(handleExampleTabPaging, 10);
    });
  });
}

// Tìm kiếm tài nguyên dựa trên từ khóa
function searchResources(query) {
  // Lấy tab đang active
  const activeTab = document.querySelector(".tab-content.active");

  if (!activeTab) return;

  // Lấy tất cả phần tử có thể tìm kiếm trong tab đang active
  let searchElements = [];
  const tabId = activeTab.getAttribute("id");

  switch (tabId) {
    case "documentation":
      searchElements = activeTab.querySelectorAll(".resource-card");
      break;
    case "examples":
      searchElements = activeTab.querySelectorAll(".example-card");
      break;
    case "videos":
      searchElements = activeTab.querySelectorAll(".video-card");
      break;
    case "books":
      searchElements = activeTab.querySelectorAll(".book-card");
      break;
    case "tools":
      searchElements = activeTab.querySelectorAll(".tool-card");
      break;
  }

  let visibleCount = 0;

  // Lọc các phần tử dựa trên từ khóa
  searchElements.forEach((element) => {
    const title = element.querySelector("h3").textContent.toLowerCase();
    const description = element.querySelector("p").textContent.toLowerCase();

    if (title.includes(query) || description.includes(query)) {
      element.style.display = "";
      visibleCount++;
    } else {
      element.style.display = "none";
    }
  });

  // Hiển thị hoặc ẩn thông báo không có kết quả
  const noResults =
    activeTab.querySelector(".no-results") || document.createElement("div");

  if (visibleCount === 0 && query !== "") {
    if (!noResults.classList.contains("no-results")) {
      // Tạo phần tử thông báo nếu chưa có
      noResults.className = "no-results";
      noResults.innerHTML = `
                <i class="fas fa-search"></i>
                <h3>No results found</h3>
                <p>Try different search terms or browse all resources</p>
            `;
      activeTab.appendChild(noResults);
    }
    noResults.style.display = "flex";
  } else if (noResults) {
    noResults.style.display = "none";
  }
  // Nếu là tab 'examples' thì phân trang lại
  if (tabId === "examples") {
    currentExamplePage = 1;
    renderPagination(true); // chỉ phân trang phần đã lọc
  }
}

// Hàm debounce để giới hạn tần suất thực thi hàm tìm kiếm
function debounce(func, delay) {
  let timeout;
  return function () {
    const context = this;
    const args = arguments;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), delay);
  };
}
// Hiển thị thông báo
function showNotification(message, type = "success") {
  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
  notification.textContent = message;

  document.body.appendChild(notification);

  // Hiệu ứng xuất hiện
  setTimeout(() => {
    notification.classList.add("show");
  }, 10);

  // Tự động ẩn sau một khoảng thời gian
  setTimeout(() => {
    notification.classList.remove("show");
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 300);
  }, 4000);
}

// Xác thực khi không phải user
function ResourceAuthButtons() {
  // Các nút cần xác thực
  const selector = [
    "#documentation .btn.btn-outline",
    "#examples .btn.btn-outline",
    "#videos .btn.btn-outline",
    "#books .btn.btn-outline",
    "#tools .btn.btn-outline",
  ].join(",");

  document.querySelectorAll(selector).forEach((btn) => {
    btn.addEventListener("click", function (e) {
      if (!auth.currentUser) {
        e.preventDefault();
        window.location.href = "/login.html";
      }
    });
  });
}

async function loadResourcesFromFirebase() {
  try {
    // Hiển thị loading cho tất cả tab
    ["documentation", "examples", "videos"].forEach(showLoading);

    // lấy data từ firebase
    const resourcesRef = ref(database, "resources");
    const snapshot = await get(resourcesRef);
    const bookmarks = await getUserBookmarks(auth.currentUser?.uid); // Lấy bookmark trước khi render

    if (snapshot.exists()) {
      const resourcesData = snapshot.val();

      // chuyển thành mảng
      const resources = Object.values(resourcesData);

      // render các tài nguyên
      renderDocumentation(
        resources.filter((r) => r.type === "documentation"),
        bookmarks
      );
      renderExamples(
        resources.filter((r) => r.type === "examples"),
        bookmarks
      );
      renderVideos(
        resources.filter((r) => r.type === "videos"),
        bookmarks
      );

      // xác thực login
      ResourceAuthButtons();
    } else {
      showNoResourceMessage();
    }
  } catch (e) {
    console.error("Lỗi khi tải tài nguyên: ", e);
    showErrorMessage();
  }
}
// Hiệu ứng loading
function showLoading(tabId) {
  const grid = document.querySelector(
    `#${tabId} .resources-grid, #${tabId} .examples-grid, #${tabId} .videos-grid, #${tabId} .books-grid, #${tabId} .tools-grid`
  );
  if (grid) {
    let skeletonHTML = "";
    // tạo 6 skeleton
    for (let i = 0; i < 6; i++) {
      skeletonHTML += `
        <div class="skeleton skeleton-resource-card">  
        </div>
      `;
    }
    grid.innerHTML = skeletonHTML;
  }
}

// Xóa hiệu ứng loading nếu có
function hideLoading(tabId) {
  const grid = document.querySelector(
    `#${tabId} .resources-grid, #${tabId} .examples-grid, #${tabId} .videos-grid, #${tabId} .books-grid, #${tabId} .tools-grid`
  );
  if (grid && grid.querySelector(".loading-courses")) {
    grid.innerHTML = "";
  }
}
// Hiển thị thông báo khi k có tài nguyên
function showNoResourceMessage() {
  ["documentation", "examples", "videos", "books", "tools"].forEach((tabId) => {
    const grid = document.querySelector(
      `#${tabId} .resources-grid, #${tabId} .examples-grid, #${tabId} .videos-grid, #${tabId} .books-grid, #${tabId} .tools-grid`
    );
    if (grid)
      grid.innerHTML = `<div class="no-courses-message"><i class="fas fa-folder-open"></i> Không có dữ liệu tài nguyên.</div>`;
  });
}
// Hiện thị thông báo lỗi
function showErrorMessage() {
  ["documentation", "examples", "videos", "books", "tools"].forEach((tabId) => {
    const grid = document.querySelector(
      `#${tabId} .resources-grid, #${tabId} .examples-grid, #${tabId} .videos-grid, #${tabId} .books-grid, #${tabId} .tools-grid`
    );
    if (grid)
      grid.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-triangle"></i> Không thể tải dữ liệu từ máy chủ.</div>`;
  });
}

// hiển thị tài liệu
function renderDocumentation(list, bookmarks = {}) {
  // ẩn hiệu ứng load
  hideLoading("documentation");

  const grid = document.querySelector("#documentation .resources-grid");
  if (!grid) return;
  if (list.length === 0) {
    grid.innerHTML = `<div class="no-courses-message"><i class="fas fa-folder-open"></i> Không có tài liệu nào.</div>`;
    return;
  }
  grid.innerHTML = list
    .map((item) => {
      const isBookmarked = bookmarks && bookmarks[item.id];
      return `
    <div class="resource-card">
      <div class="resource-icon"><i class="fab fa-html5"></i></div>
      <div class="resource-info">
        <h3>${item.title}</h3>
        <p class="line-clamp-3">${item.description}</p>
        <a href="${item.url}" class="btn btn-outline">Xem Tài Liệu</a>
        <button class="btn-bookmark" onclick="handleBookmark('${item.id}','${
        item.type
      }')"> 
            <i class="${isBookmarked ? "fas" : "far"} fa-bookmark"></i>
        </button>
      </div>
    </div>
  `;
    })
    .join("");
}

// --- Modal nhúng JSFiddle cho ví dụ mã nguồn ---
function initExampleModal() {
  // Thêm modal vào body nếu chưa có
  if (!document.getElementById("example-modal")) {
    const modal = document.createElement("div");
    modal.id = "example-modal";
    modal.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-content">
        <button class="modal-close">&times;</button>
        <iframe width="100%" height="80vh" src="" frameborder="0" allowtransparency="true" allowfullscreen="true"></iframe>
      </div>
    `;
    modal.style.display = "none";
    modal.className = "example-modal";
    document.body.appendChild(modal);

    // Đóng modal khi click backdrop hoặc nút close
    modal.querySelector(".modal-backdrop").onclick = closeExampleModal;
    modal.querySelector(".modal-close").onclick = closeExampleModal;
  }
}
function openExampleModal(url) {
  const modal = document.getElementById("example-modal");
  if (modal) {
    modal.style.display = "flex";
    modal.querySelector("iframe").src = url;
  }
}
function closeExampleModal() {
  const modal = document.getElementById("example-modal");
  if (modal) {
    modal.style.display = "none";
    modal.querySelector("iframe").src = "";
  }
}
// Gắn sự kiện cho nút "Xem Đầy Đủ Ví Dụ" sau khi render
function attachExampleViewEvents() {
  document.querySelectorAll("#examples .btn.btn-outline").forEach((btn) => {
    btn.addEventListener("click", function (e) {
      const url = btn.getAttribute("href");
      if (url && url.includes("jsfiddle.net")) {
        e.preventDefault();
        openExampleModal(url);
      }
    });
  });
}
// hiển thị ví dụ
function renderExamples(list, bookmarks = {}) {
  hideLoading("examples");
  const grid = document.querySelector("#examples .examples-grid");
  if (!grid) return;
  if (list.length === 0) {
    grid.innerHTML = `<div class="no-courses-message"><i class="fas fa-folder-open"></i> Không có ví dụ nào.</div>`;
    return;
  }
  grid.innerHTML = list
    .map((item) => {
      const isBookmarked = bookmarks && bookmarks[item.id];
      return `
    <div class="example-card">
      <h3>${item.title}</h3>
      <div class="example-tags">${(item.tags || [])
        .map((tag) => `<span>${tag}</span>`)
        .join("")}</div>
      <p>${item.description}</p>
      ${
        item.code
          ? `<div class="example-preview">
              <pre><code>${escapeHtml(item.code)}</code></pre>
            </div>`
          : ""
      }
      <a href="${
        item.url
      }" class="btn btn-outline" target="_blank">Xem Đầy Đủ Ví Dụ</a>
      <button class="btn-bookmark" onclick="handleBookmark('${item.id}','${
        item.type
      }')"> 
            <i class="${isBookmarked ? "fas" : "far"} fa-bookmark"></i>
      </button>
    </div>
  `;
    })
    .join("");

  // Khởi tạo phân trang sau khi render
  setTimeout(() => {
    handleExampleTabPaging();
    // Gắn sự kiện cho nút xem ví dụ
    attachExampleViewEvents();
  }, 100);
}

// Hàm escape để hiển thị code an toàn
function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\\n/g, "\n"); // Thêm dòng này!
}

// hiển thị video
function renderVideos(list, bookmarks = {}) {
  hideLoading("videos");
  const grid = document.querySelector("#videos .videos-grid");
  if (!grid) return;
  if (list.length === 0) {
    grid.innerHTML = `<div class="no-courses-message"><i class="fas fa-folder-open"></i> Không có video nào.</div>`;
    return;
  }
  grid.innerHTML = list
    .map((item) => {
      const isBookmarked = bookmarks && bookmarks[item.id];
      return `
    <div class="video-card">
      <div class="video-thumbnail">
        <img src="${item.image}" alt="${item.title}" />
        <div class="play-icon"><i class="fas fa-play"></i></div>
      </div>
      <div class="video-info">
        <h3>${item.title}</h3>
        <p class="line-clamp-2">${item.description}</p>
        <div class="example-tags">${(item.tags || [])
          .map((tag) => `<span>${tag}</span>`)
          .join("")}</div>
        <a href="${
          item.url
        }" class="btn btn-outline" target="_blank">Xem Video</a>
        <button class="btn-bookmark" onclick="handleBookmark('${item.id}','${
        item.type
      }')"> 
            <i class="${isBookmarked ? "fas" : "far"} fa-bookmark"></i>
        </button>
      </div>
    </div>
  `;
    })
    .join("");
}

// Lưu bookmark tài nguyên lên Firebase khi user click
async function saveBookmark(resourceId, resourceType) {
  return new Promise((resolve, reject) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.href = "login.html";
        return;
      }
      try {
        const bookmarkRef = ref(
          database,
          `bookmarks/${user.uid}/${resourceId}`
        );
        await set(bookmarkRef, {
          type: resourceType,
          date: new Date().toISOString(),
        });
        showNotification("Đã lưu tài nguyên!");
        resolve();
      } catch (err) {
        showNotification("Lỗi khi lưu tài nguyên!", "error");
        reject(err);
      }
    });
  });
}

// Lấy ds bookmark của user
async function getUserBookmarks(uid) {
  if (!uid) return {};
  const bookmarkRef = ref(database, `bookmarks/${uid}`);
  const snap = await get(bookmarkRef);
  return snap.exists() ? snap.val() : {};
}
// Gọi hàm này khi user click nút Lưu/Bookmark trên từng tài nguyên
// Ví dụ: <button onclick="handleBookmark('resourceId','type')">Lưu</button>
window.handleBookmark = function (resourceId, resourceType) {
  // đổi icon khi đã lưu
  const btns = document.querySelectorAll(
    `.btn-bookmark[onclick*="${resourceId}"]`
  );
  saveBookmark(resourceId, resourceType).then(() => {
    btns.forEach((btn) => {
      const icon = btn.querySelector("i");
      if (icon) {
        icon.classList.remove("far");
        icon.classList.add("fas");
      }
    });
  });
};

// Khởi tạo modal khi load trang
initExampleModal();
