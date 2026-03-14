import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import db from "../db";
import { AppError } from "../middleware/errorHandler";
import type { User, PublicUser, JwtPayload, SignupBody, LoginBody, AuthResponse } from "../models";

const BCRYPT_ROUNDS = 10;

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET environment variable is not set");
  return secret;
}

function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    created_at: user.created_at,
    subscription_tier: user.subscription_tier ?? "free",
    subscription_provider: user.subscription_provider ?? null,
    subscription_expires_at: user.subscription_expires_at ?? null,
  };
}

function signToken(user: User): string {
  const payload: JwtPayload = { sub: user.id, username: user.username };
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "7d" });
}

export async function signup(body: SignupBody): Promise<AuthResponse> {
  const { username, email, password } = body;

  if (!username?.trim()) throw new AppError(400, "username is required");
  if (!email?.trim())    throw new AppError(400, "email is required");
  if (!password)         throw new AppError(400, "password is required");
  if (password.length < 8) throw new AppError(400, "password must be at least 8 characters");

  const existing = db
    .prepare("SELECT id FROM users WHERE email = ? OR username = ?")
    .get(email.toLowerCase(), username) as { id: number } | undefined;
  if (existing) throw new AppError(409, "A user with that email or username already exists");

  const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const result = db
    .prepare("INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)")
    .run(username.trim(), email.toLowerCase().trim(), password_hash);

  const user = db
    .prepare("SELECT * FROM users WHERE id = ?")
    .get(result.lastInsertRowid) as User;

  return { token: signToken(user), user: toPublicUser(user) };
}

export async function login(body: LoginBody): Promise<AuthResponse> {
  const { email, password } = body;

  if (!email?.trim()) throw new AppError(400, "email is required");
  if (!password)      throw new AppError(400, "password is required");

  const user = db
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(email.toLowerCase().trim()) as User | undefined;

  // Use a constant-time compare even on miss to prevent timing attacks
  const hashToCheck = user?.password_hash ?? "$2b$10$invalidhashpadding000000000000000000000000000000000000";
  const valid = await bcrypt.compare(password, hashToCheck);

  if (!user || !valid) throw new AppError(401, "Invalid email or password");

  return { token: signToken(user), user: toPublicUser(user) };
}

export function verifyToken(token: string): JwtPayload {
  try {
    return jwt.verify(token, getJwtSecret()) as JwtPayload;
  } catch {
    throw new AppError(401, "Invalid or expired token");
  }
}
