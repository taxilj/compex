import { describe, expect, it } from "vitest";
import { ApiError } from "./client";
import { apiErrorMessage } from "./error-message";

describe("apiErrorMessage", () => {
  it("falls back for non-API errors so internals are never shown", () => {
    expect(apiErrorMessage(new Error("boom: stack trace"), "Failed to save.")).toBe("Failed to save.");
    expect(apiErrorMessage("nope", "Failed to save.")).toBe("Failed to save.");
  });

  it("shows the server message when there are no details", () => {
    expect(apiErrorMessage(new ApiError(409, "CONFLICT", "An account with this email already exists"), "Failed."))
      .toBe("An account with this email already exists");
  });

  it("appends Zod field details so an admin can see which field was wrong", () => {
    const err = new ApiError(400, "VALIDATION_ERROR", "Invalid request data", [
      { path: ["contactEmail"], message: "Invalid email" },
      { path: ["contacts", 0, "name"], message: "Required" },
      { message: "Bad body" },
      42,
    ]);
    expect(apiErrorMessage(err, "Failed.")).toBe("Invalid request data — contactEmail: Invalid email; contacts.0.name: Required; Bad body");
  });
});
