// routes/imageRoutes.js
const express = require("express");
const router = express.Router();
const upload = require("../middlewares/upload");
const imageController = require("../controllers/imageController");

// Görsel listeleme (sayfalı) endpoint'i
router.get("/", imageController.getImages);
// Tek bir görsel yüklemek için "image" alanı üzerinden dosya alıyoruz.

router.post(
  "/multiple",
  upload.array("image", 50),
  imageController.uploadImages
);

router.delete("/:id", imageController.deleteImage);
module.exports = router;
