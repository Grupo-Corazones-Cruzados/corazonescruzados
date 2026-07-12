// Capa de datos del sistema "Gestión de Datos". SQL crudo sobre el pool `pg` global
// (schema gcc_world). Prefijo de tablas: gd_. Fase A: problemáticas, problemas, fuentes,
// pesos, enfrentamientos, códigos (+ eventos de verificación), categorías.
import { pool } from '@/lib/db';
import {
  aplicarPeso,
  categoriaRef,
  clampCred,
  codigoRef,
  enfrentamientoRef,
  fuentePesoRef,
  fuentePremisaRef,
  gdKey,
  normalizeProblematicaRef,
  piezaRef,
  type CodigoUnidad,
  type GdGraph,
  type PiezaTipo,
  type TipoDato,
  type TipoLogica,
} from '@/lib/centralized/gestion-datos';

let ready = false;

export async function ensureGestionDatosTables(): Promise<void> {
  if (ready) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.gd_problematicas (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      ref VARCHAR(4) NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
  // La REF es única en todo el sistema: la nomenclatura de premisas/códigos la embebe.
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS gd_problematicas_ref_key ON gcc_world.gd_problematicas (UPPER(ref))`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.gd_problemas (
      id SERIAL PRIMARY KEY,
      problematica_id INT NOT NULL REFERENCES gcc_world.gd_problematicas(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS gd_problemas_prob_idx ON gcc_world.gd_problemas(problematica_id)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.gd_fuentes (
      id SERIAL PRIMARY KEY,
      problematica_id INT NOT NULL REFERENCES gcc_world.gd_problematicas(id) ON DELETE CASCADE,
      tipo_dato TEXT NOT NULL,                 -- 'cantidad' | 'cualidad'
      tipo_logica TEXT NOT NULL,               -- 'premisa' | 'peso'
      contenido TEXT NOT NULL DEFAULT '',
      credibilidad NUMERIC(5,2) NOT NULL DEFAULT 50,        -- base (0-100)
      credibilidad_efectiva NUMERIC(5,2) NOT NULL DEFAULT 50, -- mutada por pesos (solo premisa)
      seq INT NOT NULL,                        -- premisa: por problemática · peso: global
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS gd_fuentes_prob_idx ON gcc_world.gd_fuentes(problematica_id)`);
  // Referencia bibliográfica (APA 7) opcional por fuente: tipo + datos estructurados (jsonb).
  await pool.query(`ALTER TABLE gcc_world.gd_fuentes ADD COLUMN IF NOT EXISTS ref_tipo TEXT`);
  await pool.query(`ALTER TABLE gcc_world.gd_fuentes ADD COLUMN IF NOT EXISTS ref_datos JSONB`);

  // Aplicación de una fuente peso sobre una premisa: SIEMPRE aporta credibilidad (promedio).
  // La contradicción NO se hace con pesos, sino enfrentando dos premisas.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.gd_fuente_pesos (
      id SERIAL PRIMARY KEY,
      premisa_fuente_id INT NOT NULL REFERENCES gcc_world.gd_fuentes(id) ON DELETE CASCADE,
      peso_fuente_id INT NOT NULL REFERENCES gcc_world.gd_fuentes(id) ON DELETE CASCADE,
      cred_antes NUMERIC(5,2) NOT NULL,
      cred_despues NUMERIC(5,2) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (premisa_fuente_id, peso_fuente_id)
    )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS gd_fuente_pesos_premisa_idx ON gcc_world.gd_fuente_pesos(premisa_fuente_id)`);

  // Enfrentamiento de dos premisas → una premisa combinada (texto manual).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.gd_enfrentamientos (
      id SERIAL PRIMARY KEY,
      problematica_id INT NOT NULL REFERENCES gcc_world.gd_problematicas(id) ON DELETE CASCADE,
      ganadora_fuente_id INT NOT NULL REFERENCES gcc_world.gd_fuentes(id) ON DELETE CASCADE,
      perdedora_fuente_id INT NOT NULL REFERENCES gcc_world.gd_fuentes(id) ON DELETE CASCADE,
      texto TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS gd_enfrentamientos_prob_idx ON gcc_world.gd_enfrentamientos(problematica_id)`);

  // Código = verdad consecuente de juntar premisas (sueltas o enfrentadas).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.gd_codigos (
      id SERIAL PRIMARY KEY,
      problematica_id INT NOT NULL REFERENCES gcc_world.gd_problematicas(id) ON DELETE CASCADE,
      texto TEXT NOT NULL DEFAULT '',
      verificado BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS gd_codigos_prob_idx ON gcc_world.gd_codigos(problematica_id)`);

  // Unidades-premisa que componen un código.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.gd_codigo_unidades (
      id SERIAL PRIMARY KEY,
      codigo_id INT NOT NULL REFERENCES gcc_world.gd_codigos(id) ON DELETE CASCADE,
      unidad_kind TEXT NOT NULL,               -- 'premisa' | 'enfrentamiento'
      fuente_id INT REFERENCES gcc_world.gd_fuentes(id) ON DELETE CASCADE,
      enfrentamiento_id INT REFERENCES gcc_world.gd_enfrentamientos(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS gd_codigo_unidades_codigo_idx ON gcc_world.gd_codigo_unidades(codigo_id)`);

  // Eventos de demostración empírica que verifican un código (título + url).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.gd_codigo_eventos (
      id SERIAL PRIMARY KEY,
      codigo_id INT NOT NULL REFERENCES gcc_world.gd_codigos(id) ON DELETE CASCADE,
      titulo TEXT NOT NULL,
      url TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS gd_codigo_eventos_codigo_idx ON gcc_world.gd_codigo_eventos(codigo_id)`);

  // Categoría (por problemática) que agrupa códigos verificados.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.gd_categorias (
      id SERIAL PRIMARY KEY,
      problematica_id INT NOT NULL REFERENCES gcc_world.gd_problematicas(id) ON DELETE CASCADE,
      seq INT NOT NULL,
      nombre TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS gd_categorias_prob_idx ON gcc_world.gd_categorias(problematica_id)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.gd_categoria_codigos (
      id SERIAL PRIMARY KEY,
      categoria_id INT NOT NULL REFERENCES gcc_world.gd_categorias(id) ON DELETE CASCADE,
      codigo_id INT NOT NULL REFERENCES gcc_world.gd_codigos(id) ON DELETE CASCADE,
      UNIQUE (categoria_id, codigo_id)
    )`);

  // ── Fase B: listas globales ────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.gd_situaciones (
      id SERIAL PRIMARY KEY, nombre TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.gd_materias (
      id SERIAL PRIMARY KEY, nombre TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
    )`);

  // ── Fase B: Piezas (creadas por el futuro sistema de metodología condiciológica;
  //    aquí SOLO se visualizan). Una pieza revisa/corrige uno o varios códigos y
  //    entrega variables (fija/cambia) por factor (mental/corporal/ambiental). ──
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.gd_piezas (
      id SERIAL PRIMARY KEY,
      problematica_id INT NOT NULL REFERENCES gcc_world.gd_problematicas(id) ON DELETE CASCADE,
      tipo TEXT NOT NULL,                      -- 'revision' | 'correccion'
      estado TEXT NOT NULL DEFAULT 'incompleta', -- 'incompleta' | 'completa'
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
  await pool.query(`ALTER TABLE gcc_world.gd_piezas ADD COLUMN IF NOT EXISTS estado TEXT NOT NULL DEFAULT 'incompleta'`);
  await pool.query(`CREATE INDEX IF NOT EXISTS gd_piezas_prob_idx ON gcc_world.gd_piezas(problematica_id)`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.gd_pieza_codigos (
      id SERIAL PRIMARY KEY,
      pieza_id INT NOT NULL REFERENCES gcc_world.gd_piezas(id) ON DELETE CASCADE,
      codigo_id INT NOT NULL REFERENCES gcc_world.gd_codigos(id) ON DELETE CASCADE,
      UNIQUE (pieza_id, codigo_id)
    )`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.gd_pieza_variables (
      id SERIAL PRIMARY KEY,
      pieza_id INT NOT NULL REFERENCES gcc_world.gd_piezas(id) ON DELETE CASCADE,
      factor TEXT NOT NULL,                    -- 'mental' | 'corporal' | 'ambiental'
      nombre TEXT NOT NULL,
      tipo_var TEXT NOT NULL DEFAULT 'fija',   -- 'fija' | 'cambia'
      restricciones JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS gd_pieza_variables_pieza_idx ON gcc_world.gd_pieza_variables(pieza_id)`);

  // ── Fase B: Rompecabezas (une piezas → expresión con nombre manual + situación) ──
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.gd_rompecabezas (
      id SERIAL PRIMARY KEY,
      problematica_id INT NOT NULL REFERENCES gcc_world.gd_problematicas(id) ON DELETE CASCADE,
      nombre TEXT NOT NULL,
      situacion_id INT REFERENCES gcc_world.gd_situaciones(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS gd_rompecabezas_prob_idx ON gcc_world.gd_rompecabezas(problematica_id)`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.gd_rompecabezas_piezas (
      id SERIAL PRIMARY KEY,
      rompecabezas_id INT NOT NULL REFERENCES gcc_world.gd_rompecabezas(id) ON DELETE CASCADE,
      pieza_id INT NOT NULL REFERENCES gcc_world.gd_piezas(id) ON DELETE CASCADE,
      UNIQUE (rompecabezas_id, pieza_id)
    )`);

  // ── Fase B: Subtemas (título + hipótesis + rompecabezas ordenados) ──
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.gd_subtemas (
      id SERIAL PRIMARY KEY,
      problematica_id INT NOT NULL REFERENCES gcc_world.gd_problematicas(id) ON DELETE CASCADE,
      titulo TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS gd_subtemas_prob_idx ON gcc_world.gd_subtemas(problematica_id)`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.gd_subtema_hipotesis (
      id SERIAL PRIMARY KEY,
      subtema_id INT NOT NULL REFERENCES gcc_world.gd_subtemas(id) ON DELETE CASCADE,
      texto TEXT NOT NULL,
      orden INT NOT NULL DEFAULT 0
    )`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.gd_subtema_rompecabezas (
      id SERIAL PRIMARY KEY,
      subtema_id INT NOT NULL REFERENCES gcc_world.gd_subtemas(id) ON DELETE CASCADE,
      rompecabezas_id INT NOT NULL REFERENCES gcc_world.gd_rompecabezas(id) ON DELETE CASCADE,
      orden INT NOT NULL DEFAULT 0,
      UNIQUE (subtema_id, rompecabezas_id)
    )`);

  // ── Fase C: Temas (agrupan subtemas; describen la realidad en prosa + asocian
  //    materias y problemas). Sin nomenclatura (nivel descriptivo). ──
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.gd_temas (
      id SERIAL PRIMARY KEY,
      problematica_id INT NOT NULL REFERENCES gcc_world.gd_problematicas(id) ON DELETE CASCADE,
      titulo TEXT NOT NULL,
      prosa TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS gd_temas_prob_idx ON gcc_world.gd_temas(problematica_id)`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.gd_tema_subtemas (
      id SERIAL PRIMARY KEY,
      tema_id INT NOT NULL REFERENCES gcc_world.gd_temas(id) ON DELETE CASCADE,
      subtema_id INT NOT NULL REFERENCES gcc_world.gd_subtemas(id) ON DELETE CASCADE,
      orden INT NOT NULL DEFAULT 0,
      UNIQUE (tema_id, subtema_id)
    )`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.gd_tema_materias (
      id SERIAL PRIMARY KEY,
      tema_id INT NOT NULL REFERENCES gcc_world.gd_temas(id) ON DELETE CASCADE,
      materia_id INT NOT NULL REFERENCES gcc_world.gd_materias(id) ON DELETE CASCADE,
      UNIQUE (tema_id, materia_id)
    )`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.gd_tema_problemas (
      id SERIAL PRIMARY KEY,
      tema_id INT NOT NULL REFERENCES gcc_world.gd_temas(id) ON DELETE CASCADE,
      problema_id INT NOT NULL REFERENCES gcc_world.gd_problemas(id) ON DELETE CASCADE,
      UNIQUE (tema_id, problema_id)
    )`);

  ready = true;
}

