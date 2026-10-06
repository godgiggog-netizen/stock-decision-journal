module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ error: "Method not allowed" }));
  }
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (_) {} }
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) {
    res.statusCode = 400; res.setHeader("Content-Type","application/json");
    return res.end(JSON.stringify({ error: "text is required" }));
  }
  try {
    const upstream = await fetch("https://god-voice-studio.godgiggog.chatgpt.site/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });
    if (!upstream.ok) {
      res.statusCode = 502; res.setHeader("Content-Type","application/json");
      return res.end(JSON.stringify({ error:"God Voice upstream failed", status:upstream.status }));
    }
    const audio = Buffer.from(await upstream.arrayBuffer());
    res.statusCode = 200;
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "audio/mpeg");
    res.setHeader("Content-Length", String(audio.length));
    res.setHeader("Cache-Control", "no-store");
    return res.end(audio);
  } catch (e) {
    res.statusCode = 502; res.setHeader("Content-Type","application/json");
    return res.end(JSON.stringify({ error:"God Voice upstream unreachable", detail:String(e && e.message || e) }));
  }
};
