module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (_) {} }
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) return res.status(400).json({ error: "text is required" });
  try {
    const upstream = await fetch("https://god-voice-studio.godgiggog.chatgpt.site/api/tts", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });
    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => "");
      return res.status(502).json({ error:"God Voice upstream failed", status:upstream.status, detail:detail.slice(0,300) });
    }
    const audio = Buffer.from(await upstream.arrayBuffer());
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "audio/mpeg");
    res.setHeader("Content-Length", String(audio.length));
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(audio);
  } catch (e) {
    return res.status(502).json({ error:"God Voice upstream unreachable", detail:String(e?.message || e) });
  }
};
