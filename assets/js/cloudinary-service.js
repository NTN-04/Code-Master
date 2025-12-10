const CLOUD_NAME = "ddw6thwic";
const UPLOAD_PRESET = "codemaster_upload";

export async function uploadToCloudinary(file) {
  if (!file) return null;

  // Kiểm tra loại file
  if (!file.type.startsWith("image/")) {
    alert("Vui lòng chọn file ảnh hợp lệ!");
    return null;
  }

  if (file.size > 5 * 1024 * 1024) {
    alert("File ảnh quá lớn (tối đa 5MB)!");
    return null;
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);
  formData.append("folder", "codemaster_project");

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error("Lỗi upload ảnh lên Cloudinary");
    }

    const data = await response.json();
    return data.secure_url; // Trả về link https
  } catch (error) {
    console.error("Cloudinary Upload Error:", error);
    alert("Không thể upload ảnh. Vui lòng kiểm tra kết nối mạng.");
    return null;
  }
}
