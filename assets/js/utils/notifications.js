// Tiện ích hiển thị thông báo cho toàn bộ dự án

const FEEDBACK_CLASSES = ["success", "error", "warning", "info"];

function resolveElement(target) {
  if (!target) return null;
  if (typeof target === "string") {
    return document.getElementById(target);
  }
  return target;
}

function resetFeedbackClasses(el) {
  FEEDBACK_CLASSES.forEach((cls) => el.classList.remove(cls));
}

// Tạo thông báo nổi (thêm vào body) và tự ẩn sau thời gian quy định
export function showFloatingNotification(
  message,
  type = "success",
  options = {}
) {
  const { autoHideDelay = 4000 } = options;
  const el = document.createElement("div");
  el.className = `notification ${type}`;
  el.textContent = message;
  document.body.appendChild(el);

  requestAnimationFrame(() => {
    el.classList.add("show");
  });

  let hideTimer = null;
  const hide = () => {
    if (!el.classList.contains("show")) return;
    el.classList.remove("show");
    setTimeout(() => {
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
    }, 300);
  };

  if (autoHideDelay > 0) {
    hideTimer = setTimeout(hide, autoHideDelay);
  }

  return {
    element: el,
    hide,
    cancelAutoHide: () => {
      if (hideTimer) clearTimeout(hideTimer);
    },
  };
}

// Tạo bộ điều khiển thông báo sử dụng một container có sẵn (ví dụ #notification trong trang admin)
export function createNotificationManager(options = {}) {
  const {
    containerId = "notification",
    autoHideDelay = 5000,
    fallbackToFloating = true,
  } = options;

  let hideTimer = null;

  const show = (message, type = "success") => {
    const container = resolveElement(containerId);
    if (!container) {
      if (fallbackToFloating) {
        return showFloatingNotification(message, type, { autoHideDelay });
      }
      return null;
    }

    const messageEl =
      container.querySelector(".notification-message") || container;
    resetFeedbackClasses(container);
    container.classList.add(type, "show");
    messageEl.textContent = message;

    if (autoHideDelay > 0) {
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = setTimeout(() => hide(), autoHideDelay);
    }

    return container;
  };

  const hide = () => {
    const container = resolveElement(containerId);
    if (!container) return;
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
    container.classList.remove("show");
  };

  return { show, hide };
}
