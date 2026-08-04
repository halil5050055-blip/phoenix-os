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

export function authenticate(authService: AuthService) {
  return async (request: Request, _response: Response, next: NextFunction): Promise<void> => {
    try {
      const header = request.header("Authorization");
      if (!header?.startsWith("Bearer ")) throw new UnauthorizedError();
      const token = header.slice(7).trim();
      if (!token) throw new UnauthorizedError();
      request.auth = await authService.authenticate(token);
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