// ── Helpers internos ──────────────────────────────────────────────────────────
async function getProblematicaRef(problematicaId: number): Promise<string> {
  const { rows } = await pool.query(`SELECT ref FROM gcc_world.gd_problematicas WHERE id = $1`, [problematicaId]);
  return rows[0]?.ref || '';
}

/** Resuelve las unidades de un código a tokens (seq o "gano.perdio") para su nomenclatura. */
async function codigoUnidades(codigoId: number): Promise<CodigoUnidad[]> {
  const { rows } = await pool.query(
    `SELECT u.unidad_kind, u.fuente_id, u.enfrentamiento_id,
            f.seq AS fuente_seq,
            gf.seq AS enf_gano_seq, pf.seq AS enf_perdio_seq
       FROM gcc_world.gd_codigo_unidades u
       LEFT JOIN gcc_world.gd_fuentes f ON f.id = u.fuente_id
       LEFT JOIN gcc_world.gd_enfrentamientos e ON e.id = u.enfrentamiento_id
       LEFT JOIN gcc_world.gd_fuentes gf ON gf.id = e.ganadora_fuente_id
       LEFT JOIN gcc_world.gd_fuentes pf ON pf.id = e.perdedora_fuente_id
      WHERE u.codigo_id = $1
      ORDER BY u.id ASC`,
    [codigoId],
  );
  return rows.map((r: any): CodigoUnidad =>
    r.unidad_kind === 'premisa'
      ? { kind: 'premisa', seq: Number(r.fuente_seq) }
      : { kind: 'enfrentamiento', ganadoraSeq: Number(r.enf_gano_seq), perdedoraSeq: Number(r.enf_perdio_seq) },
  );
}

async function codigoRefById(codigoId: number, problematicaRef: string): Promise<string> {
  const us = await codigoUnidades(codigoId);
  return codigoRef(problematicaRef, us);
}

// ── Problemáticas ─────────────────────────────────────────────────────────────
export async function listProblematicas() {
  await ensureGestionDatosTables();
  const { rows } = await pool.query(
    `SELECT p.id, p.name, p.ref, p.description, p.created_at,
            (SELECT COUNT(*) FROM gcc_world.gd_fuentes f WHERE f.problematica_id = p.id)::int AS fuentes_count,
            (SELECT COUNT(*) FROM gcc_world.gd_codigos c WHERE c.problematica_id = p.id)::int AS codigos_count
       FROM gcc_world.gd_problematicas p
      ORDER BY p.created_at ASC`,
  );
  return rows;
}

export async function createProblematica(name: string, ref: string, description?: string) {
  await ensureGestionDatosTables();
  const cleanRef = normalizeProblematicaRef(ref);
  if (!cleanRef) throw new Error('La referencia debe tener de 1 a 4 letras.');
  const { rows } = await pool.query(
    `INSERT INTO gcc_world.gd_problematicas (name, ref, description) VALUES ($1, $2, $3) RETURNING *`,
    [name.trim(), cleanRef, (description || '').trim()],
  );
  return rows[0];
}

