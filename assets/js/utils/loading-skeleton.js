/**
 * Loading Skeleton Manager - Hệ thống loading skeleton thống nhất
 * Cung cấp skeleton loading cho tất cả các component trong hệ thống
 */

/**
 * Skeleton types templates
 */
const SKELETON_TEMPLATES = {
  // Course card skeleton
  courseCard: `
    <div class="course-card skeleton skeleton-card">
      <div class="skeleton-image"></div>
      <div class="skeleton-content">
        <div class="skeleton-title"></div>
        <div class="skeleton-text"></div>
        <div class="skeleton-text short"></div>
      </div>
    </div>
  `,

  // Blog card skeleton
  blogCard: `
    <li class="blog-card skeleton skeleton-blog-card">
      <div class="skeleton-avatar"></div>
      <div class="blog-info">
        <div class="skeleton-text"></div>
        <div class="skeleton-title"></div>
        <div class="skeleton-text"></div>
      </div>
    </li>
  `,

  // Resource card skeleton
  resourceCard: `
    <div class="resource-card skeleton skeleton-resource-card">
      <div class="skeleton-icon"></div>
      <div class="resource-info">
        <div class="skeleton-title"></div>
        <div class="skeleton-text"></div>
        <div class="skeleton-button"></div>
      </div>
    </div>
  `,

  // Course intro content skeleton
  container_template: `
    <div class="skeleton-container">
      <div class="skeleton-title large"></div>
      <div class="skeleton-meta">
        <div class="skeleton-badge"></div>
        <div class="skeleton-text short"></div>
        <div class="skeleton-text short"></div>
      </div>
      <div class="skeleton-text"></div>
      <div class="skeleton-text"></div>
      <div class="skeleton-text short"></div>
    </div>
  `,

  sidebar_template: `
  <div class="skeleton-sidebar">
    <div class="skeleton-image large"></div>
    <div class="skeleton-title"></div>
    <div class="skeleton-text"></div>
    <div class="skeleton-button"></div>
  </div>
`,
};

/**
 * Loading Skeleton Manager
 */
