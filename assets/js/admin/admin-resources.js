import { database } from "../firebaseConfig.js";
import {
  ref,
  get,
  set,
  update,
  remove,
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-database.js";

export default class ResourcesManager {
  constructor(adminPanel) {
    this.adminPanel = adminPanel;
    this.resources = [];
  }

  async loadData() {
    try {
      // Thử tải từ Firebase trước
      const resourcesRef = ref(database, "resources");
      const snapshot = await get(resourcesRef);

      if (snapshot.exists()) {
        // Lấy từ Firebase
        this.resources = Object.entries(snapshot.val()).map(([id, data]) => ({
          id,
          ...data,
        }));
      } else {
        // Nếu không có thì import từ file JSON vào Firebase
        await this.importResourcesToFirebase();
      }

      this.renderResourcesTable();
    } catch (error) {
      console.error("Error loading resources:", error);
      this.adminPanel.showNotification("Lỗi tải dữ liệu tài liệu", "error");
    }
  }

  async importResourcesToFirebase() {
    try {
      const response = await fetch("./data/db_resources.json");
      const data = await response.json();
      const resources = data.resources || [];

      // Import tài liệu vào Firebase
      const resourcesRef = ref(database, "resources");
      const resourcesData = {};

      resources.forEach((resource) => {
        resourcesData[resource.id] = {
          title: resource.title,
          type: resource.type,
          level: resource.level,
          url: resource.url,
          description: resource.description || "",
          createdAt: new Date().toISOString().slice(0, 10),
          updatedAt: new Date().toISOString().slice(0, 10),
          status: "active",
        };
      });

      await set(resourcesRef, resourcesData);
      this.resources = resources;

      this.adminPanel.showNotification(
        "Đã import tài liệu vào Firebase",
        "success"
      );
    } catch (error) {
      console.error("Error importing resources:", error);
      this.adminPanel.showNotification("Lỗi import tài liệu", "error");
    }
  }

  renderResourcesTable() {
    const tbody = document.getElementById("resources-table-body");
    if (!tbody) return;

    tbody.innerHTML = "";

    this.resources.forEach((resource) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${resource.title}</td>
        <td>${resource.type}</td>
        <td>${this.getLevelText(resource.level)}</td>
        <td>${resource.createdAt || "N/A"}</td>
        <td>
          <span class="status-badge status-active">Hoạt động</span>
        </td>
        <td>
          <div class="action-buttons">
            <button class="btn-action btn-edit" onclick="adminPanel.resources.editResource('${
              resource.id
            }')" title="Chỉnh sửa">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn-action btn-delete" onclick="adminPanel.resources.deleteResource('${
              resource.id
            }')" title="Xóa">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  getLevelText(level) {
    const levels = {
      beginner: "Người mới",
      intermediate: "Trung cấp",
      advanced: "Nâng cao",
    };
    return levels[level] || level;
  }

  async editResource(resourceId) {
    const resource = this.resources.find((r) => r.id === resourceId);
    if (!resource) return;

    // Hiện prompt để sửa tiêu đề (tạm thời)
    const newTitle = prompt("Nhập tiêu đề mới:", resource.title);
    if (newTitle && newTitle !== resource.title) {
      try {
        const resourceRef = ref(database, `resources/${resourceId}`);
        await update(resourceRef, {
          title: newTitle,
          updatedAt: new Date().toISOString().slice(0, 10),
        });

        // Ghi log hoạt động
        await this.adminPanel.logActivity(
          "resource",
          "Cập nhật tài liệu",
          `Đã cập nhật tài liệu "${newTitle}"`,
          "fas fa-edit"
        );

        this.adminPanel.showNotification("Đã cập nhật tài liệu", "success");
        this.loadData();
      } catch (error) {
        console.error("Error updating resource:", error);
        this.adminPanel.showNotification("Lỗi cập nhật tài liệu", "error");
      }
    }
  }

  async deleteResource(resourceId) {
    if (!confirm("Bạn có chắc chắn muốn xóa tài liệu này?")) return;

    const resource = this.resources.find((r) => r.id === resourceId);

    try {
      const resourceRef = ref(database, `resources/${resourceId}`);
      await remove(resourceRef);

      // Ghi log hoạt động
      await this.adminPanel.logActivity(
        "resource",
        "Xóa tài liệu",
        `Đã xóa tài liệu "${resource?.title || resourceId}"`,
        "fas fa-trash"
      );

      this.adminPanel.showNotification("Đã xóa tài liệu", "success");
      this.loadData();
    } catch (error) {
      console.error("Error deleting resource:", error);
      this.adminPanel.showNotification("Lỗi xóa tài liệu", "error");
    }
  }

  showAddModal() {
    this.adminPanel.showNotification(
      "Chức năng thêm tài liệu đang được phát triển",
      "warning"
    );
  }

  setupEventListeners() {
    // Nút thêm tài liệu
    const addResourceBtn = document.getElementById("add-resource-btn");
    if (addResourceBtn) {
      addResourceBtn.addEventListener("click", this.showAddModal.bind(this));
    }
  }
}
