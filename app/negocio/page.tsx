/**
 * PÁGINA DE NEGOCIO — pública, sin sesión, servida desde el servidor.
 *
 * ── POR QUÉ EXISTE ─────────────────────────────────────────────────────────────
 * Meta rechazó la verificación (2026-08-02) con «no puede determinar que pertenezca a un
 * negocio real». El certificado de RUC era correcto; lo que fallaba era el entorno: un
 * revisor abría `app.grupocc.org` y encontraba la portada de captación de candidatos
 * —pixel art, creador de personaje—, que **no se lee como una empresa que presta servicios
 * de tecnología**. Con los datos legales en el pie ya podía identificar al titular, pero
 * seguía sin poder responder a «¿qué vende esta empresa?».
 *
 * Esta página responde a eso, y **no sustituye a la portada**: son dos públicos distintos.
 * La portada capta miembros del proyecto; esta habla a empresas, revisores y autoridades.
 *
 * ── LAS DOS REGLAS QUE LA GOBIERNAN ────────────────────────────────────────────
 * 1. **Nada que no sea verificable.** Los servicios listados corresponden a módulos que
 *    existen en la aplicación; la identidad sale de `app/legal/datos.ts`, que viene del
 *    certificado del SRI. Sin cifras de clientes, sin años de experiencia, sin logros: un
 *    revisor que contrasta y no cuadra es peor que uno que no encuentra nada.
 * 2. **Server Component, sin `use client`.** Tiene que estar en el HTML crudo: quien la
 *    revise puede no ejecutar JavaScript.
 *
 * Se declara en Meta como **sitio web del negocio**.
 */

import type { Metadata } from 'next';
import {
  pagina, articulo, h1, h2, ul, b, link, sutil, recuadro, tabla, th, td,
} from '../legal/estilos';
import { RAZON_SOCIAL, NOMBRE_COMERCIAL, RUC, DIRECCION, CONTACTO } from '../legal/datos';
import AltaCliente from './AltaCliente';

export const metadata: Metadata = {
  title: `${NOMBRE_COMERCIAL} — Desarrollo de software y automatización | Guayaquil, Ecuador`,
  description:
    'Grupo Corazones Cruzados desarrolla plataformas de gestión a medida, automatiza la comunicación con clientes por correo y WhatsApp, y provee agentes de atención con inteligencia artificial. Guayaquil, Ecuador. RUC 0930095922001.',
};

/** Solo lo que existe de verdad en la aplicación. Ver la regla 1 de la cabecera. */
const SERVICIOS = [
  {
    titulo: 'Agentes de atención con inteligencia artificial en WhatsApp',
    texto: `Conectamos el número de WhatsApp Business de una empresa a un agente que atiende sus conversaciones con la información de su propio negocio. La empresa conserva su número y su equipo sigue usando WhatsApp Web: es una conexión en coexistencia, no una sustitución. Cada agente se configura con el conocimiento del negocio, decide cuándo responder y cuándo pasar la conversación a una persona, y deja constancia de todo en una bandeja.`,
  },
  {
    titulo: 'Plataformas de gestión a medida',
    texto: `Desarrollamos y operamos sistemas de gestión para empresas: proyectos y tareas, tickets de soporte, clientes, cotizaciones, suscripciones y facturación. Cada implantación se ajusta a la operación real del cliente en lugar de obligarle a adaptarse a un producto cerrado.`,
  },
  {
    titulo: 'Automatización de la comunicación',
    texto: `Campañas de correo electrónico y de WhatsApp con plantillas, programación y seguimiento de entrega. Recordatorios automáticos y avisos generados desde la propia operación del cliente.`,
  },
  {
    titulo: 'Facturación electrónica integrada con el SRI',
    texto: `Emisión, firma y autorización de comprobantes electrónicos ante el Servicio de Rentas Internas del Ecuador, integrada dentro del mismo sistema de gestión.`,
  },
];

