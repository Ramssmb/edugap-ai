import { z } from "zod";
import { HttpError } from "./middleware/errors.js";

export const idParam = z.coerce.number().int().positive();

export function parseId(value: unknown, what = "id"): number {
  const r = idParam.safeParse(value);
  if (!r.success) throw new HttpError(400, `Invalid ${what}`);
  return r.data;
}
