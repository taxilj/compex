import Fastify from "fastify";
import { registerPlugins } from "./plugins/index.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { customersRoutes } from "./modules/customers/customers.routes.js";
import { rfqsRoutes } from "./modules/rfqs/rfqs.routes.js";
import { documentsRoutes } from "./modules/documents/documents.routes.js";
import { adminRfqsRoutes } from "./modules/admin/admin.rfqs.routes.js";

export async function buildApp() {
  const app = Fastify({ logger: true });

  await registerPlugins(app);

  // Routes
  await app.register(authRoutes, { prefix: "/api/v1/auth" });
  await app.register(customersRoutes, { prefix: "/api/v1/customers" });
  await app.register(rfqsRoutes, { prefix: "/api/v1/rfqs" });
  await app.register(documentsRoutes, { prefix: "/api/v1/documents" });
  await app.register(adminRfqsRoutes, { prefix: "/api/v1/admin/rfqs" });

  app.get("/health", async () => ({ status: "ok" }));

  return app;
}