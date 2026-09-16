import type { Bloque, Celda, DocumentoPud } from '../tipos';
import { parsearEstrategias, lineas } from './estrategias';
import { celdaSemana, COLORES_FORMATO } from './documento';

/**
 * LA VISTA PREVIA DEL PUD EN PANTALLA. Dibuja el mismo modelo que el PDF y el
 * Word (`documento.ts`), así que lo que se ve es lo que se descarga. Es un
 * componente de servidor sin estado: el formato es papel, y aquí se enseña como
 * papel (hoja clara con sus colores propios, no con los tokens del tema).
 */

// Los colores son los del formato original (COLORES_FORMATO), nunca los del tema.
const DUA = COLORES_FORMATO.dua;
const C = COLORES_FORMATO;

const esEnlace = (t: string) => /^https?:\/\/\S+$/.test(t.trim());
const celda = 'border border-[#808080] px-1.5 py-1 align-top';

function Barra({ titulo, numero, color }: { titulo: string; numero?: string; color: string }) {
  return (
    <div className="py-1 text-center text-[11px] font-bold text-white" style={{ background: color }}>
      {numero ? `${numero}  ` : ''}
      {titulo}
    </div>
  );
}

/**
 * Tabla de celdas: `etiqueta` (gris, negrita), `titulo` (rojo, blanco, centrado en
 * vertical), `cursiva`, con `vinetas` o con una `imagen` centrada bajo el texto.
 */
