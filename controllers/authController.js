const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../Models/UserSchema");
const { clearAuthCookies } = require("../Helpers/tokenHelpers");
const { sendVerificationEmail } = require("../Helpers/emailHelpers");

// Environment kontrolü
const isDevelopment = process.env.NODE_ENV !== "production";

// Cookie ayarları - Production için cross-site desteği
const cookieOptions = {
  httpOnly: true,
  secure: !isDevelopment, // Production'da true, development'ta false
  sameSite: "None", // Cross-site istekler için gerekli
  path: "/",
  // domain değeri production ve development ortamları için dinamik olarak ayarlanır
};

// Token oluşturma fonksiyonu
const generateTokens = (user) => {
  console.info("auth/generateTokens: Token oluşturma başladı.");
  const accessToken = jwt.sign(
    {
      id: user._id,
      username: user.userName,
      role: user.role,
      email: user.email,
    },
    process.env.JWT_SECRET,
    { expiresIn: "24h" }
  );

  const refreshToken = jwt.sign(
    { id: user._id },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: "7d" }
  );

  console.info(
    "auth/generateTokens: Tokenlar oluşturuldu.",
    accessToken,
    refreshToken
  );

  return { accessToken, refreshToken };
};

const login = async (req, res) => {
  console.info("auth/login: Giriş işlemi başladı.");
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      console.warn("auth/login: Kullanıcı bulunamadı:", email);
      return res.status(404).json({
        success: false,
        message: "Kullanıcı bulunamadı",
        error: {
          code: "USER_NOT_FOUND",
          details: ["Bu email adresi ile kayıtlı kullanıcı bulunamadı."],
        },
      });
    }

    if (!user.isVerified) {
      console.warn("auth/login: Kullanıcı bulunamadı:", email);
      return res.status(403).json({
        success: false,
        message: "E-posta doğrulanmadı",
        error: {
          code: "ACCOUNT_NOT_VERIFIED",
          details: [
            "E-posta doğrulanmadı, e-postanızı kontrol edin veya doğrulama e-postasını yeniden gönderin.",
          ],
        },
      });
    }

    // Kullanıcının aktif olup olmadığını kontrol et
    if (!user.isActive) {
      console.warn("auth/login: Deaktif edilmiş hesap:", email);
      return res.status(403).json({
        success: false,
        message: "Hesabınız deaktif edilmiş",
        error: {
          code: "ACCOUNT_DEACTIVATED",
          details: ["Hesabınız devre dışı bırakılmıştır."],
        },
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.warn("auth/login: Şifre eşleşmedi:", email);
      return res.status(401).json({
        success: false,
        message: "Geçersiz şifre",
        error: {
          code: "INVALID_PASSWORD",
          details: ["Girdiğiniz şifre yanlış."],
        },
      });
    }

    const { accessToken, refreshToken } = generateTokens(user);
    user.refreshToken = refreshToken;
    await user.save();

    // Cookie ayarlarını değiştir
    res.cookie("token", accessToken, {
      ...cookieOptions,
      maxAge: 24 * 60 * 60 * 1000, // 1 gün
    });

    res.cookie("refreshToken", refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 gün
    });

    console.info("auth/login: Giriş başarılı, tokenlar oluşturuldu.");
    res.status(200).json({
      success: true,
      message: "Giriş başarılı",
      data: {
        user: {
          id: user._id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          username: user.userName,
        },
      },
    });
  } catch (error) {
    console.error("auth/login hata:", error);
    res.status(500).json({
      success: false,
      message: "Sunucu hatası",
      error: {
        code: "SERVER_ERROR",
        details: ["Giriş işlemi sırasında bir hata oluştu."],
      },
    });
  }
};

