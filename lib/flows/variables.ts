/**
 * VARIABLES de contacto en el correo de una campaña (Automatizaciones → Email masivo).
 *
 * El asunto, el cuerpo y el pie pueden llevar `{{nombre}}`, `{{correo}}`, `{{telefono}}` y
 * `{{puesto}}`; al enviar se sustituyen por los datos del contacto que recibe ESE correo,
 * así que el mismo contenido llega personalizado a cada uno.
 *
 * Este módulo es **puro** (sin `pg`, sin `googleapis`, sin `fs`) a propósito: lo importan
 * tanto el endpoint de envío como el editor del navegador, y así la vista previa que ve el
 * usuario usa exactamente la misma sustitución que el envío real.
 */

export type ContactVariableKey = 'nombre' | 'correo' | 'telefono' | 'puesto';

export interface ContactVariable {
  key: ContactVariableKey;
  /** Token tal como se escribe en el texto. */
  token: string;
  label: string;
  /** Para qué sirve, en el selector. */
  hint: string;
  /** Valor de ejemplo de la vista previa. */
  example: string;
}

/** Catálogo único: alimenta el selector del editor y la sustitución del envío. */
export const CONTACT_VARIABLES: ContactVariable[] = [
  { key: 'nombre',   token: '{{nombre}}',   label: 'Nombre',   hint: 'Nombre del contacto',    example: 'María López' },
  { key: 'correo',   token: '{{correo}}',   label: 'Correo',   hint: 'Correo del contacto',    example: 'maria@ejemplo.com' },
  { key: 'telefono', token: '{{telefono}}', label: 'Teléfono', hint: 'Teléfono del contacto',  example: '+593 99 888 1234' },
  { key: 'puesto',   token: '{{puesto}}',   label: 'Puesto',   hint: 'Cargo del contacto',     example: 'Directora' },
];

/** Datos del contacto de los que se puede tirar al personalizar. */
export interface ContactVars {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  position?: string | null;
}

/** Acepta `{{ nombre }}`, `{{NOMBRE}}`, `{{telefono}}`… (tolerante con espacios y mayúsculas). */
const TOKEN_RE = /\{\{\s*(nombre|correo|telefono|teléfono|puesto)\s*\}\}/gi;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function valueFor(key: string, contact: ContactVars): string {
  switch (key.toLowerCase()) {
    case 'nombre': return String(contact.name ?? '');
    case 'correo': return String(contact.email ?? '');
    case 'telefono':
    case 'teléfono': return String(contact.phone ?? '');
    case 'puesto': return String(contact.position ?? '');
    default: return '';
  }
}

/**
 * Sustituye las variables por los datos del contacto.
 *
 * `html: true` (cuerpo y pie) **escapa** el valor: el nombre de un contacto es dato de
 * entrada y sin escapar podría romper el marcado o inyectar etiquetas en el correo.
 * `html: false` (asunto) solo quita saltos de línea, que no valen en una cabecera.
 */
export function renderTemplate(text: string, contact: ContactVars, opts?: { html?: boolean }): string {
  const html = opts?.html !== false;
  return String(text || '').replace(TOKEN_RE, (_m, key: string) => {
    const raw = valueFor(key, contact);
    return html ? escapeHtml(raw) : raw.replace(/[\r\n]+/g, ' ');
  });
}

/** Vista previa con valores de ejemplo (lo que se muestra en el editor). */
export function previewTemplate(text: string, opts?: { html?: boolean }): string {
  const sample: ContactVars = {
    name: CONTACT_VARIABLES[0].example,
    email: CONTACT_VARIABLES[1].example,
    phone: CONTACT_VARIABLES[2].example,
    position: CONTACT_VARIABLES[3].example,
  };
  return renderTemplate(text, sample, opts);
}

/** Variables usadas en un texto (para avisar si a los contactos les falta ese dato). */
export function usedVariables(...texts: (string | null | undefined)[]): ContactVariableKey[] {
  const found = new Set<ContactVariableKey>();
  for (const t of texts) {
    for (const m of String(t || '').matchAll(TOKEN_RE)) {
      const k = m[1].toLowerCase().replace('teléfono', 'telefono') as ContactVariableKey;
      found.add(k);
    }
  }
  return CONTACT_VARIABLES.filter((v) => found.has(v.key)).map((v) => v.key);
}

/** Campo del contacto que alimenta cada variable (para detectar los que están vacíos). */
export const VARIABLE_FIELD: Record<ContactVariableKey, keyof ContactVars> = {
  nombre: 'name',
  correo: 'email',
  telefono: 'phone',
  puesto: 'position',
};
