// quản lý bình luận cho Admin
import { database } from "../firebaseConfig.js";
import {
  ref,
  get,
  update,
  remove,
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-database.js";

export default class CommentsManager {
  constructor(panel) {
    this.panel = panel;
    this.comments = [];
    this.reports = [];
    this.flattenedComments = [];
    this.blogTitles = {}; // Lưu trữ tiêu đề của các blog
    this.courseTitles = {}; // Lưu trữ tiêu đề của các khóa học
  }

  /**
   * Tải dữ liệu bình luận và báo cáo
   */
  async loadData() {
    try {
      // Hiển thị trạng thái đang tải
      document.getElementById("comments").innerHTML = `
        <div class="section-header">
          <h1>Quản lý bình luận</h1>
        </div>
        <div class="loading-indicator">
          <i class="fas fa-spinner fa-spin"></i>
          <p>Đang tải dữ liệu bình luận...</p>
        </div>
      `;

      // Lấy tất cả bình luận
      const commentsRef = ref(database, "comments");
      const commentsSnapshot = await get(commentsRef);

      // Lấy tất cả báo cáo
      const reportsRef = ref(database, "commentReports");
      const reportsSnapshot = await get(reportsRef);

      // Lấy danh sách blog
      const blogsRef = ref(database, "blogs");
      const blogsSnapshot = await get(blogsRef);
      if (blogsSnapshot.exists()) {
        const blogs = blogsSnapshot.val();
        for (const blogId in blogs) {
          this.blogTitles[blogId] = blogs[blogId].title || "Blog không tiêu đề";
        }
      }

      // Lấy danh sách khóa học
      const coursesRef = ref(database, "courses");
      const coursesSnapshot = await get(coursesRef);
      if (coursesSnapshot.exists()) {
        const courses = coursesSnapshot.val();
        for (const courseId in courses) {
          this.courseTitles[courseId] =
            courses[courseId].title || "Khóa học không tiêu đề";
        }
      }

      // Xử lý dữ liệu
      this.processComments(commentsSnapshot.val() || {});
      this.processReports(reportsSnapshot.val() || {});

      // Hiển thị dữ liệu
      this.renderCommentsSection();

      // Thiết lập sự kiện
      this.setupEventListeners();
    } catch (error) {
      console.error("Error loading comments data:", error);
      this.panel.showNotification("Lỗi khi tải dữ liệu bình luận", "error");
    }
  }

  /**
   * Xử lý dữ liệu bình luận từ database
   */
  processComments(commentsData) {
    this.comments = commentsData;
    this.flattenedComments = [];

    // Duyệt qua các khóa học/blog trong bình luận
    for (const courseId in commentsData) {
      // Duyệt qua các bài học/blog trong khóa học
      for (const lessonId in commentsData[courseId]) {
        // Xác định loại nội dung (blog hoặc course)
        const contentType = lessonId === "blog" ? "blog" : "course";

        // Duyệt qua các bình luận
        for (const commentId in commentsData[courseId][lessonId]) {
          const comment = commentsData[courseId][lessonId][commentId];

          // Thêm thông tin định vị
          const flattenedComment = {
            ...comment,
            courseId,
            lessonId,
            commentId,
            contentType,
            contentTitle: this.getContentTitle(courseId, contentType),
            path: `${courseId}/${lessonId}/${commentId}`,
            type: "comment",
          };

          this.flattenedComments.push(flattenedComment);

          // Xử lý các phản hồi trong bình luận
          if (comment.replies) {
            for (const replyId in comment.replies) {
              const reply = comment.replies[replyId];

              // Thêm thông tin định vị cho phản hồi
              const flattenedReply = {
                ...reply,
                courseId,
                lessonId,
                commentId,
                replyId,
                path: `${courseId}/${lessonId}/${commentId}/replies/${replyId}`,
                type: "reply",
              };

              this.flattenedComments.push(flattenedReply);
            }
          }
        }
      }
    }
  }

  /**
   * Xử lý dữ liệu báo cáo từ database
   */
  processReports(reportsData) {
    this.reports = [];

    // Duyệt qua các bình luận bị báo cáo
    for (const commentId in reportsData) {
      // Duyệt qua các người báo cáo
      for (const userId in reportsData[commentId]) {
        const report = reportsData[commentId][userId];

        // Tìm bình luận tương ứng
        const comment = this.flattenedComments.find(
          (c) => c.id === commentId || c.commentId === commentId
        );

        if (comment) {
          this.reports.push({
            ...report,
            commentId,
            userId,
            commentContent: comment.content,
            commentPath: comment.path,
            commentType: comment.type,
            reporterName: comment.userName,
          });
        }
      }
    }

    // Sắp xếp báo cáo theo thời gian, mới nhất lên đầu
    this.reports.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Hiển thị phần quản lý bình luận
   */
  renderCommentsSection() {
    const section = document.getElementById("comments");
    if (!section) return;

    section.innerHTML = `
      <div class="section-header">
        <h1>Quản lý bình luận</h1>
        <div class="section-actions">
          <button class="btn btn-primary refresh-comments">
            <i class="fas fa-sync-alt"></i> Làm mới
          </button>
        </div>
      </div>
      
      <!-- Phần báo cáo vi phạm -->
      <div class="admin-card">
        <div class="card-header">
          <h3>
            <i class="fas fa-flag"></i> Báo cáo vi phạm
            <span class="badge badge-danger">${this.reports.length}</span>
          </h3>
        </div>
        <div class="card-body">
          ${this.renderReportsTable()}
        </div>
      </div>
      
      <!-- Phần quản lý tất cả bình luận -->
      <div class="admin-card">
        <div class="card-header">
          <h3>
            <i class="fas fa-comments"></i> Tất cả bình luận
            <span class="badge badge-info">${
              this.flattenedComments.length
            }</span>
          </h3>
        </div>
        <div class="card-body">
          <div class="filter-row">
            <div class="filter-group">
              <label for="comment-search">Tìm kiếm</label>
              <input type="text" id="comment-search" placeholder="Tìm theo nội dung hoặc tên người dùng">
            </div>
            <div class="filter-group">
              <label for="comment-status-filter">Trạng thái</label>
              <select id="comment-status-filter">
                <option value="all">Tất cả</option>
                <option value="active">Hiển thị</option>
                <option value="hidden">Đã ẩn</option>
              </select>
            </div>
          </div>
          
          ${this.renderCommentsTable()}
        </div>
      </div>
    `;
  }

  /**
   * Tạo bảng hiển thị báo cáo vi phạm
   */
  renderReportsTable() {
    if (this.reports.length === 0) {
      return `<p class="empty-state"><i class="fas fa-check-circle"></i> Không có báo cáo vi phạm nào.</p>`;
    }

    return `
      <div class="table-responsive">
        <table class="admin-table" id="reports-table">
          <thead>
            <tr>
              <th>Nội dung bình luận</th>
              <th>Loại</th>
              <th>Lý do báo cáo</th>
              <th>Người báo cáo</th>
              <th>Thời gian</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            ${this.reports
              .map((report) => {
                // Tìm bình luận từ danh sách
                const comment = this.flattenedComments.find(
                  (c) => c.path === report.commentPath
                );
                const contentType =
                  comment?.contentType ||
                  (report.commentPath.split("/")[1] === "blog"
                    ? "blog"
                    : "course");

                return `
                  <tr>
                    <td>${this.truncateText(
                      report.commentContent || "Nội dung đã bị xóa",
                      50
                    )}</td>
                    <td>
                      <span class="badge ${
                        contentType === "blog"
                          ? "badge-success"
                          : "badge-primary"
                      }">
                        ${contentType === "blog" ? "Blog" : "Khóa học"}
                      </span>
                    </td>
                    <td>${this.formatReportReason(report.reason)}</td>
            
                    <td>${report.reporterName}</td>
                    <td>${this.formatDate(report.timestamp)}</td>
                    <td class="action-buttons">
                      <button class="btn-action btn-view" data-action="view" data-id="${
                        report.commentId
                      }" data-path="${report.commentPath}" title="Xem chi tiết">
                        <i class="fas fa-eye"></i>
                      </button>
                      <button class="btn-action btn-hide" data-action="hide" data-id="${
                        report.commentId
                      }" data-path="${report.commentPath}" title="Ẩn/Hiện">
                        <i class="fas fa-eye-slash"></i>
                      </button>
                      <button class="btn-action btn-delete" data-action="delete" data-id="${
                        report.commentId
                      }" data-path="${report.commentPath}" title="Xóa">
                        <i class="fas fa-trash"></i>
                      </button>
                      <button class="btn-action btn-dismiss" data-action="dismiss" data-id="${
                        report.commentId
                      }" data-reporter="${report.userId}" title="Bỏ qua">
                        <i class="fas fa-times"></i>
                      </button>
                    </td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  /**
   * Tạo bảng hiển thị tất cả bình luận
   */
  renderCommentsTable() {
    if (this.flattenedComments.length === 0) {
      return `<p class="empty-state"><i class="fas fa-comments-slash"></i> Không có bình luận nào.</p>`;
    }

    return `
      <div class="table-responsive">
        <table class="admin-table" id="comments-table">
          <thead>
            <tr>
              <th>Nội dung</th>
              <th>Loại</th>
              <th>Người đăng</th>
              <th>Thuộc về</th>
              <th>Thời gian</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            ${this.flattenedComments
              .map(
                (comment) => `
              <tr>
                <td>${this.truncateText(
                  comment.content || "Nội dung đã bị xóa",
                  50
                )}</td>
                <td>
                  <span class="badge ${
                    comment.type === "reply" ? "badge-info" : "badge-primary"
                  }">
                    ${comment.type === "reply" ? "Phản hồi" : "Bình luận"}
                  </span>
                </td>
                <td>${
                  comment.userName || comment.userId || "Không xác định"
                }</td>
                <td>
                  <span class="badge ${
                    comment.contentType === "blog"
                      ? "badge-success"
                      : "badge-primary"
                  }">
                    ${comment.contentType === "blog" ? "Blog" : "Khóa học"}
                  </span>
                </td>
                <td>${this.formatDate(comment.timestamp)}</td>
                <td>
                  <span class="status-badge ${
                    comment.status === "hidden"
                      ? "status-hidden"
                      : "status-active"
                  }">
                    ${comment.status === "hidden" ? "Đã ẩn" : "Hiển thị"}
                  </span>
                </td>
                <td class="action-buttons">
                  <button class="btn-action btn-view" data-action="view" data-id="${
                    comment.id || comment.commentId
                  }" data-path="${comment.path}" title="Xem chi tiết">
                    <i class="fas fa-eye"></i>
                  </button>
                  <button class="btn-action ${
                    comment.status === "hidden" ? "btn-show" : "btn-hide"
                  }" 
                    data-action="${
                      comment.status === "hidden" ? "show" : "hide"
                    }" 
                    data-id="${comment.id || comment.commentId}" 
                    data-path="${comment.path}" title="Ẩn/Hiện">
                    <i class="fas ${
                      comment.status === "hidden" ? "fa-eye" : "fa-eye-slash"
                    }"></i>
                  </button>
                  <button class="btn-action btn-delete" data-action="delete" data-id="${
                    comment.id || comment.commentId
                  }" data-path="${comment.path}" title="Xóa">
                    <i class="fas fa-trash"></i>
                  </button>
                </td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  /**
   * Thiết lập các sự kiện cho phần quản lý bình luận
   */
  setupEventListeners() {
    const commentsSection = document.getElementById("comments");
    if (!commentsSection) return;

    // Nút làm mới
    commentsSection
      .querySelector(".refresh-comments")
      ?.addEventListener("click", () => {
        this.loadData();
      });

    // Xử lý tìm kiếm bình luận
    const commentSearch = document.getElementById("comment-search");
    if (commentSearch) {
      commentSearch.addEventListener("input", () => {
        this.filterComments();
      });
    }

    // Xử lý lọc theo trạng thái
    const statusFilter = document.getElementById("comment-status-filter");
    if (statusFilter) {
      statusFilter.addEventListener("change", () => {
        this.filterComments();
      });
    }

    // Xử lý các nút thao tác trong bảng báo cáo
    const reportsTable = document.getElementById("reports-table");
    if (reportsTable) {
      reportsTable.addEventListener("click", (e) => {
        const button = e.target.closest(".btn-action");
        if (!button) return;

        const action = button.dataset.action;
        const commentId = button.dataset.id;
        const path = button.dataset.path;
        const reporter = button.dataset.reporter;

        switch (action) {
          case "view":
            this.viewComment(path);
            break;
          case "hide":
            this.hideComment(path);
            break;
          case "show":
            this.showComment(path);
            break;
          case "delete":
            this.deleteComment(path);
            break;
          case "dismiss":
            this.dismissReport(commentId, reporter);
            break;
        }
      });
    }

    // Xử lý các nút thao tác trong bảng bình luận
    const commentsTable = document.getElementById("comments-table");
    if (commentsTable) {
      commentsTable.addEventListener("click", (e) => {
        const button = e.target.closest(".btn-action");
        if (!button) return;

        const action = button.dataset.action;
        const path = button.dataset.path;

        switch (action) {
          case "view":
            this.viewComment(path);
            break;
          case "hide":
            this.hideComment(path);
            break;
          case "show":
            this.showComment(path);
            break;
          case "delete":
            this.deleteComment(path);
            break;
        }
      });
    }
  }

  /**
   * Lọc bình luận dựa trên tìm kiếm và bộ lọc
   */
  filterComments() {
    const searchTerm =
      document.getElementById("comment-search")?.value.toLowerCase() || "";
    const statusFilter =
      document.getElementById("comment-status-filter")?.value || "all";

    const commentsTable = document.getElementById("comments-table");
    if (!commentsTable) return;

    const rows = commentsTable.querySelectorAll("tbody tr");

    rows.forEach((row) => {
      const content = row.cells[0].textContent.toLowerCase();
      const userName = row.cells[2].textContent.toLowerCase();
      const status = row.cells[5].textContent.trim();

      const matchesSearch =
        content.includes(searchTerm) || userName.includes(searchTerm);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && status === "Hiển thị") ||
        (statusFilter === "hidden" && status === "Đã ẩn");

      row.style.display = matchesSearch && matchesStatus ? "" : "none";
    });
  }

  /**
   * Xem chi tiết bình luận
   */
  viewComment(path) {
    // Tìm bình luận trong dữ liệu đã lấy
    const comment = this.flattenedComments.find((c) => c.path === path);

    if (!comment) {
      this.panel.showNotification("Không tìm thấy bình luận.", "error");
      return;
    }

    // Lấy tiêu đề nội dung
    const contentTitle = this.getContentTitle(
      comment.courseId,
      comment.contentType
    );

    // Hiển thị modal xem chi tiết
    const modalTitle =
      comment.type === "reply" ? "Chi tiết phản hồi" : "Chi tiết bình luận";

    // Tạo nội dung modal
    const modalContent = `
      <div class="comment-detail">
        <div class="comment-header">
          <img src="${
            comment.userAvatar || "./assets/images/avatar-default.jpg"
          }" alt="${comment.userName || "User"}" class="user-avatar">
          <div>
            <h4>${comment.userName || comment.userId || "Không xác định"}</h4>
            <span>${this.formatDate(comment.timestamp)}</span>
            ${
              comment.isEdited
                ? `<span class="edited-badge">Đã chỉnh sửa</span>`
                : ""
            }
          </div>
        </div>
        
        <div class="comment-body">
          ${comment.content || "Nội dung đã bị xóa"}
        </div>
        
        <div class="comment-footer">
          <div class="comment-stats">
            <span><i class="fas fa-thumbs-up"></i> ${comment.likes || 0}</span>
            <span><i class="fas fa-thumbs-down"></i> ${
              comment.dislikes || 0
            }</span>
            <span><i class="fas fa-flag"></i> ${comment.reports || 0}</span>
          </div>
          
          <div class="comment-path">
            <strong>Loại nội dung:</strong> 
            <span class="badge ${
              comment.contentType === "blog" ? "badge-success" : "badge-primary"
            }">
              ${comment.contentType === "blog" ? "Blog" : "Khóa học"}
            </span>
          </div>
          
          <div class="comment-path">
            <strong>Tiêu đề:</strong> ${contentTitle}
          </div>
          
          <div class="comment-path">
            <strong>ID:</strong> ${comment.courseId}${
      comment.contentType === "course" ? " / " + comment.lessonId : ""
    }
          </div>
        </div>
      </div>
    `;

    // Thêm modal vào HTML và hiển thị
    let modal = document.getElementById("comment-detail-modal");
    if (!modal) {
      // Tạo modal mới nếu chưa có
      modal = document.createElement("div");
      modal.className = "modal";
      modal.id = modalId;

      modal.innerHTML = `
        <div class="modal-content">
          <div class="modal-header">
            <h3 id="comment-modal-title">${modalTitle}</h3>
            <button class="close-modal">&times;</button>
          </div>
          <div class="modal-body" id="comment-modal-body">
            ${modalContent}
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      // Thiết lập sự kiện đóng modal
      modal.querySelector(".close-modal").addEventListener("click", () => {
        this.panel.hideModal(modalId);
      });

      modal
        .querySelector("#comment-modal-close")
        .addEventListener("click", () => {
          this.panel.hideModal(modalId);
        });
    } else {
      // Cập nhật nội dung modal nếu đã tồn tại
      modal.querySelector("#comment-modal-title").textContent = modalTitle;
      modal.querySelector("#comment-modal-body").innerHTML = modalContent;
    }

    // Hiển thị modal
    this.panel.showModal(modalId);
  }

  /**
   * Ẩn một bình luận
   */
  async hideComment(path) {
    try {
      // Phân tích đường dẫn để lấy vị trí bình luận
      const pathParts = path.split("/");

      if (!pathParts || pathParts.length < 3) {
        this.panel.showNotification(
          "Đường dẫn bình luận không hợp lệ.",
          "error"
        );
        return;
      }

      // Xác định vị trí trong database
      const commentRef = ref(database, `comments/${path}`);

      // Cập nhật trạng thái
      await update(commentRef, { status: "hidden" });

      // Thông báo thành công
      this.panel.showNotification("Đã ẩn bình luận thành công.", "success");

      // Cập nhật dữ liệu và giao diện
      await this.loadData();

      // Tìm comment để lấy tên người đăng
      const comment = this.flattenedComments.find((c) => c.path === path);
      const username = comment?.userName || comment?.userId || "Không xác định";

      // Ghi log
      this.panel.logActivity(
        "system",
        "Ẩn bình luận",
        `Đã ẩn bình luận của ${username}`,
        "fas fa-eye-slash"
      );
    } catch (error) {
      console.error("Error hiding comment:", error);
      this.panel.showNotification("Lỗi khi ẩn bình luận.", "error");
    }
  }

  /**
   * Hiện một bình luận đã ẩn
   */
  async showComment(path) {
    try {
      // Tương tự như hideComment nhưng thay đổi trạng thái thành active
      const commentRef = ref(database, `comments/${path}`);

      await update(commentRef, { status: "active" });

      this.panel.showNotification("Đã hiện bình luận thành công.", "success");

      await this.loadData();

      // Tìm comment vừa ẩn để lấy tên người đăng
      const comment = this.flattenedComments.find((c) => c.path === path);
      const username = comment?.userName || comment?.userId || "Không xác định";

      this.panel.logActivity(
        "system",
        "Hiện bình luận",
        `Đã hiện bình luận của ${username}`,
        "fas fa-eye"
      );
    } catch (error) {
      console.error("Error showing comment:", error);
      this.panel.showNotification("Lỗi khi hiện bình luận.", "error");
    }
  }

  /**
   * Xóa một bình luận
   */
  async deleteComment(path) {
    try {
      // Hiện hộp thoại xác nhận
      if (
        !confirm(
          "Bạn có chắc chắn muốn xóa bình luận này không? Hành động này không thể hoàn tác."
        )
      ) {
        return;
      }

      const commentRef = ref(database, `comments/${path}`);

      await remove(commentRef);

      this.panel.showNotification("Đã xóa bình luận thành công.", "success");

      await this.loadData();

      // Tìm comment vừa xóa để lấy tên người đăng
      const deletedComment = this.flattenedComments.find(
        (c) => c.path === path
      );
      const username =
        deletedComment?.userName || deletedComment?.userId || "Không xác định";

      this.panel.logActivity(
        "system",
        "Xóa bình luận",
        `Đã xóa bình luận của ${username}`,
        "fas fa-trash"
      );
    } catch (error) {
      console.error("Error deleting comment:", error);
      this.panel.showNotification("Lỗi khi xóa bình luận.", "error");
    }
  }

  /**
   * Bỏ qua một báo cáo
   */
  async dismissReport(commentId, reporterId) {
    try {
      const reportRef = ref(
        database,
        `commentReports/${commentId}/${reporterId}`
      );

      await remove(reportRef);

      this.panel.showNotification("Đã bỏ qua báo cáo.", "success");

      await this.loadData();

      // Tìm comment bị báo cáo để lấy tên người đăng
      const comment = this.flattenedComments.find(
        (c) => c.id === commentId || c.commentId === commentId
      );
      const username = comment?.userName || comment?.userId || "Không xác định";

      this.panel.logActivity(
        "system",
        "Bỏ qua báo cáo",
        `Đã bỏ qua báo cáo về bình luận của ${username}`,
        "fa-solid fa-forward"
      );
    } catch (error) {
      console.error("Error dismissing report:", error);
      this.panel.showNotification("Lỗi khi bỏ qua báo cáo.", "error");
    }
  }

  /**
   * Định dạng lý do báo cáo
   */
  formatReportReason(reason) {
    const reasons = {
      spam: "Spam",
      inappropriate: "Nội dung không phù hợp",
      offensive: "Xúc phạm",
      misleading: "Thông tin sai lệch",
      harassment: "Quấy rối",
      other: "Lý do khác",
    };

    return reasons[reason] || reason;
  }

  /**
   * Định dạng ngày tháng
   */
  formatDate(timestamp) {
    if (!timestamp) return "N/A";

    const date = new Date(timestamp);
    return date.toLocaleString("vi-VN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  /**
   * Cắt bớt văn bản dài
   */
  truncateText(text, maxLength) {
    if (!text) return "";
    if (text.length <= maxLength) return text;
    return text.substr(0, maxLength) + "...";
  }

  /**
   * Lấy tiêu đề của nội dung (blog hoặc course)
   *  contentId ID của nội dung
   *  contentType Loại nội dung ("blog" hoặc "course")
   */
  getContentTitle(contentId, contentType) {
    if (contentType === "blog") {
      return this.blogTitles[contentId] || `Blog ID: ${contentId}`;
    } else {
      return this.courseTitles[contentId] || `Khóa học ID: ${contentId}`;
    }
  }
}
