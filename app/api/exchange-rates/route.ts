import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';

// Supported currencies with symbols and names
const CURRENCIES: Record<string, { symbol: string; name: string }> = {
  USD: { symbol: '$', name: 'Dólar Estadounidense' },
  EUR: { symbol: '€', name: 'Euro' },
  GBP: { symbol: '£', name: 'Libra Esterlina' },
  COP: { symbol: 'COP$', name: 'Peso Colombiano' },
  MXN: { symbol: 'MX$', name: 'Peso Mexicano' },
  BRL: { symbol: 'R$', name: 'Real Brasileño' },
  PEN: { symbol: 'S/', name: 'Sol Peruano' },
  CLP: { symbol: 'CLP$', name: 'Peso Chileno' },
  ARS: { symbol: 'AR$', name: 'Peso Argentino' },
};

// Cache exchange rates for 1 hour
let cachedRates: Record<string, number> | null = null;
let cacheTime = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function fetchRates(): Promise<Record<string, number>> {
  if (cachedRates && Date.now() - cacheTime < CACHE_TTL) return cachedRates;

  try {
    // Free API: exchangerate-api.com (no key required for open endpoint)
    const res = await fetch('https://open.er-api.com/v6/latest/USD', { next: { revalidate: 3600 } });
    if (!res.ok) throw new Error('Exchange API error');
    const data = await res.json();

    // Filter only our supported currencies
    const rates: Record<string, number> = { USD: 1 };
    for (const code of Object.keys(CURRENCIES)) {
      if (data.rates?.[code]) rates[code] = data.rates[code];
    }

    cachedRates = rates;
    cacheTime = Date.now();
    return rates;
  } catch {
    // Fallback rates if API is unavailable
    return {
      USD: 1,
      EUR: 0.92,
      GBP: 0.79,
      COP: 4150,
      MXN: 17.15,
      BRL: 4.97,
      PEN: 3.72,
      CLP: 950,
      ARS: 870,
    };
  }
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const rates = await fetchRates();

    // Build response with full currency info
    const currencies = Object.entries(CURRENCIES).map(([code, info]) => ({
      code,
      symbol: info.symbol,
      name: info.name,
      rate: rates[code] || 1,
    }));

    return NextResponse.json({ currencies, base: 'USD' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
