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

const PUBLIC_PAGES = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/register", changefreq: "monthly", priority: "0.6" },
  { path: "/login", changefreq: "monthly", priority: "0.5" },
];
const PRIVATE_PATHS = ["/api/", "/student", "/teacher", "/admin", "/settings"];

/** Adds the Google Search Console verification tag when GOOGLE_SITE_VERIFICATION is set. */
export function renderIndexHtml(html: string, verification = config.googleSiteVerification) {
  // Only accept the token's character set, so the setting can't inject markup.
  if (!verification || !/^[A-Za-z0-9_-]{10,100}$/.test(verification)) return html;
  return html.replace("</head>", `    <meta name="google-site-verification" content="${verification}" />\n  </head>`);
}

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

  // Search engines: only the public pages are listed; signed-in areas and the API are excluded.
  // URLs are built from the address the site is actually served on (or PUBLIC_URL).
  const baseUrl = (req: express.Request) => (config.publicUrl || `${req.protocol}://${req.get("host")}`).replace(/\/+$/, "");
  app.get("/robots.txt", (req, res) => {
    res.type("text/plain").send(
      ["User-agent: *", "Allow: /", ...PRIVATE_PATHS.map((p) => `Disallow: ${p}`), "", `Sitemap: ${baseUrl(req)}/sitemap.xml`, ""].join("\n"),
    );
  });
  app.get("/sitemap.xml", (req, res) => {
    const urls = PUBLIC_PAGES.map((p) => `  <url><loc>${baseUrl(req)}${p.path}</loc><changefreq>${p.changefreq}</changefreq><priority>${p.priority}</priority></url>`);
    res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`);
  });

  // In production the built client is served by this server (single origin).
  const clientDist = path.resolve(SERVER_ROOT, "..", "client", "dist");
  if (config.isProd && fs.existsSync(clientDist)) {
    const indexHtml = renderIndexHtml(fs.readFileSync(path.join(clientDist, "index.html"), "utf8"));
    app.use(express.static(clientDist, { index: false, maxAge: "1h" }));
    app.get(/^\/(?!api\/).*/, (_req, res) => {
      res.set("Cache-Control", "no-cache").type("html").send(indexHtml);
    });
  }

  app.use(errorHandler);
  return app;
}