export const loadingSkeleton = {
  /**
   * Hiển thị loading skeleton cho courses grid
   * @param {string|HTMLElement} container - Selector hoặc DOM element
   * @param {number} count - Số lượng skeleton cards (default: 6)
   */
  showCourses(container, count = 6) {
    const el = this._getElement(container);
    if (!el) return;

    const html = Array(count).fill(SKELETON_TEMPLATES.courseCard).join("");

    el.innerHTML = html;
    el.classList.add("loading-state");
  },

  /**
   * Hiển thị loading skeleton cho blogs list
   * @param {string|HTMLElement} container - Selector hoặc DOM element
   * @param {number} count - Số lượng skeleton cards (default: 4)
   */
  showBlogs(container, count = 4) {
    const el = this._getElement(container);
    if (!el) return;

    const html = Array(count).fill(SKELETON_TEMPLATES.blogCard).join("");

    el.innerHTML = html;
    el.classList.add("loading-state");
  },

  /**
   * Hiển thị loading skeleton cho resources grid
   * @param {string|HTMLElement} container - Selector hoặc DOM element
   * @param {number} count - Số lượng skeleton cards (default: 6)
   */
  showResources(container, count = 6) {
    const el = this._getElement(container);
    if (!el) return;

    const html = Array(count).fill(SKELETON_TEMPLATES.resourceCard).join("");

    el.innerHTML = html;
    el.classList.add("loading-state");
  },

  /**
   * Hiển thị loading skeleton cho layout Main content và sidebar
   * @param {string|HTMLElement} mainContainer - Main content container
   * @param {string|HTMLElement} sidebarContainer - Sidebar container
   */
  showMainSidebar(mainContainer, sidebarContainer, options = {}) {
    const {
      mainTemplate = SKELETON_TEMPLATES.container_template,
      sidebarTemplate = SKELETON_TEMPLATES.sidebar_template,
      hideOriginalContent = true,
    } = options;

    this._applySkeletonOverlay(
      mainContainer,
      mainTemplate,
      hideOriginalContent
    );
    this._applySkeletonOverlay(
      sidebarContainer,
      sidebarTemplate,
      hideOriginalContent
    );
  },

  /**
   * Hiển thị loading spinner (cho loading state đơn giản)
   * @param {string|HTMLElement} container - Selector hoặc DOM element
   * @param {string} message - Loading message (optional)
   */
  showSpinner(container, message = "Đang tải...") {
    const el = this._getElement(container);
    if (!el) return;

    el.innerHTML = `
      <div class="loading-spinner">
        <i class="fas fa-spinner fa-spin"></i>
        <p>${message}</p>
      </div>
    `;
    el.classList.add("loading-state");
  },

  /**
   * Ẩn loading và show content
   * @param {string|HTMLElement} container - Selector hoặc DOM element
   */
  hide(container) {
    const el = this._getElement(container);
    if (!el) return;

    el.classList.remove("loading-state");

    // Remove skeleton elements và skeleton overlay
    el.querySelectorAll(
      ".skeleton, .skeleton-card, .skeleton-overlay, .loading-spinner"
    ).forEach((skeleton) => {
      skeleton.remove();
    });

    // Hiện lại children đã bị ẩn bởi skeleton
    Array.from(el.children).forEach((child) => {
      if (child.dataset && child.dataset.skeletonHidden === "true") {
        child.style.display = child.dataset.prevDisplay || "";
        delete child.dataset.skeletonHidden;
        delete child.dataset.prevDisplay;
      }
    });
  },

  /**
   * Hiển thị loading state container và ẩn content
   * @param {string|HTMLElement} loadingContainer - Loading container
   * @param {string|HTMLElement} contentContainer - Content container
   */
  showAndHideContent(loadingContainer, contentContainer) {
    const loadingEl = this._getElement(loadingContainer);
    const contentEl = this._getElement(contentContainer);

    if (loadingEl) {
      loadingEl.style.display = "flex";
    }

    if (contentEl) {
      contentEl.style.display = "none";
    }
  },

  /**
   * Ẩn loading state và show content
   * @param {string|HTMLElement} loadingContainer - Loading container
   * @param {string|HTMLElement} contentContainer - Content container
   */
  hideAndShowContent(loadingContainer, contentContainer) {
    const loadingEl = this._getElement(loadingContainer);
    const contentEl = this._getElement(contentContainer);

    if (loadingEl) {
      loadingEl.style.display = "none";
    }

    if (contentEl) {
      contentEl.style.display = "block";
    }
  },

  /**
   * Hiển thị custom skeleton từ template
   * @param {string|HTMLElement} container - Selector hoặc DOM element
   * @param {string} template - HTML template
   * @param {number} count - Số lượng skeleton (default: 1)
   */
  showCustom(container, template, count = 1) {
    const el = this._getElement(container);
    if (!el) return;

    const html = Array(count).fill(template).join("");
    el.innerHTML = html;
    el.classList.add("loading-state");
  },

  /**
   * Helper: Lấy DOM element từ selector hoặc element
   * @private
   */
  _getElement(target) {
    if (typeof target === "string") {
      return document.querySelector(target);
    }
    return target instanceof HTMLElement ? target : null;
  },

  /**
   * Internal helper để chèn skeleton overlay vào container
   */
  _applySkeletonOverlay(target, template, hideChildren) {
    const el = this._getElement(target);
    if (!el) return;

    if (hideChildren) {
      Array.from(el.children).forEach((child) => {
        if (child.classList.contains("skeleton-overlay")) return;
        if (!child.dataset.skeletonHidden) {
          child.dataset.skeletonHidden = "true";
          child.dataset.prevDisplay = child.style.display || "";
          child.style.display = "none";
        }
      });
    }

    const skeletonDiv = document.createElement("div");
    skeletonDiv.className = "skeleton-overlay";
    skeletonDiv.innerHTML = template;
    el.insertBefore(skeletonDiv, el.firstChild);

    el.classList.add("loading-state");
    el.style.display = "block";
  },

  /**
   * Tạo skeleton card tùy chỉnh
   * @param {Object} options - Cấu hình skeleton
   * @returns {string} HTML string
   */
  createCustomCard(options = {}) {
    const {
      hasImage = true,
      hasAvatar = false,
      hasIcon = false,
      titleLines = 1,
      textLines = 2,
      className = "skeleton-card",
    } = options;

    let html = `<div class="skeleton ${className}">`;

    if (hasImage) {
      html += '<div class="skeleton-image"></div>';
    }

    if (hasAvatar) {
      html += '<div class="skeleton-avatar"></div>';
    }

    if (hasIcon) {
      html += '<div class="skeleton-icon"></div>';
    }

    html += '<div class="skeleton-content">';

    for (let i = 0; i < titleLines; i++) {
      html += '<div class="skeleton-title"></div>';
    }

    for (let i = 0; i < textLines; i++) {
      const shortClass = i === textLines - 1 ? " short" : "";
      html += `<div class="skeleton-text${shortClass}"></div>`;
    }

    html += "</div></div>";

    return html;
  },
};

/**
 * Export templates để sử dụng độc lập
 */
export { SKELETON_TEMPLATES };

/**
 * Default export
 */
export default loadingSkeleton;
