import cloudinary from "../config/cloudinary.js";
import fs from "fs";

export async function uploadToCloudinary(file,folder) {
  try {
    // Upload file
    const result = await cloudinary.uploader.upload(file.path, {
      folder: folder || "categories", // optional folder in your Cloudinary
    });

    // Delete local file
    fs.unlinkSync(file.path);

    // Return direct URL
    return result; // e.g., https://res.cloudinary.com/...
  } catch (err) {
    console.error("Cloudinary upload error:", err);
    throw err;
  }
}
export async function deleteFromCloudinary(publicId) {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    if (result.result !== "ok" && result.result !== "not found") {
      console.warn(`Cloudinary deletion warning: ${JSON.stringify(result)}`);
    }
    return result;
  } catch (err) {
    console.error("Cloudinary deletion failed:", err);
    throw new Error("Failed to rollback Cloudinary image");
  }
}