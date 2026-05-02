const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002';

export const RP_NAME = 'GCC World';

function deriveOriginAndRpId() {
  try {
    const u = new URL(APP_URL);
    return { origin: u.origin, rpId: u.hostname };
  } catch {
    return { origin: 'http://localhost:3002', rpId: 'localhost' };
  }
}

export const { origin: RP_ORIGIN, rpId: RP_ID } = deriveOriginAndRpId();
