import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { Errors } from "../../lib/errors.js";
import { getSignedDownloadUrl } from "./documents.service.js";
import { LocalStorageProvider } from "../../lib/storage/index.js";
import { env } from "../../config/env.js";

export async function documentsRoutes(app: FastifyInstance): Promise<void> {
  // GET /documents/:id/download — returns signed URL
  app.get(
    "/:id/download",
    { preHandler: authenticate },
    async (req, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
      const isStaff = ["STAFF", "ADMIN"].includes(req.user!.role);
      const url = await getSignedDownloadUrl(id, req.user!.customerId, isStaff);
      return reply.send({ success: true, data: { url } });
    },
  );

  // GET /documents/serve — local dev file serving (never in production)
  if (env.STORAGE_PROVIDER === "local") {
    app.get("/serve", async (req, reply) => {
      const { key, expires, sig } = z
        .object({ key: z.string(), expires: z.coerce.number(), sig: z.string() })
        .parse(req.query);

      const provider = new LocalStorageProvider();
      if (!provider.verifySignedUrl(key, expires, sig)) {
        throw Errors.unauthorized();
      }

      const buffer = await provider.readFile(key);
      return reply.send(buffer);
    });
  }
}