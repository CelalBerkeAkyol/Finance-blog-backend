// /controllers/authController.js
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const User = require("../Models/UserSchema");

// Token oluşturma fonksiyonu
const generateTokens = (user) => {
  console.info("generateTokens: Token oluşturma başladı.");
  const accessToken = jwt.sign(
    { id: user._id, username: user.userName, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "60m" } // Access Token kısa süreli
  );

  const refreshToken = jwt.sign(
    { id: user._id },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: "7d" } // Refresh Token uzun süreli
  );

  console.info("generateTokens: Tokenlar oluşturuldu.");
  return { accessToken, refreshToken };
};

const login = async (req, res) => {
  console.info("login: Giriş işlemi başladı.");
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ userName: username });
    if (!user) {
      console.warn("login: Kullanıcı bulunamadı:", username);
      return res.status(404).json({ message: "Kullanıcı bulunamadı" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.warn("login: Şifre eşleşmedi:", username);
      return res.status(401).json({ message: "Geçersiz şifre" });
    }

    const { accessToken, refreshToken } = generateTokens(user);
    // Refresh token veritabanında saklanıyor
    user.refreshToken = refreshToken;
    await user.save();

    // Tokenlar HTTP-Only cookie olarak gönderiliyor
    res.cookie("token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
      maxAge: 24 * 60 * 60 * 1000, // 1 gün
    });
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 gün
    });

    console.info("login: Giriş başarılı, tokenlar oluşturuldu.");
    res.status(200).json({
      userName: user.userName,
      userRole: user.role,
      message: "Giriş başarılı",
    });
  } catch (error) {
    console.error("login hata:", error);
    res.status(500).json({ message: "Sunucu hatası" });
  }
};

const createUser = async (req, res, next) => {
  console.info("createUser: Kullanıcı oluşturma işlemi başladı.");
  const { userName, password } = req.body;

  try {
    const existingUser = await User.findOne({ userName });
    if (existingUser) {
      console.warn("createUser: Aynı kullanıcı zaten mevcut:", userName);
      return res
        .status(400)
        .json({ message: "Bu email ile kayıtlı bir kullanıcı zaten var." });
    }

    const newUser = await User.create({ userName, password });
    console.info("createUser: Yeni kullanıcı oluşturuldu:", newUser.userName);
    res.status(201).json({
      message: "Yeni kullanıcı başarıyla oluşturuldu.",
      user: newUser.userName,
    });
  } catch (error) {
    console.error("createUser hata:", error);
    return next(error);
  }
};

const refreshAccessToken = async (req, res) => {
  console.info("refreshAccessToken: Yenileme işlemi başladı.");
  const { refreshToken } = req.cookies;

  if (!refreshToken) {
    console.warn("refreshAccessToken: Refresh token bulunamadı.");
    return res.status(401).json({ message: "Yetkilendirme yok." });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    const user = await User.findOne({ _id: decoded.id, refreshToken });
    if (!user) {
      console.warn("refreshAccessToken: Geçersiz refresh token.");
      return res.status(403).json({ message: "Geçersiz Refresh Token." });
    }

    const newAccessToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "15m",
    });

    res.cookie("token", newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 15 * 60 * 1000, // 15 dakika
    });

    console.info("refreshAccessToken: Yeni access token oluşturuldu.");
    res.status(200).json({ message: "Yeni Access Token oluşturuldu." });
  } catch (error) {
    console.error("refreshAccessToken hata:", error);
    res
      .status(403)
      .json({ message: "Geçersiz veya süresi dolmuş Refresh Token." });
  }
};

const verifyToken = async (req, res) => {
  console.info("verifyToken: Token doğrulama işlemi başladı.");
  const token = req.cookies.token;

  if (!token) {
    console.warn("verifyToken: Token bulunamadı.");
    return res.status(401).json({ valid: false, error: "Token bulunamadı." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.info("verifyToken: Token doğrulandı:", decoded);
    return res.status(200).json({ valid: true, user: decoded });
  } catch (error) {
    console.error("verifyToken hata:", error);
    return res.status(401).json({ valid: false, error: "Geçersiz token." });
  }
};

const logout = async (req, res) => {
  console.info("logout: Çıkış işlemi başladı.");
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      console.warn("logout: Kullanıcı bulunamadı.");
      return res.status(404).json({ message: "Kullanıcı bulunamadı" });
    }

    user.refreshToken = null;
    await user.save();

    res.clearCookie("token");
    res.clearCookie("refreshToken");

    console.info("logout: Kullanıcı çıkışı başarıyla tamamlandı.");
    res.status(200).json({ message: "Çıkış yapıldı." });
  } catch (error) {
    console.error("logout hata:", error);
    res.status(500).json({ message: "Sunucu hatası." });
  }
};

module.exports = {
  login,
  createUser,
  refreshAccessToken,
  verifyToken,
  logout,
};
