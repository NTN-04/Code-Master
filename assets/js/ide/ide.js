/**
 * IDE Module - Monaco Editor Integration
 * Cung cấp chức năng soạn thảo code và xem trước cho trang khóa học
 * Hỗ trợ đa ngôn ngữ dựa trên cấu hình template
 *
 * @module ide
 * @requires Monaco Editor (loaded via CDN)
 */

import { getTemplateConfig, getDefaultCode } from "./ide-config.js";
import {
  runPython,
  buildPythonResultHTML,
  buildLoadingHTML,
  buildRunningHTML,
  preloadPyodide,
  isPyodideReady,
} from "./python-runner.js";

// ========================================
// TRẠNG THÁI & BIẾN TOÀN CỤC
// ========================================

let editor = null;

// Expose editor globally cho resizable pane
if (typeof window !== "undefined") {
  window.editor = null;
}

let isEditorInitialized = false;
let currentConfig = null;
let currentTemplateName = "web";

/** Cấu hình Monaco Editor */
const EDITOR_CONFIG = {
  theme: "vs-dark",
  fontSize: 14,
  fontFamily: "'Fira Code', 'Consolas', 'Monaco', monospace",
  minimap: { enabled: true },
  automaticLayout: true,
  wordWrap: "on",
  lineNumbers: "on",
  scrollBeyondLastLine: false,
  padding: { top: 10, bottom: 10 },
  tabSize: 2,
  insertSpaces: true,
  formatOnPaste: true,
  formatOnType: true,
  suggestOnTriggerCharacters: true,
  quickSuggestions: true,
  folding: true,
  bracketPairColorization: { enabled: true },
};

// ========================================
// MONACO LOADER
// ========================================

/**
 * Load Monaco Editor via AMD loader
 * @returns {Promise<typeof monaco>}
 */
function loadMonaco() {
  return new Promise((resolve, reject) => {
    // Check if Monaco is already loaded
    if (window.monaco) {
      resolve(window.monaco);
      return;
    }

    // Check if require is available (loader.js)
    if (!window.require) {
      reject(new Error("Monaco loader not found. Ensure loader.js is loaded."));
      return;
    }

    // Configure AMD loader
    window.require.config({
      paths: {
        vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs",
      },
    });

    // Load Monaco
    window.require(["vs/editor/editor.main"], () => {
      resolve(window.monaco);
    });
  });
}

// ========================================
// CÁC HÀM XỬ LÝ EDITOR
// ========================================

async function initEditor(
  containerId = "monaco-container",
  templateName = "web"
) {
  // Nếu đã khởi tạo với cùng template, chỉ cần layout lại
  if (isEditorInitialized && editor && currentTemplateName === templateName) {
    layoutEditor();
    return editor;
  }

  // Nếu template khác, dispose editor cũ
  if (isEditorInitialized && editor && currentTemplateName !== templateName) {
    disposeEditor();
  }

  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`[IDE] Không tìm thấy container #${containerId}`);
    return null;
  }

  try {
    const monaco = await loadMonaco();

    // Lấy cấu hình template
    currentConfig = getTemplateConfig(templateName);
    currentTemplateName = templateName;

    const defaultLang = currentConfig.defaultLanguage;
    const defaultCode = getDefaultCode(templateName, defaultLang);

    // Lấy Monaco language ID
    const langConfig = currentConfig.languages.find(
      (l) => l.id === defaultLang
    );
    const monacoLang = langConfig?.monaco || defaultLang;

    // Tạo editor instance
    editor = monaco.editor.create(container, {
      value: defaultCode,
      language: monacoLang,
      ...EDITOR_CONFIG,
    });

    // Expose globally
    if (typeof window !== "undefined") {
      window.editor = editor;
    }

    isEditorInitialized = true;
    console.log(`[IDE] Đã khởi tạo với template: ${currentConfig.name}`);

    // Render language selector động
    renderLanguageSelector();

    // Cập nhật UI dựa trên features
    updateUIBasedOnFeatures();

    // Preload Pyodide nếu đang dùng template Python
    if (currentConfig.runMode === "pyodide") {
      console.log("[IDE] Preloading Pyodide cho Python...");
      preloadPyodide();
    }

    // Phím tắt Ctrl+Enter để chạy code
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      runCode();
    });

    return editor;
  } catch (error) {
    console.error("[IDE] Lỗi khởi tạo Monaco Editor:", error);
    return null;
  }
}

