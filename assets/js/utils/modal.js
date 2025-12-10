// Tiện ích điều khiển modal dùng chung

let openModalCount = 0;

function resolveModal(target) {
  if (!target) return null;
  if (typeof target === "string") {
    return document.getElementById(target);
  }
  return target;
}

function lockBodyScroll() {
  openModalCount += 1;
  if (openModalCount === 1) {
    document.body.dataset.prevOverflow = document.body.style.overflow || "";
    document.body.style.overflow = "hidden";
  }
}

function unlockBodyScroll() {
  openModalCount = Math.max(0, openModalCount - 1);
  if (openModalCount === 0) {
    const prev = document.body.dataset.prevOverflow;
    if (prev !== undefined) {
      document.body.style.overflow = prev;
      delete document.body.dataset.prevOverflow;
    } else {
      document.body.style.overflow = "";
    }
  }
}

export function openModal(target, options = {}) {
  const modal = resolveModal(target);
  if (!modal) return null;

  const {
    activeClass = modal.dataset.modalActiveClass || "show",
    display = modal.dataset.modalDisplay,
    lockScroll = options.lockScroll !== false,
  } = options;

  modal.dataset.modalActiveClass = activeClass;
  modal.dataset.modalLockScroll = lockScroll ? "true" : "false";
  if (display !== undefined) {
    modal.dataset.modalPrevDisplay = modal.style.display || "";
    modal.style.display = display;
  }

  modal.classList.add(activeClass);
  if (lockScroll) lockBodyScroll();
  modal.dispatchEvent(new CustomEvent("modal:opened"));
  return modal;
}

export function closeModal(target, options = {}) {
  const modal = resolveModal(target);
  if (!modal) return null;

  const activeClass =
    options.activeClass || modal.dataset.modalActiveClass || "show";
  modal.classList.remove(activeClass);

  if (modal.dataset.modalPrevDisplay !== undefined) {
    modal.style.display = modal.dataset.modalPrevDisplay;
    delete modal.dataset.modalPrevDisplay;
  }

  const shouldUnlock =
    options.lockScroll !== false && modal.dataset.modalLockScroll !== "false";
  if (shouldUnlock) {
    unlockBodyScroll();
  }

  delete modal.dataset.modalLockScroll;
  modal.dispatchEvent(new CustomEvent("modal:closed"));
  return modal;
}

export function attachModalDismiss(target, options = {}) {
  const modal = resolveModal(target);
  if (!modal || modal.dataset.modalDismissAttached) return;

  const {
    dismissSelectors = ["[data-modal-close]", ".close-modal", ".cancel-btn"],
    closeOnBackdrop = true,
  } = options;

  if (closeOnBackdrop) {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        closeModal(modal, options);
      }
    });
  }

  dismissSelectors.forEach((selector) => {
    modal.querySelectorAll(selector).forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        closeModal(modal, options);
      });
    });
  });

  modal.dataset.modalDismissAttached = "true";
}