function Tabla({ filas, anchos, minAlto }: { filas: Celda[][]; anchos?: number[]; minAlto?: number }) {
  return (
    <table className="w-full border-collapse text-[10px]" style={{ tableLayout: 'fixed' }}>
      <tbody>
        {filas.map((fila, i) => (
          <tr key={i}>
            {fila.map((c, j) => (
              <td
                key={j}
                style={{
                  width: anchos && anchos.length === fila.length ? `${anchos[j]}%` : undefined,
                  background: c.titulo ? C.barra : c.etiqueta ? C.etiqueta : undefined,
                  color: c.titulo ? '#fff' : undefined,
                  height: minAlto,
                }}
                className={`border border-[#808080] px-1.5 py-1 whitespace-pre-line ${c.titulo ? 'align-middle text-center font-bold' : 'align-top'} ${c.etiqueta ? 'font-bold' : ''} ${c.centrado ? 'text-center' : ''} ${c.cursiva ? 'italic' : ''}`}
              >
                {c.vinetas ? (
                  <ul className="list-disc pl-4">
                    {c.vinetas.map((v, k) => (
                      <li key={k}>{v}</li>
                    ))}
                  </ul>
                ) : (
                  c.texto
                )}
                {c.imagen && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.imagen} alt="" className="mx-auto mt-1 h-10 w-auto max-w-full object-contain" />
                )}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function BloqueVista({ b, color }: { b: Bloque; color: string }) {
  const titulo = `${b.numero ? b.numero + '  ' : ''}${b.titulo}`;
  if (b.tipo === 'lateral') {
    // Título rojo a toda la altura; etiquetas grises solo en su franja y los iconos sobre blanco debajo.
    const n = b.columnas.length;
    return (
      <section className="mt-2.5">
        <table className="w-full border-collapse text-[10px]" style={{ tableLayout: 'fixed' }}>
          <tbody>
            <tr>
              <td rowSpan={2} className="border border-[#808080] px-1.5 py-1 text-center align-middle font-bold text-white" style={{ width: '16%', background: C.barra }}>
                {titulo}
              </td>
              {b.columnas.map((c) => (
                <td key={c.texto} className="border border-[#808080] px-1.5 py-1 text-center align-middle font-bold" style={{ width: `${84 / n}%`, background: C.etiqueta }}>
                  {c.texto}
                </td>
              ))}
            </tr>
            <tr>
              {b.columnas.map((c) => (
                <td key={c.texto} className="border border-[#808080] px-1.5 py-1.5 text-center align-middle" style={{ height: 52 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.icono} alt="" className="mx-auto h-10 w-auto max-w-full object-contain" />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </section>
    );
  }
  if (b.tipo === 'lateral-texto')
    return (
      <section className="mt-2.5">
        <Tabla filas={[[{ texto: titulo, titulo: true }, { texto: b.texto }]]} anchos={[16, 84]} minAlto={(b.altoMinMm ?? 7) * 3.8} />
      </section>
    );
  return (
    <section className="mt-2.5">
      <Barra titulo={b.titulo} numero={b.numero} color={color} />
      {b.tipo === 'tabla' ? <Tabla filas={b.filas} anchos={b.anchos} minAlto={b.altoMinMm ? b.altoMinMm * 3.8 : undefined} /> : <Tabla filas={[[{ texto: b.texto }]]} minAlto={34} />}
    </section>
  );
}

function Fase({ titulo }: { titulo: string }) {
  return (
    <div className="mt-2 mb-1.5 flex items-stretch">
      <span className="border border-[#808080] px-1.5 py-0.5 text-[8.5px] font-bold uppercase" style={{ color: C.fase }}>
        {titulo}
      </span>
      {DUA.map((d) => (
        <span key={d.letra} className="ml-px flex w-4 items-center justify-center text-[8px] font-bold text-white" style={{ background: d.color }}>
          {d.letra}
        </span>
      ))}
    </div>
  );
}

const Enlace = ({ url }: { url: string }) => (
  <a href={url} target="_blank" rel="noreferrer" className="break-all underline" style={{ color: C.fase }}>
    {url}
  </a>
);

export function VistaPrevia({ doc }: { doc: DocumentoPud }) {
  const color = doc.colorCabecera;
  const inst = doc.institucion;
  const cols = doc.firmas.columnas;
  const anchosFirmas = cols.flatMap(() => [8, 100 / cols.length - 8]);
  return (
    <div className="mx-auto w-full max-w-[1400px] bg-white p-6 text-[10px] leading-snug text-black shadow" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
      {/* Cabecera: logos · líneas del negocio · año lectivo */}
      <div className="flex border border-[#808080]">
        <div className="flex w-[22%] items-center justify-center gap-2 border-r border-[#808080] px-2 py-1.5">
          {inst.logos.map((l, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={l} alt="" className="h-12 w-auto max-w-[80px] object-contain" />
          ))}
        </div>
        <div className="flex flex-1 flex-col items-center justify-center py-1.5 text-center">
          {inst.cabecera.map((l, i) => (
            <p key={i} className={l.estilo === 'grande' ? 'text-[17px] font-bold' : l.estilo === 'acento' ? 'text-[13px] font-semibold' : 'text-[12px]'} style={{ color: l.estilo === 'acento' ? C.acentoCabecera : C.gris }}>
              {l.texto}
            </p>
          ))}
        </div>
        <div className="w-[13%] border-l border-[#808080] text-center">
          <p className="py-1 text-[11px] font-bold" style={{ background: C.etiqueta }}>
            Año Lectivo
          </p>
          <p className="py-2 text-[11px]">{inst.anioLectivo}</p>
        </div>
      </div>
      <div className="mt-1.5 py-1.5 text-center text-[15px] font-bold text-white" style={{ background: color }}>
        {doc.tituloDocumento}
      </div>

      <section className="mt-2.5">
        <Barra titulo="DATOS INFORMATIVOS" numero="1." color={color} />
        <Tabla filas={[doc.datosInformativos[0]]} anchos={[16, 34, 18, 32]} />
        <Tabla filas={[doc.datosInformativos[1]]} anchos={[16, 34, 12, 20, 8, 10]} />
        <Tabla filas={[doc.datosInformativos[2]]} anchos={[16, 66, 8, 10]} />
        <Tabla filas={[doc.datosInformativos[3]]} anchos={[16, 10, 24, 50]} />
      </section>
      <section className="mt-2.5">
        <Barra titulo="TIEMPO" numero="2." color={color} />
        <Tabla filas={doc.tiempo} anchos={[13, 7, 20, 7, 11, 7, 11, 24]} />
      </section>

      {doc.previos.map((b, i) => (
        <BloqueVista key={i} b={b} color={color} />
      ))}

      {/* Planificación */}
      <section className="mt-2.5">
        <Barra titulo="PLANIFICACIÓN" numero={`${doc.numeroPlanificacion}.`} color={color} />
        <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
          <thead>
            <tr className="text-center font-bold" style={{ background: C.cabeceraTabla }}>
              <th rowSpan={2} className={celda} style={{ width: '8.5%' }}>N.º de semana y Fecha</th>
              <th rowSpan={2} className={celda} style={{ width: '12.5%' }}>Temas / Contenidos</th>
              <th rowSpan={2} className={celda} style={{ width: '12%' }}>Destrezas con criterio de desempeño</th>
              <th rowSpan={2} className={celda} style={{ width: '36%' }}>Estrategias Metodológica</th>
              <th rowSpan={2} className={celda} style={{ width: '14%' }}>Recursos</th>
              <th colSpan={2} className={celda}>Evaluación</th>
            </tr>
            <tr className="text-center font-bold" style={{ background: C.cabeceraTabla }}>
              <th className={celda} style={{ width: '8.5%' }}>Técnica</th>
              <th className={celda} style={{ width: '8.5%' }}>Instrumento</th>
            </tr>
          </thead>
          <tbody>
            {doc.semanas.length === 0 && (
              <tr>
                <td colSpan={7} className={`${celda} py-4 text-center text-[#8a8a8a]`}>
                  Todavía no hay planificaciones semanales generadas.
                </td>
              </tr>
            )}
            {doc.semanas.map((s) => {
              const cs = celdaSemana(s);
              const fases = parsearEstrategias(s.estrategias);
              return (
                <tr key={s.orden}>
                  <td className={celda}>
                    <p className="font-bold">{cs.titulo}</p>
                    <p>{cs.desde}</p>
                    <p>{cs.hasta}</p>
                  </td>
                  <td className={`${celda} whitespace-pre-line`}>
                    <p className="font-bold">Tema:</p>
                    <p>{s.tema}</p>
                    <p className="mt-3 font-bold">N.º de periodos:</p>
                    <p>{s.numeroPeriodos}</p>
                    <p className="mt-3 font-bold">Objetivos del tema:</p>
                    <p>{s.objetivosTema}</p>
                  </td>
                  <td className={celda}>
                    {s.destrezas.map((d) => (
                      <div key={d.codigo} className="mb-3">
                        <p>
                          {d.codigo} {d.descripcion}
                        </p>
                        {d.imagenUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={d.imagenUrl} alt="" className="mt-1 h-9 w-auto max-w-full object-contain" />
                        )}
                      </div>
                    ))}
                  </td>
                  <td className={celda}>
                    <p className="text-right text-[8.5px] font-bold">Ciclo de Aprendizaje: ACC</p>
                    <p className="text-right text-[8.5px] font-bold">Enfoque: DUA</p>
                    {fases.map((f, i) => (
                      <div key={i}>
                        {f.titulo && <Fase titulo={f.titulo} />}
                        {f.actividades.map((a, j) => (
                          <div key={j} className="mb-1.5">
                            <p>{esEnlace(a.texto) ? <Enlace url={a.texto} /> : a.texto}</p>
                            {a.vinetas.length > 0 && (
                              <ul className="list-disc pl-6">
                                {a.vinetas.map((v, k) => (
                                  <li key={k}>{esEnlace(v) ? <Enlace url={v} /> : v}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))}
                      </div>
                    ))}
                  </td>
                  <td className={celda}>
                    {lineas(s.recursos).map((l, i) => (
                      <p key={i}>{l}</p>
                    ))}
                  </td>
                  <td className={celda}>
                    {lineas(s.tecnica).map((l, i) => (
                      <p key={i} className="mb-1">
                        {l}
                      </p>
                    ))}
                  </td>
                  <td className={celda}>
                    {lineas(s.instrumento).map((l, i) => (
                      <p key={i} className="mb-1">
                        {l}
                      </p>
                    ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {doc.posteriores.map((b, i) => (
        <BloqueVista key={i} b={b} color={color} />
      ))}

      {/* Firmas: tres columnas con su casilla gris de etiqueta y su valor, como el original */}
      <section className="mt-2.5">
        <Barra titulo="FIRMAS DE RESPONSABILIDAD" numero={`${doc.numeroFirmas}.`} color={color} />
        <Tabla filas={[cols.map((c) => ({ texto: c.titulo, etiqueta: true, centrado: true }))]} anchos={cols.map(() => 100 / cols.length)} />
        <Tabla filas={[cols.flatMap((c) => [{ texto: c.cargo, etiqueta: true }, { texto: c.nombre, cursiva: true }])]} anchos={anchosFirmas} minAlto={26} />
        <Tabla filas={[cols.flatMap(() => [{ texto: 'Firma:', etiqueta: true }, { texto: '' }])]} anchos={anchosFirmas} minAlto={52} />
        <Tabla filas={[cols.flatMap((c) => [{ texto: 'Fecha:', etiqueta: true }, { texto: c.fecha }])]} anchos={anchosFirmas} minAlto={22} />
        {/* Registro de formato: media página, a la izquierda */}
        <div className="mt-3 w-1/2">
          <Tabla filas={[[{ texto: `REGISTRO DE FORMATO: ${doc.registro.titulo}`, titulo: true }]]} anchos={[100]} minAlto={22} />
          <Tabla filas={[[{ texto: 'Elaborado por', etiqueta: true, centrado: true }, { texto: 'Aprobado por', etiqueta: true, centrado: true }]]} anchos={[50, 50]} />
          <Tabla filas={[[{ texto: doc.registro.elaboradoPor.cargo, centrado: true }, { texto: doc.registro.aprobadoPor.cargo, centrado: true }]]} anchos={[50, 50]} />
          <Tabla filas={[[{ texto: '' }, { texto: '' }]]} anchos={[50, 50]} minAlto={34} />
          <Tabla filas={[[{ texto: doc.registro.elaboradoPor.nombre, centrado: true, cursiva: true }, { texto: doc.registro.aprobadoPor.nombre, centrado: true, cursiva: true }]]} anchos={[50, 50]} />
          <Tabla filas={[[{ texto: 'Fecha:', etiqueta: true }, { texto: doc.registro.elaboradoPor.fecha, centrado: true }, { texto: 'Fecha:', etiqueta: true }, { texto: doc.registro.aprobadoPor.fecha, centrado: true }]]} anchos={[14, 36, 14, 36]} />
        </div>
      </section>
    </div>
  );
}
