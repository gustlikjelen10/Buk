export default {
  async fetch(request) {
    const appToken = process.env.APP_TOKEN;
    if (appToken && request.headers.get("x-app-token") !== appToken) {
      return Response.json({ error: "Brak autoryzacji (zły lub pusty token aplikacji)." }, { status: 401 });
    }
    const apiKey = process.env.ODDSPAPI_KEY;
    if (!apiKey) {
      return Response.json(
        { error: "Brak zmiennej ODDSPAPI_KEY w Settings -> Environment Variables na Vercelu." },
        { status: 500 }
      );
    }

    const url = new URL(request.url);
    const action = url.searchParams.get("action");
    const key = encodeURIComponent(apiKey);
    let targetUrl = "";

    if (action === "account") {
      targetUrl = `https://api.oddspapi.io/v4/account?apiKey=${key}`;
    } else if (action === "fixtures") {
      const from = url.searchParams.get("from") ?? "";
      const to = url.searchParams.get("to") ?? "";
      targetUrl =
        `https://api.oddspapi.io/v4/fixtures?apiKey=${key}&sportId=10` +
        `&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&hasOdds=true`;
    } else if (action === "odds") {
      const fixtureId = url.searchParams.get("fixtureId") ?? "";
      const bookmakers = ["pinnacle+30", "efortuna.pl", "superbet.pl"]
        .map(encodeURIComponent)
        .join(",");
      targetUrl =
        `https://api.oddspapi.io/v4/odds?apiKey=${key}` +
        `&fixtureId=${encodeURIComponent(fixtureId)}&bookmakers=${bookmakers}`;
    } else {
      return Response.json({ error: "Nieobsługiwana akcja API." }, { status: 400 });
    }

    try {
      const upstream = await fetch(targetUrl);
      const body = await upstream.text();
      return new Response(body, {
        status: upstream.status,
        headers: { "Content-Type": "application/json; charset=utf-8" }
      });
    } catch (err) {
      return Response.json({ error: err.message }, { status: 502 });
    }
  }
};
