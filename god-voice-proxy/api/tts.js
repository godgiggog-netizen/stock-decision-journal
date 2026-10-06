export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch {} }
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) { res.status(400).json({ error: "text is required" }); return; }
  try {
    const upstream = await fetch("https://god-voice-studio.godgiggog.chatgpt.site/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });
    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => "");
      res.status(502).json({ error: "God Voice upstream failed", status: upstream.status, detail: detail.slice(0,300) });
      return;
    }
    const audio = Buffer.from(await upstream.arrayBuffer());
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "audio/mpeg");
    res.setHeader("Content-Length", String(audio.length));
    res.setHeader("Cache-Control", "no-store");
    res.status(200).send(audio);
  } catch (e) {
    res.status(502).json({ error: "God Voice upstream unreachable", detail: String(e?.message || e) });
  }
}
