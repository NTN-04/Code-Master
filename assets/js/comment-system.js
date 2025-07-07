// Hệ thống bình luận
import { auth, database } from "./firebaseConfig.js";
import {
  ref,
  push,
  set,
  get,
  update,
  remove,
  onValue,
  off,
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-database.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-auth.js";

class CommentSystem {
  constructor(courseId, lessonId) {
    this.courseId = this.encodePath(courseId);
    this.lessonId = this.encodePath(lessonId); // đã mã hóa (id: 1_1)
    this.currentUser = null;
    this.comments = new Map();
    this.listeners = new Map();
    this.isLoading = false;
    this.maxCommentLength = 2000; // 2000 ký tự
    this.spamCheckEnabled = true;
    this.lastCommentTime = 0;
    this.commentCooldown = 5000; // 5 giây

    this.init();
  }

  /**
   * Khởi tạo hệ thống bình luận
   */
  async init() {
    // Lắng nghe thay đổi trạng thái xác thực
    onAuthStateChanged(auth, async (user) => {
      this.currentUser = user;
      // Nếu đã đăng nhập, lấy thông tin chi tiết từ database
      if (user) {
        try {
          const userRef = ref(database, `users/${user.uid}`);
          const userSnapshot = await get(userRef);

          if (userSnapshot.exists()) {
            // Gộp thông tin từ Auth và Database
            this.userDB = {
              ...user,
              ...userSnapshot.val(),
            };
          } else {
            this.userDB = user;
          }
        } catch (error) {
          console.error("Lỗi khi tải thông tin người dùng:", error);
          this.userDB = user;
        }
      } else {
        this.userDB = null;
      }

      this.renderCommentSection();
    });

    // Khởi tạo phần bình luận
    this.renderCommentSection();

    // Tải bình luận
    await this.loadComments();

    // Thiết lập lắng nghe thời gian thực
    this.setupRealtimeListeners();
  }

  /**
   * Hiển thị phần bình luận
   */
  renderCommentSection() {
    const lessonContainer = document.querySelector(".lesson-container");
    if (!lessonContainer) return;

    // Xóa phần bình luận hiện có
    const existingSection = document.querySelector(".comments-section");
    if (existingSection) {
      existingSection.remove();
    }

    // Tạo phần bình luận mới
    const commentsSection = document.createElement("div");
    commentsSection.className = "comments-section";
    commentsSection.innerHTML = this.getCommentsSectionHTML();

    lessonContainer.appendChild(commentsSection);

    // Thiết lập sự kiện lắng nghe
    this.setupEventListeners();
  }

  /**
   * Tạo HTML cho phần bình luận
   * @returns {string} HTML của phần bình luận
   */
  getCommentsSectionHTML() {
    const commentsCount = this.comments.size;

    return `
      <div class="comments-header">
        <h3 class="comments-title">
          <i class="fas fa-comments"></i> Bình luận
        </h3>
        <span class="comments-count">${commentsCount} bình luận</span>
      </div>

      ${
        this.currentUser ? this.getCommentFormHTML() : this.getLoginPromptHTML()
      }

      <div class="comments-list">
        ${this.isLoading ? this.getLoadingHTML() : this.getCommentsHTML()}
      </div>

      ${this.getReportModalHTML()}
    `;
  }

  /**
   * Tạo HTML cho form bình luận
   * @returns {string} HTML của form bình luận
   */
  getCommentFormHTML() {
    const user = this.currentUser;
    // Kiểm tra this.userDB có tồn tại không trước khi sử dụng
    const userDB = this.userDB || {};

    //  ưu tiên lấy từ database
    const userAvatar = userDB?.avatar || "./assets/images/avatar-default.jpg";
    const userName = userDB?.username || user?.displayName || "Người dùng";

    return `
      <div class="comment-form">
        <div class="comment-form-header">
          <img src="${userAvatar}" alt="${userName}" class="comment-avatar">
          <div class="comment-user-info">
            <div class="comment-user-name">${userName}</div>
            <div class="comment-user-role">Học viên</div>
          </div>
        </div>
        
        <textarea 
          class="comment-textarea" 
          placeholder="Chia sẻ suy nghĩ của bạn về bài học này..."
          maxlength="${this.maxCommentLength}"
          rows="3"
        ></textarea>
        
        <div class="comment-form-actions">
          <div class="comment-form-left">
            <span class="comment-char-count">0/${this.maxCommentLength}</span>
          </div>
          <div class="comment-form-right">
            <button type="button" class="btn-comment btn-comment-secondary" data-action="cancel">
              <i class="fas fa-times"></i> Hủy
            </button>
            <button type="button" class="btn-comment btn-comment-primary" data-action="submit">
              <i class="fas fa-paper-plane"></i> Gửi bình luận
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Tạo HTML cho thông báo đăng nhập
   * @returns {string} HTML của thông báo đăng nhập
   */
  getLoginPromptHTML() {
    return `
      <div class="comments-login-prompt">
        <h3>Tham gia thảo luận</h3>
        <p>Đăng nhập để chia sẻ suy nghĩ và trao đổi với cộng đồng học viên</p>
        <button class="btn btn-primary" onclick="window.location.href='login.html'">
          <i class="fas fa-sign-in-alt"></i> Đăng nhập
        </button>
      </div>
    `;
  }

  /**
   * Tạo HTML cho trạng thái đang tải
   * @returns {string} HTML của trạng thái đang tải
   */
  getLoadingHTML() {
    return `
      <div class="comments-loading">
        <i class="fas fa-spinner fa-spin"></i>
        <p>Đang tải bình luận...</p>
      </div>
    `;
  }

  /**
   * Tạo HTML cho danh sách bình luận
   * @returns {string} HTML của danh sách bình luận
   */
  getCommentsHTML() {
    if (this.comments.size === 0) {
      return `
        <div class="comments-empty">
          <i class="fas fa-comment-slash"></i>
          <p>Chưa có bình luận nào cho bài học này</p>
          <p>Hãy là người đầu tiên chia sẻ suy nghĩ!</p>
        </div>
      `;
    }

    const commentsArray = Array.from(this.comments.values()).sort(
      (a, b) => b.timestamp - a.timestamp
    );

    return commentsArray
      .map((comment) => this.getCommentHTML(comment))
      .join("");
  }

  /**
   * Tạo HTML cho một bình luận
   * @param {Object} comment Đối tượng bình luận
   * @returns {string} HTML của một bình luận
   */
  getCommentHTML(comment) {
    const timeAgo = this.getTimeAgo(comment.timestamp);
    const userAvatar =
      comment.userAvatar || "./assets/images/avatar-default.jpg";
    const isOwnComment =
      this.currentUser && comment.userId === this.currentUser.uid;
    const repliesCount = comment.replies
      ? Object.keys(comment.replies).length
      : 0;

    return `
      <div class="comment-item" data-comment-id="${comment.id}">
        <div class="comment-header">
          <img src="${userAvatar}" alt="${
      comment.userName
    }" class="comment-avatar">
          <span class="comment-author">${comment.userName}</span>
          <span class="comment-time">${timeAgo}</span>
          ${
            comment.isEdited
              ? '<span class="comment-edited">(đã chỉnh sửa)</span>'
              : ""
          }
        </div>
        
        <div class="comment-content">${this.formatCommentContent(
          comment.content
        )}</div>
        
        <div class="comment-actions">
          ${
            this.currentUser
              ? this.getCommentActionsHTML(comment, isOwnComment)
              : ""
          }
        </div>
        
        ${this.currentUser ? this.getReplyFormHTML(comment.id) : ""}
        
        ${repliesCount > 0 ? this.getRepliesHTML(comment.replies) : ""}
      </div>
    `;
  }

  /**
   * Tạo HTML cho các nút tương tác với bình luận
   * @param {Object} comment Đối tượng bình luận
   * @param {boolean} isOwnComment Cờ đánh dấu bình luận của người dùng hiện tại
   * @returns {string} HTML của các nút tương tác
   */
  getCommentActionsHTML(comment, isOwnComment) {
    const userVote = this.getUserVote(comment.id);
    const likeClass = userVote === "like" ? "liked active" : "";
    const dislikeClass = userVote === "dislike" ? "disliked active" : "";

    return `
      <button class="comment-action ${likeClass}" data-action="like" data-comment-id="${
      comment.id
    }">
        <i class="fas fa-thumbs-up"></i>
        <span class="comment-action-count">${comment.likes || 0}</span>
      </button>
      
      <button class="comment-action ${dislikeClass}" data-action="dislike" data-comment-id="${
      comment.id
    }">
        <i class="fas fa-thumbs-down"></i>
        <span class="comment-action-count">${comment.dislikes || 0}</span>
      </button>
      
      <button class="comment-action" data-action="reply" data-comment-id="${
        comment.id
      }">
        <i class="fas fa-reply"></i>
        Trả lời
      </button>
      
      ${
        isOwnComment
          ? `
        <button class="comment-action" data-action="edit" data-comment-id="${comment.id}">
          <i class="fas fa-edit"></i>
          Sửa
        </button>
        
        <button class="comment-action" data-action="delete" data-comment-id="${comment.id}">
          <i class="fas fa-trash"></i>
          Xóa
        </button>
      `
          : `
        <button class="comment-action" data-action="report" data-comment-id="${comment.id}">
          <i class="fas fa-flag"></i>
          Báo cáo
        </button>
      `
      }
    `;
  }

  /**
   * Tạo HTML cho form trả lời
   * @param {string} commentId ID của bình luận
   * @returns {string} HTML của form trả lời
   */
  getReplyFormHTML(commentId) {
    if (!this.currentUser) return "";

    const user = this.currentUser;
    // Kiểm tra this.userDB có tồn tại không trước khi sử dụng
    const userDB = this.userDB || {};

    //  ưu tiên lấy từ database
    const userAvatar = userDB?.avatar || "./assets/images/avatar-default.jpg";
    const userName = userDB?.username || user?.displayName || "Người dùng";

    return `
      <div class="reply-form" data-comment-id="${commentId}">
        <div class="comment-form-header">
          <img src="${userAvatar}" alt="${userName}" class="comment-avatar">
          <div class="comment-user-info">
            <div class="comment-user-name">${userName}</div>
            <div class="comment-user-role">Học viên</div>
          </div>
        </div>
        
        <textarea 
          class="comment-textarea" 
          placeholder="Viết phản hồi..."
          maxlength="${this.maxCommentLength}"
          rows="2"
        ></textarea>
        
        <div class="comment-form-actions">
          <div class="comment-form-left">
            <span class="comment-char-count">0/${this.maxCommentLength}</span>
          </div>
          <div class="comment-form-right">
            <button type="button" class="btn-comment btn-comment-secondary" data-action="cancel-reply">
              <i class="fas fa-times"></i> Hủy
            </button>
            <button type="button" class="btn-comment btn-comment-primary" data-action="submit-reply" data-comment-id="${commentId}">
              <i class="fas fa-paper-plane"></i> Gửi phản hồi
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Tạo HTML cho danh sách phản hồi
   * @param {Object} replies Đối tượng chứa các phản hồi
   * @returns {string} HTML của danh sách phản hồi
   */
  getRepliesHTML(replies) {
    if (!replies) return "";

    const repliesArray = Object.entries(replies).sort(
      (a, b) => a.timestamp - b.timestamp
    );

    return `
      <div class="comment-replies">
        ${repliesArray
          .map(([replyId, reply]) => this.getReplyHTML(reply, replyId))
          .join("")}
      </div>
    `;
  }

  /**
   * Tạo HTML cho một phản hồi
   * @param {Object} reply Đối tượng phản hồi
   * @param {string} replyId ID của phản hồi
   * @returns {string} HTML của một phản hồi
   */
  getReplyHTML(reply, replyId) {
    const timeAgo = this.getTimeAgo(reply.timestamp);
    const userAvatar = reply.userAvatar || "./assets/images/avatar-default.jpg";
    const isOwnReply =
      this.currentUser && reply.userId === this.currentUser.uid;
    const parentId = reply.parentId; // ID của comment cha
    return `
      <div class="reply-item" data-reply-id="${replyId}" data-parent-id="${parentId}">
        <div class="reply-header">
          <img src="${userAvatar}" alt="${reply.userName}" class="reply-avatar">
          <span class="reply-author">${reply.userName}</span>
          <span class="reply-time">${timeAgo}</span>
          ${
            reply.isEdited
              ? '<span class="comment-edited">(đã chỉnh sửa)</span>'
              : ""
          }
        </div>
        
        <div class="reply-content">${this.formatCommentContent(
          reply.content
        )}</div>
        
        <div class="reply-actions">
          ${
            this.currentUser
              ? this.getReplyActionsHTML(reply, replyId, parentId, isOwnReply)
              : ""
          }
        </div>
      </div>
    `;
  }

  /**
   * Tạo HTML cho các nút tương tác với phản hồi
   * @param {Object} reply Đối tượng phản hồi
   * @param {string} replyId ID của phản hồi
   * @param {string} parentId ID của bình luận cha
   * @param {boolean} isOwnReply Cờ đánh dấu phản hồi của người dùng hiện tại
   * @returns {string} HTML của các nút tương tác
   */
  getReplyActionsHTML(reply, replyId, parentId, isOwnReply) {
    const userVote = this.getUserVote(replyId);
    const likeClass = userVote === "like" ? "liked active" : "";
    const dislikeClass = userVote === "dislike" ? "disliked active" : "";

    return `
      <button class="comment-action ${likeClass}" data-action="like" data-reply-id="${replyId}"  data-parent-id="${parentId}">
        <i class="fas fa-thumbs-up"></i>
        <span class="comment-action-count">${reply.likes || 0}</span>
      </button>
      
      <button class="comment-action ${dislikeClass}" data-action="dislike" data-reply-id="${replyId}"  data-parent-id="${parentId}">
        <i class="fas fa-thumbs-down"></i>
        <span class="comment-action-count">${reply.dislikes || 0}</span>
      </button>
      
      ${
        isOwnReply
          ? `
        <button class="comment-action" data-action="edit-reply" data-reply-id="${replyId}"  data-parent-id="${parentId}">
          <i class="fas fa-edit"></i>
          Sửa
        </button>
        
        <button class="comment-action" data-action="delete-reply" data-reply-id="${replyId}"  data-parent-id="${parentId}">
          <i class="fas fa-trash"></i>
          Xóa
        </button>
      `
          : `
        <button class="comment-action" data-action="report-reply" data-reply-id="${replyId}"  data-parent-id="${parentId}">
          <i class="fas fa-flag"></i>
          Báo cáo
        </button>
      `
      }
    `;
  }

  /**
   * Tạo HTML cho modal báo cáo vi phạm
   * @returns {string} HTML của modal báo cáo
   */
  getReportModalHTML() {
    return `
      <div class="report-modal" id="report-modal">
        <div class="report-modal-content">
          <div class="report-modal-header">
            <h3 class="report-modal-title">Báo cáo vi phạm</h3>
            <button class="report-modal-close" data-action="close-report">×</button>
          </div>
          
          <form class="report-form">
            <label for="report-reason">Lý do báo cáo:</label>
            <select id="report-reason" required>
              <option value="">Chọn lý do...</option>
              <option value="spam">Spam</option>
              <option value="inappropriate">Nội dung không phù hợp</option>
              <option value="harassment">Quấy rối</option>
              <option value="other">Khác</option>
            </select>
            
            <label for="report-description">Mô tả chi tiết (tùy chọn):</label>
            <textarea id="report-description" placeholder="Mô tả thêm về vi phạm..." maxlength="500"></textarea>
            
            <div class="report-form-actions">
              <button type="button" class="btn-comment btn-comment-secondary" data-action="close-report">
                Hủy
              </button>
              <button type="submit" class="btn-comment btn-comment-primary">
                Gửi báo cáo
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  /**
   * Thiết lập các sự kiện lắng nghe
   */
  setupEventListeners() {
    const commentsSection = document.querySelector(".comments-section");
    if (!commentsSection) return;

    // Sự kiện của form bình luận
    const commentTextarea = commentsSection.querySelector(".comment-textarea");
    const submitBtn = commentsSection.querySelector('[data-action="submit"]');
    const cancelBtn = commentsSection.querySelector('[data-action="cancel"]');

    if (commentTextarea) {
      commentTextarea.addEventListener("input", (e) => {
        this.updateCharCount(e.target);
        this.validateCommentForm();
      });
    }

    if (submitBtn) {
      submitBtn.addEventListener("click", () => this.submitComment());
    }

    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => this.cancelComment());
    }

    // Sự kiện tương tác với bình luận (sử dụng event delegation)
    commentsSection.addEventListener("click", (e) => {
      // Tìm phần tử gần nhất có data-action
      let target = e.target;
      let action;

      while (target && target !== commentsSection) {
        action = target.dataset.action;
        if (action) break;
        target = target.parentElement;
      }

      if (!action) return;

      e.preventDefault();
      e.stopPropagation();

      switch (action) {
        case "like":
          if (target.dataset.replyId) {
            // Đây là reply vote
            this.toggleVote(
              {
                type: "reply",
                replyId: target.dataset.replyId,
                parentId: target.dataset.parentId,
              },
              "like"
            );
          } else {
            // Đây là comment vote
            this.toggleVote(
              {
                type: "comment",
                commentId: target.dataset.commentId,
              },
              "like"
            );
          }
          break;
        case "dislike":
          if (target.dataset.replyId) {
            // Đây là reply vote
            this.toggleVote(
              {
                type: "reply",
                replyId: target.dataset.replyId,
                parentId: target.dataset.parentId,
              },
              "dislike"
            );
          } else {
            // Đây là comment vote
            this.toggleVote(
              {
                type: "comment",
                commentId: target.dataset.commentId,
              },
              "dislike"
            );
          }
          break;
        case "reply":
          this.showReplyForm(target.dataset.commentId);
          break;
        case "edit":
          this.editComment(target.dataset.commentId);
          break;
        case "edit-reply":
          this.editReply(target.dataset.replyId, target.dataset.parentId);
          break;
        case "delete":
          this.deleteComment(target.dataset.commentId);
          break;
        case "delete-reply":
          this.deleteReply(target.dataset.replyId, target.dataset.parentId);
          break;
        case "report":
          this.showReportModal(target.dataset.commentId);
          break;
        case "submit-reply":
          this.submitReply(target.dataset.commentId);
          break;
        case "cancel-reply":
          this.cancelReply(target.closest(".reply-form"));
          break;
        case "close-report":
          this.closeReportModal();
          break;
      }
    });

    // Gửi form báo cáo
    const reportForm = commentsSection.querySelector(".report-form");
    if (reportForm) {
      reportForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.submitReport();
      });
    }

    // Click bên ngoài modal để đóng
    const reportModal = commentsSection.querySelector(".report-modal");
    if (reportModal) {
      reportModal.addEventListener("click", (e) => {
        if (e.target === reportModal) {
          this.closeReportModal();
        }
      });
    }
  }

  /**
   * Tải bình luận từ Firebase
   */
  async loadComments() {
    this.isLoading = true;
    this.renderCommentSection();

    try {
      const commentsRef = ref(
        database,
        `comments/${this.courseId}/${this.lessonId}`
      );
      const snapshot = await get(commentsRef);

      if (snapshot.exists()) {
        const commentsData = snapshot.val();
        this.comments.clear();

        Object.entries(commentsData).forEach(([commentId, commentData]) => {
          this.comments.set(commentId, {
            id: commentId,
            ...commentData,
          });
        });
      }
    } catch (error) {
      console.error("Lỗi khi tải bình luận:", error);
      this.showError("Không thể tải bình luận. Vui lòng thử lại.");
    } finally {
      this.isLoading = false;
      this.renderCommentSection();
    }
  }

  /**
   * Thiết lập lắng nghe thời gian thực
   */
  setupRealtimeListeners() {
    const commentsRef = ref(
      database,
      `comments/${this.courseId}/${this.lessonId}`
    );

    // Thay vì render lại toàn bộ, chỉ cập nhật thuộc tính đã thay đổi
    const listener = onValue(commentsRef, (snapshot) => {
      if (snapshot.exists()) {
        const commentsData = snapshot.val();

        // Trường hợp chưa có comments
        if (this.comments.size === 0) {
          Object.entries(commentsData).forEach(([commentId, commentData]) => {
            this.comments.set(commentId, {
              id: commentId,
              ...commentData,
            });
          });
          this.renderCommentSection();
          return;
        }

        // So sánh và chỉ cập nhật những gì thay đổi
        let hasStructuralChanges = false; // Kiểm tra nếu có thêm/xóa comment

        // Kiểm tra comment đã xóa
        for (const [commentId, oldComment] of this.comments.entries()) {
          if (!commentsData[commentId]) {
            this.comments.delete(commentId);
            hasStructuralChanges = true;
          }
        }

        // Kiểm tra comment mới hoặc cập nhật
        Object.entries(commentsData).forEach(([commentId, newCommentData]) => {
          const oldComment = this.comments.get(commentId);

          if (!oldComment) {
            // Comment mới
            this.comments.set(commentId, {
              id: commentId,
              ...newCommentData,
            });
            hasStructuralChanges = true;
          } else {
            // Comment đã tồn tại - kiểm tra các thay đổi
            // Chỉ cập nhật số lượng like/dislike nếu không có thay đổi khác
            const hasContentChanges =
              oldComment.content !== newCommentData.content ||
              oldComment.isEdited !== newCommentData.isEdited;

            const hasLikesChanged =
              oldComment.likes !== newCommentData.likes ||
              oldComment.dislikes !== newCommentData.dislikes;

            // Kiểm tra replies
            let hasReplyChanges = false;
            const oldReplies = oldComment.replies || {};
            const newReplies = newCommentData.replies || {};

            if (
              Object.keys(oldReplies).length !== Object.keys(newReplies).length
            ) {
              hasReplyChanges = true;
            } else {
              // So sánh nội dung replies
              for (const replyId in newReplies) {
                if (
                  !oldReplies[replyId] ||
                  oldReplies[replyId].content !== newReplies[replyId].content ||
                  oldReplies[replyId].isEdited !== newReplies[replyId].isEdited
                ) {
                  hasReplyChanges = true;
                  break;
                }
              }
            }

            // Cập nhật comment trong map
            this.comments.set(commentId, {
              id: commentId,
              ...newCommentData,
            });

            // Cập nhật UI cho riêng comment này nếu cần
            if (hasContentChanges || hasReplyChanges) {
              hasStructuralChanges = true;
            } else if (hasLikesChanged) {
              this.updateCommentLikesUI(
                commentId,
                newCommentData.likes,
                newCommentData.dislikes
              );
            }
          }
        });

        // Chỉ render lại toàn bộ nếu có thay đổi lớn
        if (hasStructuralChanges) {
          this.renderCommentSection();
        }
      } else {
        this.comments.clear();
        this.renderCommentSection();
      }
    });

    this.listeners.set("comments", listener);
  }

  // phương thức để cập nhật UI số lượng like/dislike
  updateCommentLikesUI(commentId, likes, dislikes) {
    const commentElement = document.querySelector(
      `[data-comment-id="${commentId}"]`
    );
    if (!commentElement) return;

    const likeButton = commentElement.querySelector(`[data-action="like"]`);
    const dislikeButton = commentElement.querySelector(
      `[data-action="dislike"]`
    );

    if (likeButton) {
      const likeCounter = likeButton.querySelector(".comment-action-count");
      if (likeCounter) {
        likeCounter.textContent = likes || 0;
      }
    }

    if (dislikeButton) {
      const dislikeCounter = dislikeButton.querySelector(
        ".comment-action-count"
      );
      if (dislikeCounter) {
        dislikeCounter.textContent = dislikes || 0;
      }
    }
  }

  /**
   * Gửi bình luận mới
   */
  async submitComment() {
    if (!this.currentUser) {
      this.showError("Vui lòng đăng nhập để bình luận.");
      return;
    }

    const textarea = document.querySelector(".comment-textarea");
    const content = textarea.value.trim();

    if (!content) {
      this.showError("Vui lòng nhập nội dung bình luận.");
      return;
    }

    if (content.length > this.maxCommentLength) {
      this.showError(
        `Bình luận không được vượt quá ${this.maxCommentLength} ký tự.`
      );
      return;
    }

    // Kiểm tra spam
    if (
      this.spamCheckEnabled &&
      Date.now() - this.lastCommentTime < this.commentCooldown
    ) {
      this.showError("Vui lòng đợi một chút trước khi bình luận tiếp.");
      return;
    }

    try {
      const submitBtn = document.querySelector('[data-action="submit"]');
      submitBtn.disabled = true;
      submitBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Đang gửi...';

      // const userDB = this.userDB || {};

      const commentData = {
        userId: this.currentUser.uid,
        userName:
          this.userDB?.username || this.currentUser.displayName || "Người dùng",
        userAvatar: this.userDB?.avatar || "./assets/images/avatar-default.jpg",
        content: content,
        timestamp: Date.now(),
        likes: 0,
        dislikes: 0,
        reports: 0,
        status: "active",
        isEdited: false,
        editedAt: null,
      };

      const commentsRef = ref(
        database,
        `comments/${this.courseId}/${this.lessonId}`
      );
      const newCommentRef = push(commentsRef);

      await set(newCommentRef, commentData);

      this.lastCommentTime = Date.now();
      textarea.value = "";
      this.updateCharCount(textarea);
      this.validateCommentForm();

      this.showSuccess("Bình luận đã được gửi thành công!");
    } catch (error) {
      console.error("Lỗi khi gửi bình luận:", error);
      this.showError("Không thể gửi bình luận. Vui lòng thử lại.");
    } finally {
      const submitBtn = document.querySelector('[data-action="submit"]');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML =
          '<i class="fas fa-paper-plane"></i> Gửi bình luận';
      }
    }
  }

  /**
   * Gửi phản hồi mới
   * @param {string} commentId ID của bình luận gốc
   */
  async submitReply(commentId) {
    if (!this.currentUser) {
      this.showError("Vui lòng đăng nhập để trả lời.");
      return;
    }

    const replyForm = document.querySelector(
      `[data-comment-id="${commentId}"].reply-form`
    );
    const textarea = replyForm.querySelector(".comment-textarea");
    const content = textarea.value.trim();

    if (!content) {
      this.showError("Vui lòng nhập nội dung phản hồi.");
      return;
    }

    if (content.length > this.maxCommentLength) {
      this.showError(
        `Phản hồi không được vượt quá ${this.maxCommentLength} ký tự.`
      );
      return;
    }

    try {
      const submitBtn = replyForm.querySelector('[data-action="submit-reply"]');
      submitBtn.disabled = true;
      submitBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Đang gửi...';

      const replyData = {
        userId: this.currentUser.uid,
        userName:
          this.userDB?.username || this.currentUser.displayName || "Người dùng",
        userAvatar: this.userDB?.avatar || "./assets/images/avatar-default.jpg",
        content: content,
        timestamp: Date.now(),
        likes: 0,
        dislikes: 0,
        reports: 0,
        status: "active",
        isEdited: false,
        editedAt: null,
        parentId: commentId,
      };

      const replyRef = ref(
        database,
        `comments/${this.courseId}/${this.lessonId}/${commentId}/replies`
      );
      const newReplyRef = push(replyRef);

      await set(newReplyRef, replyData);

      this.cancelReply(replyForm);
      this.showSuccess("Phản hồi đã được gửi thành công!");
    } catch (error) {
      console.error("Lỗi khi gửi phản hồi:", error);
      this.showError("Không thể gửi phản hồi. Vui lòng thử lại.");
    } finally {
      const submitBtn = replyForm.querySelector('[data-action="submit-reply"]');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Gửi phản hồi';
      }
    }
  }

  /**
   * Bật/tắt like/dislike cho bình luận hoặc phản hồi
   * @param {Object} target Đối tượng chứa thông tin mục tiêu (comment hoặc reply)
   * @param {string} voteType Loại vote ("like" hoặc "dislike")
   */
  async toggleVote(target, voteType) {
    if (!this.currentUser) {
      this.showError("Vui lòng đăng nhập để bình chọn.");
      return;
    }

    try {
      let voteRef;
      let id;
      let button;
      let container;

      // Cập nhật trạng thái active cho nút like/dislike
      const updateButtonActiveState = (btn, isActive, type) => {
        if (!btn) return;
        if (isActive) {
          btn.classList.add("active", type === "like" ? "liked" : "disliked");
        } else {
          btn.classList.remove(
            "active",
            type === "like" ? "liked" : "disliked"
          );
        }
      };
      // Cập nhật số lượng hiển thị trên nút like/dislike
      const updateCounterValue = (btn, delta) => {
        if (!btn) return;
        const counterElement = btn.querySelector(".comment-action-count");
        if (counterElement) {
          const currentCount = parseInt(counterElement.textContent) || 0;
          counterElement.textContent = Math.max(0, currentCount + delta);
        }
      };

      if (target.type === "reply") {
        // Vote cho reply
        id = target.replyId;
        voteRef = ref(database, `commentVotes/${id}/${this.currentUser.uid}`);

        // tìm nút like/dislike
        container = document.querySelector(`[data-reply-id="${id}"]`);
        if (container) {
          button = container.querySelector(`[data-action="${voteType}"]`);
        }
      } else {
        // Vote cho comment
        id = target.commentId;
        voteRef = ref(database, `commentVotes/${id}/${this.currentUser.uid}`);

        container = document.querySelector(`[data-comment-id="${id}"]`);
        if (container) {
          button = container.querySelector(`[data-action="${voteType}"]`);
        }
      }

      // Lấy trạng thái vote hiện tại
      const currentVoteSnapshot = await get(voteRef);
      const currentVote = currentVoteSnapshot.exists()
        ? currentVoteSnapshot.val()
        : null;
      const oppositeType = voteType === "like" ? "dislike" : "like";
      const oppositeButton = container?.querySelector(
        `[data-action="${oppositeType}"]`
      );
      // Xác định thao tác cần thực hiện
      let action;
      if (currentVote === voteType) {
        action = "remove"; // Bỏ vote hiện tại
      } else if (currentVote) {
        action = "change"; // Đổi loại vote
      } else {
        action = "add"; // Thêm vote mới
      }

      // QUAN TRỌNG: TẠM THỜI LƯU TRẠNG THÁI HIỆN TẠI CỦA PHẦN TỬ DOM
      // Để phòng trường hợp component bị re-render
      const buttonClassList = button ? [...button.classList] : [];
      const oppositeButtonClassList = oppositeButton
        ? [...oppositeButton.classList]
        : [];
      const currentCount = button
        ? parseInt(
            button.querySelector(".comment-action-count")?.textContent || "0"
          )
        : 0;
      const oppositeCount = oppositeButton
        ? parseInt(
            oppositeButton.querySelector(".comment-action-count")
              ?.textContent || "0"
          )
        : 0;

      // Cập nhật vào Firebase (không chờ đợi)
      let updatePromise;
      if (action === "remove") {
        updatePromise = remove(voteRef);
      } else {
        updatePromise = set(voteRef, voteType);
      }

      // Cập nhật UI ngay lập tức
      if (button) {
        if (action === "remove") {
          // Hủy vote
          updateCounterValue(button, -1);
          updateButtonActiveState(button, false, voteType);
        } else if (action === "change") {
          // Đổi loại vote
          updateCounterValue(button, 1);
          updateCounterValue(oppositeButton, -1);
          updateButtonActiveState(button, true, voteType);
          updateButtonActiveState(oppositeButton, false, oppositeType);
        } else {
          // Vote mới
          updateCounterValue(button, 1);
          updateButtonActiveState(button, true, voteType);
        }
      }

      // QUAN TRỌNG: THÊM EVENT LISTENER CHO VIỆC CHỐNG RE-RENDER
      // Bởi vì Firebase listener có thể gây re-render toàn bộ comment
      // Cần đảm bảo state của nút vote được giữ đúng sau re-render
      const preserveVoteState = () => {
        setTimeout(() => {
          // Kiểm tra xem button có còn tồn tại không sau render
          const newButton = container?.querySelector(
            `[data-action="${voteType}"]`
          );
          const newOppositeButton = container?.querySelector(
            `[data-action="${oppositeType}"]`
          );

          if (newButton && button !== newButton) {
            // Nếu button đã bị thay thế bởi re-render
            if (action === "remove") {
              updateButtonActiveState(newButton, false, voteType);
            } else {
              updateButtonActiveState(newButton, true, voteType);
            }

            // Cập nhật lại số lượng
            const counter = newButton.querySelector(".comment-action-count");
            if (counter) {
              if (action === "remove") {
                counter.textContent = Math.max(0, currentCount - 1);
              } else if (action === "add") {
                counter.textContent = currentCount + 1;
              } else if (action === "change") {
                counter.textContent = currentCount + 1;
              }
            }
          }

          if (
            newOppositeButton &&
            oppositeButton !== newOppositeButton &&
            action === "change"
          ) {
            updateButtonActiveState(newOppositeButton, false, oppositeType);
            const counter = newOppositeButton.querySelector(
              ".comment-action-count"
            );
            if (counter) {
              counter.textContent = Math.max(0, oppositeCount - 1);
            }
          }
        }, 50); // Vẫn giữ timeout để đợi DOM cập nhật
      };

      // Tạo MutationObserver để theo dõi thay đổi DOM
      const observer = new MutationObserver((mutations) => {
        // Chỉ gọi hàm một lần và ngắt kết nối observer
        preserveVoteState();
        observer.disconnect();
      });

      // Bắt đầu quan sát thay đổi trong phần tử cha của container
      const commentsSection = document.querySelector(".comments-section");
      if (commentsSection) {
        observer.observe(commentsSection, {
          childList: true, // Quan sát thêm/xóa node con
          subtree: true, // Quan sát cả cây DOM con
        });
      }

      // Chờ cập nhật Firebase hoàn tất và cập nhật counts trong database
      // Đưa vào try/catch riêng để không ảnh hưởng đến UI đã cập nhật
      try {
        await updatePromise;
        await this.updateVoteCounts(target);
      } catch (dbError) {
        console.error("Lỗi khi cập nhật vote vào database:", dbError);
        // Không cần thông báo lỗi vì UI đã được cập nhật
      }
    } catch (error) {
      console.error("Lỗi khi bình chọn:", error);
      this.showError("Không thể bình chọn. Vui lòng thử lại.");
    }
  }

  /**
   * Cập nhật số lượng bình chọn
   * @param {Object} target Đối tượng chứa thông tin mục tiêu (comment hoặc reply)
   */
  async updateVoteCounts(target) {
    try {
      let id;
      let updateRef;

      if (target.type === "reply") {
        // Đếm vote cho reply
        id = target.replyId;
        updateRef = ref(
          database,
          `comments/${this.courseId}/${this.lessonId}/${target.parentId}/replies/${id}`
        );
      } else {
        // Đếm vote cho comment
        id = target.commentId;
        updateRef = ref(
          database,
          `comments/${this.courseId}/${this.lessonId}/${id}`
        );
      }

      // Lấy số vote
      const votesRef = ref(database, `commentVotes/${id}`);
      const snapshot = await get(votesRef);

      let likes = 0;
      let dislikes = 0;

      if (snapshot.exists()) {
        const votes = snapshot.val();
        Object.values(votes).forEach((vote) => {
          if (vote === "like") likes++;
          else if (vote === "dislike") dislikes++;
        });
      }

      // Cập nhật số vote vào database
      await update(updateRef, {
        likes: likes,
        dislikes: dislikes,
      });
    } catch (error) {
      console.error("Lỗi khi cập nhật số lượng vote:", error);
    }
  }

  // Xóa bình luận
  async deleteComment(commentId) {
    if (!this.currentUser) return;

    const comment = this.comments.get(commentId);
    if (!comment || comment.userId !== this.currentUser.uid) {
      this.showError("Bạn không có quyền xóa bình luận này.");
      return;
    }

    if (confirm("Bạn có chắc chắn muốn xóa bình luận này?")) {
      try {
        const commentRef = ref(
          database,
          `comments/${this.courseId}/${this.lessonId}/${commentId}`
        );
        await remove(commentRef);

        // Đồng thời xóa các vote liên quan
        const voteRef = ref(database, `commentVotes/${commentId}`);
        await remove(voteRef);

        this.showSuccess("Bình luận đã được xóa.");
      } catch (error) {
        console.error("Lỗi khi xóa bình luận:", error);
        this.showError("Không thể xóa bình luận. Vui lòng thử lại.");
      }
    }
  }
  // Xóa phản hồi
  async deleteReply(replyId, parentId) {
    if (!this.currentUser) return;

    // Tìm comment cha của reply
    const comment = this.comments.get(parentId);
    if (!comment || !comment.replies || !comment.replies[replyId]) {
      this.showError("Không tìm thấy phản hồi");
      return;
    }
    // Tìm reply
    const commentReply = comment.replies[replyId];
    if (commentReply.userId !== this.currentUser.uid) {
      this.showError("Bạn không có quyền xóa phản hồi này!");
      return;
    }

    if (confirm("Bạn có chắc chắn muốn xóa phản hồi này?")) {
      try {
        const commentRef = ref(
          database,
          `comments/${this.courseId}/${this.lessonId}/${parentId}/replies/${replyId}`
        );
        await remove(commentRef);

        // Đồng thời xóa các vote liên quan
        const voteRef = ref(database, `commentVotes/${replyId}`);
        await remove(voteRef);

        this.showSuccess("Phản hồi đã được xóa.");
      } catch (error) {
        console.error("Lỗi khi xóa phản hồi:", error);
        this.showError("Không thể xóa phản hồi. Vui lòng thử lại.");
      }
    }
  }

  //  Chỉnh sửa comment
  async editComment(commentId) {
    await this.editContent({
      type: "comment",
      id: commentId,
    });
  }
  // Chỉnh sửa phản hồi
  async editReply(replyId, parentId) {
    await this.editContent({
      type: "reply",
      id: replyId,
      parentId: parentId,
    });
  }

  /**
   * Chỉnh sửa bình luận hoặc phản hồi
   * @param {Object} params Tham số chỉnh sửa
   * @param {string} params.type Loại ("comment" hoặc "reply")
   * @param {string} params.id ID của bình luận/phản hồi
   * @param {string} [params.parentId] ID của bình luận cha (chỉ cần cho reply)
   */
  async editContent(params) {
    if (!this.currentUser) {
      this.showError(
        `Vui lòng đăng nhập để sửa ${
          params.type === "comment" ? "bình luận" : "phản hồi"
        }.`
      );
      return;
    }

    // Xác định phần tử và dữ liệu
    let contentData, contentElement, itemElement, contentRef;
    const isComment = params.type === "comment";

    if (isComment) {
      // Xử lý cho comment
      contentData = this.comments.get(params.id);
      if (!contentData) return;

      itemElement = document.querySelector(`[data-comment-id="${params.id}"]`);
      contentElement = itemElement?.querySelector(".comment-content");
      contentRef = ref(
        database,
        `comments/${this.courseId}/${this.lessonId}/${params.id}`
      );
    } else {
      // Xử lý cho reply
      const parentComment = this.comments.get(params.parentId);
      if (
        !parentComment ||
        !parentComment.replies ||
        !parentComment.replies[params.id]
      )
        return;

      contentData = parentComment.replies[params.id];
      itemElement = document.querySelector(`[data-reply-id="${params.id}"]`);
      contentElement = itemElement?.querySelector(".reply-content");
      contentRef = ref(
        database,
        `comments/${this.courseId}/${this.lessonId}/${params.parentId}/replies/${params.id}`
      );
    }

    // Kiểm tra quyền
    if (!contentData || contentData.userId !== this.currentUser.uid) {
      this.showError(
        `Bạn không có quyền sửa ${isComment ? "bình luận" : "phản hồi"} này.`
      );
      return;
    }

    if (!contentElement) return;

    // Lấy nội dung gốc
    const originalContent = contentData.content;

    // Tạo form chỉnh sửa
    const editForm = document.createElement("div");
    editForm.className = `edit-${isComment ? "comment" : "reply"}-form`;

    // ID data attribute cho các nút
    const idAttr = isComment
      ? `data-comment-id="${params.id}"`
      : `data-reply-id="${params.id}" data-parent-id="${params.parentId}"`;

    editForm.innerHTML = `
    <textarea class="comment-textarea" maxlength="${this.maxCommentLength}">${originalContent}</textarea>
    <div class="comment-form-actions">
      <div class="comment-form-left">
        <span class="comment-char-count">${originalContent.length}/${this.maxCommentLength}</span>
      </div>
      <div class="comment-form-right">
        <button type="button" class="btn-comment btn-comment-secondary" data-action="cancel-edit" ${idAttr}>
          <i class="fas fa-times"></i> Hủy
        </button>
        <button type="button" class="btn-comment btn-comment-primary" data-action="save-edit" ${idAttr}>
          <i class="fas fa-save"></i> Lưu
        </button>
      </div>
    </div>
  `;

    // Thay thế nội dung bằng form
    contentElement.parentNode.replaceChild(editForm, contentElement);

    // Focus vào textarea và thiết lập con trỏ ở cuối
    const textarea = editForm.querySelector("textarea");
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);

    // Thiết lập sự kiện cho textarea
    textarea.addEventListener("input", (e) => {
      this.updateCharCount(e.target);
    });

    // Thiết lập sự kiện cho nút hủy
    editForm
      .querySelector('[data-action="cancel-edit"]')
      .addEventListener("click", () => {
        // Khôi phục lại nội dung
        editForm.parentNode.replaceChild(contentElement, editForm);
      });

    // Thiết lập sự kiện cho nút lưu
    editForm
      .querySelector('[data-action="save-edit"]')
      .addEventListener("click", async () => {
        const newContent = textarea.value.trim();

        // Kiểm tra nội dung
        if (!newContent) {
          this.showError(
            `Vui lòng nhập nội dung ${isComment ? "bình luận" : "phản hồi"}.`
          );
          return;
        }

        if (newContent.length > this.maxCommentLength) {
          this.showError(
            `${isComment ? "Bình luận" : "Phản hồi"} không được vượt quá ${
              this.maxCommentLength
            } ký tự.`
          );
          return;
        }

        try {
          const saveBtn = editForm.querySelector('[data-action="save-edit"]');
          saveBtn.disabled = true;
          saveBtn.innerHTML =
            '<i class="fas fa-spinner fa-spin"></i> Đang lưu...';

          // Cập nhật vào Firebase
          await update(contentRef, {
            content: newContent,
            isEdited: true,
            editedAt: Date.now(),
          });

          // Cập nhật nội dung hiển thị
          contentElement.innerHTML = this.formatCommentContent(newContent);

          // Thay thế form bằng nội dung
          editForm.parentNode.replaceChild(contentElement, editForm);

          this.showSuccess(
            `${isComment ? "Bình luận" : "Phản hồi"} đã được cập nhật.`
          );
        } catch (error) {
          console.error(
            `Lỗi khi cập nhật ${isComment ? "bình luận" : "phản hồi"}:`,
            error
          );
          this.showError(
            `Không thể cập nhật ${
              isComment ? "bình luận" : "phản hồi"
            }. Vui lòng thử lại.`
          );

          const saveBtn = editForm.querySelector('[data-action="save-edit"]');
          if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Lưu';
          }
        }
      });
  }
  /**
   * Gửi báo cáo vi phạm
   */
  async submitReport() {
    const reason = document.getElementById("report-reason").value;
    const description = document.getElementById("report-description").value;
    const commentId = this.currentReportCommentId;

    if (!reason) {
      this.showError("Vui lòng chọn lý do báo cáo.");
      return;
    }

    try {
      const reportData = {
        reason: reason,
        description: description,
        timestamp: Date.now(),
      };

      const reportRef = ref(
        database,
        `commentReports/${commentId}/${this.currentUser.uid}`
      );
      await set(reportRef, reportData);

      this.closeReportModal();
      this.showSuccess(
        "Báo cáo đã được gửi. Cảm ơn bạn đã góp phần xây dựng cộng đồng tích cực!"
      );
    } catch (error) {
      console.error("Lỗi khi gửi báo cáo:", error);
      this.showError("Không thể gửi báo cáo. Vui lòng thử lại.");
    }
  }

  /**
   * Hiển thị form trả lời
   * @param {string} commentId ID của bình luận
   */
  showReplyForm(commentId) {
    // Ẩn tất cả form trả lời trước
    document.querySelectorAll(".reply-form").forEach((form) => {
      form.classList.remove("active");
    });

    // Hiển thị form trả lời cụ thể
    const replyForm = document.querySelector(
      `[data-comment-id="${commentId}"].reply-form`
    );
    if (replyForm) {
      replyForm.classList.add("active");
      const textarea = replyForm.querySelector(".comment-textarea");
      textarea.focus();
    }
  }

  /**
   * Hủy trả lời
   * @param {HTMLElement} replyForm Form trả lời cần hủy
   */
  cancelReply(replyForm) {
    replyForm.classList.remove("active");
    const textarea = replyForm.querySelector(".comment-textarea");
    textarea.value = "";
    this.updateCharCount(textarea);
  }

  /**
   * Hiển thị modal báo cáo vi phạm
   * @param {string} commentId ID của bình luận cần báo cáo
   */
  showReportModal(commentId) {
    this.currentReportCommentId = commentId;
    const modal = document.getElementById("report-modal");
    modal.classList.add("active");

    // Reset form
    document.getElementById("report-reason").value = "";
    document.getElementById("report-description").value = "";
  }

  /**
   * Đóng modal báo cáo vi phạm
   */
  closeReportModal() {
    const modal = document.getElementById("report-modal");
    modal.classList.remove("active");
    this.currentReportCommentId = null;
  }

  /**
   * Cập nhật số ký tự đã nhập
   * @param {HTMLElement} textarea Ô nhập text cần cập nhật
   */
  updateCharCount(textarea) {
    const charCount = textarea.value.length;
    const maxLength = parseInt(textarea.getAttribute("maxlength"));
    const charCountElement = textarea
      .closest(".comment-form, .reply-form")
      .querySelector(".comment-char-count");

    if (charCountElement) {
      charCountElement.textContent = `${charCount}/${maxLength}`;

      // Cập nhật màu dựa trên số ký tự
      charCountElement.className = "comment-char-count";
      if (charCount > maxLength * 0.8) {
        charCountElement.classList.add("warning");
      }
      if (charCount > maxLength * 0.95) {
        charCountElement.classList.add("error");
      }
    }
  }

  /**
   * Kiểm tra tính hợp lệ của form bình luận
   */
  validateCommentForm() {
    const textarea = document.querySelector(".comment-textarea");
    const submitBtn = document.querySelector('[data-action="submit"]');

    if (textarea && submitBtn) {
      const isValid =
        textarea.value.trim().length > 0 &&
        textarea.value.length <= this.maxCommentLength;
      submitBtn.disabled = !isValid;
    }
  }

  /**
   * Hủy bình luận
   */
  cancelComment() {
    const textarea = document.querySelector(".comment-textarea");
    if (textarea) {
      textarea.value = "";
      this.updateCharCount(textarea);
      this.validateCommentForm();
    }
  }

  /**
   * Lấy bình chọn của người dùng hiện tại
   * @param {string} id ID của bình luận hoặc phản hồi
   * @returns {string|null} Loại vote ("like", "dislike") hoặc null
   */
  async getUserVote(id) {
    if (!this.currentUser) return null;

    try {
      const voteRef = ref(
        database,
        `commentVotes/${id}/${this.currentUser.uid}`
      );
      const snapshot = await get(voteRef);

      if (snapshot.exists()) {
        return snapshot.val(); // "like" hoặc "dislike"
      }

      return null;
    } catch (error) {
      console.error("Lỗi khi lấy bình chọn của người dùng:", error);
      return null;
    }
  }

  /**
   * Định dạng nội dung bình luận
   * @param {string} content Nội dung bình luận
   * @returns {string} Nội dung đã được định dạng an toàn
   */
  formatCommentContent(content) {
    // Xử lý nội dung undefined/null/rỗng
    if (typeof content !== "string") {
      if (content === undefined || content === null) return "";
      content = String(content);
    }
    // Escape HTML và định dạng cơ bản
    return content
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;")
      .replace(/\n/g, "<br>");
  }

  /**
   * Mã hóa đường dẫn để sử dụng trong Firebase
   * @param {string} path Đường dẫn cần mã hóa
   * @returns {string} Đường dẫn đã mã hóa
   */
  encodePath(path) {
    // Thay các ký tự đặc biệt thành '_'
    return path.replace(/[.#$\[\]]/g, "_");
  }

  /**
   * Chuyển đổi timestamp thành chuỗi thời gian tương đối
   * @param {number} timestamp Thời gian dưới dạng timestamp
   * @returns {string} Chuỗi thời gian tương đối
   */
  getTimeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;

    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    const week = 7 * day;
    const month = 30 * day;
    const year = 365 * day;

    if (diff < minute) {
      return "Vừa xong";
    } else if (diff < hour) {
      return `${Math.floor(diff / minute)} phút trước`;
    } else if (diff < day) {
      return `${Math.floor(diff / hour)} giờ trước`;
    } else if (diff < week) {
      return `${Math.floor(diff / day)} ngày trước`;
    } else if (diff < month) {
      return `${Math.floor(diff / week)} tuần trước`;
    } else if (diff < year) {
      return `${Math.floor(diff / month)} tháng trước`;
    } else {
      return `${Math.floor(diff / year)} năm trước`;
    }
  }

  /**
   * Hiển thị thông báo lỗi
   * @param {string} message Nội dung thông báo
   */
  showError(message) {
    // Tạo thông báo toast đơn giản
    const toast = document.createElement("div");
    toast.className = "toast toast-error";
    toast.innerHTML = `
      <i class="fas fa-exclamation-circle"></i>
      <span>${message}</span>
    `;

    document.body.appendChild(toast);

    // Xóa toast sau 3 giây
    setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  /**
   * Hiển thị thông báo thành công
   * @param {string} message Nội dung thông báo
   */
  showSuccess(message) {
    // Tạo thông báo toast đơn giản
    const toast = document.createElement("div");
    toast.className = "toast toast-success";
    toast.innerHTML = `
      <i class="fas fa-check-circle"></i>
      <span>${message}</span>
    `;

    document.body.appendChild(toast);

    // Xóa toast sau 3 giây
    setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  /**
   * Giải phóng tài nguyên khi không sử dụng
   */
  destroy() {
    // Dọn dẹp listeners đúng cách
    if (this.listeners.has("comments")) {
      const commentsRef = ref(
        database,
        `comments/${this.courseId}/${this.lessonId}`
      );
      off(commentsRef); // Hủy tất cả listeners trên ref này
    }
    this.listeners.clear();

    // Xóa phần bình luận khỏi DOM
    const commentsSection = document.querySelector(".comments-section");
    if (commentsSection) {
      commentsSection.remove();
    }

    // Đặt lại trạng thái
    this.comments.clear();
    this.currentUser = null;
    this.isLoading = false;
  }
}

// Export để sử dụng trong các module khác
export default CommentSystem;
