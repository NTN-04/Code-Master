/**
 * IDE UI Enhancement
 * Xử lý full-screen mode, resizable pane, toggle sidebar
 */

// ========================================
// STATE
// ========================================

let isSidebarVisible = true;
let isResizing = false;
let lastEditorWidth = localStorage.getItem("ide-editor-width") || "50%";

// ========================================
// TOGGLE SIDEBAR
// ========================================

/**
 * Toggle sidebar visibility (Ctrl+B)
 */
function toggleSidebar() {
  const wrapper = document.querySelector(".learning-wrapper");
  const toggleBtn = document.getElementById("sidebar-toggle-edge");

  if (!wrapper) return;

  isSidebarVisible = !isSidebarVisible;

  if (isSidebarVisible) {
    wrapper.classList.remove("ide-full-mode");
  } else {
    wrapper.classList.add("ide-full-mode");
  }

  // Force Monaco layout after sidebar animation
  setTimeout(() => {
    if (window.editor) {
      window.editor.layout();
    }
  }, 350);
}

/**
 * Khởi tạo IDE full mode khi vào tab Editor
 */
function enterIDEMode() {
  const wrapper = document.querySelector(".learning-wrapper");
  const toggleBtn = document.getElementById("sidebar-toggle-edge");

  if (wrapper) {
    wrapper.classList.add("ide-full-mode");
    wrapper.classList.add("ide-active"); // Để CSS hiện toggle button
    isSidebarVisible = false;
  }

  if (toggleBtn) {
    toggleBtn.style.display = "flex";
  }
}

/**
 * Thoát IDE full mode khi ra khỏi tab Editor
 */
function exitIDEMode() {
  const wrapper = document.querySelector(".learning-wrapper");
  const toggleBtn = document.getElementById("sidebar-toggle-edge");

  if (wrapper) {
    wrapper.classList.remove("ide-full-mode");
    wrapper.classList.remove("ide-active");
    isSidebarVisible = true;
  }

  if (toggleBtn) {
    toggleBtn.style.display = "none";
  }
}

// ========================================
// RESIZABLE PANE
// ========================================

/**
 * Khởi tạo resizable divider
 */
function initResizablePanes() {
  const divider = document.getElementById("editor-divider");
  const container = document.getElementById("editor-container");
  const editorPane = document.getElementById("monaco-container");
  const previewPane = container?.querySelector(".preview-pane");

  if (!divider || !container || !editorPane || !previewPane) return;

  // Load saved width
  if (lastEditorWidth) {
    editorPane.style.flex = `0 0 ${lastEditorWidth}`;
    previewPane.style.flex = "1";
  }

  // Mouse down - Bắt đầu resize
  divider.addEventListener("mousedown", (e) => {
    isResizing = true;
    divider.classList.add("dragging");
    container.classList.add("resizing");

    // Prevent text selection
    e.preventDefault();

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  });

  // Mouse move - Thực hiện resize
  function handleMouseMove(e) {
    if (!isResizing) return;

    const containerRect = container.getBoundingClientRect();
    const offsetX = e.clientX - containerRect.left;
    const containerWidth = containerRect.width;

    // Tính phần trăm (giới hạn 20% - 80%)
    let percentage = (offsetX / containerWidth) * 100;
    percentage = Math.max(20, Math.min(80, percentage));

    // Cập nhật width
    editorPane.style.flex = `0 0 ${percentage}%`;
    previewPane.style.flex = "1";

    // Force Monaco layout
    if (window.editor) {
      window.editor.layout();
    }
  }

  // Mouse up - Kết thúc resize
  function handleMouseUp() {
    if (!isResizing) return;

    isResizing = false;
    divider.classList.remove("dragging");
    container.classList.remove("resizing");

    // Lưu width
    const editorWidth = editorPane.style.flex.match(/[\d.]+%/)?.[0];
    if (editorWidth) {
      localStorage.setItem("ide-editor-width", editorWidth);
      lastEditorWidth = editorWidth;
    }

    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  }
}

// ========================================
// KEYBOARD SHORTCUTS
// ========================================

/**
 * Khởi tạo phím tắt
 */
function initKeyboardShortcuts() {
  document.addEventListener("keydown", (e) => {
    // Ctrl+B: Toggle Sidebar
    if (e.ctrlKey && e.key === "b") {
      const editorTab = document.getElementById("tab-editor");
      if (editorTab?.classList.contains("active")) {
        e.preventDefault();
        toggleSidebar();
      }
    }

    // F11: Fullscreen (browser native, chỉ log)
    if (e.key === "F11") {
      console.log("[IDE] F11 pressed - Browser fullscreen");
    }
  });
}

// ========================================
// TAB SWITCHING INTEGRATION
// ========================================

/**
 * Hook vào tab switching để auto enter/exit IDE mode
 */
function initTabSwitchingHooks() {
  const tabBtns = document.querySelectorAll(".tab-btn");

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tabName = btn.dataset.tab;

      if (tabName === "editor") {
        // Vào tab Editor → Full mode
        setTimeout(() => enterIDEMode(), 50);
      } else {
        // Ra khỏi tab Editor → Exit full mode
        setTimeout(() => exitIDEMode(), 50);
      }
    });
  });
}

// ========================================
// INITIALIZATION
// ========================================

document.addEventListener("DOMContentLoaded", () => {
  // Khởi tạo toggle sidebar button (Edge Button)
  const toggleBtn = document.getElementById("sidebar-toggle-edge");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", toggleSidebar);
    // Ẩn mặc định, chỉ hiện khi vào tab Editor
    toggleBtn.style.display = "none";
  }

  // Khởi tạo resizable panes
  initResizablePanes();

  // Khởi tạo keyboard shortcuts
  initKeyboardShortcuts();

  // Hook vào tab switching
  initTabSwitchingHooks();
});

export { toggleSidebar, enterIDEMode, exitIDEMode, initResizablePanes };
