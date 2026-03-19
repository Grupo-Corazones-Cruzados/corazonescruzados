import type { DigimonPhrases, ActionDescriptions } from '@/types/digimon';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

interface DigimonProfile {
  visualDescription: string;
  phrases: DigimonPhrases;
  actionDescriptions: ActionDescriptions;
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
          content: `You are a Digimon expert and pixel art game designer. You will generate a visual description, personality phrases, and UNIQUE sprite action descriptions for a Digimon character.

Return a JSON object with this exact structure:
{
  "visualDescription": "string (50-100 words, in English, detailed physical description for AI image generation. Describe their body, colors, features, proportions for a pixel art sprite.)",
  "actionDescriptions": {
    "working": "string (English, 15-25 words. Describe how THIS specific Digimon looks when deep in thought or concentrating. Use their unique body features — claws, tail, horns, wings, etc. Must be different from other Digimon.)",
    "excited": "string (English, 15-25 words. Describe how THIS Digimon shows excitement/happiness. Use their personality — shy vs bold, energetic vs calm. Unique pose/gesture.)",
    "done": "string (English, 15-25 words. Describe how THIS Digimon celebrates completing a task. Must be DIFFERENT from excited — more triumphant, proud, relieved. Use their body uniquely.)",
    "sleeping": "string (English, 15-25 words. Describe how THIS Digimon sleeps — curled up, sprawled out, sitting, hugging tail, etc. Based on their body shape.)",
    "eating": "string (English, 15-25 words. Describe how THIS Digimon eats — messy, elegant, using claws, big bites, etc. Based on their personality and mouth/hands.)",
    "chromaKey": "string (a hex color like #FF00FF. Choose the background color that has the LEAST similarity to this Digimon's body colors. Options: #FF00FF (magenta — best for green/blue/white characters), #00FF00 (green — best for red/orange/pink characters), #0000FF (blue — best for yellow/orange/red characters), #FF0000 (red — best for blue/green/white characters). Pick the one most different from the character's main colors.)"
  },
  "phrases": {
    "tier1": ["phrase1", "phrase2"],
    "tier2": ["phrase1", ..., "phrase5"],
    "tier3": ["phrase1", ..., "phrase15"],
    "tier4": ["phrase1", ..., "phrase25"],
    "tier5": ["phrase1", ..., "phrase35"],
    "tier6": ["phrase1", ..., "phrase40"]
  }
}

CRITICAL rules for actionDescriptions:
- Each description is for a ROW of 4 animation frames in a pixel art sprite sheet
- Describe the POSE and BODY LANGUAGE, not emotions or context
- Reference the Digimon's specific body parts (tail, claws, horn, wings, fur, etc.)
- "excited" and "done" MUST describe clearly DIFFERENT poses/gestures
- Keep descriptions visual and concrete (for AI image generation)
- Do NOT include props, objects, food items, or background elements
- NEVER mention fire, flames, energy, attacks, special moves, projectiles, magic, aura or any combat abilities
- Focus ONLY on body poses, gestures, and expressions
- ALL poses MUST have feet touching the ground, NEVER floating or jumping in the air
- For "excited": show excitement through upper body and arms, NOT by jumping — feet stay planted on the ground

Rules for phrases:
- ALL phrases MUST be in Spanish
- Each phrase max 35 characters
- tier1 (2 phrases): Cold, distant, distrustful. Like meeting a stranger.
- tier2 (5 phrases): Slightly curious but still guarded.
- tier3 (15 phrases): Friendly, starting to open up, casual conversation.
- tier4 (25 phrases): Close friend, shares feelings, playful teasing.
- tier5 (35 phrases): Best friend, deep trust, affectionate, protective.
- tier6 (40 phrases): Soulmate level, unconditional love, deeply emotional.
- Phrases should feel natural for ${digimonName}'s personality from the Digimon series.`
        },
        {
          role: 'user',
          content: `Generate the complete profile for ${digimonName}.`
        }
      ],
      temperature: 0.9,
      max_tokens: 4500,
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

  if (!parsed.visualDescription || !parsed.phrases || !parsed.actionDescriptions) {
    throw new Error('Invalid profile structure from OpenAI');
  }

  return parsed;
}

/** Generate a chat persona/system prompt for a Digimon based on its canonical personality */
export async function generateDigimonPersona(digimonName: string): Promise<string> {
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
          content: `You are a Digimon expert. Generate a system prompt persona for a Digimon character that will be used as an AI coding assistant.

Return a JSON object: { "persona": "..." }

The persona should be 3-5 sentences that:
1. Start with "You are ${digimonName}, ..." and reference their Digimon series/generation
2. Describe their canonical personality traits from the Digimon franchise
3. Mention they work in "GCC WORLD"
4. End with: "Keep responses concise. Use markdown for code. Respond in the same language the user writes to you."

Make it faithful to the character's personality from the anime/games.`
        },
        {
          role: 'user',
          content: `Generate the chat persona for ${digimonName}.`
        }
      ],
      temperature: 0.7,
      max_tokens: 500,
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenAI API error: ${res.status}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('No content from OpenAI');

  const parsed = JSON.parse(content);
  return parsed.persona;
}
