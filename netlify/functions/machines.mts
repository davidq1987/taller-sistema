import type { Context, Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

function store() {
  return getStore("maintenance-tasks");
}

export default async (req: Request, context: Context) => {
  const s = store();
  const url = new URL(req.url);

  try {
    if (req.method === "GET") {
      const { blobs } = await s.list();
      const items = await Promise.all(blobs.map((b) => s.get(b.key, { type: "json" })));
      return new Response(JSON.stringify(items.filter(Boolean)), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (req.method === "POST") {
      const body = await req.json();
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const record = { ...body, id, createdAt: now, updatedAt: now };
      await s.setJSON(id, record);
      return new Response(JSON.stringify(record), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (req.method === "PUT") {
      const body = await req.json();
      const id = body.id || url.searchParams.get("id");
      if (!id) {
        return new Response(JSON.stringify({ error: "id requerido" }), { status: 400 });
      }
      const existing = await s.get(id, { type: "json" });
      if (!existing) {
        return new Response(JSON.stringify({ error: "no encontrado" }), { status: 404 });
      }
      const updated = { ...existing, ...body, id, updatedAt: new Date().toISOString() };
      await s.setJSON(id, updated);
      return new Response(JSON.stringify(updated), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (req.method === "DELETE") {
      const id = url.searchParams.get("id");
      if (!id) {
        return new Response(JSON.stringify({ error: "id requerido" }), { status: 400 });
      }
      await s.delete(id);
      return new Response(null, { status: 204 });
    }

    return new Response("Method not allowed", { status: 405 });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
};

export const config: Config = {
  path: "/api/machines",
};