const logout = async (req, res) => {
  console.info("auth/logout: Çıkış işlemi başladı.");
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      console.warn("auth/logout: Kullanıcı bulunamadı.");
      return res.status(404).json({
        success: false,
        message: "Kullanıcı bulunamadı",
        error: {
          code: "USER_NOT_FOUND",
          details: ["Oturum açmış kullanıcı bulunamadı."],
        },
      });
    }

    user.refreshToken = null;
    await user.save();

    // Çerezleri temizle
    clearAuthCookies(res);

    console.info("auth/logout: Çıkış başarılı.");
    res.status(200).json({
      success: true,
      message: "Çıkış yapıldı",
      data: null,
    });
  } catch (error) {
    console.error("auth/logout hata:", error);
    res.status(500).json({
      success: false,
      message: "Sunucu hatası",
      error: {
        code: "SERVER_ERROR",
        details: ["Çıkış işlemi sırasında bir hata oluştu."],
      },
    });
  }
};

const register = async (req, res) => {
  console.info("auth/register: Kayıt işlemi başladı.");
  const { userName, email, password } = req.body;

  if (!userName || !email || !password)
    return res.status(400).json({
      success: false,
      message: "Kullanıcı adı, şifre ve e-posta alanları gereklidir.",
    });

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.warn("auth/register: Aynı kullanıcı zaten mevcut:", email);
      return res.status(400).json({
        success: false,
        message: "Bu email ile kayıtlı bir kullanıcı zaten var",
        error: {
          code: "USER_EXISTS",
          details: ["Bu email adresi zaten kullanımda."],
        },
      });
    }

    const newUser = await User.create({ userName, email, password });

    // Kullanıcı oluşturulduktan sonra token üret
    const { accessToken, refreshToken } = generateTokens(newUser);

    // Refresh token'ı veritabanına kaydet
    newUser.refreshToken = refreshToken;
    await newUser.save();

    const user = await User.findOne({ email });

    sendVerificationEmail(user, res);

    console.info(
      "auth/register: Yeni kullanıcı oluşturuldu ve token'lar ayarlandı:",
      newUser.email
    );

    res.status(201).json({
      success: true,
      message:
        "Hesap başarıyla oluşturuldu, hesabınızı doğrulamak için e-postanızı kontrol edin. Doğrulama e-postası 2 saat içinde geçerliliğini yitirecektir.",
    });
  } catch (error) {
    console.error("auth/register hata:", error);
    res.status(500).json({
      success: false,
      message: "Sunucu hatası",
      error: {
        code: "SERVER_ERROR",
        details: ["Kayıt işlemi sırasında bir hata oluştu."],
      },
    });
  }
};

const refreshAccessToken = async (req, res) => {
  console.info("auth/refreshAccessToken: Yenileme işlemi başladı.");
  const { refreshToken } = req.cookies;

  if (!refreshToken) {
    console.warn("auth/refreshAccessToken: Refresh token bulunamadı.");
    return res.status(401).json({
      success: false,
      message: "Yetkilendirme yok",
      error: {
        code: "NO_REFRESH_TOKEN",
        details: ["Refresh token bulunamadı."],
      },
    });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    const user = await User.findOne({ _id: decoded.id, refreshToken });

    if (!user) {
      console.warn("auth/refreshAccessToken: Geçersiz refresh token.");
      clearAuthCookies(res);
      return res.status(403).json({
        success: false,
        message: "Geçersiz Refresh Token",
        error: {
          code: "INVALID_REFRESH_TOKEN",
          details: ["Geçersiz veya süresi dolmuş refresh token."],
        },
      });
    }

    const newAccessToken = jwt.sign(
      {
        id: user._id,
        username: user.userName,
        role: user.role,
        email: user.email,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "15m",
      }
    );

    res.cookie("token", newAccessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000, // 15 dakika
    });

    console.info("auth/refreshAccessToken: Yeni access token oluşturuldu.");
    res.status(200).json({
      success: true,
      message: "Yeni Access Token oluşturuldu",
      data: {
        user: {
          id: user._id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          username: user.userName,
        },
        token: newAccessToken,
      },
    });
  } catch (error) {
    console.error("auth/refreshAccessToken hata:", error);
    clearAuthCookies(res);
    return res.status(403).json({
      success: false,
      message: "Geçersiz veya süresi dolmuş Refresh Token",
      error: {
        code: "INVALID_REFRESH_TOKEN",
        details: ["Refresh token geçersiz veya süresi dolmuş."],
      },
    });
  }
};