/**
 * Chạy code và hiển thị kết quả
 * Hỗ trợ nhiều runMode: web, console, pyodide, react, sql
 */
async function runCode() {
  if (!editor) {
    console.warn("[IDE] Editor chưa được khởi tạo");
    return;
  }

  const code = editor.getValue();
  const language = getCurrentLanguage();
  const runMode = currentConfig?.runMode || "web";

  // Xử lý riêng cho Pyodide (async)
  if (runMode === "pyodide") {
    await runPythonCode(code);
    return;
  }

  let htmlContent = "";

  // Xử lý theo runMode của template
  switch (runMode) {
    case "web":
      htmlContent = buildWebPreview(code, language);
      break;
    case "console":
      htmlContent = buildConsolePreview(code, language);
      break;
    case "react":
      htmlContent = buildReactPreview(code);
      break;
    case "sql":
      htmlContent = buildSQLPreview(code);
      break;
    default:
      htmlContent = buildWebPreview(code, language);
  }

  writeToPreview("code-preview", htmlContent);
}

/**
 * Chạy code Python với Pyodide
 * @param {string} code - Code Python cần chạy
 */
async function runPythonCode(code) {
  const runBtn = document.getElementById("btn-run-code");
  const previewId = "code-preview";

  // Disable nút chạy và hiển thị loading
  if (runBtn) {
    runBtn.disabled = true;
    runBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang chạy...';
  }

  try {
    // Hiển thị loading state
    if (!isPyodideReady()) {
      writeToPreview(previewId, buildLoadingHTML());
    } else {
      writeToPreview(previewId, buildRunningHTML());
    }

    // Chạy Python code
    const result = await runPython(code);

    // Hiển thị kết quả
    const resultHTML = buildPythonResultHTML(result);
    writeToPreview(previewId, resultHTML);

    // Log kết quả
    if (result.success) {
      console.log(`[IDE] Python chạy thành công (${result.executionTime}ms)`);
    } else {
      console.warn("[IDE] Python có lỗi:", result.error);
    }
  } catch (error) {
    // Xử lý lỗi không mong đợi
    console.error("[IDE] Lỗi chạy Python:", error);
    const errorHTML = buildPythonResultHTML({
      success: false,
      output: "",
      error: error.message || "Đã xảy ra lỗi không xác định",
      executionTime: 0,
    });
    writeToPreview(previewId, errorHTML);
  } finally {
    // Restore nút chạy
    if (runBtn) {
      runBtn.disabled = false;
      runBtn.innerHTML = '<i class="fas fa-play"></i> Chạy Code';
    }
  }
}

/**
 * Xây dựng preview cho Web (HTML/CSS/JS)
 */
function buildWebPreview(code, language) {
  switch (language) {
    case "html":
      return code;
    case "css":
      return buildCSSPreview(code);
    case "javascript":
      return buildJSPreview(code);
    default:
      return code;
  }
}

/**
 * Xây dựng preview cho CSS
 */
function buildCSSPreview(cssCode) {
  return `<!DOCTYPE html>
<html>
<head>
  <style>${cssCode}</style>
</head>
<body>
  <div class="card">
    <h1>CSS Preview</h1>
    <p>Thêm class "card" để xem style của bạn</p>
  </div>
</body>
</html>`;
}

/**
 * Xây dựng preview cho JavaScript
 */
function buildJSPreview(jsCode) {
  return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; }
  </style>
