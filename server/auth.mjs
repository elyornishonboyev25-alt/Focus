import {
  randomBytes,
  createHash,
  scrypt as scryptCallback,
  timingSafeEqual,
  randomUUID,
} from "node:crypto";
import { promisify } from "node:util";
const scrypt = promisify(scryptCallback);
const digest = (value) => createHash("sha256").update(value).digest("hex");
const COOKIE = "daily_session";
const DAYS_30 = 30 * 86400000;
export function createAuth(store, { secure = false } = {}) {
  const db = store.db;
  // A fixed dummy hash makes unknown-account and wrong-password paths both perform scrypt.
  const dummy = "00000000000000000000000000000000:" + "00".repeat(64);
  function create(res, workspaceId = store.createWorkspace(), userId = null) {
    const token = randomBytes(32).toString("hex"),
      csrf = randomBytes(32).toString("hex");
    db.prepare("INSERT INTO sessions VALUES (?, ?, ?, ?, ?)").run(
      digest(token),
      csrf,
      userId,
      workspaceId,
      Date.now() + DAYS_30,
    );
    res.setHeader(
      "Set-Cookie",
      COOKIE +
        "=" +
        token +
        "; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000" +
        (secure ? "; Secure" : ""),
    );
    return { tokenHash: digest(token), csrf, workspaceId, userId };
  }
  function session(req, res) {
    const token = (req.headers.cookie || "")
      .split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith(COOKIE + "="))
      ?.slice(COOKIE.length + 1);
    if (token && /^[a-f0-9]{64}$/.test(token)) {
      const row = db
        .prepare("SELECT * FROM sessions WHERE token_hash=? AND expires_at>?")
        .get(digest(token), Date.now());
      if (row)
        return {
          tokenHash: row.token_hash,
          csrf: row.csrf,
          workspaceId: row.workspace_id,
          userId: row.user_id,
        };
    }
    return create(res);
  }
  function info(current) {
    const user = current.userId
      ? db.prepare("SELECT email FROM users WHERE id=?").get(current.userId)
      : null;
    return {
      workspaceId: current.workspaceId,
      csrf: current.csrf,
      user: user ? { email: user.email } : null,
    };
  }
  async function hashPassword(password) {
    const salt = randomBytes(16).toString("hex");
    const hash = await scrypt(password, salt, 64);
    return salt + ":" + hash.toString("hex");
  }
  async function verifyPassword(password, stored = dummy) {
    const [salt, hash] = stored.split(":");
    const value = await scrypt(password, salt, 64);
    return timingSafeEqual(value, Buffer.from(hash, "hex"));
  }
  function credentials(body) {
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 254 ||
      password.length < 12 ||
      password.length > 256
    )
      throw Object.assign(
        new Error("Use a valid email and a password of 12–256 characters."),
        { status: 400 },
      );
    return { email, password };
  }
  async function register(current, res, body) {
    if (current.userId)
      throw Object.assign(new Error("You are already signed in."), {
        status: 400,
      });
    const { email, password } = credentials(body);
    const passwordHash = await hashPassword(password);
    const id = randomUUID();
    try {
      db.prepare("INSERT INTO users VALUES (?, ?, ?, ?, ?)").run(
        id,
        email,
        passwordHash,
        current.workspaceId,
        Date.now(),
      );
    } catch (error) {
      if (String(error.message).includes("UNIQUE"))
        throw Object.assign(
          new Error("This email is already registered. Sign in instead."),
          { status: 409 },
        );
      throw error;
    }
    db.prepare("DELETE FROM sessions WHERE token_hash=?").run(
      current.tokenHash,
    );
    return create(res, current.workspaceId, id);
  }
  async function login(current, res, body) {
    const { email, password } = credentials(body);
    const user = db.prepare("SELECT * FROM users WHERE email=?").get(email);
    const valid = await verifyPassword(password, user?.password_hash);
    if (!valid || !user)
      throw Object.assign(new Error("Email or password is incorrect."), {
        status: 401,
      });
    db.prepare("DELETE FROM sessions WHERE token_hash=?").run(
      current.tokenHash,
    );
    return create(res, user.workspace_id, user.id);
  }
  function logout(current, res) {
    db.prepare("DELETE FROM sessions WHERE token_hash=?").run(
      current.tokenHash,
    );
    return create(res);
  }
  return { session, info, register, login, logout };
}
