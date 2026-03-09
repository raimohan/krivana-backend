import { beforeEach, describe, expect, it } from "vitest";

beforeEach(() => {
  process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
  process.env.REDIS_URL = "redis://localhost:6379";
  process.env.JWT_SECRET = "test-secret";
  process.env.ENCRYPTION_KEY = "unit-test-secret";
});

const cryptoModulePath = "./crypto";

describe("crypto helpers", () => {
  it("encrypts and decrypts values", async () => {
    const { decryptSecret, encryptSecret } = await import(cryptoModulePath);
    const encrypted = encryptSecret("hello-world");
    expect(decryptSecret(encrypted)).toBe("hello-world");
  });
});
