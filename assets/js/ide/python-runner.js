/**
 * Python Runner Module - Chạy Python trong browser với Pyodide
 * Sử dụng WebAssembly để thực thi Python code client-side
 *
 * @module python-runner
 * @requires Pyodide (loaded via CDN)
 */

import { showFloatingNotification } from "../utils/notifications.js";

// ========================================
// HẰNG SỐ VÀ CẤU HÌNH
// ========================================

/** URL CDN của Pyodide */
const PYODIDE_CDN = "https://cdn.jsdelivr.net/pyodide/v0.24.1/full/";

/** Timeout cho việc chạy code (ms) */
const EXECUTION_TIMEOUT = 30000;

/** Các package Python phổ biến có thể load thêm */
const AVAILABLE_PACKAGES = ["numpy", "pandas", "matplotlib", "sympy"];

// ========================================
// TRẠNG THÁI MODULE
// ========================================

/** Instance Pyodide đã khởi tạo */
let pyodideInstance = null;

/** Trạng thái loading */
let isLoading = false;

/** Trạng thái sẵn sàng */
let isReady = false;

/** Callbacks khi Pyodide sẵn sàng */
const readyCallbacks = [];

// ========================================
// KHỞI TẠO PYODIDE
// ========================================

/**
 * Cập nhật trạng thái hiển thị trên UI
 * @param {string} status - 'loading' | 'ready' | 'hidden'
 */
function updateStatusUI(status) {
  const statusEl = document.getElementById("pyodide-status");
  if (!statusEl) return;

  switch (status) {
    case "loading":
      statusEl.style.display = "flex";
      statusEl.className = "pyodide-status loading";
      statusEl.querySelector(".status-text").textContent = "Đang tải Python...";
      break;
    case "ready":
      statusEl.style.display = "flex";
      statusEl.className = "pyodide-status ready";
      statusEl.querySelector(".status-text").textContent = "Python sẵn sàng";
      // Ẩn sau 3 giây
      setTimeout(() => {
        statusEl.style.display = "none";
      }, 3000);
      break;
    case "hidden":
    default:
      statusEl.style.display = "none";
      break;
  }
}

/**
 * Tải và khởi tạo Pyodide runtime
 * Sử dụng lazy loading - chỉ load khi cần
 *
 * @returns {Promise<object>} Pyodide instance
 */
async function initPyodide() {
  // Đã sẵn sàng
  if (isReady && pyodideInstance) {
    return pyodideInstance;
  }

  // Đang loading, chờ hoàn thành
  if (isLoading) {
    return new Promise((resolve) => {
      readyCallbacks.push(resolve);
    });
  }

  isLoading = true;
  updateStatusUI("loading");
  console.log("[Python Runner] Đang khởi tạo Pyodide...");

  try {
    // Load Pyodide script nếu chưa có
    if (!window.loadPyodide) {
      await loadPyodideScript();
    }

    // Khởi tạo Pyodide runtime
    pyodideInstance = await window.loadPyodide({
      indexURL: PYODIDE_CDN,
      stdout: (text) => appendToOutput(text, "stdout"),
      stderr: (text) => appendToOutput(text, "stderr"),
    });

    // Setup môi trường Python
    await setupPythonEnvironment();

    isReady = true;
    isLoading = false;
    updateStatusUI("ready");
    console.log("[Python Runner] Pyodide đã sẵn sàng!");

    // Gọi các callbacks đang chờ
    readyCallbacks.forEach((cb) => cb(pyodideInstance));
    readyCallbacks.length = 0;

    return pyodideInstance;
  } catch (error) {
    isLoading = false;
    updateStatusUI("hidden");
    console.error("[Python Runner] Lỗi khởi tạo Pyodide:", error);
    throw error;
  }
}

/**
 * Load Pyodide script từ CDN
 * @returns {Promise<void>}
 */
function loadPyodideScript() {
  return new Promise((resolve, reject) => {
    // Kiểm tra đã load chưa
    if (window.loadPyodide) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = `${PYODIDE_CDN}pyodide.js`;
    script.async = true;

    script.onload = () => {
      console.log("[Python Runner] Đã load Pyodide script");
      resolve();
    };

    script.onerror = () => {
      reject(new Error("Không thể tải Pyodide từ CDN"));
    };

    document.head.appendChild(script);
  });
}

