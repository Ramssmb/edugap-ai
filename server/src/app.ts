import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import path from "node:path";
import fs from "node:fs";
import { loadUser, requireCsrfHeader } from "./middleware/auth.js";
import { errorHandler } from "./middleware/errors.js";
import { authRouter } from "./routes/auth.js";
import { catalogRouter } from "./routes/catalog.js";
import { studentRouter } from "./routes/student.js";
import { tutorRouter } from "./routes/tutor.js";
import { teacherRouter } from "./routes/teacher.js";
import { adminRouter } from "./routes/admin.js";
import { profileRouter } from "./routes/profile.js";
import { aiEnabled, config, SERVER_ROOT } from "./config.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", config.trustProxy);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:"],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
    }),
  );
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());

  const api = express.Router();
  api.use((_req, res, next) => {
    res.set("Cache-Control", "no-store"); // student data must not be cached by proxies
    next();
  });
  api.use(requireCsrfHeader);
  api.use(loadUser);
  api.get("/health", (_req, res) => res.json({ ok: true, ai: aiEnabled() ? "enabled" : "offline" }));
  api.use("/auth", authRouter);
  api.use("/catalog", catalogRouter);
  api.use("/student", studentRouter);
  api.use("/tutor", tutorRouter);
  api.use("/teacher", teacherRouter);
  api.use("/admin", adminRouter);
  api.use("/profile", profileRouter);
  api.use((_req, res) => res.status(404).json({ error: "Not found" }));
  app.use("/api", api);

  // In production the built client is served by this server (single origin).
  const clientDist = path.resolve(SERVER_ROOT, "..", "client", "dist");
  if (config.isProd && fs.existsSync(clientDist)) {
    app.use(express.static(clientDist, { index: false, maxAge: "1h" }));
    app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(clientDist, "index.html")));
  }

  app.use(errorHandler);
  return app;
}
