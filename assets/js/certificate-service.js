import { auth, database } from "./firebaseConfig.js";
import {
  ref,
  get,
  set,
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-database.js";
import { showFloatingNotification as showNotification } from "./utils/notifications.js";
import { openModal, closeModal, attachModalDismiss } from "./utils/modal.js";

let confettiInstance = null;

function ensureConfettiInstance() {
  if (confettiInstance) return confettiInstance;
  if (typeof window.confetti !== "function") return null;

  const existingCanvas = document.getElementById("cert-confetti-layer");
  const canvas = existingCanvas || document.createElement("canvas");
  canvas.id = "cert-confetti-layer";
  canvas.style.position = "fixed";
  canvas.style.inset = "0";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "100000"; // higher than modal backdrop
  canvas.style.display = "block";

  if (!existingCanvas) {
    document.body.appendChild(canvas);
  }

  confettiInstance = window.confetti.create(canvas, {
    resize: true,
    useWorker: true,
  });
  return confettiInstance;
}

function formatDateVN(date) {
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getUserDisplayName(user) {
  if (!user) return "Học viên CodeMaster";
  return user.displayName || user.email || "Học viên CodeMaster";
}

function triggerConfetti() {
  try {
    const confetti = ensureConfettiInstance();
    if (!confetti) return;
    const duration = 1800;
    const end = Date.now() + duration;
    (function frame() {
      confetti({
        particleCount: 6,
        startVelocity: 28,
        spread: 90,
        ticks: 120,
        origin: { x: Math.random(), y: Math.random() - 0.2 },
        colors: ["#ffd166", "#06d6a0", "#118ab2", "#ef476f", "#ffc43d"],
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    })();
  } catch (err) {
    console.warn("Confetti error", err);
  }
}

function getDomRefs() {
  return {
    modal: document.getElementById("cert-review-modal"),
    template: document.getElementById("certificate-template"),
    nameInput: document.getElementById("cert-student-input"),
    nameDisplay: document.getElementById("cert-student-display"),
    courseTitleEl: document.getElementById("cert-course-title"),
    issuedDateEl: document.getElementById("cert-issued-date"),
    certIdEl: document.getElementById("cert-id"),
    confirmBtn: document.getElementById("cert-confirm-btn"),
    downloadBtn: document.getElementById("cert-download-btn"),
    noteEl: document.querySelector(".cert-note"),
  };
}

function bindDownloadButton(downloadBtn, templateEl) {
  if (!downloadBtn) return;
  downloadBtn.onclick = async () => {
    if (!templateEl) return;
    if (typeof window.html2pdf === "undefined") {
      showNotification(
        "Không thể tạo PDF. Vui lòng kiểm tra kết nối.",
        "error"
      );
      return;
    }
    const opts = {
      margin: 0,
      filename: "Chung-chi-CodeMaster.pdf",
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 4, useCORS: true, scrollY: 0 },
      jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
    };
    await window.html2pdf().set(opts).from(templateEl).save();
  };
}

function setExistingState({
  nameDisplay,
  nameInput,
  confirmBtn,
  downloadBtn,
  certData,
  issuedDateEl,
  certIdEl,
  courseTitleEl,
  template,
  noteEl,
}) {
  if (nameInput) nameInput.style.display = "none";
  if (nameDisplay) {
    nameDisplay.textContent = certData.studentName || "Học viên CodeMaster";
    nameDisplay.style.display = "inline-block";
  }
  if (confirmBtn) confirmBtn.style.display = "none";
  if (downloadBtn) downloadBtn.style.display = "inline-flex";
  if (noteEl) noteEl.style.display = "none";
  if (issuedDateEl && certData.issuedAt) {
    issuedDateEl.textContent = formatDateVN(new Date(certData.issuedAt));
  }
  if (certIdEl)
    certIdEl.textContent = certData.id || certData.certificateId || "#000000";
  if (courseTitleEl && certData.courseTitle) {
    courseTitleEl.textContent = certData.courseTitle;
  }
  bindDownloadButton(downloadBtn, template);
}

function setNewState({
  nameDisplay,
  nameInput,
  confirmBtn,
  downloadBtn,
  issuedDateEl,
  certIdEl,
  courseTitleEl,
  courseTitle,
  defaultName,
  newCertId,
  today,
  template,
  noteEl,
}) {
  if (nameInput) {
    nameInput.value = defaultName;
    nameInput.style.display = "inline-block";
    setTimeout(() => nameInput.focus({ preventScroll: true }), 30);
  }
  if (nameDisplay) nameDisplay.style.display = "none";
  if (confirmBtn) confirmBtn.style.display = "inline-flex";
  if (downloadBtn) downloadBtn.style.display = "none";
  if (noteEl) noteEl.style.display = "block";
  if (issuedDateEl) issuedDateEl.textContent = formatDateVN(today);
  if (certIdEl) certIdEl.textContent = newCertId;
  if (courseTitleEl) courseTitleEl.textContent = courseTitle;
  bindDownloadButton(downloadBtn, template);
}

async function fetchExistingCertificate(userId, courseId) {
  const certsRef = ref(database, `certificates/${userId}`);
  const snap = await get(certsRef);
  if (!snap.exists()) return null;
  const certs = snap.val() || {};
  const foundEntry = Object.entries(certs).find(([, value]) => {
    return value && value.courseId === courseId;
  });
  if (!foundEntry) return null;
  const [certKey, certVal] = foundEntry;
  return {
    id: certVal.id || certVal.certificateId || certKey,
    courseId: certVal.courseId,
    courseTitle: certVal.courseTitle,
    studentName: certVal.studentName,
    issuedAt: certVal.issuedAt,
  };
}

export async function issueCertificate(courseId, courseTitle) {
  const user = auth.currentUser;
  if (!user) {
    showNotification("Vui lòng đăng nhập để nhận chứng chỉ.", "error");
    return;
  }

  // Kiểm tra tiến độ >= 100
  const progressRef = ref(
    database,
    `userProgress/${user.uid}/courses/${courseId}/progress`
  );
  const progressSnap = await get(progressRef);
  const progressValue = progressSnap.exists() ? progressSnap.val() : 0;
  if (progressValue < 100) {
    showNotification(
      "Bạn cần hoàn thành 100% khóa học trước khi nhận chứng chỉ.",
      "warning"
    );
    return;
  }

  const {
    modal,
    template,
    nameInput,
    nameDisplay,
    courseTitleEl,
    issuedDateEl,
    certIdEl,
    confirmBtn,
    downloadBtn,
    noteEl,
  } = getDomRefs();

  if (!modal || !template) {
    showNotification("Không tìm thấy giao diện chứng chỉ.", "error");
    return;
  }

  attachModalDismiss(modal, {
    closeOnBackdrop: true,
    dismissSelectors: ["[data-modal-close]", ".cert-modal-backdrop"],
  });

  // Lấy chứng chỉ nếu đã tồn tại
  const existingCert = await fetchExistingCertificate(user.uid, courseId);

  // Common: gắn title
  if (courseTitleEl)
    courseTitleEl.textContent = courseTitle || "Khóa học CodeMaster";

  if (existingCert) {
    setExistingState({
      nameDisplay,
      nameInput,
      confirmBtn,
      downloadBtn,
      certData: existingCert,
      issuedDateEl,
      certIdEl,
      courseTitleEl,
      template,
      noteEl,
    });
    openModal(modal);
    triggerConfetti();
    return;
  }

  // Chưa có chứng chỉ: chuẩn bị dữ liệu mới
  const newCertId = `CM-${Date.now()}`;
  const today = new Date();
  const defaultName = getUserDisplayName(user);

  setNewState({
    nameDisplay,
    nameInput,
    confirmBtn,
    downloadBtn,
    issuedDateEl,
    certIdEl,
    courseTitleEl,
    courseTitle: courseTitle || "Khóa học CodeMaster",
    defaultName,
    newCertId,
    today,
    template,
    noteEl,
  });

  openModal(modal);
  triggerConfetti();

  if (confirmBtn) {
    confirmBtn.onclick = async () => {
      const studentName = (nameInput?.value || "").trim();
      if (!studentName) {
        showNotification(
          "Vui lòng nhập tên hiển thị trên chứng chỉ.",
          "warning"
        );
        return;
      }
      const ok = window.confirm(
        "Bạn không thể sửa tên sau khi lưu. Xác nhận lưu?"
      );
      if (!ok) return;

      const issuedAt = new Date();
      const certPayload = {
        id: newCertId,
        certificateId: newCertId,
        courseId,
        courseTitle: courseTitle || "Khóa học CodeMaster",
        studentName,
        issuedAt: issuedAt.toISOString(),
      };

      try {
        await set(
          ref(database, `certificates/${user.uid}/${newCertId}`),
          certPayload
        );
        // Cập nhật giao diện sang trạng thái đã có
        setExistingState({
          nameDisplay,
          nameInput,
          confirmBtn,
          downloadBtn,
          certData: certPayload,
          issuedDateEl,
          certIdEl,
          courseTitleEl,
          template,
          noteEl,
        });
        triggerConfetti();
        showNotification("Đã lưu chứng chỉ thành công!", "success");
      } catch (err) {
        console.error("Lỗi khi lưu chứng chỉ", err);
        showNotification("Không thể lưu chứng chỉ. Vui lòng thử lại.", "error");
      }
    };
  }
}

export function closeCertificateModal() {
  const { modal } = getDomRefs();
  closeModal(modal);
}
