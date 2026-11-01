import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

export const notFound = (what = "Resource") => new HttpError(404, `${what} not found`);
export const forbidden = () => new HttpError(403, "You do not have access to this resource");

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "Please check the highlighted fields.",
      fields: Object.fromEntries(err.issues.map((i) => [i.path.join(".") || "_", i.message])),
    });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, ...(err.details && typeof err.details === "object" ? err.details : {}) });
  }
  // Malformed JSON body from express.json()
  if (typeof err === "object" && err && "type" in err && (err as { type: string }).type === "entity.parse.failed") {
    return res.status(400).json({ error: "Request body is not valid JSON" });
  }
  console.error(err);
  res.status(500).json({ error: "Something went wrong on our side. Please try again." });
}
