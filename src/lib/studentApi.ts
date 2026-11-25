// Student-portal API client.
//
// There is no student backend yet, so this module implements the same async contract against
// localStorage + the shared mock data. To go live, replace the bodies with `fetch` calls (the Admin
// client in `./api.ts` shows the request helper pattern); hooks and pages do not need to change.
// Student session and accounts use their own storage keys and never touch the admin `eduflow-token`.
import type { StudentAccount, StudentPortalData } from "@/types/student";
import { buildPortalData, findStudentByEmail, findStudentById, getLivePortalData, pickDemoStudentId } from "@/lib/studentPortal";

const ACCOUNTS_KEY = "eduflow-student-accounts";
const SESSION_KEY = "eduflow-student-session";
const RESETS_KEY = "eduflow-student-resets";
const SESSION_TTL = 7 * 24 * 3600 * 1000;
const RESET_TTL = 30 * 60 * 1000;
const LATENCY = 350;

export const PASSWORD_MIN_LENGTH = 8;
export const DEMO_EMAIL = "student@eduflow.lk";
export const DEMO_PASSWORD = "Student@123";

interface StoredAccount extends StudentAccount {
  salt: string;
  hash: string;
}
interface Session {
  accountId: string;
  expiresAt: number;
}
interface ResetToken {
  token: string;
  accountId: string;
  expiresAt: number;
}

const wait = <T,>(v: T, ms = LATENCY) => new Promise<T>((res) => setTimeout(() => res(v), ms));

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: session lives for this page load only */
  }
}

const randomHex = (bytes = 16) => Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, "0")).join("");
async function hashPassword(password: string, salt: string): Promise<string> {
  if (crypto.subtle) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${password}`));
    return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
  }
  return `plain:${salt}:${password}`; // insecure-context fallback (mock only)
}

async function loadAccounts(): Promise<StoredAccount[]> {
  const accounts = read<StoredAccount[]>(ACCOUNTS_KEY, []);
  if (!accounts.some((a) => a.email === DEMO_EMAIL)) {
    const salt = randomHex();
    const demoStudentId = pickDemoStudentId();
    const demoStudent = findStudentById(demoStudentId);
    accounts.push({
      id: "acct_demo",
      studentId: demoStudentId,
      fullName: demoStudent?.fullName ?? "Demo Student",
      email: DEMO_EMAIL,
      phone: demoStudent?.phone ?? "0771234567",
      salt,
      hash: await hashPassword(DEMO_PASSWORD, salt),
    });
    write(ACCOUNTS_KEY, accounts);
  }
  return accounts;
}

const toPublic = ({ salt: _s, hash: _h, ...rest }: StoredAccount): StudentAccount => rest;
const normEmail = (e: string) => e.trim().toLowerCase();

export interface AuthResult {
  account: StudentAccount;
}
export interface RegisterPayload {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  studentId?: string;
}

function startSession(accountId: string) {
  write(SESSION_KEY, { accountId, expiresAt: Date.now() + SESSION_TTL } satisfies Session);
}

export const studentAuthApi = {
  async register(p: RegisterPayload): Promise<AuthResult> {
    const accounts = await loadAccounts();
    const email = normEmail(p.email);
    if (accounts.some((a) => a.email === email)) throw new Error("An account with this email already exists. Try signing in instead.");

    let studentId: string | null = null;
    const wanted = p.studentId?.trim();
    if (wanted) {
      const s = findStudentById(wanted);
      if (!s) throw new Error(`We couldn't find student ID “${wanted}”. Check the ID on your enrolment card, or leave it blank.`);
      if (accounts.some((a) => a.studentId === s.id)) throw new Error("That student ID already has a portal account. Try signing in or resetting your password.");
      studentId = s.id;
    } else {
      const byEmail = findStudentByEmail(email);
      if (byEmail && !accounts.some((a) => a.studentId === byEmail.id)) studentId = byEmail.id;
    }

    const salt = randomHex();
    const stored: StoredAccount = { id: `acct_${randomHex(6)}`, studentId, fullName: p.fullName.trim(), email, phone: p.phone.trim(), salt, hash: await hashPassword(p.password, salt) };
    write(ACCOUNTS_KEY, [...accounts, stored]);
    startSession(stored.id);
    return wait({ account: toPublic(stored) });
  },

  async login(emailIn: string, password: string): Promise<AuthResult> {
    const accounts = await loadAccounts();
    const acct = accounts.find((a) => a.email === normEmail(emailIn));
    const ok = acct && (await hashPassword(password, acct.salt)) === acct.hash;
    await wait(null);
    if (!acct || !ok) throw new Error("Incorrect email or password.");
    startSession(acct.id);
    return { account: toPublic(acct) };
  },

  async me(): Promise<StudentAccount | null> {
    const s = read<Session | null>(SESSION_KEY, null);
    if (!s || s.expiresAt < Date.now()) return null;
    const acct = (await loadAccounts()).find((a) => a.id === s.accountId);
    return acct ? toPublic(acct) : null;
  },

  async logout(): Promise<void> {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  },

  /**
   * Always resolves the same way so the response never reveals whether an email is registered.
   * Without an email service, `demoResetLink` carries the link a real system would have emailed.
   */
  async forgotPassword(emailIn: string): Promise<{ demoResetLink?: string }> {
    const acct = (await loadAccounts()).find((a) => a.email === normEmail(emailIn));
    if (!acct) return wait({});
    const token = randomHex(20);
    const resets = read<ResetToken[]>(RESETS_KEY, []).filter((r) => r.expiresAt > Date.now() && r.accountId !== acct.id);
    write(RESETS_KEY, [...resets, { token, accountId: acct.id, expiresAt: Date.now() + RESET_TTL }]);
    return wait({ demoResetLink: `/student/reset-password?token=${token}` });
  },

  async validateResetToken(token: string): Promise<boolean> {
    return wait(read<ResetToken[]>(RESETS_KEY, []).some((r) => r.token === token && r.expiresAt > Date.now()), 150);
  },

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const resets = read<ResetToken[]>(RESETS_KEY, []);
    const r = resets.find((x) => x.token === token && x.expiresAt > Date.now());
    if (!r) throw new Error("This reset link is invalid or has expired. Request a new one.");
    const accounts = await loadAccounts();
    const salt = randomHex();
    const hash = await hashPassword(newPassword, salt);
    write(ACCOUNTS_KEY, accounts.map((a) => (a.id === r.accountId ? { ...a, salt, hash } : a)));
    write(RESETS_KEY, resets.filter((x) => x.token !== token));
    await wait(null);
  },
};

export const studentPortalApi = {
  async getPortal(account: StudentAccount): Promise<StudentPortalData> {
    try {
      return await getLivePortalData(account);
    } catch {
      return wait(buildPortalData(account.studentId), 300);
    }
  },
};
