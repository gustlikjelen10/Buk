function buildHeaders(secretKey, extra = {}) {
  // Nowe klucze sb_secret_... nie są JWT — wysyłamy je tylko w nagłówku apikey.
  const authHeaders = secretKey.startsWith("sb_")
    ? { apikey: secretKey }
    : { apikey: secretKey, Authorization: `Bearer ${secretKey}` };
  return { ...authHeaders, ...extra };
}

function jsonResponse(text, status) {
  return new Response(text, {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}

export default {
  async fetch(request) {
    const appToken = process.env.APP_TOKEN;
    if (appToken && request.headers.get("x-app-token") !== appToken) {
      return Response.json({ error: "Brak autoryzacji (zły lub pusty token aplikacji)." }, { status: 401 });
    }
    const rawUrl = process.env.SUPABASE_URL;
    const secretKey = process.env.SUPABASE_SECRET_KEY;

    if (!rawUrl) {
      return Response.json({ error: "Brak zmiennej SUPABASE_URL na Vercelu." }, { status: 500 });
    }
    if (!secretKey) {
      return Response.json({ error: "Brak zmiennej SUPABASE_SECRET_KEY na Vercelu." }, { status: 500 });
    }

    const baseUrl = rawUrl.replace(/\/+$/, "");
    const tableUrl = `${baseUrl}/rest/v1/bets`;
    const url = new URL(request.url);

    try {
      if (request.method === "GET") {
        const res = await fetch(`${tableUrl}?select=*&order=created_at.desc`, {
          headers: buildHeaders(secretKey)
        });
        return jsonResponse(await res.text(), res.status);
      }

      if (request.method === "POST") {
        const payload = await request.json();
        const res = await fetch(tableUrl, {
          method: "POST",
          headers: buildHeaders(secretKey, {
            "Content-Type": "application/json",
            "Prefer": "return=representation"
          }),
          body: JSON.stringify(payload)
        });
        return jsonResponse(await res.text(), res.status);
      }

      if (request.method === "PATCH") {
        const body = await request.json();
        const id = body.id;
        if (!id) {
          return Response.json({ error: "Brak id kuponu do aktualizacji." }, { status: 400 });
        }
        const res = await fetch(`${tableUrl}?id=eq.${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: buildHeaders(secretKey, {
            "Content-Type": "application/json",
            "Prefer": "return=representation"
          }),
          body: JSON.stringify(Object.fromEntries(["status", "net", "clv_pct"].filter(k => body[k] !== undefined).map(k => [k, body[k]])))
        });
        return jsonResponse(await res.text(), res.status);
      }

      if (request.method === "DELETE") {
        const id = url.searchParams.get("id");
        const clearAll = url.searchParams.get("all");
        let target = "";

        if (clearAll === "true") {
          target = `${tableUrl}?id=gt.0`;
        } else if (id) {
          target = `${tableUrl}?id=eq.${encodeURIComponent(id)}`;
        } else {
          return Response.json({ error: "Podaj parametr id lub all=true." }, { status: 400 });
        }

        const res = await fetch(target, {
          method: "DELETE",
          headers: buildHeaders(secretKey)
        });
        const text = await res.text();
        return jsonResponse(text ? text : "[]", res.status);
      }

      return Response.json({ error: "Nieobsługiwana metoda HTTP." }, { status: 405 });
    } catch (err) {
      return Response.json({ error: err.message }, { status: 502 });
    }
  }
};
