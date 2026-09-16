import type { Bloque, Celda, DocumentoPud } from '../tipos';
import { parsearEstrategias, lineas } from './estrategias';
import { celdaSemana } from './documento';

/**
 * LA VISTA PREVIA DEL PUD EN PANTALLA. Dibuja el mismo modelo que el PDF
 * (`documento.ts`), así que lo que se ve es lo que se descarga. Es un componente
 * de servidor sin estado: el formato es papel, y aquí se enseña como papel (hoja
 * clara con sus colores propios, no con los tokens del tema de la aplicación).
 */

const DUA = [
  { letra: 'I', color: '#7ac043' },
  { letra: 'R', color: '#6f3fa8' },
  { letra: 'A', color: '#1ba1e2' },
];

const esEnlace = (t: string) => /^https?:\/\/\S+$/.test(t.trim());

function Barra({ titulo, numero, color }: { titulo: string; numero?: string; color: string }) {
  return (
    <div className="py-1 text-center text-[11px] font-bold text-white" style={{ background: color }}>
      {numero ? `${numero}  ` : ''}
      {titulo}
    </div>
  );
}

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
                  background: c.etiqueta ? '#c8c8c8' : undefined,
                  minHeight: minAlto,
                  height: minAlto,
                }}
                className={`border border-[#7a7a7a] px-1.5 py-1 align-top whitespace-pre-line ${c.etiqueta ? 'font-bold' : ''} ${c.centrado ? 'text-center' : ''}`}
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
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function BloqueVista({ b, color }: { b: Bloque; color: string }) {
  return (
    <section className="mt-2.5">
      <Barra titulo={b.titulo} numero={b.numero} color={color} />
      {b.tipo === 'tabla' ? <Tabla filas={b.filas} anchos={b.anchos} /> : <Tabla filas={[[{ texto: b.texto }]]} minAlto={34} />}
    </section>
  );
}

function Fase({ titulo }: { titulo: string }) {
  return (
    <div className="mt-2 mb-1.5 flex items-stretch">
      <span className="border border-[#7a7a7a] px-1.5 py-0.5 text-[8.5px] font-bold uppercase text-[#1f4e9c]">{titulo}</span>
      {DUA.map((d) => (
        <span key={d.letra} className="ml-px flex w-4 items-center justify-center text-[8px] font-bold text-white" style={{ background: d.color }}>
          {d.letra}
        </span>
      ))}
    </div>
  );
}

const Enlace = ({ url }: { url: string }) => (
  <a href={url} target="_blank" rel="noreferrer" className="break-all text-[#1f4e9c] underline">
    {url}
  </a>
);

export function VistaPrevia({ doc }: { doc: DocumentoPud }) {
  const color = doc.colorCabecera;
  const inst = doc.institucion;
  const celda = 'border border-[#7a7a7a] px-1.5 py-1 align-top';
  return (
    <div className="mx-auto w-full max-w-[1120px] bg-white p-6 text-[10px] leading-snug text-[#1a1a1a] shadow" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
      {/* Cabecera */}
      <div className="flex border border-[#7a7a7a]">
        <div className="flex w-[22%] items-center gap-2 border-r border-[#7a7a7a] px-2 py-1.5">
          {inst.logos.map((l) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={l} src={l} alt="" className="h-12 w-auto object-contain" />
          ))}
        </div>
        <div className="flex flex-1 flex-col items-center justify-center py-1.5 text-center">
          {inst.cabecera.map((l, i) => (
            <p
              key={i}
              className={l.estilo === 'grande' ? 'text-[17px] font-bold text-[#5a5a5a]' : l.estilo === 'acento' ? 'text-[13px] font-semibold' : 'text-[12px] text-[#5a5a5a]'}
              style={l.estilo === 'acento' ? { color } : undefined}
            >
              {l.texto}
            </p>
          ))}
        </div>
        <div className="w-[13%] border-l border-[#7a7a7a] text-center">
          <p className="bg-[#bfbfbf] py-1 text-[11px] font-bold">Año Lectivo</p>
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
            <tr className="bg-[#bfbfbf] text-center font-bold">
              <th rowSpan={2} className={celda} style={{ width: '8.5%' }}>N.º de semana y Fecha</th>
              <th rowSpan={2} className={celda} style={{ width: '12.5%' }}>Temas / Contenidos</th>
              <th rowSpan={2} className={celda} style={{ width: '12%' }}>Destrezas con criterio de desempeño</th>
              <th rowSpan={2} className={celda} style={{ width: '36%' }}>Estrategias Metodológica</th>
              <th rowSpan={2} className={celda} style={{ width: '14%' }}>Recursos</th>
              <th colSpan={2} className={celda}>Evaluación</th>
            </tr>
            <tr className="bg-[#bfbfbf] text-center font-bold">
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
                          <img src={d.imagenUrl} alt="" className="mt-1 h-9 w-9 rounded-full object-cover" />
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

      {/* Firmas */}
      <section className="mt-2.5">
        <Barra titulo="FIRMAS DE RESPONSABILIDAD" numero={`${doc.numeroFirmas}.`} color={color} />
        <table className="w-full border-collapse text-[10px]" style={{ tableLayout: 'fixed' }}>
          <tbody>
            <tr>
              {doc.firmas.columnas.map((c) => (
                <td key={c.titulo} className={`${celda} bg-[#c8c8c8] text-center font-bold`}>
                  {c.titulo}
                </td>
              ))}
            </tr>
            <tr>
              {doc.firmas.columnas.map((c) => (
                <td key={c.titulo} className={celda}>
                  <span className="font-bold">{c.cargo}</span> {c.nombre}
                </td>
              ))}
            </tr>
            <tr>
              {doc.firmas.columnas.map((c) => (
                <td key={c.titulo} className={`${celda} h-12`}>
                  <span className="font-bold">Firma:</span>
                </td>
              ))}
            </tr>
            <tr>
              {doc.firmas.columnas.map((c) => (
                <td key={c.titulo} className={celda}>
                  <span className="font-bold">Fecha:</span> {c.fecha}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
        {doc.registro && (
          <div className="mt-3">
            <p className="text-center text-[10px] font-bold">{doc.registro.titulo}</p>
            <Tabla
              filas={[
                [{ texto: 'Elaborado por', etiqueta: true, centrado: true }, { texto: 'Aprobado por', etiqueta: true, centrado: true }],
                [{ texto: doc.registro.elaboradoPor.cargo, centrado: true }, { texto: doc.registro.aprobadoPor.cargo, centrado: true }],
                [
                  { texto: `\n\n${doc.registro.elaboradoPor.nombre}\nFecha: ${doc.registro.elaboradoPor.fecha}`, centrado: true },
                  { texto: `\n\n${doc.registro.aprobadoPor.nombre}\nFecha: ${doc.registro.aprobadoPor.fecha}`, centrado: true },
                ],
              ]}
              anchos={[50, 50]}
            />
          </div>
        )}
      </section>
    </div>
  );
}
