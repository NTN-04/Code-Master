import { database } from "../firebaseConfig.js";
import {
  ref,
  get,
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-database.js";

export async function getUserEnrollments(userId) {
  if (!userId) {
    return new Set();
  }

  try {
    const enrollmentsRef = ref(database, `enrollments/${userId}`);
    const snapshot = await get(enrollmentsRef);

    if (!snapshot.exists()) {
      return new Set();
    }

    const enrollments = snapshot.val() || {};
    return new Set(Object.keys(enrollments));
  } catch (error) {
    console.error("Không thể tải trạng thái ghi danh:", error);
    return new Set();
  }
}
