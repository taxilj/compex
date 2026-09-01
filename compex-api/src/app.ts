import Fastify from "fastify";
import { registerPlugins } from "./plugins/index.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { customersRoutes } from "./modules/customers/customers.routes.js";
import { rfqsRoutes } from "./modules/rfqs/rfqs.routes.js";
import { documentsRoutes } from "./modules/documents/documents.routes.js";
import { adminRfqsRoutes } from "./modules/admin/admin.rfqs.routes.js";
import { adminVendorsRoutes } from "./modules/admin/admin.vendors.routes.js";
import { adminManufacturersRoutes } from "./modules/admin/admin.manufacturers.routes.js";
import { adminVendorRfqsRoutes } from "./modules/admin/admin.vendor-rfqs.routes.js";
import { adminLeadsRoutes } from "./modules/admin/admin.leads.routes.js";
import { adminLandedCostRoutes } from "./modules/admin/admin.landed-cost.routes.js";
import { adminQuotationsRoutes } from "./modules/admin/admin.quotations.routes.js";
import { adminOrganizationsRoutes } from "./modules/admin/admin.organizations.routes.js";
import { adminSettingsRoutes } from "./modules/admin/admin.settings.routes.js";
import { adminCustomersRoutes } from "./modules/admin/admin.customers.routes.js";
import { testEmailRoutes } from "./modules/test-support/test-email.routes.js";
import { env } from "./config/env.js";
import { quotesRoutes } from "./modules/quotes/quotes.routes.js";
import { publicLeadsRoutes } from "./modules/leads/public-leads.routes.js";

export async function buildApp() {
  const app = Fastify({ logger: true });

  await registerPlugins(app);

  // Routes
  await app.register(authRoutes, { prefix: "/api/v1/auth" });
  await app.register(customersRoutes, { prefix: "/api/v1/customers" });
  await app.register(rfqsRoutes, { prefix: "/api/v1/rfqs" });
  await app.register(documentsRoutes, { prefix: "/api/v1/documents" });
  await app.register(adminRfqsRoutes, { prefix: "/api/v1/admin/rfqs" });
  await app.register(adminVendorsRoutes, { prefix: "/api/v1/admin/vendors" });
  await app.register(adminManufacturersRoutes, { prefix: "/api/v1/admin/manufacturers" });
  await app.register(adminVendorRfqsRoutes, { prefix: "/api/v1/admin/vendor-rfqs" });
  await app.register(adminLeadsRoutes, { prefix: "/api/v1/admin/leads" });
  await app.register(adminLandedCostRoutes, { prefix: "/api/v1/admin/vendor-rfqs" });
  await app.register(adminQuotationsRoutes, { prefix: "/api/v1/admin/quotations" });
  await app.register(adminOrganizationsRoutes, { prefix: "/api/v1/admin/organizations" });
  await app.register(adminSettingsRoutes, { prefix: "/api/v1/admin/settings" });
  await app.register(adminCustomersRoutes, { prefix: "/api/v1/admin/customers" });
  await app.register(publicLeadsRoutes, { prefix: "/api/v1/leads" });
  await app.register(quotesRoutes, { prefix: "/api/v1/quotes" });
  if (env.NODE_ENV === "test") {
    await app.register(testEmailRoutes, { prefix: "/api/v1/test" });
  }

  app.get("/health", async () => ({ status: "ok" }));

  return app;
}
