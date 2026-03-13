import { database } from "../firebaseConfig.js";
import { uploadToCloudinary } from "../cloudinary-service.js";
import {
  ref,
  get,
  push,
  update,
  remove,
  onValue,
  off,
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-database.js";
import {
  initBulkSelect,
  clearSelection,
  toggleBulkActionsBar,
  batchDelete,
  batchUpdateStatus,
} from "../utils/bulk-select.js";

export default class BlogManager {
  constructor(adminPanel) {
    this.adminPanel = adminPanel;
    this.blogs = [];
    // Listener management
    this.blogsListenerRef = null;
    this.blogsListenerCallback = null;
    // Bulk selection
    this.selectedBlogIds = [];
  }

  async loadData() {
    // Hiển thị trạng thái đang tải
    const tbody = document.getElementById("resources-table-body");
    if (tbody) {
      tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center">
          <div class="loading-courses">
            <span class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></span>
            <span>Đang tải danh sách bài viết...</span>
          </div>
        </td>
      </tr>
    `;
    }

    this.cleanupListener();

    this.blogsListenerRef = ref(database, "blogs");
    this.blogsListenerCallback = (snapshot) => {
      if (snapshot.exists()) {
        // Lấy từ Firebase
        this.blogs = Object.entries(snapshot.val()).map(([id, data]) => ({
          id,
          ...data,
        }));
      } else {
        this.blogs = [];
      }

      // hiện thị các chủ đề
      this.updateTagsFilterOptions();
      // hiển thị blogs
      this.renderBlogTable();
    };

    onValue(this.blogsListenerRef, this.blogsListenerCallback, (error) => {
      this.adminPanel.showNotification("Lỗi tải dữ liệu bài viết", "error");
    });
  }

  // Cleanup listener khi chuyển tab hoặc không cần nữa
  cleanupListener() {
    if (this.blogsListenerRef && this.blogsListenerCallback) {
      // off chỉ khi đã có ref và callback
      off(this.blogsListenerRef, this.blogsListenerCallback);
      this.blogsListenerRef = null;
      this.blogsListenerCallback = null;
    }
  }

  renderBlogTable() {
    const tbody = document.getElementById("resources-table-body");
    if (!tbody) return;

    tbody.innerHTML = "";

    // Clear bulk selection when re-rendering
    clearSelection("blogs-table");
    this.selectedBlogIds = [];
    toggleBulkActionsBar("blogs-bulk-bar", 0);

    this.blogs.forEach((blog) => {
      const tr = document.createElement("tr");

      // Get status badge class
      const statusClass =
        blog.status === "published"
          ? "status-active"
          : blog.status === "pending"
            ? "status-pending"
            : "status-inactive";

      // Get status text
      const statusText =
        blog.status === "published"
          ? "Đã đăng"
          : blog.status === "pending"
            ? "Chờ duyệt"
            : "Không hoạt động";

      // Truncate content for preview
      const contentPreview = blog.content
        ? blog.content.length > 50
          ? blog.content.substring(0, 50) + "..."
          : blog.content
        : "";

      tr.innerHTML = `
        <td class="checkbox-col">
          <input type="checkbox" class="select-row" data-id="${blog.id}">
        </td>
        <td>${blog.title || "Không có tiêu đề"}</td>
        <td>${blog.authorName}</td>
        <td>${(blog.tags || []).join(", ") || "Không phân loại"}</td>
        <td>${blog.createdAt}</td>
        <td>
          <span class="status-badge ${statusClass}">${statusText}</span>
        </td>
        <td>
          <div class="action-buttons">
            <button class="btn-action btn-view" onclick="adminPanel.blogs.showBlogDetail('${
              blog.id
            }')" title="Xem chi tiết">
              <i class="fas fa-eye"></i>
            </button>
            <button class="btn-action btn-edit" onclick="adminPanel.blogs.editBlog('${
              blog.id
            }')" title="Chỉnh sửa">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn-action btn-delete" onclick="adminPanel.blogs.deleteBlog('${
              blog.id
            }')" title="Xóa">
              <i class="fas fa-trash"></i>
            </button>
            ${
              blog.status === "pending"
                ? `<button class="btn-action btn-approve" onclick="adminPanel.blogs.approveBlog('${blog.id}')" title="Duyệt bài">
                <i class="fas fa-check"></i>
              </button>`
                : ""
            }
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  getAllTags() {
    // Lấy tất cả tags từ các blog, loại bỏ trùng lặp và trả về mảng
    const tagSet = new Set();
    this.blogs.forEach((blog) => {
      if (Array.isArray(blog.tags)) {
        blog.tags.forEach((tag) => tagSet.add(tag.trim().toLowerCase()));
      }
    });
    return Array.from(tagSet);
  }
  // load chủ đề
  updateTagsFilterOptions() {
    const categoryFilter = document.getElementById("blog-category-filter");
    if (!categoryFilter) return;
    const tags = this.getAllTags();

    // Lưu lại giá trị đang chọn
    const currentValue = categoryFilter.value;
    // Xóa các option cũ (trừ "Tất cả")
    categoryFilter.innerHTML = `<option value="">Tất cả</option>`;
    tags.forEach((tag) => {
      // Hiển thị chữ hoa đầu cho đẹp
      const label = tag.charAt(0).toUpperCase() + tag.slice(1);
      categoryFilter.innerHTML += `<option value="${tag}">${label}</option>`;
    });
    // Giữ lại lựa chọn cũ nếu còn tồn tại
    if (tags.includes(currentValue)) {
      categoryFilter.value = currentValue;
    }
  }

  async editBlog(blogId) {
    const blog = this.blogs.find((b) => b.id === blogId);

    if (!blog) return;
    this.showEditBlogModal(blog);
  }

  async deleteBlog(blogId) {
    if (!confirm("Bạn có chắc chắn muốn xóa bài viết này?")) return;

    const blog = this.blogs.find((b) => b.id === blogId);

    try {
      const blogRef = ref(database, `blogs/${blogId}`);
      await remove(blogRef);

      // Ghi log hoạt động
      await this.adminPanel.logActivity(
        "blog",
        "Xóa bài viết",
        `Đã xóa bài viết "${blog?.title || blogId}"`,
        "fas fa-trash",
      );

      this.adminPanel.showNotification("Đã xóa bài viết", "success");
      // this.loadData(); realtime
    } catch (error) {
      console.error("Error deleting blog:", error);
      this.adminPanel.showNotification("Lỗi xóa bài viết", "error");
    }
  }

  // Duyệt bài
  async approveBlog(blogId) {
    const blog = this.blogs.find((b) => b.id === blogId);
    if (!blog) return;

    try {
      const blogRef = ref(database, `blogs/${blogId}`);
      await update(blogRef, {
        status: "published",
        updatedAt: new Date().toLocaleDateString("vi-VN"),
      });

      // Ghi log hoạt động
      await this.adminPanel.logActivity(
        "blog",
        "Duyệt bài viết",
        `Đã duyệt bài viết "${blog.title}"`,
        "fas fa-check",
      );

      this.adminPanel.showNotification("Đã duyệt bài viết", "success");
      // this.loadData();
    } catch (error) {
      console.error("Error approving blog:", error);
      this.adminPanel.showNotification("Lỗi khi duyệt bài viết", "error");
    }
  }

  showEditBlogModal(blog) {
    let modal = document.getElementById("admin-blog-modal");
    if (modal) {
      this.adminPanel.showModal("admin-blog-modal");
    }

    // Đổi tiêu đề modal và nút submit
    modal.querySelector(".modal-header h3").textContent = "Chỉnh sửa bài viết";
    const submitBtn = modal.querySelector(".form-actions .btn-primary");
    submitBtn.textContent = "Lưu thay đổi";

    // SimpleMDE
    if (!window.adminSimpleMDE) {
      window.adminSimpleMDE = new window.SimpleMDE({
        element: document.getElementById("admin-blog-content"),
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
    const mde = window.adminSimpleMDE;

    // Các trường
    const titleInput = document.getElementById("admin-blog-title");
    const tagsInput = document.getElementById("admin-blog-tags");
    const imageInput = document.getElementById("admin-blog-image");
    const imagePreview = document.getElementById("admin-blog-image-preview");

    // load dữ liệu từ Firebase
    titleInput.value = blog.title || "";
    tagsInput.value = (blog.tags || []).join(", ");
    mde.value(blog.content || "");
    if (blog.image) {
      imagePreview.src = blog.image;
      imagePreview.style.display = "block";
    } else {
      imagePreview.style.display = "none";
    }

    // hiển thị ảnh preview
    imageInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      imagePreview.src = url;
      imagePreview.style.display = "block";
      imageInput._selectedFile = file;
      // stop storing Base64 drafts for edit
      localStorage.removeItem("blog-edit-draft-image");
    };

    // Xử lý submit
    document.getElementById("admin-blog-form").onsubmit = async (e) => {
      e.preventDefault();
      // Validate
      if (!titleInput.value.trim()) {
        this.adminPanel.showNotification("Vui lòng nhập tiêu đề!", "error");
        return;
      }
      if (!mde.value().trim()) {
        this.adminPanel.showNotification("Vui lòng nhập nội dung!", "error");
        return;
      }
      // Chuẩn bị dữ liệu
      const tags = tagsInput.value
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);

      const newImageFile = imageInput._selectedFile;
      const blogData = {
        title: titleInput.value.trim(),
        content: mde.value(),
        tags,
        updatedAt: new Date().toLocaleDateString("vi-VN"),
      };
      // nếu có ảnh mới thì lưu
      if (newImageFile) {
        const url = await uploadToCloudinary(newImageFile);
        if (!url) {
          this.adminPanel.showNotification("Upload ảnh thất bại", "error");
          return;
        }
        blogData.image = url;
      }

      try {
        // Cập nhật Firebase
        const blogRef = ref(database, `blogs/${blog.id}`);
        await update(blogRef, blogData);
        // Ghi log hoạt động
        await this.adminPanel.logActivity(
          "blog",
          "Cập nhật bài viết",
          `Đã cập nhật bài viết "${blogData.title}"`,
          "fas fa-edit",
        );
        e.target.reset();
        // xóa tham chiếu file tạm
        imageInput._selectedFile = null;
        this.adminPanel.showNotification("Đã lưu thay đổi!", "success");

        this.adminPanel.hideModal("admin-blog-modal");
        // this.loadData();
      } catch (err) {
        console.error("Lỗi: ", err);
        this.adminPanel.showNotification("Có lỗi khi lưu!", "error");
      }
    };
  }

  showAddBlogModal() {
    // Nếu modal đã tồn tại thì chỉ cần show
    let modal = document.getElementById("admin-blog-modal");
    if (modal) {
      this.adminPanel.showModal("admin-blog-modal");
    }

    // Đổi tiêu đề modal và nút submit
    modal.querySelector(".modal-header h3").textContent = "Thêm bài viết mới";
    const submitBtn = modal.querySelector(".form-actions .btn-primary");
    submitBtn.textContent = "Đăng bài";

    // SimpleMDE
    if (!window.adminSimpleMDE) {
      window.adminSimpleMDE = new window.SimpleMDE({
        element: document.getElementById("admin-blog-content"),
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
    const mde = window.adminSimpleMDE;

    // Các trường
    const titleInput = document.getElementById("admin-blog-title");
    const tagsInput = document.getElementById("admin-blog-tags");
    const imageInput = document.getElementById("admin-blog-image");
    const imagePreview = document.getElementById("admin-blog-image-preview");

    // Load nháp nếu có
    titleInput.value = localStorage.getItem("admin-blog-draft-title") || "";
    tagsInput.value = localStorage.getItem("admin-blog-draft-tags") || "";
    mde.value(localStorage.getItem("admin-blog-draft-content") || "");
    // Không còn lưu Base64 ảnh nháp; chỉ hiển thị khi có file chọn
    imagePreview.style.display = "none";

    // Lưu nháp khi nhập
    titleInput.oninput = () =>
      localStorage.setItem("admin-blog-draft-title", titleInput.value);
    tagsInput.oninput = () =>
      localStorage.setItem("admin-blog-draft-tags", tagsInput.value);
    mde.codemirror.on("change", () =>
      localStorage.setItem("admin-blog-draft-content", mde.value()),
    );
    imageInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      imagePreview.src = url;
      imagePreview.style.display = "block";
      imageInput._selectedFile = file;
    };

    // Đóng modal click vào nút cancel-btn và close-modal
    // Đóng khi click ra ngoài. khởi tạo ở initModal() admin.js

    // Xử lý submit
    document.getElementById("admin-blog-form").onsubmit = async (e) => {
      e.preventDefault();
      // Validate
      if (!titleInput.value.trim()) {
        this.adminPanel.showNotification("Vui lòng nhập tiêu đề!", "error");
        return;
      }
      if (!mde.value().trim()) {
        this.adminPanel.showNotification("Vui lòng nhập nội dung!", "error");
        return;
      }
      // Chuẩn bị dữ liệu
      const tags = tagsInput.value
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
      // Upload nếu có file ảnh mới
      let image = "";
      const newFile = imageInput._selectedFile;
      if (newFile) {
        image = await uploadToCloudinary(newFile);
        if (!image) {
          this.adminPanel.showNotification("Upload ảnh thất bại", "error");
          return;
        }
      }
      const blogData = {
        title: titleInput.value.trim(),
        content: mde.value(),
        tags,
        image,
        authorName: this.adminPanel.currentUser?.displayName || "Admin",
        authorId: this.adminPanel.currentUser?.uid || "admin",
        authorAvatar:
          localStorage.getItem(
            "profile-avatar-" + this.adminPanel.currentUser?.uid,
          ) || "assets/images/avatar-default.jpg",
        createdAt: new Date().toLocaleDateString("vi-VN"),
        status: "published",
      };
      try {
        // Thêm vào Firebase
        await push(ref(database, "blogs"), blogData);
        this.adminPanel.showNotification("Đăng bài thành công!", "success");

        // Ghi log hoạt động
        await this.adminPanel.logActivity(
          "blog",
          "Thêm bài viết",
          `Đã thêm bài viết "${blogData.title}"`,
          "fas fa-blog",
        );
        e.target.reset();
        // Xóa nháp (không còn ảnh Base64)
        localStorage.removeItem("admin-blog-draft-title");
        localStorage.removeItem("admin-blog-draft-tags");
        localStorage.removeItem("admin-blog-draft-content");
        imageInput._selectedFile = null;
        // ẩn modal
        this.adminPanel.hideModal("admin-blog-modal");
        // this.loadData();
      } catch (err) {
        console.error("Lỗi: ", err);
        this.adminPanel.showNotification("Có lỗi khi đăng bài!", "error");
      }
    };
  }

  // Modal xem chi tiết bài viết
  showBlogDetail(blogId) {
    const blog = this.blogs.find((b) => b.id === blogId);
    if (!blog) return;
    // Tạo modal nếu chưa có
    let modal = document.getElementById("admin-blog-detail-modal");
    if (modal) {
      // hiện modal
      this.adminPanel.showModal("admin-blog-detail-modal");
    }

    const statusText = blog.status === "pending" ? "Chờ duyệt" : "Đã duyệt";
    // Render thông tin
    document.getElementById("detail-title").textContent = blog.title;
    document.getElementById("detail-body").innerHTML = `
      <div><b>Tác giả:</b> ${blog.authorName}</div>
      <div><b>Ngày tạo:</b> ${blog.createdAt}</div>
      <div><b>Trạng thái:</b> ${statusText}</div>
      <div><b>Tags:</b> ${(blog.tags || []).join(", ")}</div>
      ${
        blog.image
          ? `<img src="${blog.image}">`
          : `<img src="" style="display= none">`
      }
      <div style="margin-top:16px" class="blog-detail-content-view">${
        window.SimpleMDE
          ? window.SimpleMDE.prototype.markdown(blog.content || "")
          : blog.content || ""
      }</div>
    `;
    // Footer
    const approveBtn = document.getElementById("approve-blog-btn");
    // Sự kiện duyệt
    if (blog.status === "pending") {
      approveBtn.style.display = "block";
      approveBtn.onclick = () => {
        this.adminPanel.hideModal("admin-blog-detail-modal");
        this.approveBlog(blog.id);
      };
    } else {
      approveBtn.style.display = "none";
    }
  }

  setupEventListeners() {
    // Nút thêm bài viết blog
    const addBlogBtn = document.getElementById("add-blog-btn");
    if (addBlogBtn) {
      addBlogBtn.textContent = "Tạo bài viết";
      addBlogBtn.addEventListener("click", this.showAddBlogModal.bind(this));
    }

    // Xử lý lọc và tìm kiếm
    const searchInput = document.getElementById("blog-search");
    const categoryFilter = document.getElementById("blog-category-filter");
    const statusFilter = document.getElementById("blog-status-filter");

    if (searchInput) {
      searchInput.addEventListener("input", this.handleFilter.bind(this));
    }

    if (categoryFilter) {
      categoryFilter.addEventListener("change", this.handleFilter.bind(this));
    }

    if (statusFilter) {
      statusFilter.addEventListener("change", this.handleFilter.bind(this));
    }

    // Initialize bulk selection
    initBulkSelect("blogs-table", (selectedIds) => {
      this.selectedBlogIds = selectedIds;
      toggleBulkActionsBar("blogs-bulk-bar", selectedIds.length);
      // Update count number
      const countSpan = document.querySelector("#blogs-bulk-bar .count-number");
      if (countSpan) {
        countSpan.textContent = selectedIds.length;
      }
    });

    // Bulk cancel button
    const bulkCancelBtn = document.getElementById("blogs-bulk-cancel-btn");
    if (bulkCancelBtn) {
      bulkCancelBtn.addEventListener("click", () => {
        clearSelection("blogs-table");
        this.selectedBlogIds = [];
        toggleBulkActionsBar("blogs-bulk-bar", 0);
      });
    }

    // Bulk approve button
    const bulkApproveBtn = document.getElementById("blogs-bulk-approve-btn");
    if (bulkApproveBtn) {
      bulkApproveBtn.addEventListener("click", () =>
        this.bulkUpdateStatus("published"),
      );
    }

    // Bulk draft button
    const bulkDraftBtn = document.getElementById("blogs-bulk-draft-btn");
    if (bulkDraftBtn) {
      bulkDraftBtn.addEventListener("click", () =>
        this.bulkUpdateStatus("draft"),
      );
    }

    // Bulk delete button
    const bulkDeleteBtn = document.getElementById("blogs-bulk-delete-btn");
    if (bulkDeleteBtn) {
      bulkDeleteBtn.addEventListener("click", () => this.bulkDeleteBlogs());
    }
  }

  // Bulk delete blogs
  async bulkDeleteBlogs() {
    if (this.selectedBlogIds.length === 0) {
      this.adminPanel.showNotification("Chưa chọn bài viết nào", "warning");
      return;
    }

    const count = this.selectedBlogIds.length;
    if (!confirm(`Bạn có chắc chắn muốn xóa ${count} bài viết đã chọn?`)) {
      return;
    }

    try {
      const deleteFunc = async (blogId) => {
        await remove(ref(database, `blogs/${blogId}`));
      };

      const result = await batchDelete(
        this.selectedBlogIds,
        deleteFunc,
        "bài viết",
      );

      this.adminPanel.showNotification(
        `Đã xóa ${result.success} bài viết${result.failed > 0 ? `, ${result.failed} lỗi` : ""}`,
        result.failed > 0 ? "warning" : "success",
      );

      // Clear selection
      this.selectedBlogIds = [];
      clearSelection("blogs-table");
      toggleBulkActionsBar("blogs-bulk-bar", 0);
    } catch (error) {
      console.error("Error bulk deleting blogs:", error);
      this.adminPanel.showNotification(
        error.message || "Lỗi xóa bài viết",
        "error",
      );
    }
  }

  // Bulk update status
  async bulkUpdateStatus(newStatus) {
    if (this.selectedBlogIds.length === 0) {
      this.adminPanel.showNotification("Chưa chọn bài viết nào", "warning");
      return;
    }

    const count = this.selectedBlogIds.length;
    const statusText =
      newStatus === "published" ? "duyệt" : "chuyển về bản nháp";

    if (
      !confirm(`Bạn có chắc chắn muốn ${statusText} ${count} bài viết đã chọn?`)
    ) {
      return;
    }

    try {
      const updateFunc = async (blogId, status) => {
        const blogRef = ref(database, `blogs/${blogId}`);
        await update(blogRef, { status });
      };

      const result = await batchUpdateStatus(
        this.selectedBlogIds,
        newStatus,
        updateFunc,
      );

      this.adminPanel.showNotification(
        `Đã ${statusText} ${result.success} bài viết${result.failed > 0 ? `, ${result.failed} lỗi` : ""}`,
        result.failed > 0 ? "warning" : "success",
      );

      // Clear selection
      this.selectedBlogIds = [];
      clearSelection("blogs-table");
      toggleBulkActionsBar("blogs-bulk-bar", 0);
    } catch (error) {
      console.error("Error bulk updating status:", error);
      this.adminPanel.showNotification("Lỗi cập nhật trạng thái", "error");
    }
  }

  handleFilter() {
    const searchInput = document.getElementById("blog-search");
    const categoryFilter = document.getElementById("blog-category-filter");
    const statusFilter = document.getElementById("blog-status-filter");

    let filteredBlogs = [...this.blogs];

    // Lọc theo từ khóa tìm kiếm
    if (searchInput && searchInput.value.trim()) {
      const searchTerm = searchInput.value.trim().toLowerCase();
      filteredBlogs = filteredBlogs.filter(
        (blog) =>
          blog.title?.toLowerCase().includes(searchTerm) ||
          blog.content?.toLowerCase().includes(searchTerm) ||
          blog.authorName?.toLowerCase().includes(searchTerm),
      );
    }

    // Lọc theo chuyên mục
    if (categoryFilter && categoryFilter.value) {
      const filteredTags = categoryFilter.value.toLowerCase();
      filteredBlogs = filteredBlogs.filter(
        (blog) =>
          Array.isArray(blog.tags) &&
          blog.tags.some((tag) => tag.toLowerCase() === filteredTags),
      );
    }

    // Lọc theo trạng thái
    if (statusFilter && statusFilter.value) {
      filteredBlogs = filteredBlogs.filter(
        (blog) => blog.status === statusFilter.value,
      );
    }

    // Render bảng với dữ liệu đã lọc
    this.renderFilteredBlogs(filteredBlogs);
  }

  renderFilteredBlogs(filteredBlogs) {
    const tbody = document.getElementById("resources-table-body");
    if (!tbody) return;

    tbody.innerHTML = "";

    // Clear bulk selection when filtering
    clearSelection("blogs-table");
    this.selectedBlogIds = [];
    toggleBulkActionsBar("blogs-bulk-bar", 0);

    if (filteredBlogs.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td colspan="7" class="text-center">Không tìm thấy bài viết nào phù hợp</td>
      `;
      tbody.appendChild(tr);
      return;
    }

    filteredBlogs.forEach((blog) => {
      const tr = document.createElement("tr");

      // Get status badge class
      const statusClass =
        blog.status === "published"
          ? "status-active"
          : blog.status === "pending"
            ? "status-pending"
            : "status-inactive";

      // Get status text
      const statusText =
        blog.status === "published"
          ? "Đã đăng"
          : blog.status === "pending"
            ? "Chờ duyệt"
            : "Không hoạt động";

      tr.innerHTML = `
        <td class="checkbox-col">
          <input type="checkbox" class="select-row" data-id="${blog.id}">
        </td>
        <td>${blog.title || "Không có tiêu đề"}</td>
        <td>${blog.authorName}</td>
        <td>${(blog.tags || []).join(", ") || "Không phân loại"}</td>
        <td>${blog.createdAt}</td>
        <td>
          <span class="status-badge ${statusClass}">${statusText}</span>
        </td>
        <td>
          <div class="action-buttons">
            <button class="btn-action btn-view" onclick="window.open('/blog-detail.html?id=${
              blog.id
            }', '_blank')" title="Xem bài viết">
              <i class="fas fa-eye"></i>
            </button>
            <button class="btn-action btn-edit" onclick="adminPanel.blogs.editBlog('${
              blog.id
            }')" title="Chỉnh sửa">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn-action btn-delete" onclick="adminPanel.blogs.deleteBlog('${
              blog.id
            }')" title="Xóa">
              <i class="fas fa-trash"></i>
            </button>
            ${
              blog.status === "pending"
                ? `<button class="btn-action btn-approve" onclick="adminPanel.blogs.approveBlog('${blog.id}')" title="Duyệt bài">
                <i class="fas fa-check"></i>
              </button>`
                : ""
            }
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }
}
