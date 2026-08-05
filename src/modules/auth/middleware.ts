import type { NextFunction, Request, Response } from "express";
import type { AuthService, AuthPrincipal } from "./auth-service.js";
import { ForbiddenError, UnauthorizedError } from "../../shared/errors.js";
import type { Role } from "../users/user-service.js";

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPrincipal;
    }
  }
}

export const SESSION_COOKIE_NAME = "phoenix_session";

function cookieValue(request: Request, name: string): string | undefined {
  const cookie = request.header("Cookie");
  if (!cookie) return undefined;
  for (const part of cookie.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export function accessToken(request: Request): string {
  const header = request.header("Authorization");
  if (header?.startsWith("Bearer ")) {
    const token = header.slice(7).trim();
    if (token) return token;
  }
  const token = cookieValue(request, SESSION_COOKIE_NAME);
  if (token) return token;
  throw new UnauthorizedError();
}

export function authenticate(authService: AuthService) {
  return async (request: Request, _response: Response, next: NextFunction): Promise<void> => {
    try {
      request.auth = await authService.authenticate(accessToken(request));
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function authorize(...roles: Role[]) {
  return (request: Request, _response: Response, next: NextFunction): void => {
    if (!request.auth) return next(new UnauthorizedError());
    if (!roles.includes(request.auth.role)) return next(new ForbiddenError());
    next();
  };
}
