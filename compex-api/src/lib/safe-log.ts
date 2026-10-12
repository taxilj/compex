// Safe failure logging. Raw exception messages and stacks can carry customer
// content (Prisma echoes query values), supplier response bodies, SMTP replies,
// hostnames, tokens or file paths. Logs may therefore contain only the error
// type, a short machine code, an HTTP status, an operation label and IDs.

export interface SafeError {
  errorName: string;
  code?: string;
  statusCode?: number;
}

const SAFE_CODE = /^[A-Za-z0-9_.:-]{1,40}$/;

export function safeErr(err: unknown): SafeError {
  const e = err as { name?: unknown; code?: unknown; statusCode?: unknown; $metadata?: { httpStatusCode?: unknown } } | null;
  const status = e?.statusCode ?? e?.$metadata?.httpStatusCode;
  return {
    errorName: typeof e?.name === "string" && SAFE_CODE.test(e.name) ? e.name : "Error",
    code: typeof e?.code === "string" && SAFE_CODE.test(e.code) ? e.code : undefined,
    statusCode: typeof status === "number" ? status : undefined,
  };
}

// Compact one-line form for console.error template strings: "Error P2002 (500)".
export function describeError(err: unknown): string {
  const { errorName, code, statusCode } = safeErr(err);
  return [errorName, code, statusCode !== undefined ? `(${statusCode})` : undefined].filter(Boolean).join(" ");
}
