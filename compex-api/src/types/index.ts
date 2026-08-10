export interface JwtPayload {
  sub: string;
  role: string;
  customerId?: string;
  companyId?: string;
  iat?: number;
  exp?: number;
}

export interface AuthUser {
  id: string;
  role: string;
  customerId?: string;
  companyId?: string;
}

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthUser;
  }
}