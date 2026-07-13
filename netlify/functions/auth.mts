import type { Context, Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

// Credenciales por defecto para el acceso a "Mensajes interno".
// Se pueden cambiar desde Configuración una vez logueado con la actual.
const DEFAULTS: Record<string, { rol: string; password: string }> = {
  gerencia: { rol: "Gerencia", password: "gerencia2026" },
  mantenimiento: { rol: "Mantenimiento", password: "taller2026" },
};

function store() {
  return getStore("app-auth");
}

async function getCredentials() {
  const s = store();
  const saved = (await s.get("credentials", { type: "json" })) || {};
  const merged: Record<string, { rol: string; password: string }> = {};
  for (const key of Object.keys(DEFAULTS)) {
    merged[key] = { ...DEFAULTS[key], ...(saved[key] || {}) };
  }
  return merged;
}

export default async (req: Request, context: Context) => {
  try {
    if (req.method === "POST") {
      const body = await req.json();
      const usuario = (body.usuario || "").toLowerCase();
      const password = body.password || "";
      const creds = await getCredentials();
      const entry = creds[usuario];
      if (!entry) {
        return new Response(JSON.stringify({ ok: false, error: "Usuario inválido" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (entry.password !== password) {
        return new Response(JSON.stringify({ ok: false, error: "Contraseña incorrecta" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: true, rol: entry.rol }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (req.method === "PUT") {
      const body = await req.json();
      const usuario = (body.usuario || "").toLowerCase();
      const passwordActual = body.passwordActual || "";
      const passwordNueva = body.passwordNueva || "";
      const creds = await getCredentials();
      const entry = creds[usuario];
      if (!entry) {
        return new Response(JSON.stringify({ ok: false, error: "Usuario inválido" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (entry.password !== passwordActual) {
        return new Response(JSON.stringify({ ok: false, error: "La contraseña actual no es correcta" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (!passwordNueva || passwordNueva.length < 4) {
        return new Response(JSON.stringify({ ok: false, error: "La contraseña nueva debe tener al menos 4 caracteres" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      const s = store();
      const saved = (await s.get("credentials", { type: "json" })) || {};
      saved[usuario] = { ...entry, password: passwordNueva };
      await s.setJSON("credentials", saved);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Method not allowed", { status: 405 });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500 });
  }
};

export const config: Config = {
  path: "/api/auth",
};
