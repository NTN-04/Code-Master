// DOM Elements
document.addEventListener("DOMContentLoaded", function () {
  // Animation on scroll
  initScrollAnimations();
});

// Animation on scroll
function initScrollAnimations() {
  const elementsToAnimate = document.querySelectorAll(
    ".course-card, .path-card, .resource-card"
  );

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("animated");
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.1,
    }
  );

  elementsToAnimate.forEach((element) => {
    observer.observe(element);
  });
}

// Lắng nghe thông điệp từ popup
window.addEventListener("message", function (event) {
  // Chỉ nhận từ cùng origin
  if (event.origin !== window.location.origin) return;
  if (event.data && event.data.type === "login-success") {
    // Đăng nhập thành công, reload hoặc chuyển hướng
    window.location.href = "index.html";
  }
});
