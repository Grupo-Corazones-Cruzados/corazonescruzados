import type { DigimonPhrases } from '@/types/digimon';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

interface DigimonProfile {
  visualDescription: string;
  phrases: DigimonPhrases;
}

export async function generateDigimonProfile(digimonName: string): Promise<DigimonProfile> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are a Digimon expert. You will generate a visual description and personality phrases for a Digimon character.

Return a JSON object with this exact structure:
{
  "visualDescription": "string (50-100 words, in English, detailed physical description for AI image generation. Describe their body, colors, features, proportions for a pixel art sprite.)",
  "phrases": {
    "tier1": ["phrase1", "phrase2"],
    "tier2": ["phrase1", ..., "phrase5"],
    "tier3": ["phrase1", ..., "phrase15"],
    "tier4": ["phrase1", ..., "phrase25"],
    "tier5": ["phrase1", ..., "phrase35"],
    "tier6": ["phrase1", ..., "phrase40"]
  }
}

Rules for phrases:
- ALL phrases MUST be in Spanish
- Each phrase max 35 characters
- tier1 (2 phrases): Cold, distant, distrustful. Like meeting a stranger.
- tier2 (5 phrases): Slightly curious but still guarded.
- tier3 (15 phrases): Friendly, starting to open up, casual conversation.
- tier4 (25 phrases): Close friend, shares feelings, playful teasing.
- tier5 (35 phrases): Best friend, deep trust, affectionate, protective.
- tier6 (40 phrases): Soulmate level, unconditional love, deeply emotional.
- Phrases should feel natural for ${digimonName}'s personality from the Digimon series.
- Include a mix of greetings, observations, reactions, and emotional expressions per tier.`
        },
        {
          role: 'user',
          content: `Generate the profile for ${digimonName}.`
        }
      ],
      temperature: 0.8,
      max_tokens: 4000,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error: ${res.status} ${err}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('No content from OpenAI');

  const parsed = JSON.parse(content) as DigimonProfile;

  // Validate structure
  if (!parsed.visualDescription || !parsed.phrases) {
    throw new Error('Invalid profile structure from OpenAI');
  }

  return parsed;
}
