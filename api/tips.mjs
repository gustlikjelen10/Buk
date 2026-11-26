export default {
  async fetch(request) {
    const appToken = process.env.APP_TOKEN;
    if (appToken && request.headers.get("x-app-token") !== appToken) {
      return Response.json({ error: "Brak autoryzacji (zły lub pusty token aplikacji)." }, { status: 401 });
    }
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) {
      return Response.json({ error: "Brak zmiennej ANTHROPIC_API_KEY na Vercelu." }, { status: 500 });
    }
    if (request.method !== "POST") {
      return Response.json({ error: "Użyj POST." }, { status: 405 });
    }

    try {
      const { matches } = await request.json();
      const list = (Array.isArray(matches) ? matches : []).slice(0, 8);
      if (list.length === 0) {
        return Response.json({ error: "Brak meczów do sprawdzenia." }, { status: 400 });
      }
      const names = list.map(m => `- ${m.name} (${m.league})`).join("\n");
      const prompt =
        `Dziś jest ${new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Warsaw" })}. ` +
        `Wyszukaj w sieci publicznie dostępne typy typerów/ekspertów na wynik 1X2 (po 90 minutach) tych meczów:\n${names}\n\n` +
        `Dla każdego meczu podaj najczęstszy typ ("1", "X" lub "2"), liczbę niezależnych źródeł, które go podają, i bardzo krótką notatkę (max 12 słów, np. kontuzje). ` +
        `Jeśli nie znajdziesz typów, daj pick null i sources 0. Nie zmyślaj źródeł. ` +
        `Odpowiedz WYŁĄCZNIE tablicą JSON, bez markdown: ` +
        `[{"match":"<nazwa dokładnie jak wyżej>","pick":"1|X|2|null","sources":0,"note":""}]`;

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: process.env.TIPS_MODEL || "claude-sonnet-5-5",
          max_tokens: 2000,
          tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 6 }],
          messages: [{ role: "user", content: prompt }]
        })
      });
      const data = await res.json();
      if (!res.ok) {
        return Response.json({ error: data?.error?.message ?? `Anthropic HTTP ${res.status}` }, { status: 502 });
      }
      const text = (data.content ?? []).filter(b => b.type === "text").map(b => b.text).join("\n");
      const m = text.match(/\[[\s\S]*\]/);
      if (!m) {
        return Response.json({ error: "Model nie zwrócił listy typów." }, { status: 502 });
      }
      return Response.json({ tips: JSON.parse(m[0]) });
    } catch (err) {
      return Response.json({ error: err.message }, { status: 502 });
    }
  }
};
