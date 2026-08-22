import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";

// Set before any module in this file's isolated registry imports config/env.js,
// so the fix (env.CORS_ORIGIN) is provably what drives the verification link —
// not a stray, unset env var that would silently fall back to localhost.
process.env.CORS_ORIGIN = "https://compex-frontend.vercel.app";

const sendEmailMock = vi.fn().mockResolvedValue(undefined);
vi.mock("../../src/lib/email.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/lib/email.js")>();
  return { ...actual, sendEmail: sendEmailMock };
});

describe("registration verification link", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const { createTestApp, cleanDb } = await import("./helpers.js");
    await cleanDb();
    app = await createTestApp();
  });

  afterAll(async () => {
    const { prisma } = await import("../../src/lib/prisma.js");
    await app.close();
    await prisma.$disconnect();
  });

  it("links to the deployed frontend origin (CORS_ORIGIN), never localhost", async () => {
    await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        companyName: "Acme Ltd",
        firstName: "Jane",
        lastName: "Smith",
        email: "jane-verify@acme.com",
        phone: "9876543210",
        password: "SecurePass1!",
      },
    });

    await vi.waitFor(() => expect(sendEmailMock).toHaveBeenCalledTimes(1));

    const html = sendEmailMock.mock.calls[0][0].html as string;
    expect(html).toContain("https://compex-frontend.vercel.app/verify-email?token=");
    expect(html).not.toContain("localhost");
  });
});
