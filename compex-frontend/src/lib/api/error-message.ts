import { ApiError } from "./client";

// Turns a thrown API error into text an admin can act on. The backend sends
// Zod failures as message "Invalid request data" plus details:[{path,message}];
// showing only `message` hides which field was wrong.
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (!(err instanceof ApiError)) return fallback;
  const details = (err.details ?? [])
    .map((d) => {
      if (d && typeof d === "object" && "message" in d) {
        const { path, message } = d as { path?: unknown; message?: unknown };
        const field = Array.isArray(path) && path.length > 0 ? `${path.join(".")}: ` : "";
        return typeof message === "string" ? `${field}${message}` : null;
      }
      return null;
    })
    .filter((m): m is string => m !== null);
  return details.length > 0 ? `${err.message} — ${details.join("; ")}` : err.message;
}