/**
 * Thiết lập môi trường Python cơ bản
 */
async function setupPythonEnvironment() {
  if (!pyodideInstance) return;

  // Redirect stdout/stderr để capture output
  await pyodideInstance.runPythonAsync(`
import sys
from io import StringIO

# Custom stdout/stderr để capture output
class OutputCapture:
    def __init__(self, stream_type):
        self.stream_type = stream_type
        self.buffer = StringIO()
    
    def write(self, text):
        if text.strip():  # Bỏ qua dòng trống
            self.buffer.write(text)
            # Gọi JS callback
            import js
            js.window._pyodideOutputCallback(text, self.stream_type)
    
    def flush(self):
        pass

# Không ghi đè sys.stdout/stderr ở đây vì Pyodide đã handle
  `);
}

// ========================================
// CHẠY CODE PYTHON
// ========================================

/**
 * Chạy code Python và trả về kết quả
 *
 * @param {string} code - Code Python cần chạy
 * @param {object} options - Tùy chọn
 * @param {number} options.timeout - Timeout (ms)
 * @param {function} options.onOutput - Callback khi có output
 * @returns {Promise<RunResult>} Kết quả chạy code
 *
 * @typedef {object} RunResult
 * @property {boolean} success - Chạy thành công hay không
 * @property {string} output - Output từ stdout
 * @property {string} error - Error message (nếu có)
 * @property {number} executionTime - Thời gian chạy (ms)
 */
async function runPython(code, options = {}) {
  const { timeout = EXECUTION_TIMEOUT, onOutput = null } = options;

  // Đảm bảo Pyodide đã sẵn sàng
  if (!isReady) {
    await initPyodide();
  }

  // Reset output buffer
  outputBuffer = { stdout: [], stderr: [] };

  // Setup callback cho output
  if (onOutput) {
    window._pyodideOutputCallback = (text, type) => {
      onOutput(text, type);
    };
  }

  const startTime = performance.now();

  try {
    // Chạy code với timeout
    const result = await Promise.race([
      executePythonCode(code),
      createTimeout(timeout),
    ]);

    const executionTime = Math.round(performance.now() - startTime);

    return {
      success: true,
      output: outputBuffer.stdout.join(""),
      error: outputBuffer.stderr.join(""),
      executionTime,
      result,
    };
  } catch (error) {
    const executionTime = Math.round(performance.now() - startTime);

    return {
      success: false,
      output: outputBuffer.stdout.join(""),
      error: formatPythonError(error),
      executionTime,
    };
  }
}

/**
 * Thực thi code Python
 * @param {string} code - Code cần chạy
 * @returns {Promise<any>} Kết quả trả về (nếu có)
 */
async function executePythonCode(code) {
  if (!pyodideInstance) {
    throw new Error("Pyodide chưa được khởi tạo");
  }

  // Chạy code và capture output
  const result = await pyodideInstance.runPythonAsync(code);

  // Nếu có giá trị trả về, thêm vào output
  if (result !== undefined && result !== null) {
    const resultStr = String(result);
    if (resultStr && resultStr !== "undefined") {
      appendToOutput(resultStr, "stdout");
    }
  }

  return result;
}

/**
 * Tạo promise timeout
 * @param {number} ms - Thời gian timeout
 */
