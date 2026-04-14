import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma.js";

const router = Router();

const SALT_ROUNDS = 12;
const JWT_EXPIRES_IN = "24h";
const FREE_EMAIL_PROVIDERS = new Set([
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
]);

function isValidPassword(password) {
  return (
    typeof password === "string" &&
    password.length >= 8 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

// ─── POST /register ─────────────────────────────────────────────

router.post("/register", async (req, res, next) => {
  try {
    const { email, password, businessName, gstNumber, phone } = req.body;

    if (!email || !password || !businessName) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "email, password, and businessName are required",
        },
      });
    }

    const emailDomain = email.split("@")[1]?.toLowerCase();
    if (!emailDomain || FREE_EMAIL_PROVIDERS.has(emailDomain)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Please register with a business email address",
        },
      });
    }

    if (!isValidPassword(password)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Password must be at least 8 characters and include upper, lower, number, and symbol",
        },
      });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: { code: "EMAIL_EXISTS", message: "An account with this email already exists" },
      });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        businessName,
        gstNumber: gstNumber || null,
        phone: phone || null,
      },
      select: {
        id: true,
        email: true,
        businessName: true,
        status: true,
        planType: true,
        createdAt: true,
      },
    });

    res.status(201).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

// ─── POST /login ────────────────────────────────────────────────

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "email and password are required" },
      });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({
        success: false,
        error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" },
      });
    }

    if (user.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        error: {
          code: "ACCOUNT_INACTIVE",
          message: `Account is ${user.status.toLowerCase().replace("_", " ")}`,
        },
      });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, isAdmin: user.isAdmin },
      process.env.JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          businessName: user.businessName,
          planType: user.planType,
          isAdmin: user.isAdmin,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /me ────────────────────────────────────────────────────

router.get("/me", async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        error: { code: "MISSING_TOKEN", message: "Authorization header with Bearer token is required" },
      });
    }

    const decoded = jwt.verify(authHeader.split(" ")[1], process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        businessName: true,
        gstNumber: true,
        phone: true,
        status: true,
        planType: true,
        isAdmin: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: "USER_NOT_FOUND", message: "User not found" },
      });
    }

    res.json({ success: true, data: user });
  } catch (err) {
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        error: { code: "INVALID_TOKEN", message: "Token is invalid or expired" },
      });
    }
    next(err);
  }
});

export default router;
