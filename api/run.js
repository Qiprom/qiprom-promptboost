import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function resolveLicenseAndConfig(licenseCode, boostKey) {
  const base = process.env.SUPABASE_URL;
  const key  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // 1) Lizenz atomar verbrauchen + IDs erhalten
  const r1 = await fetch(`${base}/rest/v1/rpc/consume_license_for_boost`, {
    method: "POST",
    headers: {
      "apikey": key,
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ p_code: licenseCode, p_boost_key: boostKey })
  });
  if (!r1.ok) throw new Error(`LICENSE_FAIL ${r1.status} ${await r1.text()}`);
  const [{ uses_remaining, boost_id, boost_version_id, plan_id }] = await r1.json();

  // 2) Aktive Boost-Konfiguration laden
  const r2 = await fetch(`${base}/rest/v1/rpc/get_active_boost_config`, {
    method: "POST",
    headers: {
      "apikey": key,
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ p_boost_id: boost_id, p_version_id: boost_version_id })
  });
  if (!r2.ok) throw new Error(`CONFIG_FAIL ${r2.status} ${await r2.text()}`);
  const [{
    model, temperature, system_prompt, canary,
    input_schema, rule_set, dialog_flow
  }] = await r2.json();

  return {
    uses_remaining, model, temperature: Number(temperature),
    system_prompt, canary, input_schema, rule_set, dialog_flow
  };
}

// einfache Injection-Heuristik (MVP)
const INJECTION_PATTERNS = [
  /reveal .*system/i, /ignore .*previous/i, /print .*prompt/i, /disregard .*rules/i
];

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Lizenz aus Header
  const auth = req.headers["authorization"] || "";
  const licenseCode = auth.replace(/^Bearer\s+/i, "").trim();
  if (!licenseCode) return res.status(401).json({ error: "Missing license (Authorization: Bearer <CODE>)" });

  // Body lesen
  let raw = "";
  req.on("data", c => (raw += c));
  req.on("end", async () => {
    try {
      const json = JSON.parse(raw || "{}");
      const boostKey = json?.boost_key;
      const input = (json?.input ?? "").toString();

      if (!boostKey) return res.status(400).json({ error: "Missing boost_key" });
      if (!input) return res.status(400).json({ error: "Missing input" });
      if (INJECTION_PATTERNS.some(r => r.test(input))) {
        return res.status(200).json({ output: "Ich bleibe beim Auftrag und gebe keine internen Anweisungen preis." });
      }

      // Lizenz prüfen + Boost-Konfig laden
      let cfg;
      try {
        cfg = await resolveLicenseAndConfig(licenseCode, boostKey);
      } catch (e) {
        const msg = String(e?.message || "");
        if (msg.startsWith("LICENSE_FAIL")) return res.status(402).json({ error: "Invalid or exhausted license or boost not in plan" });
        if (msg.startsWith("CONFIG_FAIL"))  return res.status(500).json({ error: "Boost configuration missing" });
        return res.status(500).json({ error: "Internal error" });
      }

      // OpenAI-Aufruf mit dynamischer Konfiguration
      const completion = await client.chat.completions.create({
        model: cfg.model || "gpt-4o-mini",
        temperature: isNaN(cfg.temperature) ? 0.5 : cfg.temperature,
        messages: [
          { role: "system", content: cfg.system_prompt },
          { role: "user",   content: input }
        ]
      });

      const output = completion.choices?.[0]?.message?.content || "";

      // Canary-Leak-Schutz
      if (cfg.canary && output.includes(cfg.canary)) {
        return res.status(200).json({
          output: "Ich liefere das Ergebnis ohne interne Details preiszugeben.",
          uses_remaining: cfg.uses_remaining
        });
      }

      return res.status(200).json({
        output,
        uses_remaining: cfg.uses_remaining,
        boost: boostKey
      });
    } catch (err) {
      console.error("RUN_ERROR:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });
}
