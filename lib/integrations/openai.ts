export async function generateRequirementDetails(
  rawText: string
): Promise<{ title: string; description: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content:
            "Eres un asistente que estructura requerimientos de proyectos en español. " +
            "A partir del texto del usuario, genera un JSON con: " +
            "\"title\" (resumen conciso del requerimiento, máximo 80 caracteres) y " +
            "\"description\" (la misma idea del usuario reescrita con mejor redacción, 1-2 oraciones). " +
            "REGLAS ESTRICTAS: " +
            "1. Solo reformula lo que el usuario dijo. NO agregues justificaciones, beneficios, razones ni propósitos que el usuario no haya mencionado. " +
            "2. NO uses frases como 'esto permitirá...', 'esto facilitará...', 'con el objetivo de...', 'para mejorar...' a menos que el usuario las haya dicho explícitamente. " +
            "3. Si el usuario dice 'botón para guardar cambios en catálogo', la descripción debe ser algo como 'Agregar un botón de guardar cambios en el módulo de catálogo.' y nada más. " +
            "Responde SOLO con JSON válido, sin markdown.",
        },
        {
          role: "user",
          content: rawText,
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error: ${res.status} ${err}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new Error("Empty response from OpenAI");
  }

  const jsonStr = content.replace(/^```json\s*/, "").replace(/\s*```$/, "");
  const parsed = JSON.parse(jsonStr);

  return {
    title: parsed.title || rawText,
    description: parsed.description || "",
  };
}