function createTimeout(ms) {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Timeout: Code chạy quá ${ms / 1000} giây`));
    }, ms);
  });
}

// ========================================
// XỬ LÝ OUTPUT
// ========================================

/** Buffer lưu output */
let outputBuffer = { stdout: [], stderr: [] };

/**
 * Thêm text vào output buffer
 * @param {string} text - Text cần thêm
 * @param {string} type - Loại output (stdout/stderr)
 */
function appendToOutput(text, type = "stdout") {
  if (!text) return;

  if (type === "stderr") {
    outputBuffer.stderr.push(text);
  } else {
    outputBuffer.stdout.push(text);
  }
}

/**
 * Format lỗi Python để hiển thị đẹp hơn
 * @param {Error} error - Lỗi cần format
 * @returns {string} Lỗi đã format
 */
function formatPythonError(error) {
  if (!error) return "";

  let message = error.message || String(error);

  // Loại bỏ các dòng traceback không cần thiết từ Pyodide
  const lines = message.split("\n");
  const filteredLines = lines.filter((line) => {
    return (
      !line.includes("pyodide") &&
      !line.includes("wasm") &&
      !line.includes("<exec>")
    );
  });

  // Nếu filter quá nhiều, giữ nguyên message gốc
  if (filteredLines.length < 2) {
    return message;
  }

  return filteredLines.join("\n");
}

// ========================================
// RENDER KẾT QUẢ
// ========================================

/**
 * Tạo HTML hiển thị kết quả chạy Python
 *
 * @param {RunResult} result - Kết quả từ runPython
 * @returns {string} HTML content
 */
function buildPythonResultHTML(result) {
  const { success, output, error, executionTime } = result;

  // CSS cho console
  const styles = `
    <style>
      body {
        margin: 0;
        font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
        background: #1e1e1e;
        color: #d4d4d4;
        padding: 16px;
        min-height: 100vh;
        box-sizing: border-box;
      }
      .console-container {
        max-width: 100%;
      }
      .console-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        background: #2d2d30;
        border-radius: 6px 6px 0 0;
        border-bottom: 1px solid #3c3c3c;
        font-size: 13px;
      }
      .console-title {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #569cd6;
        font-weight: 600;
      }
      .console-title .icon {
        font-size: 16px;
      }
      .console-meta {
        color: #808080;
        font-size: 12px;
      }
      .console-body {
        background: #1e1e1e;
        padding: 16px;
        border-radius: 0 0 6px 6px;
        overflow-x: auto;
      }
      .output-line {
        white-space: pre-wrap;
        word-break: break-word;
        line-height: 1.6;
        margin: 2px 0;
      }
      .output-stdout {
        color: #d4d4d4;
      }
      .output-stderr {
        color: #f48771;
      }
      .error-container {
        background: rgba(244, 135, 113, 0.1);
        border: 1px solid rgba(244, 135, 113, 0.3);
        border-radius: 6px;
        padding: 12px;
        margin-top: 8px;
      }
      .error-title {
        color: #f48771;
        font-weight: 600;
        margin-bottom: 8px;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .error-message {
        color: #f48771;
        white-space: pre-wrap;
        font-size: 13px;
      }
      .success-indicator {
        color: #4ec9b0;
      }
      .empty-output {
        color: #808080;
        font-style: italic;
      }
    </style>
  `;

  // Status indicator
  const statusIcon = success ? "✅" : "❌";
  const statusClass = success ? "success-indicator" : "output-stderr";

  // Format output
  let outputHTML = "";

  if (output && output.trim()) {
    // Tách output thành các dòng và format
    const lines = output.split("\n");
    outputHTML = lines
      .map(
        (line) =>
          `<div class="output-line output-stdout">${escapeHTML(line)}</div>`
      )
      .join("");
  } else if (success && !error) {
    outputHTML =
      '<div class="output-line empty-output">✨ Code chạy thành công (không có output)</div>';
  }

  // Error section
  let errorHTML = "";
  if (error && error.trim()) {
    errorHTML = `
      <div class="error-container">
        <div class="error-title">
          <span>⚠️</span>
          <span>Lỗi</span>
        </div>
        <div class="error-message">${escapeHTML(error)}</div>
      </div>
    `;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      ${styles}
    </head>
    <body>
      <div class="console-container">
        <div class="console-header">
          <div class="console-title">
            <span class="icon">🐍</span>
            <span>Python Console</span>
          </div>
          <div class="console-meta">
            <span class="${statusClass}">${statusIcon}</span>
            Thời gian: ${executionTime}ms
          </div>
        </div>
        <div class="console-body">
          ${outputHTML}
          ${errorHTML}
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Escape HTML để tránh XSS
 * @param {string} str - String cần escape
 * @returns {string} String đã escape
 */
function escapeHTML(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ========================================
// LOADING UI
// ========================================

/**
 * Tạo HTML cho trạng thái loading
 * @returns {string} HTML content
 */
function buildLoadingHTML() {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          margin: 0;
          font-family: Arial, sans-serif;
          background: #1e1e1e;
          color: #d4d4d4;
          min-height: 100vh;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .loading-container {
          text-align: center;
          padding: 40px;
        }
        .spinner {
          width: 50px;
          height: 50px;
          border: 3px solid #3c3c3c;
          border-top-color: #569cd6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 20px;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .loading-text {
          font-size: 14px;
          color: #808080;
        }
        .loading-hint {
          font-size: 12px;
          color: #666;
          margin-top: 10px;
        }
      </style>
    </head>
    <body>
      <div class="loading-container">
        <div class="spinner"></div>
        <div class="loading-text">🐍 Đang khởi tạo Python...</div>
        <div class="loading-hint">Lần đầu có thể mất vài giây</div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Tạo HTML cho trạng thái đang chạy code
 * @returns {string} HTML content
 */
function buildRunningHTML() {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          margin: 0;
          font-family: Arial, sans-serif;
          background: #1e1e1e;
          color: #d4d4d4;
          min-height: 100vh;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .running-container {
          text-align: center;
          padding: 40px;
        }
        .pulse {
          width: 20px;
          height: 20px;
          background: #4ec9b0;
          border-radius: 50%;
          animation: pulse 1.5s ease-in-out infinite;
          margin: 0 auto 20px;
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.3); opacity: 0.7; }
        }
        .running-text {
          font-size: 14px;
          color: #4ec9b0;
        }
      </style>
    </head>
    <body>
      <div class="running-container">
        <div class="pulse"></div>
        <div class="running-text">⚡ Đang chạy code...</div>
      </div>
    </body>
    </html>
  `;
}