export default function NegocioPage() {
  return (
    <main style={pagina}>
      <article style={articulo}>
        <h1 style={h1}>{NOMBRE_COMERCIAL}</h1>
        <p style={{ ...sutil, marginTop: 6, fontSize: '1.02rem' }}>
          Desarrollo de software, automatización y agentes de atención con inteligencia
          artificial. Guayaquil, Ecuador.
        </p>

        <h2 style={h2}>Qué hacemos</h2>
        <p>
          {NOMBRE_COMERCIAL} construye y opera los sistemas con los que otras empresas
          gestionan su trabajo y atienden a sus clientes. Trabajamos de forma directa con
          cada empresa: implantamos, configuramos con su información y seguimos operando el
          servicio.
        </p>

        {SERVICIOS.map((s) => (
          <div key={s.titulo} style={{ marginTop: 22 }}>
            <h3 style={{ fontSize: '1rem', color: '#f1eefb', margin: '0 0 6px' }}>{s.titulo}</h3>
            <p style={{ margin: 0 }}>{s.texto}</p>
          </div>
        ))}

        {/* La invitación va DESPUÉS de los servicios: primero se dice qué se hace y
            luego se invita. Es una isla de cliente dentro de una página de servidor. */}
        <AltaCliente />

        {/* ── Lo que interesa a un revisor de WhatsApp ──────────────────────────── */}
        <h2 style={h2}>Nuestro papel en WhatsApp Business</h2>
        <p>
          {NOMBRE_COMERCIAL} actúa como <strong style={b}>proveedor de tecnología</strong>:
          las empresas clientes conectan <strong style={b}>su propio número</strong> de
          WhatsApp Business a nuestra plataforma y conservan la titularidad de su cuenta y de
          sus conversaciones.
        </p>
        <p>
          En el tratamiento de los datos de esas conversaciones, la empresa cliente es la{' '}
          <strong style={b}>responsable</strong> y {NOMBRE_COMERCIAL} es{' '}
          <strong style={b}>encargada del tratamiento</strong>: tratamos los datos únicamente
          por cuenta de ella y siguiendo sus instrucciones. Los detalles —qué datos, para qué,
          con quién se comparten, cuánto se conservan y cómo se eliminan— están publicados en{' '}
          <a href="/legal/whatsapp" style={link}>
            la política del servicio
          </a>
          .
        </p>

        {/* ── Identidad, con el camino para comprobarla ─────────────────────────── */}
        <h2 style={h2}>Identidad legal</h2>
        <table style={tabla}>
          <tbody>
            <tr>
              <th style={th}>Razón social</th>
              {/* Tal como consta en el SRI: apellidos primero y en mayúsculas. Es la forma
                  que un revisor va a contrastar. */}
              <td style={td}>{RAZON_SOCIAL}</td>
            </tr>
            <tr>
              <th style={th}>Nombre comercial</th>
              <td style={td}>{NOMBRE_COMERCIAL}</td>
            </tr>
            <tr>
              <th style={th}>RUC</th>
              <td style={td}>{RUC}</td>
            </tr>
            <tr>
              <th style={th}>Domicilio</th>
              <td style={td}>{DIRECCION}</td>
            </tr>
            <tr>
              <th style={th}>Correo</th>
              <td style={td}>
                <a href={`mailto:${CONTACTO}`} style={link}>{CONTACTO}</a>
              </td>
            </tr>
            <tr>
              <th style={th}>Sitio</th>
              <td style={td}>
                <a href="https://app.grupocc.org" style={link}>app.grupocc.org</a>
              </td>
            </tr>
          </tbody>
        </table>

        <div style={recuadro('nota')}>
          <p style={{ margin: 0 }}>
            <strong style={b}>Cómo comprobar estos datos.</strong> El registro es público y no
            hace falta clave: en{' '}
            <a href="https://srienlinea.sri.gob.ec/sri-en-linea/SriRucWeb/ConsultaRuc/Consultas/consultaRuc" style={link} rel="noopener noreferrer" target="_blank">
              Consulta de RUC del SRI
            </a>{' '}
            se introduce el número <strong style={b}>{RUC}</strong> y aparecen la razón social,
            el estado del contribuyente y el establecimiento con su nombre comercial.
          </p>
        </div>

        <h2 style={h2}>Contacto</h2>
        <p>
          Para contratar un servicio, resolver una duda o ejercer derechos sobre datos
          personales:{' '}
          <a href={`mailto:${CONTACTO}`} style={link}>
            {CONTACTO}
          </a>
          .
        </p>

        <h2 style={h2}>Documentos</h2>
        <ul style={ul}>
          <li>
            <a href="/legal" style={link}>Términos y condiciones y política de privacidad</a>
          </li>
          <li>
            <a href="/legal/whatsapp" style={link}>
              Agente IA en WhatsApp — privacidad, condiciones y encargo del tratamiento
            </a>
          </li>
          <li>
            <a href="/legal/whatsapp#eliminar-datos" style={link}>Cómo eliminar tus datos</a>
          </li>
        </ul>

        <p style={{ marginTop: 40 }}>
          <a href="/" style={link}>← Inicio</a>
        </p>
      </article>
    </main>
  );
}
