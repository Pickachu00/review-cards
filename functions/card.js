function page(body) {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Card Setup</title></head><body style="font-family:sans-serif;max-width:420px;margin:20px auto;padding:0 16px">${body}</body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } }
  );
}

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === "GET") {
    return page(`
      <h2>Card Setup</h2>
      <form method="POST">
        <label>Card number<br><input name="card" required></label><br><br>
        <label>4 digit PIN<br><input name="pin" inputmode="numeric" pattern="[0-9]{4}" required></label><br><br>
        <label>Review link (https://...)<br><input name="link" type="url" required style="width:100%"></label><br><br>
        <button name="action" value="activate">Activate (first time)</button>
        <button name="action" value="edit">Change link</button>
      </form>`);
  }

  const form = await request.formData();
  const card = String(form.get("card") || "").trim();
  const pin = String(form.get("pin") || "").trim();
  const link = String(form.get("link") || "").trim();
  const action = form.get("action");

  if (!/^\d{1,6}$/.test(card)) return page("Card number must be digits only.");
  if (!/^\d{4}$/.test(pin)) return page("PIN must be exactly 4 digits.");
  if (!/^https:\/\//.test(link)) return page("Link must start with https://");

  const pinKey = "pin:" + card;
  const savedHash = await env.CARDS.get(pinKey);
  const pinHash = await sha256(card + ":" + pin);

  if (action === "activate") {
    if (savedHash) return page("This card is already activated. Use Change link.");
    await env.CARDS.put(pinKey, pinHash);
    await env.CARDS.put(card, link);
    return page(`Card ${card} activated. Link saved.`);
  }

  if (action === "edit") {
    if (!savedHash) return page("This card is not activated yet.");
    if (savedHash !== pinHash) return page("Wrong PIN.");
    await env.CARDS.put(card, link);
    return page(`Card ${card} link updated.`);
  }

  return page("Unknown action.");
}
