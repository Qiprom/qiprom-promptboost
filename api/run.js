import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let body = "";
  req.on("data", chunk => (body += chunk));
  req.on("end", async () => {
    try {
      const json = JSON.parse(body || "{}");
      const input = json?.input;
      if (!input) return res.status(400).json({ error: "Missing input" });

      // Hier dein "Boost-Prompt" – aktuell noch minimal, damit es funktioniert
      const systemPrompt = "Du bist ein hilfreicher Assistent, der eine SWOT-Analyse unterstützt. Antworte klar und strukturiert.";

      const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: input }
        ]
      });

      const output = completion.choices[0].message.content;
      res.status(200).json({ output });
    } catch (err) {
      console.error("Error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
}
