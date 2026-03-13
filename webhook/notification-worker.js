/**
 * Cloudflare Worker - Notification Dispatch Service
 * =================================================
 *
 * Muc tieu:
 * - POST /notification: tao notification cho 1 user
 * - POST /new-course: broadcast notification NEW_COURSE cho user thuong
 *
 * Yeu cau env secrets trong Cloudflare Worker:
 * - FIREBASE_DB_URL: https://db-code-master-default-rtdb.firebaseio.com
 * - FIREBASE_DB_SECRET: Firebase Database Secret (hoac token co quyen ghi)
 * - FIREBASE_WEB_API_KEY: Firebase Web API Key (de verify ID token)
 * - ADMIN_API_KEY: khoa noi bo cho backend-to-backend (khong su dung tren browser)
 */

const jsonHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-admin-key, Authorization",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: jsonHeaders });
}

function normalizeTimestamp(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Date.parse(String(value || ""));
  if (Number.isFinite(parsed)) return parsed;
  return Date.now();
}

function normalizePayload(payload) {
  const type = typeof payload?.type === "string" ? payload.type : "system";
  const title =
    typeof payload?.title === "string" ? payload.title.trim() : "Thong bao";
  const message =
    typeof payload?.message === "string" ? payload.message.trim() : "";
  const link =
    typeof payload?.link === "string" &&
    payload.link.trim() &&
    !/^https?:\/\//i.test(payload.link)
      ? payload.link.trim()
      : null;

  return {
    type,
    title: title.slice(0, 200),
    message: message.slice(0, 500),
    link,
    data: payload?.data || null,
    read: false,
    isRead: false,
    createdAt: normalizeTimestamp(payload?.createdAt),
  };
}

function buildFirebaseUrl(env, path) {
  const base = String(env.FIREBASE_DB_URL || "").replace(/\/$/, "");
  const auth = encodeURIComponent(String(env.FIREBASE_DB_SECRET || ""));
  return `${base}/${path}.json?auth=${auth}`;
}

async function firebaseGet(env, path) {
  const response = await fetch(buildFirebaseUrl(env, path));
  if (!response.ok) {
    throw new Error(`firebaseGet failed: ${response.status}`);
  }
  return response.json();
}

async function firebasePost(env, path, body) {
  const response = await fetch(buildFirebaseUrl(env, path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`firebasePost failed: ${response.status}`);
  }

  return response.json();
}

async function firebasePatchRoot(env, patchBody) {
  const base = String(env.FIREBASE_DB_URL || "").replace(/\/$/, "");
  const auth = encodeURIComponent(String(env.FIREBASE_DB_SECRET || ""));
  const response = await fetch(`${base}/.json?auth=${auth}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patchBody),
  });

  if (!response.ok) {
    throw new Error(`firebasePatchRoot failed: ${response.status}`);
  }

  return response.json();
}

function checkAuth(request, env) {
  const expected = String(env.ADMIN_API_KEY || "");
  if (!expected) return false;
  const received = request.headers.get("x-admin-key") || "";
  return received === expected;
}

async function verifyFirebaseIdToken(idToken, env) {
  const apiKey = String(env.FIREBASE_WEB_API_KEY || "").trim();
  if (!apiKey) {
    throw new Error("FIREBASE_WEB_API_KEY is missing");
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    },
  );

  if (!response.ok) {
    throw new Error(`verifyFirebaseIdToken failed: ${response.status}`);
  }

  const payload = await response.json();
  const uid = payload?.users?.[0]?.localId;
  if (!uid) {
    throw new Error("Invalid Firebase ID token");
  }

  return uid;
}

function getBearerToken(request) {
  const authHeader = request.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return "";
  return authHeader.slice(7).trim();
}

async function resolveRequestIdentity(request, env) {
  // Backend-to-backend path (server key)
  if (checkAuth(request, env)) {
    return { mode: "api-key", uid: null, isAdmin: true };
  }

  // Browser/admin path (Firebase ID token)
  const idToken = getBearerToken(request);
  if (!idToken) {
    return { mode: "none", uid: null, isAdmin: false };
  }

  const uid = await verifyFirebaseIdToken(idToken, env);
  const user = await firebaseGet(env, `users/${uid}`);
  const isAdmin = Number(user?.role) === 1;
  return { mode: "firebase", uid, isAdmin };
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: jsonHeaders });
    }

    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/") {
      return json({
        success: true,
        message: "Notification worker is running",
        routes: ["POST /notification", "POST /new-course"],
        timestamp: new Date().toISOString(),
      });
    }

    if (request.method !== "POST") {
      return json({ success: false, error: "Method not allowed" }, 405);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ success: false, error: "Invalid JSON body" }, 400);
    }

    try {
      const identity = await resolveRequestIdentity(request, env);

      if (url.pathname === "/notification") {
        // /notification cho phep:
        // - server key (trusted backend) hoac
        // - user tu tao notification cho chinh minh
        if (!identity.isAdmin && !identity.uid) {
          return json({ success: false, error: "Unauthorized" }, 401);
        }

        const userId = String(body?.userId || "").trim();
        if (!userId) {
          return json({ success: false, error: "userId is required" }, 400);
        }

        if (!identity.isAdmin && identity.uid !== userId) {
          return json({ success: false, error: "Forbidden" }, 403);
        }

        const payload = normalizePayload(body);
        const created = await firebasePost(
          env,
          `notifications/${userId}`,
          payload,
        );
        return json({ success: true, id: created?.name || null });
      }

      if (url.pathname === "/new-course") {
        // /new-course chi cho admin (qua key hoac firebase admin token)
        if (!identity.isAdmin) {
          return json({ success: false, error: "Forbidden" }, 403);
        }

        const payload = normalizePayload({
          ...body,
          type: "new_course",
        });

        const users = (await firebaseGet(env, "users")) || {};
        const patch = {};
        let count = 0;

        Object.entries(users).forEach(([uid, user]) => {
          if (Number(user?.role) === 1) return;
          const notifId = `n_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          patch[`notifications/${uid}/${notifId}`] = payload;
          count += 1;
        });

        if (count === 0) {
          return json({ success: true, sent: 0, message: "No recipients" });
        }

        await firebasePatchRoot(env, patch);
        return json({ success: true, sent: count });
      }

      return json({ success: false, error: "Route not found" }, 404);
    } catch (error) {
      return json(
        {
          success: false,
          error: error?.message || "Internal error",
          timestamp: new Date().toISOString(),
        },
        500,
      );
    }
  },
};
