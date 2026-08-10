import { describe, it, expect } from "vitest";
import { RegisterSchema, LoginSchema } from "../../src/modules/auth/auth.schema.js";

describe("RegisterSchema", () => {
  const valid = {
    companyName: "Acme Corp",
    firstName: "John",
    lastName: "Doe",
    email: "john@acme.com",
    phone: "9876543210",
    password: "SecurePass1",
  };

  it("accepts valid registration data", () => {
    expect(() => RegisterSchema.parse(valid)).not.toThrow();
  });

  it("rejects weak password (no uppercase)", () => {
    expect(() => RegisterSchema.parse({ ...valid, password: "weakpassword1" })).toThrow();
  });

  it("rejects weak password (no number)", () => {
    expect(() => RegisterSchema.parse({ ...valid, password: "WeakPassword" })).toThrow();
  });

  it("rejects password under 10 chars", () => {
    expect(() => RegisterSchema.parse({ ...valid, password: "Short1" })).toThrow();
  });

  it("rejects invalid email", () => {
    expect(() => RegisterSchema.parse({ ...valid, email: "notanemail" })).toThrow();
  });

  it("normalises email to lowercase", () => {
    const result = RegisterSchema.parse({ ...valid, email: "UPPER@ACME.COM" });
    expect(result.email).toBe("upper@acme.com");
  });
});

describe("LoginSchema", () => {
  it("accepts valid credentials", () => {
    expect(() => LoginSchema.parse({ email: "a@b.com", password: "x" })).not.toThrow();
  });

  it("rejects empty password", () => {
    expect(() => LoginSchema.parse({ email: "a@b.com", password: "" })).toThrow();
  });
});