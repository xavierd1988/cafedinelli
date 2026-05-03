// Petit client Groq côté serveur. Lit GROQ_API_KEY dans process.env.
// API compatible OpenAI : POST /openai/v1/chat/completions

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

export async function askGroq({
  system,
  messages,
  model = "llama-3.3-70b-versatile",
  maxTokens = 200,
  temperature = 0.85
}) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set");

  const payload = {
    model,
    temperature,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: system },
      ...messages
    ]
  };

  const res = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Groq ${res.status}: ${text || res.statusText}`);
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() || "";
}
