import { NextRequest, NextResponse } from 'next/server';
import { getDigimonEntry, setDigimonEntry, isMealWindowOpen, todayString } from '@/lib/digimon-data';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { agentId, mealIndex } = await req.json();

  if (!agentId || mealIndex === undefined) {
    return NextResponse.json({ error: 'agentId and mealIndex required' }, { status: 400 });
  }

  const entry = await getDigimonEntry(agentId);
  if (!entry) {
    return NextResponse.json({ error: 'Digimon not found' }, { status: 404 });
  }

  const mealTime = entry.foodSchedule.meals[mealIndex];
  if (!mealTime) {
    return NextResponse.json({ error: 'Invalid mealIndex' }, { status: 400 });
  }

  const now = new Date();

  // Check if within 3-hour window
  if (!isMealWindowOpen(mealTime, now)) {
    return NextResponse.json({ error: 'Not within meal window' }, { status: 400 });
  }

  // Check if already fed this meal today
  const today = todayString();
  const fedKey = `${today}_${mealIndex}`;
  if (entry.lastFedDates.includes(fedKey)) {
    return NextResponse.json({ error: 'Already fed this meal today' }, { status: 400 });
  }

  // Feed! Increment affinity
  entry.lastFedDates.push(fedKey);
  // Clean old dates (keep only today's entries)
  entry.lastFedDates = entry.lastFedDates.filter(d => d.startsWith(today));

  // Increase affinity: +3 per meal, capped at 100
  entry.affinity = Math.min(100, entry.affinity + 3);

  await setDigimonEntry(agentId, entry);

  return NextResponse.json({
    ok: true,
    affinity: entry.affinity,
    fedKey,
  });
}
