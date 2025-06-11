// Admin Guard - Middleware để bảo vệ trang admin
import { auth, database } from "./firebaseConfig.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-auth.js";
import {
  ref,
  get,
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-database.js";

class AdminGuard {
  constructor() {
    this.init();
  }

  async init() {
    // Kiểm tra xem có đang ở trang admin không
    if (!this.isAdminPage()) {
      return;
    }

    // Hiển thị loading screen
    this.showLoadingScreen();

    // Kiểm tra authentication và authorization
    await this.checkAccess();
  }

  isAdminPage() {
    return window.location.pathname.includes("admin.html");
  }

  showLoadingScreen() {
    // Tạo loading screen
    const loadingHTML = `
      <div id="admin-loading" style="
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        color: white;
      ">
        <div style="text-align: center;">
          <div style="
            width: 50px;
            height: 50px;
            border: 3px solid rgba(255,255,255,0.3);
            border-radius: 50%;
            border-top-color: white;
            animation: spin 1s ease-in-out infinite;
            margin-bottom: 20px;
          "></div>
          <h2 style="margin: 0; font-size: 1.5rem;">Đang kiểm tra quyền truy cập...</h2>
          <p style="margin: 10px 0 0 0; opacity: 0.8;">Vui lòng đợi trong giây lát</p>
        </div>
        <style>
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        </style>
      </div>
    `;

    document.body.insertAdjacentHTML("afterbegin", loadingHTML);
  }

  hideLoadingScreen() {
    const loadingElement = document.getElementById("admin-loading");
    if (loadingElement) {
      loadingElement.remove();
    }
  }

  showAccessDenied(message = "Bạn không có quyền truy cập trang này!") {
    this.hideLoadingScreen();

    const deniedHTML = `
      <div id="access-denied" style="
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        color: white;
        text-align: center;
        padding: 2rem;
      ">
        <div style="max-width: 500px;">
          <i class="fas fa-exclamation-triangle" style="font-size: 4rem; margin-bottom: 1rem; opacity: 0.9;"></i>
          <h1 style="margin: 0 0 1rem 0; font-size: 2rem;">Truy cập bị từ chối</h1>
          <p style="margin: 0 0 2rem 0; font-size: 1.1rem; opacity: 0.9;">${message}</p>
          <div style="display: flex; gap: 1rem; justify-content: center;">
            <a href="index.html" style="
              background: rgba(255,255,255,0.2);
              color: white;
              padding: 12px 24px;
              border-radius: 6px;
              text-decoration: none;
              border: 1px solid rgba(255,255,255,0.3);
              transition: all 0.3s ease;
            " onmouseover="this.style.background='rgba(255,255,255,0.3)'" 
               onmouseout="this.style.background='rgba(255,255,255,0.2)'">
              <i class="fas fa-home"></i> Về trang chủ
            </a>
            <a href="login.html" style="
              background: rgba(255,255,255,0.9);
              color: #ee5a52;
              padding: 12px 24px;
              border-radius: 6px;
              text-decoration: none;
              border: 1px solid rgba(255,255,255,0.3);
              transition: all 0.3s ease;
            " onmouseover="this.style.background='white'" 
               onmouseout="this.style.background='rgba(255,255,255,0.9)'">
              <i class="fas fa-sign-in-alt"></i> Đăng nhập
            </a>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML("afterbegin", deniedHTML);

    // Tự động trở về trang index sau 10s
    setTimeout(() => {
      window.location.href = "index.html";
    }, 10000);
  }

  async checkAccess() {
    return new Promise((resolve) => {
      onAuthStateChanged(auth, async (user) => {
        if (!user) {
          // Không đăng nhập
          this.showAccessDenied(
            "Bạn cần đăng nhập để truy cập trang quản trị."
          );
          resolve(false);
          return;
        }

        try {
          // Kiểm tra role admin
          const isAdmin = await this.checkAdminRole(user.uid);

          if (!isAdmin) {
            this.showAccessDenied(
              "Chỉ có quản trị viên mới có thể truy cập trang này."
            );
            resolve(false);
            return;
          }

          // Kiểm tra trạng thái tài khoản
          const isActive = await this.checkAccountStatus(user.uid);

          if (!isActive) {
            this.showAccessDenied("Tài khoản của bạn đã bị tạm ngừng.");
            resolve(false);
            return;
          }

          // Cho phép truy cập
          this.hideLoadingScreen();
          resolve(true);
        } catch (error) {
          console.error("Error checking admin access:", error);
          this.showAccessDenied("Có lỗi xảy ra khi kiểm tra quyền truy cập.");
          resolve(false);
        }
      });
    });
  }

  async checkAdminRole(userId) {
    try {
      const userRef = ref(database, `users/${userId}`);
      const snapshot = await get(userRef);

      if (snapshot.exists()) {
        const userData = snapshot.val();
        return userData.role === 1; // 1 = admin
      }

      return false;
    } catch (error) {
      console.error("Error checking admin role:", error);
      return false;
    }
  }

  async checkAccountStatus(userId) {
    try {
      const userRef = ref(database, `users/${userId}`);
      const snapshot = await get(userRef);

      if (snapshot.exists()) {
        const userData = snapshot.val();
        return (userData.status || "active") === "active";
      }

      return true; // Default to active if no status field
    } catch (error) {
      console.error("Error checking account status:", error);
      return true;
    }
  }
}

// Initialize admin guard
document.addEventListener("DOMContentLoaded", () => {
  new AdminGuard();
});

export default AdminGuard;
