import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getDigimonEntry, setDigimonEntry } from '@/lib/digimon-data';
import { readWorldConfig, writeWorldConfig } from '@/lib/world';
import { generateDigimonProfile, generateDigimonPersona } from '@/lib/openai';
import type { CitizenDef } from '@/types/world';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const PERSONAS_PATH = path.join(process.cwd(), 'data', 'personas.json');

async function readPersonas(): Promise<Record<string, string>> {
  try {
    return JSON.parse(await fs.readFile(PERSONAS_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

async function writePersonas(data: Record<string, string>) {
  await fs.writeFile(PERSONAS_PATH, JSON.stringify(data, null, 2) + '\n');
}

export async function POST(req: NextRequest) {
  const { agentId, newName } = await req.json();

  if (!agentId || !newName?.trim()) {
    return NextResponse.json({ error: 'agentId and newName required' }, { status: 400 });
  }

  const trimmedName = newName.trim();

  // 1. Update world.json citizen name
  try {
    const config = await readWorldConfig();
    const citizen = config.citizens?.find((c: CitizenDef) => c.agentId === agentId);
    if (citizen) {
      citizen.name = trimmedName;
      await writeWorldConfig(config);
    }
  } catch (err) {
    console.warn('Could not update world.json:', err);
  }

  // 2. Update digimon-data.json digimonName
  const existing = await getDigimonEntry(agentId);
  if (existing) {
    existing.digimonName = trimmedName;
    await setDigimonEntry(agentId, existing);
  }

  // 3. Regenerate profile + persona in background
  regenerateAll(agentId, trimmedName).catch(err => {
    console.error(`[Rename] Background regeneration failed for ${agentId}:`, err);
  });

  return NextResponse.json({ ok: true, regenerating: true });
}

async function regenerateAll(agentId: string, digimonName: string) {
  // Regenerate OpenAI profile (visualDescription, phrases, actionDescriptions)
  try {
    const profile = await generateDigimonProfile(digimonName);
    const existing = await getDigimonEntry(agentId);
    if (existing) {
      existing.digimonName = digimonName;
      existing.visualDescription = profile.visualDescription;
      existing.phrases = profile.phrases;
      existing.actionDescriptions = profile.actionDescriptions;
      await setDigimonEntry(agentId, existing);
    }
    console.log(`[Rename] Profile regenerated for ${agentId} → ${digimonName}`);
  } catch (err) {
    console.error(`[Rename] Profile regen failed:`, err);
  }

  // Regenerate chat persona
  try {
    const persona = await generateDigimonPersona(digimonName);
    const personas = await readPersonas();
    personas[agentId] = persona;
    await writePersonas(personas);
    console.log(`[Rename] Persona regenerated for ${agentId} → ${digimonName}`);
  } catch (err) {
    console.error(`[Rename] Persona regen failed:`, err);
    // Fallback: save a basic persona
    const personas = await readPersonas();
    personas[agentId] = `You are ${digimonName}, a Digimon working in GCC WORLD. You are helpful, knowledgeable, and dedicated to your tasks. Keep responses concise. Use markdown for code. Respond in the same language the user writes to you.`;
    await writePersonas(personas);
  }
}
