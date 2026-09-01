import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp, cleanDb } from "./helpers.js";
import { prisma } from "../../src/lib/prisma.js";
import { makeTestPassword } from "./helpers.js";

let app: FastifyInstance;

beforeAll(async () => { app = await createTestApp(); });
afterAll(async () => { await app.close(); await prisma.$disconnect(); });
beforeEach(async () => { await cleanDb(); });

const REG = {
  companyName: "Acme Ltd",
  firstName: "Jane",
  lastName: "Smith",
  email: "jane@acme.com",
  phone: "9876543210",
  password: makeTestPassword(),
};

// 1. Customer registration
it("registers a new customer", async () => {
  const res = await app.inject({ method: "POST", url: "/api/v1/auth/register", payload: REG });
  expect(res.statusCode).toBe(201);
  expect(res.json().data.message).toContain("verify your email");
});

it("rejects duplicate email", async () => {
  await app.inject({ method: "POST", url: "/api/v1/auth/register", payload: REG });
  const res = await app.inject({ method: "POST", url: "/api/v1/auth/register", payload: REG });
  expect(res.statusCode).toBe(409);
});

// 2. Login
it("login fails before email verification", async () => {
  await app.inject({ method: "POST", url: "/api/v1/auth/register", payload: REG });
  const res = await app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { email: REG.email, password: REG.password } });
  expect(res.statusCode).toBe(422);
});

it("login succeeds after email verification", async () => {
  await app.inject({ method: "POST", url: "/api/v1/auth/register", payload: REG });
  await prisma.user.update({ where: { email: REG.email }, data: { status: "ACTIVE" } });
  const res = await app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { email: REG.email, password: REG.password } });
  expect(res.statusCode).toBe(200);
  expect(res.json().data.accessToken).toBeTruthy();
  expect(res.cookies.find((cookie) => cookie.name === "access_token")?.sameSite).toBe("Lax");
});

it("login returns same message for wrong email and wrong password", async () => {
  await app.inject({ method: "POST", url: "/api/v1/auth/register", payload: REG });
  await prisma.user.update({ where: { email: REG.email }, data: { status: "ACTIVE" } });
  const incorrectPassword = makeTestPassword();
  const wrongPw = await app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { email: REG.email, password: incorrectPassword } });
  const wrongEmail = await app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { email: "nobody@nope.com", password: incorrectPassword } });
  // Both must return 401 — prevents user enumeration
  expect(wrongPw.statusCode).toBe(401);
  expect(wrongEmail.statusCode).toBe(401);
});

// 3. Refresh token
it("refreshes access token", async () => {
  await app.inject({ method: "POST", url: "/api/v1/auth/register", payload: REG });
  await prisma.user.update({ where: { email: REG.email }, data: { status: "ACTIVE" } });
  const loginRes = await app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { email: REG.email, password: REG.password } });
  const cookies = loginRes.cookies;
  const refreshCookie = cookies.find((c) => c.name === "refresh_token");
  expect(refreshCookie).toBeTruthy();

  const refreshRes = await app.inject({
    method: "POST",
    url: "/api/v1/auth/refresh",
    cookies: { refresh_token: refreshCookie!.value },
  });
  expect(refreshRes.statusCode).toBe(200);
  expect(refreshRes.json().data.accessToken).toBeTruthy();
});

// 4. Logout
it("logout clears cookies", async () => {
  await app.inject({ method: "POST", url: "/api/v1/auth/register", payload: REG });
  await prisma.user.update({ where: { email: REG.email }, data: { status: "ACTIVE" } });
  const loginRes = await app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { email: REG.email, password: REG.password } });
  const accessToken = loginRes.json().data.accessToken;

  const logoutRes = await app.inject({
    method: "POST",
    url: "/api/v1/auth/logout",
    headers: { authorization: `Bearer ${accessToken}` },
  });
  expect(logoutRes.statusCode).toBe(200);
});

// 8. Customer cannot access admin endpoint
it("customer cannot access admin RFQ list", async () => {
  await app.inject({ method: "POST", url: "/api/v1/auth/register", payload: REG });
  await prisma.user.update({ where: { email: REG.email }, data: { status: "ACTIVE" } });
  const loginRes = await app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { email: REG.email, password: REG.password } });
  const accessToken = loginRes.json().data.accessToken;

  const res = await app.inject({
    method: "GET",
    url: "/api/v1/admin/rfqs",
    headers: { authorization: `Bearer ${accessToken}` },
  });
  expect(res.statusCode).toBe(403);
});
