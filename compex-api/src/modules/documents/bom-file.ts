import type { FastifyRequest } from "fastify";
import path from "node:path";
import { AppError, Errors } from "../../lib/errors.js";

export const MAX_BYTES = 10 * 1024 * 1024;
export const ALLOWED_EXTS = new Set([".xlsx", ".csv"]);
export const ALLOWED_MIMES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv", "application/csv", "text/plain",
]);

// Consume and validate the whole multipart request before any storage/DB/queue
// side effect. Raw parser messages can contain request data and are never public.
export async function readBomFile(req: FastifyRequest) {
  let file: { filename: string; mime: string; buffer: Buffer; ext: string } | undefined;
  try {
    for await (const part of req.parts({ limits: { fileSize: MAX_BYTES, files: 1, fields: 0, parts: 1 } })) {
      if (part.type !== "file") throw Errors.validation("Only one BOM file is allowed");
      const buffer = await part.toBuffer();
      if (buffer.length > MAX_BYTES || part.file.truncated) throw Errors.fileTooLarge();
      const ext = path.extname(part.filename).toLowerCase();
      const mime = part.mimetype.split(";")[0].trim();
      if (!ALLOWED_EXTS.has(ext)) throw Errors.validation("Only .xlsx and .csv files are allowed");
      if (!ALLOWED_MIMES.has(mime) && mime !== "application/octet-stream") throw Errors.validation("Invalid file type");
      if (ext === ".xlsx" && (buffer[0] !== 0x50 || buffer[1] !== 0x4b)) throw Errors.validation("File does not appear to be a valid XLSX file");
      file = { filename: part.filename, mime, buffer, ext };
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    if ((error as { code?: string })?.code === "FST_REQ_FILE_TOO_LARGE") throw Errors.fileTooLarge();
    throw Errors.validation("Invalid BOM upload request");
  }
  if (!file) throw Errors.validation("No file uploaded");
  return file;
}
