// Chức năng trang Tài Nguyên
document.addEventListener("DOMContentLoaded", function () {
  // Khởi tạo tab
  initTabs();

  // Khởi tạo chức năng tìm kiếm
  initSearch();
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
  const allExamples = Array.from(
    examplesGrid.querySelectorAll(".example-card")
  );

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
// Gọi khi dom sẳn sàng
document.addEventListener("DOMContentLoaded", function () {
  patchTabSwitchForPaging();
  handleExampleTabPaging();
});

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

// Thêm chức năng đánh dấu bookmark
function toggleBookmark(resourceId, resourceType) {
  // Lấy bookmark hiện tại từ localStorage
  let bookmarks = JSON.parse(
    localStorage.getItem("resource-bookmarks") || "[]"
  );

  // Kiểm tra tài nguyên đã được bookmark chưa
  const existingIndex = bookmarks.findIndex(
    (bookmark) => bookmark.id === resourceId && bookmark.type === resourceType
  );

  if (existingIndex !== -1) {
    // Xóa khỏi bookmark
    bookmarks.splice(existingIndex, 1);
    localStorage.setItem("resource-bookmarks", JSON.stringify(bookmarks));
    return false; // Trả về false khi đã xóa
  } else {
    // Thêm vào bookmark
    bookmarks.push({
      id: resourceId,
      type: resourceType,
      date: new Date().toISOString(),
    });
    localStorage.setItem("resource-bookmarks", JSON.stringify(bookmarks));
    return true; // Trả về true khi đã thêm
  }
}

// Kiểm tra tài nguyên đã được bookmark chưa
function isBookmarked(resourceId, resourceType) {
  const bookmarks = JSON.parse(
    localStorage.getItem("resource-bookmarks") || "[]"
  );
  return bookmarks.some(
    (bookmark) => bookmark.id === resourceId && bookmark.type === resourceType
  );
}

// Chức năng đánh giá tài nguyên
function rateResource(resourceId, resourceType, rating) {
  // Trong ứng dụng thực tế, sẽ gửi đánh giá lên server
  // Ở đây chỉ lưu local
  let ratings = JSON.parse(localStorage.getItem("resource-ratings") || "{}");

  // Tạo key cho tài nguyên
  const resourceKey = `${resourceType}-${resourceId}`;

  // Lưu đánh giá
  ratings[resourceKey] = rating;
  localStorage.setItem("resource-ratings", JSON.stringify(ratings));

  // Trả về thông báo thành công
  return {
    success: true,
    message: "Rating saved successfully",
  };
}

// Sao chép ví dụ code vào clipboard
function copyCodeExample(codeBlockId) {
  const codeBlock = document.getElementById(codeBlockId);

  if (codeBlock) {
    const codeText = codeBlock.textContent;

    // Tạo textarea tạm để copy nội dung
    const textarea = document.createElement("textarea");
    textarea.value = codeText;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);

    // Hiển thị thông báo
    showNotification("Code copied to clipboard!");

    return true;
  }

  return false;
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
  }, 3000);
}