export async function updateProblematica(id: number, name?: string, ref?: string, description?: string) {
  await ensureGestionDatosTables();
  const sets: string[] = [];
  const params: any[] = [];
  if (name != null) { sets.push(`name = $${params.length + 1}`); params.push(name.trim()); }
  if (ref != null) {
    const cleanRef = normalizeProblematicaRef(ref);
    if (!cleanRef) throw new Error('La referencia debe tener de 1 a 4 letras.');
    sets.push(`ref = $${params.length + 1}`); params.push(cleanRef);
  }
  if (description != null) { sets.push(`description = $${params.length + 1}`); params.push(description.trim()); }
  if (!sets.length) return;
  params.push(id);
  await pool.query(`UPDATE gcc_world.gd_problematicas SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
}

export async function deleteProblematica(id: number) {
  await ensureGestionDatosTables();
  await pool.query(`DELETE FROM gcc_world.gd_problematicas WHERE id = $1`, [id]);
}

// ── Problemas ─────────────────────────────────────────────────────────────────
export async function listProblemas(problematicaId: number) {
  await ensureGestionDatosTables();
  const { rows } = await pool.query(
    `SELECT id, title, description, created_at FROM gcc_world.gd_problemas
      WHERE problematica_id = $1 ORDER BY created_at ASC`,
    [problematicaId],
  );
  return rows;
}

export async function createProblema(problematicaId: number, title: string, description?: string) {
  await ensureGestionDatosTables();
  const { rows } = await pool.query(
    `INSERT INTO gcc_world.gd_problemas (problematica_id, title, description) VALUES ($1, $2, $3) RETURNING *`,
    [problematicaId, title.trim(), (description || '').trim()],
  );
  return rows[0];
}

export async function updateProblema(id: number, title?: string, description?: string) {
  await ensureGestionDatosTables();
  const sets: string[] = [];
  const params: any[] = [];
  if (title != null) { sets.push(`title = $${params.length + 1}`); params.push(title.trim()); }
  if (description != null) { sets.push(`description = $${params.length + 1}`); params.push(description.trim()); }
  if (!sets.length) return;
  params.push(id);
  await pool.query(`UPDATE gcc_world.gd_problemas SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
}

export async function deleteProblema(id: number) {
  await ensureGestionDatosTables();
  await pool.query(`DELETE FROM gcc_world.gd_problemas WHERE id = $1`, [id]);
}

// ── Fuentes ───────────────────────────────────────────────────────────────────
export async function listFuentes(problematicaId: number) {
  await ensureGestionDatosTables();
  const { rows } = await pool.query(
    `SELECT f.id, f.problematica_id, f.tipo_dato, f.tipo_logica, f.contenido,
            f.credibilidad::float AS credibilidad,
            f.credibilidad_efectiva::float AS credibilidad_efectiva,
            f.ref_tipo, f.ref_datos,
            f.seq, f.created_at
       FROM gcc_world.gd_fuentes f
      WHERE f.problematica_id = $1
      ORDER BY f.created_at ASC`,
    [problematicaId],
  );
  const ref = await getProblematicaRef(problematicaId);
  return rows.map((r: any) => ({
    ...r,
    nomenclatura: r.tipo_logica === 'premisa' ? fuentePremisaRef(ref, r.seq) : fuentePesoRef(r.seq),
  }));
}

export async function createFuente(
  problematicaId: number,
  tipoDato: TipoDato,
  tipoLogica: TipoLogica,
  contenido: string,
  credibilidad: number,
  refTipo?: string | null,
  refDatos?: Record<string, string> | null,
) {
  await ensureGestionDatosTables();
  const cred = clampCred(Number(credibilidad));
  // Secuencia: premisa = por problemática; peso = GLOBAL en todo el sistema.
  const seqQuery =
    tipoLogica === 'premisa'
      ? await pool.query(
          `SELECT COALESCE(MAX(seq), 0) + 1 AS next FROM gcc_world.gd_fuentes
            WHERE problematica_id = $1 AND tipo_logica = 'premisa'`,
          [problematicaId],
        )
      : await pool.query(
          `SELECT COALESCE(MAX(seq), 0) + 1 AS next FROM gcc_world.gd_fuentes WHERE tipo_logica = 'peso'`,
        );
  const seq = Number(seqQuery.rows[0].next);
  const { rows } = await pool.query(
    `INSERT INTO gcc_world.gd_fuentes
       (problematica_id, tipo_dato, tipo_logica, contenido, credibilidad, credibilidad_efectiva, seq, ref_tipo, ref_datos)
     VALUES ($1, $2, $3, $4, $5, $5, $6, $7, $8::jsonb) RETURNING *`,
    [problematicaId, tipoDato, tipoLogica, contenido.trim(), cred, seq, refTipo || null, refDatos ? JSON.stringify(refDatos) : null],
  );
  return rows[0];
}

export async function updateFuente(
  id: number,
  contenido?: string,
  credibilidad?: number,
  refTipo?: string | null,
  refDatos?: Record<string, string> | null,
  tipoDato?: TipoDato,
) {
  await ensureGestionDatosTables();
  const sets: string[] = [];
  const params: any[] = [];
  if (tipoDato && ['cantidad', 'cualidad'].includes(tipoDato)) { sets.push(`tipo_dato = $${params.length + 1}`); params.push(tipoDato); }
  if (contenido != null) { sets.push(`contenido = $${params.length + 1}`); params.push(contenido.trim()); }
  if (credibilidad != null) {
    const cred = clampCred(Number(credibilidad));
    // Al cambiar la base se resetea la efectiva a la base y se re-aplican los pesos.
    sets.push(`credibilidad = $${params.length + 1}`); params.push(cred);
    sets.push(`credibilidad_efectiva = $${params.length + 1}`); params.push(cred);
  }
  if (refTipo !== undefined) {
    sets.push(`ref_tipo = $${params.length + 1}`); params.push(refTipo || null);
    sets.push(`ref_datos = $${params.length + 1}::jsonb`); params.push(refDatos ? JSON.stringify(refDatos) : null);
  }
  if (!sets.length) return;
  params.push(id);
  await pool.query(`UPDATE gcc_world.gd_fuentes SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
  if (credibilidad != null) await recomputeCredibilidad(id);
}

export async function deleteFuente(id: number) {
  await ensureGestionDatosTables();
  await pool.query(`DELETE FROM gcc_world.gd_fuentes WHERE id = $1`, [id]);
}

/** Re-aplica en orden todos los pesos registrados sobre una premisa, desde su base. */
async function recomputeCredibilidad(premisaFuenteId: number) {
  const { rows: [base] } = await pool.query(
    `SELECT credibilidad::float AS c FROM gcc_world.gd_fuentes WHERE id = $1`,
    [premisaFuenteId],
  );
  let cred = clampCred(Number(base?.c ?? 0));
  const { rows: pesos } = await pool.query(
    `SELECT p.id, f.credibilidad::float AS peso_cred
       FROM gcc_world.gd_fuente_pesos p
       JOIN gcc_world.gd_fuentes f ON f.id = p.peso_fuente_id
      WHERE p.premisa_fuente_id = $1
      ORDER BY p.created_at ASC, p.id ASC`,
    [premisaFuenteId],
  );
  for (const p of pesos) {
    const antes = cred;
    cred = clampCred(aplicarPeso(antes, Number(p.peso_cred)));
    await pool.query(`UPDATE gcc_world.gd_fuente_pesos SET cred_antes = $1, cred_despues = $2 WHERE id = $3`, [antes, cred, p.id]);
  }
  await pool.query(`UPDATE gcc_world.gd_fuentes SET credibilidad_efectiva = $1 WHERE id = $2`, [cred, premisaFuenteId]);
  return cred;
}

// ── Pesos (aplicar una fuente peso a una premisa) ─────────────────────────────
export async function aplicarPesoAFuente(premisaFuenteId: number, pesoFuenteId: number) {
  await ensureGestionDatosTables();
  // Validaciones: la premisa debe ser 'premisa', el peso debe ser 'peso'.
  const { rows } = await pool.query(
    `SELECT id, tipo_logica FROM gcc_world.gd_fuentes WHERE id = ANY($1::int[])`,
    [[premisaFuenteId, pesoFuenteId]],
  );
  const premisa = rows.find((r: any) => r.id === premisaFuenteId);
  const peso = rows.find((r: any) => r.id === pesoFuenteId);
  if (!premisa || premisa.tipo_logica !== 'premisa') throw new Error('La fuente objetivo debe ser de tipo premisa.');
  if (!peso || peso.tipo_logica !== 'peso') throw new Error('La fuente aplicada debe ser de tipo peso.');
  await pool.query(
    `INSERT INTO gcc_world.gd_fuente_pesos (premisa_fuente_id, peso_fuente_id, cred_antes, cred_despues)
     VALUES ($1, $2, 0, 0)
     ON CONFLICT (premisa_fuente_id, peso_fuente_id) DO NOTHING`,
    [premisaFuenteId, pesoFuenteId],
  );
  return recomputeCredibilidad(premisaFuenteId);
}

export async function quitarPeso(premisaFuenteId: number, pesoFuenteId: number) {
  await ensureGestionDatosTables();
  await pool.query(
    `DELETE FROM gcc_world.gd_fuente_pesos WHERE premisa_fuente_id = $1 AND peso_fuente_id = $2`,
    [premisaFuenteId, pesoFuenteId],
  );
  return recomputeCredibilidad(premisaFuenteId);
}

export async function listPesosDePremisa(premisaFuenteId: number) {
  await ensureGestionDatosTables();
  const { rows } = await pool.query(
    `SELECT p.id, p.peso_fuente_id, p.cred_antes::float AS cred_antes, p.cred_despues::float AS cred_despues,
            f.seq AS peso_seq, f.contenido AS peso_contenido, f.credibilidad::float AS peso_credibilidad
       FROM gcc_world.gd_fuente_pesos p
       JOIN gcc_world.gd_fuentes f ON f.id = p.peso_fuente_id
      WHERE p.premisa_fuente_id = $1
      ORDER BY p.created_at ASC`,
    [premisaFuenteId],
  );
  return rows.map((r: any) => ({ ...r, peso_nomenclatura: fuentePesoRef(r.peso_seq) }));
}

// ── Enfrentamientos ───────────────────────────────────────────────────────────
export async function crearEnfrentamiento(problematicaId: number, fuenteAId: number, fuenteBId: number, texto: string) {
  await ensureGestionDatosTables();
  const { rows } = await pool.query(
    `SELECT id, tipo_logica, credibilidad_efectiva::float AS cred FROM gcc_world.gd_fuentes
      WHERE id = ANY($1::int[]) AND problematica_id = $2`,
    [[fuenteAId, fuenteBId], problematicaId],
  );
  const a = rows.find((r: any) => r.id === fuenteAId);
  const b = rows.find((r: any) => r.id === fuenteBId);
  if (!a || !b) throw new Error('Ambas fuentes deben pertenecer a la problemática.');
  if (a.tipo_logica !== 'premisa' || b.tipo_logica !== 'premisa') throw new Error('Solo se enfrentan fuentes de tipo premisa.');
  // Ganadora = mayor credibilidad efectiva (empate → la primera).
  const ganadora = Number(a.cred) >= Number(b.cred) ? a : b;
  const perdedora = ganadora.id === a.id ? b : a;
  const { rows: ins } = await pool.query(
    `INSERT INTO gcc_world.gd_enfrentamientos (problematica_id, ganadora_fuente_id, perdedora_fuente_id, texto)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [problematicaId, ganadora.id, perdedora.id, (texto || '').trim()],
  );
  return ins[0];
}

export async function updateEnfrentamiento(id: number, texto: string) {
  await ensureGestionDatosTables();
  await pool.query(`UPDATE gcc_world.gd_enfrentamientos SET texto = $1 WHERE id = $2`, [(texto || '').trim(), id]);
}

export async function deleteEnfrentamiento(id: number) {
  await ensureGestionDatosTables();
  await pool.query(`DELETE FROM gcc_world.gd_enfrentamientos WHERE id = $1`, [id]);
}

export async function listEnfrentamientos(problematicaId: number) {
  await ensureGestionDatosTables();
  const ref = await getProblematicaRef(problematicaId);
  const { rows } = await pool.query(
    `SELECT e.id, e.texto, e.created_at,
            gf.seq AS gano_seq, gf.contenido AS gano_contenido,
            pf.seq AS perdio_seq, pf.contenido AS perdio_contenido
       FROM gcc_world.gd_enfrentamientos e
       JOIN gcc_world.gd_fuentes gf ON gf.id = e.ganadora_fuente_id
       JOIN gcc_world.gd_fuentes pf ON pf.id = e.perdedora_fuente_id
      WHERE e.problematica_id = $1
      ORDER BY e.created_at ASC`,
    [problematicaId],
  );
  return rows.map((r: any) => ({ ...r, nomenclatura: enfrentamientoRef(ref, r.gano_seq, r.perdio_seq) }));
}

// ── Códigos ───────────────────────────────────────────────────────────────────
/** unidades: [{kind:'premisa', fuenteId}] | [{kind:'enfrentamiento', enfrentamientoId}] */
export async function crearCodigo(
  problematicaId: number,
  texto: string,
  unidades: { kind: 'premisa' | 'enfrentamiento'; id: number }[],
) {
  await ensureGestionDatosTables();
  if (!unidades?.length) throw new Error('Un código requiere al menos una premisa.');
  const { rows } = await pool.query(
    `INSERT INTO gcc_world.gd_codigos (problematica_id, texto) VALUES ($1, $2) RETURNING *`,
    [problematicaId, (texto || '').trim()],
  );
  const codigo = rows[0];
  for (const u of unidades) {
    if (u.kind === 'premisa') {
      await pool.query(
        `INSERT INTO gcc_world.gd_codigo_unidades (codigo_id, unidad_kind, fuente_id) VALUES ($1, 'premisa', $2)`,
        [codigo.id, u.id],
      );
    } else {
      await pool.query(
        `INSERT INTO gcc_world.gd_codigo_unidades (codigo_id, unidad_kind, enfrentamiento_id) VALUES ($1, 'enfrentamiento', $2)`,
        [codigo.id, u.id],
      );
    }
  }
  return codigo;
}

export async function updateCodigo(id: number, texto?: string, verificado?: boolean) {
  await ensureGestionDatosTables();
  const sets: string[] = [];
  const params: any[] = [];
  if (texto != null) { sets.push(`texto = $${params.length + 1}`); params.push(texto.trim()); }
  if (verificado != null) { sets.push(`verificado = $${params.length + 1}`); params.push(!!verificado); }
  if (!sets.length) return;
  params.push(id);
  await pool.query(`UPDATE gcc_world.gd_codigos SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
}

export async function deleteCodigo(id: number) {
  await ensureGestionDatosTables();
  await pool.query(`DELETE FROM gcc_world.gd_codigos WHERE id = $1`, [id]);
}

export async function listCodigos(problematicaId: number) {
  await ensureGestionDatosTables();
  const ref = await getProblematicaRef(problematicaId);
  const { rows } = await pool.query(
    `SELECT id, texto, verificado, created_at FROM gcc_world.gd_codigos
      WHERE problematica_id = $1 ORDER BY created_at ASC`,
    [problematicaId],
  );
  const out = [];
  for (const c of rows) {
    const us = await codigoUnidades(c.id);
    const { rows: eventos } = await pool.query(
      `SELECT id, titulo, url, created_at FROM gcc_world.gd_codigo_eventos WHERE codigo_id = $1 ORDER BY created_at ASC`,
      [c.id],
    );
    out.push({ ...c, nomenclatura: codigoRef(ref, us), unidades: us, eventos });
  }
  return out;
}

export async function addCodigoEvento(codigoId: number, titulo: string, url: string) {
  await ensureGestionDatosTables();
  const { rows } = await pool.query(
    `INSERT INTO gcc_world.gd_codigo_eventos (codigo_id, titulo, url) VALUES ($1, $2, $3) RETURNING *`,
    [codigoId, titulo.trim(), (url || '').trim()],
  );
  return rows[0];
}

export async function deleteCodigoEvento(id: number) {
  await ensureGestionDatosTables();
  await pool.query(`DELETE FROM gcc_world.gd_codigo_eventos WHERE id = $1`, [id]);
}

// ── Categorías ────────────────────────────────────────────────────────────────
export async function listCategorias(problematicaId: number) {
  await ensureGestionDatosTables();
  const ref = await getProblematicaRef(problematicaId);
  const { rows } = await pool.query(
    `SELECT id, seq, nombre, created_at FROM gcc_world.gd_categorias
      WHERE problematica_id = $1 ORDER BY seq ASC`,
    [problematicaId],
  );
  const out = [];
  for (const c of rows) {
    const { rows: codigos } = await pool.query(
      `SELECT gc.codigo_id AS id, cod.verificado
         FROM gcc_world.gd_categoria_codigos gc
         JOIN gcc_world.gd_codigos cod ON cod.id = gc.codigo_id
        WHERE gc.categoria_id = $1
        ORDER BY gc.id ASC`,
      [c.id],
    );
    const codigoRefs: string[] = [];
    for (const cod of codigos) codigoRefs.push(await codigoRefById(cod.id, ref));
    out.push({ ...c, nomenclatura: categoriaRef(c.seq, codigoRefs), codigos: codigos.map((x: any, i: number) => ({ ...x, nomenclatura: codigoRefs[i] })) });
  }
  return out;
}

export async function crearCategoria(problematicaId: number, nombre: string, codigoIds: number[]) {
  await ensureGestionDatosTables();
  // Solo se agrupan códigos VERIFICADOS.
  if (codigoIds?.length) {
    const { rows } = await pool.query(
      `SELECT id, verificado FROM gcc_world.gd_codigos WHERE id = ANY($1::int[]) AND problematica_id = $2`,
      [codigoIds, problematicaId],
    );
    if (rows.some((r: any) => !r.verificado)) throw new Error('Solo se pueden categorizar códigos verificados.');
  }
  const { rows: seqRows } = await pool.query(
    `SELECT COALESCE(MAX(seq), 0) + 1 AS next FROM gcc_world.gd_categorias WHERE problematica_id = $1`,
    [problematicaId],
  );
  const seq = Number(seqRows[0].next);
  const { rows } = await pool.query(
    `INSERT INTO gcc_world.gd_categorias (problematica_id, seq, nombre) VALUES ($1, $2, $3) RETURNING *`,
    [problematicaId, seq, (nombre || '').trim()],
  );
  const cat = rows[0];
  for (const cid of codigoIds || []) {
    await pool.query(
      `INSERT INTO gcc_world.gd_categoria_codigos (categoria_id, codigo_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [cat.id, cid],
    );
  }
  return cat;
}

export async function updateCategoria(id: number, nombre: string) {
  await ensureGestionDatosTables();
  await pool.query(`UPDATE gcc_world.gd_categorias SET nombre = $1 WHERE id = $2`, [(nombre || '').trim(), id]);
}

export async function deleteCategoria(id: number) {
  await ensureGestionDatosTables();
  await pool.query(`DELETE FROM gcc_world.gd_categorias WHERE id = $1`, [id]);
}

export async function setCategoriaCodigo(categoriaId: number, codigoId: number, add: boolean) {
  await ensureGestionDatosTables();
  if (add) {
    const { rows } = await pool.query(`SELECT verificado FROM gcc_world.gd_codigos WHERE id = $1`, [codigoId]);
    if (!rows[0]?.verificado) throw new Error('Solo se pueden categorizar códigos verificados.');
    await pool.query(
      `INSERT INTO gcc_world.gd_categoria_codigos (categoria_id, codigo_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [categoriaId, codigoId],
    );
  } else {
    await pool.query(`DELETE FROM gcc_world.gd_categoria_codigos WHERE categoria_id = $1 AND codigo_id = $2`, [categoriaId, codigoId]);
  }
}

// ── Fase B: Situaciones (lista global) ────────────────────────────────────────
export async function listSituaciones() {
  await ensureGestionDatosTables();
  const { rows } = await pool.query(`SELECT id, nombre FROM gcc_world.gd_situaciones ORDER BY nombre ASC`);
  return rows;
}
export async function createSituacion(nombre: string) {
  await ensureGestionDatosTables();
  const { rows } = await pool.query(`INSERT INTO gcc_world.gd_situaciones (nombre) VALUES ($1) RETURNING *`, [nombre.trim()]);
  return rows[0];
}
export async function updateSituacion(id: number, nombre: string) {
  await ensureGestionDatosTables();
  await pool.query(`UPDATE gcc_world.gd_situaciones SET nombre = $1 WHERE id = $2`, [nombre.trim(), id]);
}
export async function deleteSituacion(id: number) {
  await ensureGestionDatosTables();
  await pool.query(`DELETE FROM gcc_world.gd_situaciones WHERE id = $1`, [id]);
}

// ── Fase B/C: Materias (lista global) ─────────────────────────────────────────
export async function listMaterias() {
  await ensureGestionDatosTables();
  const { rows } = await pool.query(`SELECT id, nombre FROM gcc_world.gd_materias ORDER BY nombre ASC`);
  return rows;
}
export async function createMateria(nombre: string) {
  await ensureGestionDatosTables();
  const { rows } = await pool.query(`INSERT INTO gcc_world.gd_materias (nombre) VALUES ($1) RETURNING *`, [nombre.trim()]);
  return rows[0];
}
export async function updateMateria(id: number, nombre: string) {
  await ensureGestionDatosTables();
  await pool.query(`UPDATE gcc_world.gd_materias SET nombre = $1 WHERE id = $2`, [nombre.trim(), id]);
}
export async function deleteMateria(id: number) {
  await ensureGestionDatosTables();
  await pool.query(`DELETE FROM gcc_world.gd_materias WHERE id = $1`, [id]);
}

// ── Fase B: Piezas (SOLO visualización aquí; las crea el sistema de metodología) ──
/** Nomenclatura base de una pieza = categoría del 1er código (o su ref de código). */
async function piezaBaseNomencl(codigoIds: number[], ref: string): Promise<string> {
  if (!codigoIds.length) return '';
  const first = codigoIds[0];
  // ¿Está el código en alguna categoría?
  const { rows } = await pool.query(
    `SELECT c.seq FROM gcc_world.gd_categoria_codigos gc
       JOIN gcc_world.gd_categorias c ON c.id = gc.categoria_id
      WHERE gc.codigo_id = $1 ORDER BY c.seq ASC LIMIT 1`,
    [first],
  );
  const codRef = await codigoRefById(first, ref);
  if (rows[0]) return categoriaRef(Number(rows[0].seq), [codRef]);
  return codRef;
}

export async function listPiezas(problematicaId: number) {
  await ensureGestionDatosTables();
  const ref = await getProblematicaRef(problematicaId);
  const { rows } = await pool.query(
    `SELECT id, tipo, estado, created_at FROM gcc_world.gd_piezas WHERE problematica_id = $1 ORDER BY created_at ASC`,
    [problematicaId],
  );
  const out = [];
  for (const p of rows) {
    const { rows: cods } = await pool.query(`SELECT codigo_id FROM gcc_world.gd_pieza_codigos WHERE pieza_id = $1 ORDER BY id ASC`, [p.id]);
    const { rows: vars } = await pool.query(`SELECT id, factor, nombre, tipo_var, restricciones FROM gcc_world.gd_pieza_variables WHERE pieza_id = $1 ORDER BY id ASC`, [p.id]);
    const codigoIds = cods.map((c: any) => c.codigo_id);
    out.push({ ...p, nomenclatura: piezaRef(p.tipo as PiezaTipo, await piezaBaseNomencl(codigoIds, ref)), codigoIds, variables: vars });
  }
  return out;
}

/** Crear pieza (para el futuro sistema de metodología condiciológica). */
export async function createPieza(problematicaId: number, tipo: PiezaTipo, codigoIds: number[], variables: { factor: string; nombre: string; tipo_var?: string; restricciones?: any }[]) {
  await ensureGestionDatosTables();
  const { rows } = await pool.query(`INSERT INTO gcc_world.gd_piezas (problematica_id, tipo) VALUES ($1, $2) RETURNING *`, [problematicaId, tipo]);
  const pieza = rows[0];
  for (const cid of codigoIds || []) await pool.query(`INSERT INTO gcc_world.gd_pieza_codigos (pieza_id, codigo_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [pieza.id, cid]);
  for (const v of variables || []) {
    await pool.query(
      `INSERT INTO gcc_world.gd_pieza_variables (pieza_id, factor, nombre, tipo_var, restricciones) VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [pieza.id, v.factor, v.nombre, v.tipo_var || 'fija', JSON.stringify(v.restricciones || {})],
    );
  }
  return pieza;
}

export async function deletePieza(id: number) {
  await ensureGestionDatosTables();
  await pool.query(`DELETE FROM gcc_world.gd_piezas WHERE id = $1`, [id]);
}

/** Crea una pieza VACÍA (estado incompleta) — la usa el sistema Metodología Condiciológica
 *  al generar una tarea; se completa luego en Gestión de Condiciones. */
export async function createEmptyPieza(problematicaId: number, tipo: PiezaTipo = 'revision') {
  await ensureGestionDatosTables();
  const { rows } = await pool.query(
    `INSERT INTO gcc_world.gd_piezas (problematica_id, tipo, estado) VALUES ($1, $2, 'incompleta') RETURNING *`,
    [problematicaId, tipo],
  );
  return rows[0];
}

export async function setPiezaEstado(id: number, estado: 'incompleta' | 'completa') {
  await ensureGestionDatosTables();
  await pool.query(`UPDATE gcc_world.gd_piezas SET estado = $1 WHERE id = $2`, [estado, id]);
}

// ── Lectores para Metodología Condiciológica (Reconocer) ──────────────────────
/** Todos los códigos VERIFICADOS (de todas las problemáticas), con su referencia. */
export async function listVerifiedCodigos() {
  await ensureGestionDatosTables();
  const { rows } = await pool.query(
    `SELECT c.id, c.texto, c.problematica_id, pr.ref AS problematica_ref, pr.name AS problematica_name
       FROM gcc_world.gd_codigos c
       JOIN gcc_world.gd_problematicas pr ON pr.id = c.problematica_id
      WHERE c.verificado = TRUE
      ORDER BY pr.ref ASC, c.created_at ASC`,
  );
  const out = [];
  for (const c of rows) {
    const us = await codigoUnidades(c.id);
    out.push({ id: c.id, texto: c.texto, problematica_id: c.problematica_id, problematica_ref: c.problematica_ref, problematica_name: c.problematica_name, nomenclatura: codigoRef(c.problematica_ref, us) });
  }
  return out;
}

/** Detalle de un código para la revisión (Reconocer): premisas asociadas con sus pesos,
 *  y premisas de enfrentamiento. */
export async function getCodigoDetalle(codigoId: number) {
  await ensureGestionDatosTables();
  const { rows: cRows } = await pool.query(
    `SELECT c.id, c.texto, c.verificado, c.problematica_id, pr.ref
       FROM gcc_world.gd_codigos c JOIN gcc_world.gd_problematicas pr ON pr.id = c.problematica_id
      WHERE c.id = $1`, [codigoId]);
  const c = cRows[0];
  if (!c) return null;
  const ref = c.ref;
  const { rows: units } = await pool.query(
    `SELECT unidad_kind, fuente_id, enfrentamiento_id FROM gcc_world.gd_codigo_unidades WHERE codigo_id = $1 ORDER BY id ASC`, [codigoId]);
  const premisas = [];
  const enfrentadas = [];
  for (const u of units) {
    if (u.unidad_kind === 'premisa') {
      const { rows: fr } = await pool.query(
        `SELECT id, seq, contenido, credibilidad::float AS credibilidad, credibilidad_efectiva::float AS credibilidad_efectiva
           FROM gcc_world.gd_fuentes WHERE id = $1`, [u.fuente_id]);
      const f = fr[0];
      if (f) {
        const pesos = await listPesosDePremisa(f.id); // [{peso_nomenclatura, peso_contenido, peso_credibilidad, cred_antes, cred_despues, modo?}]
        premisas.push({ id: f.id, nomenclatura: fuentePremisaRef(ref, f.seq), contenido: f.contenido, credibilidad: f.credibilidad, credibilidad_efectiva: f.credibilidad_efectiva, pesos });
      }
    } else {
      const { rows: er } = await pool.query(
        `SELECT e.id, e.texto, gf.seq AS gano_seq, gf.contenido AS gano_contenido, pf.seq AS perdio_seq, pf.contenido AS perdio_contenido
           FROM gcc_world.gd_enfrentamientos e
           JOIN gcc_world.gd_fuentes gf ON gf.id = e.ganadora_fuente_id
           JOIN gcc_world.gd_fuentes pf ON pf.id = e.perdedora_fuente_id
          WHERE e.id = $1`, [u.enfrentamiento_id]);
      const e = er[0];
      if (e) enfrentadas.push({ id: e.id, nomenclatura: enfrentamientoRef(ref, e.gano_seq, e.perdio_seq), texto: e.texto, gano_seq: e.gano_seq, gano_contenido: e.gano_contenido, perdio_seq: e.perdio_seq, perdio_contenido: e.perdio_contenido });
    }
  }
  return { id: c.id, texto: c.texto, verificado: c.verificado, nomenclatura: codigoRef(ref, await codigoUnidades(c.id)), premisas, enfrentadas };
}

// ── Fase B: Rompecabezas ──────────────────────────────────────────────────────
export async function listRompecabezas(problematicaId: number) {
  await ensureGestionDatosTables();
  const { rows } = await pool.query(
    `SELECT r.id, r.nombre, r.situacion_id, s.nombre AS situacion_nombre, r.created_at
       FROM gcc_world.gd_rompecabezas r
       LEFT JOIN gcc_world.gd_situaciones s ON s.id = r.situacion_id
      WHERE r.problematica_id = $1 ORDER BY r.created_at ASC`,
    [problematicaId],
  );
  const out = [];
  for (const r of rows) {
    const { rows: piezas } = await pool.query(`SELECT pieza_id FROM gcc_world.gd_rompecabezas_piezas WHERE rompecabezas_id = $1 ORDER BY id ASC`, [r.id]);
    out.push({ ...r, piezaIds: piezas.map((p: any) => p.pieza_id) });
  }
  return out;
}

export async function crearRompecabezas(problematicaId: number, nombre: string, situacionId: number | null, piezaIds: number[]) {
  await ensureGestionDatosTables();
  if (!nombre?.trim()) throw new Error('El nombre del rompecabezas es requerido.');
  const { rows } = await pool.query(
    `INSERT INTO gcc_world.gd_rompecabezas (problematica_id, nombre, situacion_id) VALUES ($1, $2, $3) RETURNING *`,
    [problematicaId, nombre.trim(), situacionId || null],
  );
  const r = rows[0];
  for (const pid of piezaIds || []) await pool.query(`INSERT INTO gcc_world.gd_rompecabezas_piezas (rompecabezas_id, pieza_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [r.id, pid]);
  return r;
}

export async function updateRompecabezas(id: number, nombre?: string, situacionId?: number | null, piezaIds?: number[]) {
  await ensureGestionDatosTables();
  const sets: string[] = [];
  const params: any[] = [];
  if (nombre != null) { sets.push(`nombre = $${params.length + 1}`); params.push(nombre.trim()); }
  if (situacionId !== undefined) { sets.push(`situacion_id = $${params.length + 1}`); params.push(situacionId || null); }
  if (sets.length) { params.push(id); await pool.query(`UPDATE gcc_world.gd_rompecabezas SET ${sets.join(', ')} WHERE id = $${params.length}`, params); }
  if (piezaIds) {
    await pool.query(`DELETE FROM gcc_world.gd_rompecabezas_piezas WHERE rompecabezas_id = $1`, [id]);
    for (const pid of piezaIds) await pool.query(`INSERT INTO gcc_world.gd_rompecabezas_piezas (rompecabezas_id, pieza_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [id, pid]);
  }
}

export async function deleteRompecabezas(id: number) {
  await ensureGestionDatosTables();
  await pool.query(`DELETE FROM gcc_world.gd_rompecabezas WHERE id = $1`, [id]);
}

// ── Fase B: Subtemas ──────────────────────────────────────────────────────────
export async function listSubtemas(problematicaId: number) {
  await ensureGestionDatosTables();
  const { rows } = await pool.query(
    `SELECT id, titulo, created_at FROM gcc_world.gd_subtemas WHERE problematica_id = $1 ORDER BY created_at ASC`,
    [problematicaId],
  );
  const out = [];
  for (const s of rows) {
    const { rows: hips } = await pool.query(`SELECT id, texto, orden FROM gcc_world.gd_subtema_hipotesis WHERE subtema_id = $1 ORDER BY orden ASC, id ASC`, [s.id]);
    const { rows: romps } = await pool.query(
      `SELECT sr.rompecabezas_id AS id, r.nombre, sr.orden
         FROM gcc_world.gd_subtema_rompecabezas sr
         JOIN gcc_world.gd_rompecabezas r ON r.id = sr.rompecabezas_id
        WHERE sr.subtema_id = $1 ORDER BY sr.orden ASC, sr.id ASC`,
      [s.id],
    );
    out.push({ ...s, hipotesis: hips, rompecabezas: romps });
  }
  return out;
}

export async function crearSubtema(problematicaId: number, titulo: string, hipotesis: string[], rompecabezasIds: number[]) {
  await ensureGestionDatosTables();
  if (!titulo?.trim()) throw new Error('El título del subtema es requerido.');
  const { rows } = await pool.query(`INSERT INTO gcc_world.gd_subtemas (problematica_id, titulo) VALUES ($1, $2) RETURNING *`, [problematicaId, titulo.trim()]);
  const s = rows[0];
  await replaceSubtemaChildren(s.id, hipotesis, rompecabezasIds);
  return s;
}

export async function updateSubtema(id: number, titulo?: string, hipotesis?: string[], rompecabezasIds?: number[]) {
  await ensureGestionDatosTables();
  if (titulo != null) await pool.query(`UPDATE gcc_world.gd_subtemas SET titulo = $1 WHERE id = $2`, [titulo.trim(), id]);
  if (hipotesis || rompecabezasIds) await replaceSubtemaChildren(id, hipotesis, rompecabezasIds);
}

async function replaceSubtemaChildren(subtemaId: number, hipotesis?: string[], rompecabezasIds?: number[]) {
  if (hipotesis) {
    await pool.query(`DELETE FROM gcc_world.gd_subtema_hipotesis WHERE subtema_id = $1`, [subtemaId]);
    let i = 0;
    for (const h of hipotesis) {
      if (!h?.trim()) continue;
      await pool.query(`INSERT INTO gcc_world.gd_subtema_hipotesis (subtema_id, texto, orden) VALUES ($1, $2, $3)`, [subtemaId, h.trim(), i++]);
    }
  }
  if (rompecabezasIds) {
    await pool.query(`DELETE FROM gcc_world.gd_subtema_rompecabezas WHERE subtema_id = $1`, [subtemaId]);
    let i = 0;
    for (const rid of rompecabezasIds) await pool.query(`INSERT INTO gcc_world.gd_subtema_rompecabezas (subtema_id, rompecabezas_id, orden) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [subtemaId, rid, i++]);
  }
}

export async function deleteSubtema(id: number) {
  await ensureGestionDatosTables();
  await pool.query(`DELETE FROM gcc_world.gd_subtemas WHERE id = $1`, [id]);
}

// ── Fase C: Temas ─────────────────────────────────────────────────────────────
export async function listTemas(problematicaId: number) {
  await ensureGestionDatosTables();
  const { rows } = await pool.query(
    `SELECT id, titulo, prosa, created_at FROM gcc_world.gd_temas WHERE problematica_id = $1 ORDER BY created_at ASC`,
    [problematicaId],
  );
  const out = [];
  for (const t of rows) {
    const { rows: subs } = await pool.query(
      `SELECT ts.subtema_id AS id, s.titulo FROM gcc_world.gd_tema_subtemas ts
         JOIN gcc_world.gd_subtemas s ON s.id = ts.subtema_id
        WHERE ts.tema_id = $1 ORDER BY ts.orden ASC, ts.id ASC`, [t.id]);
    const { rows: mats } = await pool.query(
      `SELECT tm.materia_id AS id, m.nombre FROM gcc_world.gd_tema_materias tm
         JOIN gcc_world.gd_materias m ON m.id = tm.materia_id WHERE tm.tema_id = $1 ORDER BY tm.id ASC`, [t.id]);
    const { rows: probs } = await pool.query(
      `SELECT tp.problema_id AS id, p.title FROM gcc_world.gd_tema_problemas tp
         JOIN gcc_world.gd_problemas p ON p.id = tp.problema_id WHERE tp.tema_id = $1 ORDER BY tp.id ASC`, [t.id]);
    out.push({ ...t, subtemas: subs, materias: mats, problemas: probs });
  }
  return out;
}

async function replaceTemaChildren(temaId: number, subtemaIds?: number[], materiaIds?: number[], problemaIds?: number[]) {
  if (subtemaIds) {
    await pool.query(`DELETE FROM gcc_world.gd_tema_subtemas WHERE tema_id = $1`, [temaId]);
    let i = 0;
    for (const sid of subtemaIds) await pool.query(`INSERT INTO gcc_world.gd_tema_subtemas (tema_id, subtema_id, orden) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [temaId, sid, i++]);
  }
  if (materiaIds) {
    await pool.query(`DELETE FROM gcc_world.gd_tema_materias WHERE tema_id = $1`, [temaId]);
    for (const mid of materiaIds) await pool.query(`INSERT INTO gcc_world.gd_tema_materias (tema_id, materia_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [temaId, mid]);
  }
  if (problemaIds) {
    await pool.query(`DELETE FROM gcc_world.gd_tema_problemas WHERE tema_id = $1`, [temaId]);
    for (const pid of problemaIds) await pool.query(`INSERT INTO gcc_world.gd_tema_problemas (tema_id, problema_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [temaId, pid]);
  }
}

export async function crearTema(problematicaId: number, titulo: string, prosa: string, subtemaIds: number[], materiaIds: number[], problemaIds: number[]) {
  await ensureGestionDatosTables();
  if (!titulo?.trim()) throw new Error('El título del tema es requerido.');
  const { rows } = await pool.query(`INSERT INTO gcc_world.gd_temas (problematica_id, titulo, prosa) VALUES ($1, $2, $3) RETURNING *`, [problematicaId, titulo.trim(), (prosa || '').trim()]);
  const t = rows[0];
  await replaceTemaChildren(t.id, subtemaIds, materiaIds, problemaIds);
  return t;
}

export async function updateTema(id: number, titulo?: string, prosa?: string, subtemaIds?: number[], materiaIds?: number[], problemaIds?: number[]) {
  await ensureGestionDatosTables();
  const sets: string[] = [];
  const params: any[] = [];
  if (titulo != null) { sets.push(`titulo = $${params.length + 1}`); params.push(titulo.trim()); }
  if (prosa != null) { sets.push(`prosa = $${params.length + 1}`); params.push(prosa.trim()); }
  if (sets.length) { params.push(id); await pool.query(`UPDATE gcc_world.gd_temas SET ${sets.join(', ')} WHERE id = $${params.length}`, params); }
  if (subtemaIds || materiaIds || problemaIds) await replaceTemaChildren(id, subtemaIds, materiaIds, problemaIds);
}

export async function deleteTema(id: number) {
  await ensureGestionDatosTables();
  await pool.query(`DELETE FROM gcc_world.gd_temas WHERE id = $1`, [id]);
}

// ── Grafo "universo" de una problemática ──────────────────────────────────────
export async function getProblematicaGraph(problematicaId: number): Promise<GdGraph> {
  await ensureGestionDatosTables();
  const ref = await getProblematicaRef(problematicaId);
  const nodes: GdGraph['nodes'] = [];
  const edges: GdGraph['edges'] = [];

  // Problemas (nodos sueltos en Fase A; se conectan a temas en Fase C).
  const { rows: problemas } = await pool.query(
    `SELECT id, title FROM gcc_world.gd_problemas WHERE problematica_id = $1 ORDER BY created_at ASC`,
    [problematicaId],
  );
  for (const p of problemas) nodes.push({ key: gdKey('problema', p.id), type: 'problema', id: p.id, title: p.title });

  // Fuentes.
  const { rows: fuentes } = await pool.query(
    `SELECT id, tipo_logica, contenido, seq, credibilidad_efectiva::float AS cred
       FROM gcc_world.gd_fuentes WHERE problematica_id = $1 ORDER BY created_at ASC`,
    [problematicaId],
  );
  for (const f of fuentes) {
    if (f.tipo_logica === 'premisa') {
      nodes.push({
        key: gdKey('fuente_premisa', f.id), type: 'fuente_premisa', id: f.id,
        title: fuentePremisaRef(ref, f.seq), subtitle: f.contenido, credibilidad: Number(f.cred),
      });
    } else {
      nodes.push({
        key: gdKey('fuente_peso', f.id), type: 'fuente_peso', id: f.id,
        title: fuentePesoRef(f.seq), subtitle: f.contenido, credibilidad: Number(f.cred),
      });
    }
  }

  // Pesos aplicados → aristas peso → premisa.
  const fuenteIds = fuentes.map((f: any) => f.id);
  if (fuenteIds.length) {
    const { rows: pesos } = await pool.query(
      `SELECT premisa_fuente_id, peso_fuente_id FROM gcc_world.gd_fuente_pesos WHERE premisa_fuente_id = ANY($1::int[])`,
      [fuenteIds],
    );
    for (const p of pesos) {
      edges.push({ source: gdKey('fuente_peso', p.peso_fuente_id), target: gdKey('fuente_premisa', p.premisa_fuente_id), kind: 'peso' });
    }
  }

  // Enfrentamientos.
  const { rows: enfs } = await pool.query(
    `SELECT e.id, e.ganadora_fuente_id, e.perdedora_fuente_id, gf.seq AS gano_seq, pf.seq AS perdio_seq
       FROM gcc_world.gd_enfrentamientos e
       JOIN gcc_world.gd_fuentes gf ON gf.id = e.ganadora_fuente_id
       JOIN gcc_world.gd_fuentes pf ON pf.id = e.perdedora_fuente_id
      WHERE e.problematica_id = $1 ORDER BY e.created_at ASC`,
    [problematicaId],
  );
  for (const e of enfs) {
    nodes.push({ key: gdKey('enfrentamiento', e.id), type: 'enfrentamiento', id: e.id, title: enfrentamientoRef(ref, e.gano_seq, e.perdio_seq) });
    edges.push({ source: gdKey('fuente_premisa', e.ganadora_fuente_id), target: gdKey('enfrentamiento', e.id), kind: 'enfrenta' });
    edges.push({ source: gdKey('fuente_premisa', e.perdedora_fuente_id), target: gdKey('enfrentamiento', e.id), kind: 'enfrenta' });
  }

  // Códigos (+ aristas desde sus unidades).
  const { rows: codigos } = await pool.query(
    `SELECT id, verificado FROM gcc_world.gd_codigos WHERE problematica_id = $1 ORDER BY created_at ASC`,
    [problematicaId],
  );
  for (const c of codigos) {
    const us = await codigoUnidades(c.id);
    nodes.push({ key: gdKey('codigo', c.id), type: 'codigo', id: c.id, title: codigoRef(ref, us), verificado: !!c.verificado });
    const { rows: rawUnits } = await pool.query(
      `SELECT unidad_kind, fuente_id, enfrentamiento_id FROM gcc_world.gd_codigo_unidades WHERE codigo_id = $1`,
      [c.id],
    );
    for (const u of rawUnits) {
      const src = u.unidad_kind === 'premisa' ? gdKey('fuente_premisa', u.fuente_id) : gdKey('enfrentamiento', u.enfrentamiento_id);
      edges.push({ source: src, target: gdKey('codigo', c.id), kind: 'compone' });
    }
  }

  // Categorías (+ aristas desde sus códigos).
  const { rows: cats } = await pool.query(
    `SELECT id, seq FROM gcc_world.gd_categorias WHERE problematica_id = $1 ORDER BY seq ASC`,
    [problematicaId],
  );
  for (const cat of cats) {
    const { rows: codRefsRows } = await pool.query(
      `SELECT codigo_id FROM gcc_world.gd_categoria_codigos WHERE categoria_id = $1 ORDER BY id ASC`,
      [cat.id],
    );
    const codigoRefs: string[] = [];
    for (const r of codRefsRows) codigoRefs.push(await codigoRefById(r.codigo_id, ref));
    nodes.push({ key: gdKey('categoria', cat.id), type: 'categoria', id: cat.id, title: categoriaRef(cat.seq, codigoRefs) });
    for (const r of codRefsRows) edges.push({ source: gdKey('codigo', r.codigo_id), target: gdKey('categoria', cat.id), kind: 'agrupa' });
  }

  // Piezas (+ aristas desde sus códigos).
  const { rows: piezas } = await pool.query(
    `SELECT id, tipo, estado FROM gcc_world.gd_piezas WHERE problematica_id = $1 ORDER BY created_at ASC`,
    [problematicaId],
  );
  for (const pz of piezas) {
    const { rows: pcods } = await pool.query(`SELECT codigo_id FROM gcc_world.gd_pieza_codigos WHERE pieza_id = $1 ORDER BY id ASC`, [pz.id]);
    const codigoIds = pcods.map((r: any) => r.codigo_id);
    nodes.push({ key: gdKey('pieza', pz.id), type: 'pieza', id: pz.id, title: piezaRef(pz.tipo as PiezaTipo, await piezaBaseNomencl(codigoIds, ref)), incompleta: pz.estado !== 'completa' });
    for (const r of pcods) edges.push({ source: gdKey('codigo', r.codigo_id), target: gdKey('pieza', pz.id), kind: 'compone' });
  }

  // Rompecabezas (+ aristas desde sus piezas).
  const { rows: romps } = await pool.query(
    `SELECT id, nombre FROM gcc_world.gd_rompecabezas WHERE problematica_id = $1 ORDER BY created_at ASC`,
    [problematicaId],
  );
  for (const rc of romps) {
    nodes.push({ key: gdKey('rompecabezas', rc.id), type: 'rompecabezas', id: rc.id, title: rc.nombre });
    const { rows: rpiezas } = await pool.query(`SELECT pieza_id FROM gcc_world.gd_rompecabezas_piezas WHERE rompecabezas_id = $1`, [rc.id]);
    for (const r of rpiezas) edges.push({ source: gdKey('pieza', r.pieza_id), target: gdKey('rompecabezas', rc.id), kind: 'compone' });
  }

  // Subtemas (+ aristas desde sus rompecabezas).
  const { rows: subtemas } = await pool.query(
    `SELECT id, titulo FROM gcc_world.gd_subtemas WHERE problematica_id = $1 ORDER BY created_at ASC`,
    [problematicaId],
  );
  for (const st of subtemas) {
    nodes.push({ key: gdKey('subtema', st.id), type: 'subtema', id: st.id, title: st.titulo });
    const { rows: sromps } = await pool.query(`SELECT rompecabezas_id FROM gcc_world.gd_subtema_rompecabezas WHERE subtema_id = $1`, [st.id]);
    for (const r of sromps) edges.push({ source: gdKey('rompecabezas', r.rompecabezas_id), target: gdKey('subtema', st.id), kind: 'agrupa' });
  }

  // Temas (+ aristas desde sus subtemas y problemas asociados).
  const { rows: temas } = await pool.query(
    `SELECT id, titulo FROM gcc_world.gd_temas WHERE problematica_id = $1 ORDER BY created_at ASC`,
    [problematicaId],
  );
  for (const tm of temas) {
    nodes.push({ key: gdKey('tema', tm.id), type: 'tema', id: tm.id, title: tm.titulo });
    const { rows: tsubs } = await pool.query(`SELECT subtema_id FROM gcc_world.gd_tema_subtemas WHERE tema_id = $1`, [tm.id]);
    for (const r of tsubs) edges.push({ source: gdKey('subtema', r.subtema_id), target: gdKey('tema', tm.id), kind: 'agrupa' });
    const { rows: tprobs } = await pool.query(`SELECT problema_id FROM gcc_world.gd_tema_problemas WHERE tema_id = $1`, [tm.id]);
    for (const r of tprobs) edges.push({ source: gdKey('problema', r.problema_id), target: gdKey('tema', tm.id), kind: 'agrupa' });
  }

  return { nodes, edges };
}
