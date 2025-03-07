const mongoose = require("mongoose");
const User = require("../Models/UserSchema");

const getAllUserFromDatabase = async (req, res) => {
  console.info(
    "user/getAllUserFromDatabase: Tüm kullanıcılar getirilmeye çalışılıyor."
  );
  try {
    const bilgiler = await User.find({});
    if (bilgiler.length === 0) {
      console.info("user/getAllUserFromDatabase: Hiç kullanıcı bulunamadı.");
      return res
        .status(404)
        .json({ success: false, message: "Hiç kullanıcı bulunamadı." });
    }
    console.info(
      `user/getAllUserFromDatabase: ${bilgiler.length} kullanıcı getirildi.`
    );
    res.status(200).json({ success: true, data: bilgiler });
  } catch (error) {
    console.error("user/getAllUserFromDatabase hata:", error);
    res
      .status(500)
      .json({ success: false, message: "Sunucu hatası", error: error.message });
  }
};

const getUserByUserNameFromDatabase = async (req, res) => {
  console.info(
    "user/getUserByUserNameFromDatabase: Kullanıcı araması başladı."
  );
  const username = req.params.username;
  try {
    const bilgiler = await User.findOne(
      { userName: username },
      "userName role createdAt"
    );
    if (!bilgiler) {
      console.info(
        "user/getUserByUserNameFromDatabase: Kullanıcı bulunamadı:",
        username
      );
      return res
        .status(404)
        .json({ success: false, message: "Kullanıcı bulunamadı." });
    }

    console.info(
      "user/getUserByUserNameFromDatabase: Kullanıcı getirildi:",
      username
    );
    res
      .status(200)
      .json({
        success: true,
        message: "Bireysel kullanıcı bilgileriniz",
        data: bilgiler,
      });
  } catch (error) {
    console.error("user/getUserByUserNameFromDatabase hata:", error);
    res
      .status(500)
      .json({ success: false, message: "Sunucu hatası", error: error.message });
  }
};

const getUserByID = async (req, res) => {
  console.info("user/getUserByID: Kullanıcı ID ile aranıyor.");
  const id = req.params.id;
  try {
    const bilgiler = await User.findById(
      { _id: id },
      "userName role createdAt"
    );
    if (!bilgiler) {
      console.info("user/getUserByID: Kullanıcı bulunamadı, ID:", id);
      return res
        .status(404)
        .json({ success: false, message: "Kullanıcı bulunamadı." });
    }

    console.info("user/getUserByID: Kullanıcı getirildi, ID:", id);
    res
      .status(200)
      .json({
        success: true,
        message: "Bireysel kullanıcı bilgileriniz",
        data: bilgiler,
      });
  } catch (error) {
    console.error("user/getUserByID hata:", error);
    res
      .status(500)
      .json({ success: false, message: "Sunucu hatası", error: error.message });
  }
};

const deleteUserFromDatabase = async (req, res) => {
  const username = req.params.username;
  if (!username) {
    console.error("user/deleteUserFromDatabase: Username sağlanmadı.");
    return res
      .status(400)
      .json({ success: false, message: "Username is required" });
  }
  try {
    const result = await User.deleteOne({ userName: username });
    if (result.deletedCount === 0) {
      console.info(
        "user/deleteUserFromDatabase: Kullanıcı bulunamadı:",
        username
      );
      return res
        .status(404)
        .json({ success: false, message: "Kullanıcı bulunamadı." });
    }
    console.info("user/deleteUserFromDatabase: Kullanıcı silindi:", username);
    res
      .status(200)
      .json({ success: true, message: "Kullanıcı başarıyla silindi." });
  } catch (error) {
    console.error("user/deleteUserFromDatabase hata:", error);
    res
      .status(500)
      .json({ success: false, message: "Sunucu hatası", error: error.message });
  }
};

const deleteUserByID = async (req, res) => {
  const id = req.params.id;
  if (!id) {
    console.error("user/deleteUserByID: ID sağlanmadı.");
    return res.status(400).json({ success: false, message: "ID is required" });
  }
  try {
    const result = await User.deleteOne({ _id: id });
    if (result.deletedCount === 0) {
      console.info("user/deleteUserByID: Kullanıcı bulunamadı, ID:", id);
      return res
        .status(404)
        .json({ success: false, message: "Kullanıcı bulunamadı." });
    }
    console.info("user/deleteUserByID: Kullanıcı silindi, ID:", id);
    res
      .status(200)
      .json({ success: true, message: "Kullanıcı başarıyla silindi." });
  } catch (error) {
    console.error("user/deleteUserByID hata:", error);
    res
      .status(500)
      .json({ success: false, message: "Sunucu hatası", error: error.message });
  }
};

const deleteAllUsersFromDatabase = async (req, res) => {
  const delete_confirm = req.body.delete_confirm;
  try {
    if (delete_confirm === "DELETE ALL USER") {
      const result = await User.deleteMany({});
      console.info(
        "user/deleteAllUsersFromDatabase: Tüm kullanıcılar silindi, sayısı:",
        result.deletedCount
      );
      res.status(200).json({
        success: true,
        message: `${result.deletedCount} kullanıcı silindi.`,
      });
    } else {
      console.info(
        "user/deleteAllUsersFromDatabase: Silme işlemi iptal edildi."
      );
      res.status(400).json({
        success: false,
        message: "Sanırım silmekten vazgeçtiniz.",
      });
    }
  } catch (error) {
    console.error("user/deleteAllUsersFromDatabase hata:", error);
    res.status(500).json({
      success: false,
      message: "Kullanıcılar silinirken bir hata oluştu.",
      error: error.message,
    });
  }
};

const updateUserFromDatabase = async (req, res) => {
  console.info(
    "user/updateUserFromDatabase: Kullanıcı güncelleme işlemi başladı."
  );
  const username = req.params.username;
  const updatedData = req.body;
  try {
    const updatedUser = await User.findOneAndUpdate(
      { userName: username },
      updatedData,
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      console.info(
        "user/updateUserFromDatabase: Kullanıcı bulunamadı:",
        username
      );
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    console.info(
      "user/updateUserFromDatabase: Kullanıcı güncellendi:",
      username
    );
    res.status(200).json({ success: true, data: updatedUser });
  } catch (error) {
    console.error("user/updateUserFromDatabase hata:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAllUserFromDatabase,
  deleteAllUsersFromDatabase,
  deleteUserFromDatabase,
  updateUserFromDatabase,
  getUserByUserNameFromDatabase,
  getUserByID,
  deleteUserByID,
};
