import type { Context, Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

const DEFAULTS = {
  rateConvencional: 8000,
  rateCNC: 12000,
  rateSoldadura: 9000,
  defaultMargin: 30,
  empresa: "Mi Taller Metalúrgico",
};

export default async (req: Request, context: Context) => {
  const s = getStore("settings");

  try {
    if (req.method === "GET") {
      const data = await s.get("default", { type: "json" });
      return new Response(JSON.stringify({ ...DEFAULTS, ...(data || {}) }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (req.method === "POST" || req.method === "PUT") {
      const body = await req.json();
      const existing = (await s.get("default", { type: "json" })) || {};
      const updated = { ...DEFAULTS, ...existing, ...body };
      await s.setJSON("default", updated);
      return new Response(JSON.stringify(updated), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Method not allowed", { status: 405 });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
};

export const config: Config = {
  path: "/api/settings",
};