// ========================================
// PACKAGE MANAGEMENT
// ========================================

/**
 * Cài đặt package Python bổ sung
 *
 * @param {string|string[]} packages - Tên package(s) cần cài
 * @returns {Promise<boolean>} Thành công hay không
 */
async function installPackages(packages) {
  if (!isReady || !pyodideInstance) {
    await initPyodide();
  }

  const packageList = Array.isArray(packages) ? packages : [packages];

  try {
    console.log(`[Python Runner] Đang cài đặt: ${packageList.join(", ")}`);

    await pyodideInstance.loadPackagesFromImports(packageList.join("\n"));

    console.log("[Python Runner] Cài đặt package thành công!");
    return true;
  } catch (error) {
    console.error("[Python Runner] Lỗi cài đặt package:", error);
    return false;
  }
}

// ========================================
// TRẠNG THÁI VÀ UTILITIES
// ========================================

/**
 * Kiểm tra Pyodide đã sẵn sàng chưa
 * @returns {boolean}
 */
function isPyodideReady() {
  return isReady && pyodideInstance !== null;
}

/**
 * Kiểm tra đang loading không
 * @returns {boolean}
 */
function isPyodideLoading() {
  return isLoading;
}

/**
 * Reset Pyodide về trạng thái ban đầu
 * Hữu ích khi muốn clear state giữa các lần chạy
 */
async function resetPyodide() {
  if (!pyodideInstance) return;

  try {
    // Reset namespace
    await pyodideInstance.runPythonAsync(`
# Clear user-defined variables
for name in list(globals().keys()):
    if not name.startswith('_'):
        del globals()[name]
    `);
  } catch (error) {
    console.warn("[Python Runner] Lỗi reset:", error);
  }
}

/**
 * Preload Pyodide trong background
 * Gọi hàm này sớm để giảm thời gian chờ khi user chạy code
 */
function preloadPyodide() {
  if (!isReady && !isLoading) {
    initPyodide().catch((err) => {
      console.warn("[Python Runner] Preload failed:", err);
    });
  }
}

// ========================================
// EXPORTS
// ========================================

export {
  initPyodide,
  runPython,
  buildPythonResultHTML,
  buildLoadingHTML,
  buildRunningHTML,
  installPackages,
  isPyodideReady,
  isPyodideLoading,
  resetPyodide,
  preloadPyodide,
  AVAILABLE_PACKAGES,
};
