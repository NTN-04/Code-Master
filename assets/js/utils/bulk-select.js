/**
 * Bulk Selection Utility
 * Hỗ trợ chọn nhiều items trong bảng để thực hiện hành động hàng loạt
 */

/**
 * Initialize bulk selection for a table
 * @param {string} tableId - ID của table
 * @param {Function} onSelectionChange - Callback khi selection thay đổi
 */
export function initBulkSelect(tableId, onSelectionChange) {
  const table = document.getElementById(tableId);
  if (!table) return;

  // Get select all checkbox
  const selectAllCheckbox = table.querySelector(".select-all");
  if (!selectAllCheckbox) return;

  // Handle select all
  selectAllCheckbox.addEventListener("change", (e) => {
    const checkboxes = table.querySelectorAll(".select-row");
    checkboxes.forEach((cb) => {
      cb.checked = e.target.checked;
    });

    if (onSelectionChange) {
      onSelectionChange(getSelectedIds(tableId));
    }
  });

  // Handle individual checkboxes (delegated)
  table.addEventListener("change", (e) => {
    if (e.target.classList.contains("select-row")) {
      updateSelectAllState(tableId);

      if (onSelectionChange) {
        onSelectionChange(getSelectedIds(tableId));
      }
    }
  });
}

/**
 * Get all selected IDs from a table
 * @param {string} tableId - ID của table
 * @returns {string[]} Array of selected IDs
 */
export function getSelectedIds(tableId) {
  const table = document.getElementById(tableId);
  if (!table) return [];

  const checkedBoxes = table.querySelectorAll(".select-row:checked");
  return Array.from(checkedBoxes).map((cb) => cb.dataset.id);
}

/**
 * Clear all selections in a table
 * @param {string} tableId - ID của table
 */
export function clearSelection(tableId) {
  const table = document.getElementById(tableId);
  if (!table) return;

  const selectAllCheckbox = table.querySelector(".select-all");
  if (selectAllCheckbox) {
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = false;
  }

  const checkboxes = table.querySelectorAll(".select-row");
  checkboxes.forEach((cb) => {
    cb.checked = false;
  });
}

/**
 * Update select all checkbox state based on individual selections
 * @param {string} tableId - ID của table
 */
function updateSelectAllState(tableId) {
  const table = document.getElementById(tableId);
  if (!table) return;

  const selectAllCheckbox = table.querySelector(".select-all");
  if (!selectAllCheckbox) return;

  const allCheckboxes = table.querySelectorAll(".select-row");
  const checkedCheckboxes = table.querySelectorAll(".select-row:checked");

  if (checkedCheckboxes.length === 0) {
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = false;
  } else if (checkedCheckboxes.length === allCheckboxes.length) {
    selectAllCheckbox.checked = true;
    selectAllCheckbox.indeterminate = false;
  } else {
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = true;
  }
}

/**
 * Show/hide bulk actions bar based on selection count
 * @param {string} barId - ID của bulk actions bar
 * @param {number} count - Số lượng items đã chọn
 */
export function toggleBulkActionsBar(barId, count) {
  const bar = document.getElementById(barId);
  if (!bar) return;

  if (count > 0) {
    bar.style.display = "flex";
    const countSpan = bar.querySelector(".selected-count");
    if (countSpan) {
      countSpan.textContent = `${count} đã chọn`;
    }
  } else {
    bar.style.display = "none";
  }
}

/**
 * Batch delete items với confirm dialog
 * @param {string[]} ids - Array of IDs to delete
 * @param {Function} deleteFunction - Function to delete single item
 * @param {string} itemName - Tên item để hiển thị (vd: "người dùng")
 * @returns {Promise<{success: number, failed: number}>}
 */
export async function batchDelete(ids, deleteFunction, itemName = "mục") {
  const result = { success: 0, failed: 0 };

  if (ids.length === 0) return result;

  // Limit batch size to prevent timeout
  const MAX_BATCH_SIZE = 50;
  if (ids.length > MAX_BATCH_SIZE) {
    throw new Error(
      `Chỉ có thể xóa tối đa ${MAX_BATCH_SIZE} ${itemName} mỗi lần`,
    );
  }

  // Process deletions
  const promises = ids.map(async (id) => {
    try {
      await deleteFunction(id);
      result.success++;
    } catch (error) {
      console.error(`Error deleting ${itemName} ${id}:`, error);
      result.failed++;
    }
  });

  await Promise.all(promises);
  return result;
}

/**
 * Batch update status
 * @param {string[]} ids - Array of IDs to update
 * @param {string} newStatus - New status value
 * @param {Function} updateFunction - Function to update single item
 * @returns {Promise<{success: number, failed: number}>}
 */
export async function batchUpdateStatus(ids, newStatus, updateFunction) {
  const result = { success: 0, failed: 0 };

  if (ids.length === 0) return result;

  const promises = ids.map(async (id) => {
    try {
      await updateFunction(id, newStatus);
      result.success++;
    } catch (error) {
      console.error(`Error updating status for ${id}:`, error);
      result.failed++;
    }
  });

  await Promise.all(promises);
  return result;
}
