const express = require("express");
const router = express.Router();
const {
  getAllUserFromDatabase,
  deleteAllUsersFromDatabase,
  updateUserFromDatabase,
  getUserByUserNameFromDatabase,
  getUserByID,
  deleteUserByID,
  updateUserRole,
  getAuthorsAndAdmins,
} = require("../controllers/userController.js");
const {
  getAccessToRoute,
  isAdmin,
  isOwnerOrAdminForUser,
} = require("../middlewares/authMiddleware.js"); // kullanıcı kontrolü burada yapılıyor

// Authors and Admins endpoint - public access
router.get("/team", getAuthorsAndAdmins);

// Ortak yol prefix'i kullanılarak rotalar birleştirildi
router.use(getAccessToRoute); // Tüm rotalarda erişim kontrolü

// Kullanıcı bilgisi getirme - giriş yapmış herkes erişebilir
router.get("/username/:username", getUserByUserNameFromDatabase);
router.get("/:id", getUserByID);

// Kullanıcı güncelleme - kullanıcının kendisi veya admin yapabilir
router.route("/:id").put(isOwnerOrAdminForUser, updateUserFromDatabase);

// Sadece admin erişebilen rotalar
router.delete("/:id", isAdmin, deleteUserByID); // Belirli kullanıcıyı silme (sadece admin)
router.patch("/:id/role", isAdmin, updateUserRole); // Kullanıcı rolünü güncelleme (sadece admin)

// Tüm kullanıcıları listeleme ve silme (sadece admin)
router
  .use(isAdmin)
  .route("/")
  .get(getAllUserFromDatabase)
  .delete(deleteAllUsersFromDatabase);

module.exports = router;