</head>
<body>
  <script>
    const originalLog = console.log;
    const logs = [];
    console.log = (...args) => {
      logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' '));
      originalLog.apply(console, args);
    };

    try {
      ${jsCode}
    } catch (error) {
      document.body.innerHTML = '<div style="color: red; padding: 20px;"><h3>Lỗi:</h3><pre>' + error.message + '</pre></div>';
    }

    if (document.body.children.length === 0 && logs.length > 0) {
      document.body.innerHTML = '<div style="padding: 20px; font-family: monospace;"><h3>Console Output:</h3>' + 
        logs.map(log => '<div style="background: #f5f5f5; padding: 8px; margin: 4px 0; border-radius: 4px;">' + log + '</div>').join('') + 
        '</div>';
    }
  <\/script>
</body>
</html>`;
}

/**
 * Xây dựng preview cho Console (Python, Java, C++...)
 * Hiển thị thông báo cần API backend để chạy
 */
function buildConsolePreview(code, language) {
  const langName =
    currentConfig?.languages.find((l) => l.id === language)?.name || language;
  return `<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      margin: 0;
      font-family: 'Consolas', monospace;
      background: #1e1e1e;
      color: #d4d4d4;
      padding: 20px;
      min-height: 100vh;
      box-sizing: border-box;
    }
    .console-header {
      color: #569cd6;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 1px solid #333;
    }
    .code-preview {
      background: #252526;
      padding: 15px;
      border-radius: 8px;
      overflow-x: auto;
      white-space: pre-wrap;
      font-size: 13px;
      line-height: 1.5;
    }
    .note {
      margin-top: 20px;
      padding: 15px;
      background: #2d2d30;
      border-left: 3px solid #5ebbff;
      border-radius: 4px;
      color: #9cdcfe;
    }
  </style>
</head>
<body>
  <div class="console-header">
    <strong>📟 Console ${langName}</strong>
  </div>
  <div class="code-preview">${escapeHtmlForPreview(code)}</div>
  <div class="note">
    <strong>💡 Ghi chú:</strong><br>
    Để chạy code ${langName}, cần tích hợp backend API hoặc service như Pyodide (Python), JDoodle (Java/C++).
    <br><br>
    Hiện tại đang hiển thị code preview.
  </div>
</body>
</html>`;
}

/**
 * Xây dựng preview cho React (JSX)
 */
function buildReactPreview(code) {
  return `<!DOCTYPE html>
<html>
<head>
  <script src="https://unpkg.com/react@18/umd/react.development.js"><\/script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"><\/script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; }
    #root { min-height: 100vh; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    ${code}
  <\/script>
