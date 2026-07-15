import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createPasswordResetToken,
  verifyPasswordResetToken,
} from "../src/db/password-reset.js";

describe("password reset tokens", () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = "test-secret-for-reset-tokens";
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("round-trips a valid token", () => {
    const token = createPasswordResetToken("user-1", "Player@Example.com");
    expect(verifyPasswordResetToken(token)).toEqual({
      userId: "user-1",
      email: "player@example.com",
    });
  });

  it("rejects expired tokens", () => {
    vi.useFakeTimers();
    const token = createPasswordResetToken("user-1", "a@b.com");
    vi.advanceTimersByTime(61 * 60 * 1000);
    expect(verifyPasswordResetToken(token)).toBeNull();
  });

  it("rejects tampered tokens", () => {
    const token = createPasswordResetToken("user-1", "a@b.com");
    expect(verifyPasswordResetToken(`${token}x`)).toBeNull();
  });
});