const verifyToken = async (req, res) => {
  console.info("auth/verifyToken: Token doğrulama işlemi başladı.");
  const token = req.cookies.token;

  if (!token) {
    console.warn("auth/verifyToken: Token bulunamadı.");
    return res.status(401).json({
      success: false,
      message: "Token bulunamadı",
      error: {
        code: "NO_TOKEN",
        details: ["Yetkilendirme tokeni bulunamadı."],
      },
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.info("auth/verifyToken: Token doğrulandı.", decoded);
    res.status(200).json({
      success: true,
      message: "Token doğrulandı",
      data: {
        user: decoded,
        token: token,
      },
    });
  } catch (error) {
    console.error("auth/verifyToken hata:", error);
    res.status(401).json({
      success: false,
      message: "Geçersiz token",
      error: {
        code: "INVALID_TOKEN",
        details: ["Geçersiz veya süresi dolmuş token."],
      },
    });
  }
};

const verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;

    const user = await User.findOne({ verificationToken: token });
    if (Date.now() - user.verificationTokenExpiresAt > 0) {
      return res.status(400).json({
        success: false,
        message: "Token süresi doldu.",
        error: {
          code: "INVALID_TOKEN",
          details: [
            "Doğrulama tokeni süresi doldu, doğrulama e-postasını yeniden gönderin.",
          ],
        },
      });
    }
    user.isVerified = true;
    user.verificationToken = null;
    user.verificationTokenExpiresAt = null;
    await user.save();

    const { accessToken, refreshToken } = generateTokens(user);

    // Token'ları cookie'ye yaz
    res.cookie("token", accessToken, {
      ...cookieOptions,
      maxAge: 24 * 60 * 60 * 1000, // 1 gün
    });

    res.cookie("refreshToken", refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 gün
    });

    console.info(
      "auth/register: Yeni kullanıcı oluşturuldu ve token'lar ayarlandı:",
      user.email
    );

    res.status(201).json({
      success: true,
      message: "Yeni kullanıcı başarıyla oluşturuldu ve oturum açıldı",
      data: {
        user: {
          id: user._id,
          userName: user.userName,
          role: user.role,
        },
      },
    });
  } catch (error) {
    console.error("auth/verifyEmail hata:", error);
    res.status(401).json({
      success: false,
      message: "Geçersiz token",
      error: {
        code: "INVALID_TOKEN",
        details: ["Geçersiz veya süresi dolmuş token."],
      },
    });
  }
};
const resendVerificationEmail = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email)
      return res
        .status(400)
        .json({ success: false, message: "Email is required" });
    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({
        success: false,
        message: "Kullanıcı bulunamadı",
        error: {
          code: "USER_NOT_FOUND",
          details: ["Bu email adresi ile kayıtlı kullanıcı bulunamadı."],
        },
      });
    sendVerificationEmail(user, res);
    res.status(201).json({
      success: true,
      message:
        "Hesap başarıyla oluşturuldu, hesabınızı doğrulamak için e-postanızı kontrol edin. Doğrulama e-postası 2 saat içinde geçerliliğini yitirecektir.",
    });
  } catch (error) {
    console.error("auth/resendVerificationEmail hata:", error);
    return res.status(400).json({
      success: false,
      message: "Doğrulama e-postası gönderilirken hata oluştu.",
    });
  }
};

module.exports = {
  login,
  refreshAccessToken,
  verifyToken,
  logout,
  register,
  verifyEmail,
  resendVerificationEmail,
};