</body>
</html>`;
}

/**
 * Xây dựng preview cho SQL
 */
function buildSQLPreview(code) {
  return `<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      margin: 0;
      font-family: 'Consolas', monospace;
      background: #1e1e1e;
      color: #d4d4d4;
      padding: 20px;
      min-height: 100vh;
      box-sizing: border-box;
    }
    .sql-header {
      color: #ce9178;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 1px solid #333;
    }
    .code-preview {
      background: #252526;
      padding: 15px;
      border-radius: 8px;
      overflow-x: auto;
      white-space: pre-wrap;
      font-size: 13px;
      line-height: 1.5;
    }
    .keyword { color: #569cd6; }
    .string { color: #ce9178; }
    .comment { color: #6a9955; }
  </style>
</head>
<body>
  <div class="sql-header">
    <strong>🗃️ SQL Query Preview</strong>
  </div>
  <div class="code-preview">${highlightSQL(code)}</div>
</body>
</html>`;
}

/**
 * Highlight SQL syntax đơn giản
 */
function highlightSQL(code) {
  const keywords = [
    "SELECT",
    "FROM",
    "WHERE",
    "INSERT",
    "INTO",
    "VALUES",
    "UPDATE",
    "SET",
    "DELETE",
    "CREATE",
    "TABLE",
    "DROP",
    "ALTER",
    "JOIN",
    "LEFT",
    "RIGHT",
    "INNER",
    "OUTER",
    "ON",
    "AND",
    "OR",
    "ORDER",
    "BY",
    "GROUP",
    "HAVING",
    "LIMIT",
    "OFFSET",
    "AS",
    "NOT",
    "NULL",
    "PRIMARY",
    "KEY",
    "FOREIGN",
    "REFERENCES",
    "DEFAULT",
    "AUTO_INCREMENT",
    "INT",
    "VARCHAR",
    "TEXT",
    "DECIMAL",
    "TIMESTAMP",
    "UNIQUE",
    "INDEX",
    "ASC",
    "DESC",
  ];

  let result = escapeHtmlForPreview(code);

  // Highlight comments
  result = result.replace(/(--[^\n]*)/g, '<span class="comment">$1</span>');

  // Highlight strings
  result = result.replace(/('([^']*)')/g, '<span class="string">$1</span>');

  // Highlight keywords
  keywords.forEach((kw) => {
    const regex = new RegExp(`\\b(${kw})\\b`, "gi");
    result = result.replace(regex, '<span class="keyword">$1</span>');
  });

  return result;
}

/**
 * Escape HTML cho preview
 */
function escapeHtmlForPreview(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function writeToPreview(iframeOrId, content) {
  // Hỗ trợ cả iframe element hoặc ID string
  // Luôn query lại từ DOM để tránh lỗi orphan element
  let iframe;

  if (typeof iframeOrId === "string") {
    iframe = document.getElementById(iframeOrId);
  } else if (iframeOrId && iframeOrId.id) {
    // Nếu là element, query lại bằng ID để đảm bảo có element mới nhất
    iframe = document.getElementById(iframeOrId.id) || iframeOrId;
  } else {
    iframe = iframeOrId;
  }

  if (!iframe) {
    console.error("[IDE] Không tìm thấy iframe preview");
    return;
  }

  // Cách 1: Sử dụng srcdoc (an toàn, không cần replace)
  // Nhược điểm: một số browser cũ không hỗ trợ
  if ("srcdoc" in iframe) {
    iframe.srcdoc = content;
    return;
  }

  // Cách 2: Fallback - ghi trực tiếp vào document
  try {
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      console.error("[IDE] Cannot access iframe document");
      return;
    }

    doc.open();
    doc.write(content);
    doc.close();
  } catch (error) {
    console.error("[IDE] Error writing to preview:", error);
    // Fallback cuối: dùng srcdoc với data URI
    iframe.src = "data:text/html;charset=utf-8," + encodeURIComponent(content);
  }
}

/**
 * Lấy ngôn ngữ đang chọn
 * @returns {string}
 */
function getCurrentLanguage() {
  const select = document.getElementById("language-select");
  return select?.value || currentConfig?.defaultLanguage || "html";
}

/**
 * Đổi ngôn ngữ editor
 */
function changeLanguage(languageId) {
  if (!editor || !window.monaco || !currentConfig) return;

  // Tìm cấu hình ngôn ngữ
  const langConfig = currentConfig.languages.find((l) => l.id === languageId);
  if (!langConfig) {
    console.warn(`[IDE] Ngôn ngữ không hợp lệ: ${languageId}`);
    return;
  }

  // Cập nhật ngôn ngữ Monaco
  const model = editor.getModel();
  if (model) {
    window.monaco.editor.setModelLanguage(model, langConfig.monaco);
  }

  // Lấy code mẫu cho ngôn ngữ mới
  const currentCode = editor.getValue();
  const allDefaults = Object.values(currentConfig.defaultCode);

  // Chỉ thay đổi code nếu đang dùng code mẫu
  if (allDefaults.includes(currentCode)) {
    const newDefault = getDefaultCode(currentTemplateName, languageId);
    if (newDefault) {
      editor.setValue(newDefault);
    }
  }
}

/**
 * Render language selector động dựa trên template
 */
function renderLanguageSelector() {
  const select = document.getElementById("language-select");
  if (!select || !currentConfig) return;

  // Xóa options cũ
  select.innerHTML = "";

  // Thêm options từ template
  currentConfig.languages.forEach((lang) => {
    const option = document.createElement("option");
    option.value = lang.id;
    option.textContent = lang.name;
    if (lang.id === currentConfig.defaultLanguage) {
      option.selected = true;
    }
    select.appendChild(option);
  });

  // Ẩn selector nếu chỉ có 1 ngôn ngữ
  const toolbarLeft = select.closest(".toolbar-left");
  if (toolbarLeft) {
    toolbarLeft.style.display =
      currentConfig.languages.length <= 1 ? "none" : "flex";
  }
}

/**
 * Cập nhật UI dựa trên features của template
 */
function updateUIBasedOnFeatures() {
  if (!currentConfig) return;

  const features = currentConfig.features;
  const previewPane = document.querySelector(".preview-pane");
  const editorPane = document.querySelector(".editor-pane");

  // Ẩn/hiện preview pane
  if (previewPane) {
    previewPane.style.display = features.livePreview ? "flex" : "none";
  }

  // Nếu không có preview, editor chiếm toàn bộ
  if (editorPane && !features.livePreview) {
    editorPane.style.flex = "1";
  } else if (editorPane) {
    editorPane.style.flex = "";
  }

  // Cập nhật nút chạy code
  const runBtn = document.getElementById("btn-run-code");
  if (runBtn) {
    runBtn.innerHTML = '<i class="fas fa-play"></i> Chạy Code';
  }
}

/**
 * Force editor layout recalculation
 * Call this when the container becomes visible
 */
function layoutEditor() {
  if (editor) {
    editor.layout();
  }
}

/**
 * Get current editor value
 * @returns {string}
 */
function getEditorValue() {
  return editor?.getValue() || "";
}

/**
 * Set editor value
 * @param {string} value
 */
function setEditorValue(value) {
  if (editor) {
    editor.setValue(value);
  }
}

/**
 * Dispose editor instance
 */
function disposeEditor() {
  if (editor) {
    editor.dispose();
    editor = null;
    isEditorInitialized = false;
  }
}

// ========================================
// TAB SWITCHING
// ========================================

function switchTab(tabName, templateName = null) {
  const tabs = document.querySelectorAll(".tab-btn");
  const contents = document.querySelectorAll(".tab-content");

  // Cập nhật trạng thái tab buttons
  tabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.tab === tabName);
  });

  // Cập nhật hiển thị nội dung
  contents.forEach((content) => {
    const isTarget = content.id === `tab-${tabName}`;
    content.classList.toggle("active", isTarget);
  });

  // Khởi tạo hoặc layout editor khi chuyển sang tab editor
  if (tabName === "editor") {
    if (!isEditorInitialized) {
      initEditor("editor-container", templateName);
    } else {
      // Force layout recalculation sau khi tab hiện ra
      requestAnimationFrame(() => layoutEditor());
    }
  }
}

// ========================================
// EVENT LISTENERS
// ========================================

function initIDEEvents() {
  // Tab switching
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      switchTab(btn.dataset.tab);
    });
  });

  // Run code button
  const runBtn = document.getElementById("btn-run-code");
  if (runBtn) {
    runBtn.addEventListener("click", runCode);
  }

  // Language selector
  const langSelect = document.getElementById("language-select");
  if (langSelect) {
    langSelect.addEventListener("change", (e) => {
      changeLanguage(e.target.value);
    });
  }
}

// ========================================
// INITIALIZATION
// ========================================

// Auto-initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  // Only init if we're on a page with the tab switcher
  if (document.querySelector(".tab-switcher")) {
    initIDEEvents();
  }
});

export {
  initEditor,
  runCode,
  layoutEditor,
  switchTab,
  changeLanguage,
  getEditorValue,
  setEditorValue,
  disposeEditor,
  renderLanguageSelector,
  updateUIBasedOnFeatures,
};
