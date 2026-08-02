/**
 * Página legal pública: Términos y Condiciones + Política de Privacidad y
 * Tratamiento de Datos Personales, conforme a la Ley Orgánica de Protección de
 * Datos Personales (LOPDP) del Ecuador y su Reglamento General.
 *
 * Estructura alineada con la política oficial de la Superintendencia de
 * Protección de Datos Personales (SPDP) y con guías de cumplimiento de la LOPDP:
 * definiciones, delegado/contacto de protección de datos, categorías de datos,
 * base de licitud, derechos del titular (respuesta en 15 días), vulneraciones de
 * seguridad (notificación en 5 días), cookies y decisiones automatizadas.
 *
 * ⚠️ ALCANCE: esta página cubre a GCC como **RESPONSABLE** del tratamiento —los datos
 * de candidatos y miembros del propio proyecto—. El servicio de Agente IA en WhatsApp
 * es el caso CONTRARIO: ahí GCC es **encargado** por cuenta de la empresa cliente, y
 * vive en `/legal/whatsapp`. No mezclar: meter los dos roles en un documento haría
 * falso uno de los dos.
 *
 * AVISO: Es una plantilla orientada al cumplimiento; NO sustituye asesoría legal.
 * Debe ser revisada por un abogado ecuatoriano antes de su uso definitivo, en
 * especial las secciones de datos sensibles / geolocalización.
 */

import type { Metadata } from 'next';
import DocumentoLegal, { Titulo, h2, ul, b, link, p as pp, recuadro } from '@/components/sitio/documento';
import { DOCUMENTOS_LEGALES } from '@/lib/negocio/legal';
import { RESPONSABLE, RUC, DIRECCION, CONTACTO } from '@/lib/negocio/datos';

export const metadata: Metadata = {
  title: 'Términos y condiciones y política de privacidad',
  description:
    'Política de privacidad y tratamiento de datos personales de Grupo Corazones Cruzados conforme a la LOPDP del Ecuador, y términos de uso del sitio.',
  alternates: { canonical: '/legal' },
};

/** El índice lateral. Se pasa a mano porque la página es de servidor a propósito. */
const INDICE = [
  { id: 's1', label: '1. Antecedentes y objeto' },
  { id: 's2', label: '2. Responsable y contacto' },
  { id: 's3', label: '3. Definiciones' },
  { id: 's4', label: '4. Principios' },
  { id: 's5', label: '5. Datos que tratamos' },
  { id: 's6', label: '6. Momento de la recolección' },
  { id: 's7', label: '7. Finalidades' },
  { id: 's8', label: '8. Base de licitud' },
  { id: 's9', label: '9. Control Psicosocial' },
  { id: 's10', label: '10. Cookies' },
  { id: 's11', label: '11. Decisiones automatizadas' },
  { id: 's12', label: '12. Encargados y transferencias' },
  { id: 's13', label: '13. Conservación' },
  { id: 's14', label: '14. Derechos del Titular' },
  { id: 's15', label: '15. Seguridad' },
  { id: 's16', label: '16. Vulneraciones' },
  { id: 's17', label: '17. Permisos y desafiliación' },
  { id: 's18', label: '18. Menores de edad' },
  { id: 's19', label: '19. Términos de uso' },
  { id: 's20', label: '20. Modificaciones' },
  { id: 'eliminar-datos', label: '21. Cómo eliminar tus datos' },
  { id: 's22', label: '22. Contacto y autoridad' },
];

const ULTIMA_ACTUALIZACION = '1 de agosto de 2026';

export default function LegalPage() {
  return (
    <DocumentoLegal
      id="general"
      titulo="Términos y condiciones y política de privacidad"
      subtitulo="Cómo tratamos los datos de las personas candidatas y miembros del proyecto, y las condiciones de uso de este sitio."
      actualizado={ULTIMA_ACTUALIZACION}
      indice={INDICE}
      aviso={
        <>
          {/* El índice sale del REGISTRO, no escrito a mano: al añadir el documento de un
              servicio nuevo aparece aquí, en la barra lateral de todos los documentos y en
              el mapa del sitio, sin tocar esta página. Ver `lib/negocio/legal.ts`. */}
          <strong className={b}>Centro de documentación legal</strong>
          <p className="mt-1.5 text-white/50">
            Todos los documentos de todo lo que ofrecemos, en un solo sitio.
          </p>

          <ul className="mt-4 space-y-4">
            {DOCUMENTOS_LEGALES.map((d) => (
              <li key={d.id}>
                <a href={d.ruta} className={`${link} font-semibold`}>{d.titulo}</a>
                <span className="ml-2 inline-flex items-center rounded-full border border-white/[0.14] px-2 py-0.5 text-[11px] text-white/45 align-middle">
                  {d.papel === 'encargado' ? 'Somos encargados' : 'Somos responsables'}
                </span>
                <span className="block mt-1 text-[14px] text-white/50">{d.para}</span>
                {/* Los puntos destacados: son los que la gente busca de verdad y los que se
                    piden desde fuera —Meta pide la URL de la eliminación de datos, no la de
                    la política entera—. */}
                <span className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                  {d.puntos.filter((x) => x.destacado).map((x) => (
                    <a key={x.id} href={`${d.ruta}#${x.id}`} className={`${link} text-[13.5px]`}>
                      {x.label}
                    </a>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </>
      }
    >

        <Titulo id="s1">1. Antecedentes y objeto</Titulo>
        <p className={pp}>
          El presente documento (en adelante, la “Política”) regula el uso de este sitio web y el{' '}
          <strong className={b}>tratamiento de datos personales</strong> de las personas usuarias y
          candidatas (en adelante, “el Usuario” o “el Titular”), de conformidad con la{' '}
          <strong className={b}>Constitución de la República del Ecuador</strong> (artículo 66, numeral
          19), la <strong className={b}>Ley Orgánica de Protección de Datos Personales (LOPDP)</strong>,
          su <strong className={b}>Reglamento General</strong> y demás normativa aplicable. Al aceptar la
          Política, el Titular declara haberla leído y comprendido, y otorga su consentimiento{' '}
          <strong className={b}>libre, específico, informado e inequívoco</strong> para el tratamiento de
          sus datos en los términos aquí descritos. El responsable podrá actualizar esta Política;
          la versión vigente se publicará siempre en esta página.
        </p>

        <Titulo id="s2">2. Responsable del tratamiento y contacto de protección de datos</Titulo>
        <p className={pp}>
          <strong className={b}>Alcance de esta Política:</strong> regula el sitio web y los datos
          de las personas candidatas y miembros del proyecto, respecto de los cuales Grupo
          Corazones Cruzados es <strong className={b}>responsable</strong>. No cubre las
          conversaciones de WhatsApp que atendemos <strong className={b}>por cuenta de empresas
          clientes</strong>: en ese servicio somos <strong className={b}>encargados</strong> y la
          responsable es la empresa, con su propio documento en{' '}
          <a href="/legal/whatsapp" className={link}>
            /legal/whatsapp
          </a>
          .
        </p>
        <p className={pp}>
          <strong className={b}>Responsable del tratamiento:</strong> {RESPONSABLE}, en representación
          del proyecto <strong className={b}>Grupo Corazones Cruzados</strong>.
          <br />
          <strong className={b}>RUC:</strong> {RUC}.
          <br />
          <strong className={b}>Dirección:</strong> {DIRECCION}.
          <br />
          <strong className={b}>Correo de contacto y de protección de datos:</strong>{' '}
          <a href={`mailto:${CONTACTO}`} className={link}>
            {CONTACTO}
          </a>
          .
        </p>
        <p className={pp}>
          El Titular puede dirigir a ese correo cualquier consulta, el ejercicio de sus derechos o
          el retiro de su consentimiento.
        </p>

        <Titulo id="s3">3. Definiciones</Titulo>
        <ul className={ul}>
          <li>
            <strong className={b}>Dato personal:</strong> cualquier información sobre una persona natural
            identificada o identificable.
          </li>
          <li>
            <strong className={b}>Dato sensible:</strong> aquel que, de tratarse indebidamente, pueda
            afectar derechos fundamentales (p. ej. salud, datos biométricos o que revelen origen,
            creencias o conducta).
          </li>
          <li>
            <strong className={b}>Titular:</strong> la persona natural a quien corresponden los datos.
          </li>
          <li>
            <strong className={b}>Responsable:</strong> quien decide sobre la finalidad y el tratamiento
            de los datos (en este caso, el indicado en la sección 2).
          </li>
          <li>
            <strong className={b}>Encargado:</strong> quien trata datos por cuenta del responsable.
          </li>
          <li>
            <strong className={b}>Tratamiento:</strong> cualquier operación sobre datos personales
            (recolección, registro, uso, conservación, supresión, etc.).
          </li>
          <li>
            <strong className={b}>Consentimiento:</strong> manifestación de voluntad libre, específica,
            informada e inequívoca del Titular para el tratamiento.
          </li>
        </ul>

        <Titulo id="s4">4. Principios que aplicamos</Titulo>
        <p className={pp}>
          Tratamos los datos conforme a los principios de la LOPDP:{' '}
          <strong className={b}>juridicidad, lealtad, transparencia, finalidad, pertinencia y
          minimización, proporcionalidad, confidencialidad, calidad y exactitud, conservación,
          seguridad, y responsabilidad proactiva y demostrada</strong>, aplicando siempre la
          interpretación más favorable al Titular.
        </p>

        <Titulo id="s5">5. Datos que tratamos</Titulo>
        <p className={pp}>
          Aplicamos el principio de <strong className={b}>minimización</strong>: solo tratamos los datos
          necesarios para las finalidades indicadas. Las categorías de datos que podemos recabar son:
        </p>
        <ul className={ul}>
          <li>
            <strong className={b}>Datos de postulación:</strong> nombre completo, correo electrónico,
            país, dirección y contacto telefónico, la motivación que el Titular redacta (texto libre)
            y el registro de las aceptaciones que otorga (qué aceptó y cuándo). Estos datos se
            solicitan únicamente en el formulario de postulación.
          </li>
          <li>
            <strong className={b}>Datos de cuenta y perfil:</strong> alias o nombre de usuario,
            configuración de su personaje/avatar y contraseña (almacenada de forma cifrada) para el
            acceso y la recuperación de la cuenta.
          </li>
          <li>
            <strong className={b}>Datos técnicos y de conexión:</strong> identificadores de dispositivo,
            cookies o tokens de sesión y <strong className={b}>dirección IP</strong>, utilizados para
            reconocer si el Titular es nuevo o recurrente y para la seguridad del servicio.
          </li>
          <li>
            <strong className={b}>Datos de comunicación:</strong> los que el Titular nos proporcione al
            contactarnos o participar en reuniones del proyecto.
          </li>
        </ul>

        <Titulo id="s6">6. Momento de la recolección (minimización y responsabilidad)</Titulo>
        <p className={pp}>
          Como medida de responsabilidad proactiva, <strong className={b}>los datos de postulación se
          recolectan y conservan únicamente cuando el Titular completa y envía el formulario de
          postulación</strong> y otorga su aceptación final. Antes de ese momento, la información
          introducida permanece de forma temporal en el dispositivo del Titular y no es transmitida
          ni almacenada por el responsable con fines de tratamiento.
        </p>

        <Titulo id="s7">7. Finalidades del tratamiento</Titulo>
        <ul className={ul}>
          <li>Gestionar la postulación y, en su caso, la afiliación del Titular al proyecto.</li>
          <li>Crear y administrar su cuenta y permitir el acceso al sitio y a sus herramientas.</li>
          <li>Comunicarnos con el Titular respecto de su candidatura y del proyecto.</li>
          <li>Garantizar la seguridad del servicio y prevenir fraudes o usos indebidos.</li>
          <li>Cumplir obligaciones legales aplicables.</li>
        </ul>

        <Titulo id="s8">8. Base de licitud</Titulo>
        <p className={pp}>
          El tratamiento se sustenta principalmente en el <strong className={b}>consentimiento</strong>{' '}
          del Titular, otorgado al aceptar esta Política, así como, cuando corresponda, en la
          ejecución de medidas precontractuales a petición del Titular, en el interés legítimo del
          responsable o en el cumplimiento de obligaciones legales. El Titular puede{' '}
          <strong className={b}>retirar su consentimiento</strong> en cualquier momento, sin que ello
          afecte la licitud del tratamiento realizado con anterioridad (ver sección 14).
        </p>

        <Titulo id="s9">9. Sistema de Control Psicosocial y geolocalización</Titulo>
        <p className={pp}>
          El proyecto contempla un <em>Sistema de Control Psicosocial</em> compuesto por distintas
          herramientas. <strong className={b}>Cada herramienta de este sistema solicitará su propio
          consentimiento</strong>, de forma explícita, separada, específica e informada, antes de
          tratar cualquier dato.
        </p>
        <p className={pp}>
          El consentimiento específico a cada dato se otorga{' '}
          <strong className={b}>antes de acceder a la herramienta correspondiente</strong>, no de forma
          anticipada. En su estado actual,{' '}
          <strong className={b}>este sistema no recopila datos del Titular a través del sitio</strong>.
          Si en el futuro se habilitan herramientas que requieran datos —incluida geolocalización u
          otros datos sensibles— se solicitará el consentimiento explícito y separado
          correspondiente y se adoptarán las garantías y, cuando proceda, la evaluación de impacto
          que exija la LOPDP. El Titular podrá negarse a dicho tratamiento sin que ello le impida
          usar las funciones que no dependan de esos datos.
        </p>

        <Titulo id="s10">10. Cookies y tecnologías similares</Titulo>
        <p className={pp}>
          Utilizamos cookies o tokens de sesión estrictamente necesarios para el funcionamiento y la
          seguridad del sitio (por ejemplo, para mantener la sesión y distinguir entre usuarios
          nuevos y recurrentes). El Titular puede gestionar las cookies desde la configuración de su
          navegador; deshabilitarlas puede afectar el funcionamiento de algunas funciones.
        </p>

        <Titulo id="s11">11. Decisiones automatizadas y elaboración de perfiles</Titulo>
        <p className={pp}>
          El Titular tiene derecho a no ser objeto de decisiones basadas únicamente en tratamientos
          automatizados que produzcan efectos jurídicos o le afecten significativamente. Si en algún
          momento se realizaran tratamientos de este tipo, se informará al Titular y se garantizará
          su derecho a obtener intervención humana, a expresar su punto de vista y a impugnar la
          decisión.
        </p>

        <Titulo id="s12">12. Encargados del tratamiento y transferencias internacionales</Titulo>
        <p className={pp}>
          Para prestar el servicio utilizamos proveedores tecnológicos que actúan como encargados del
          tratamiento, algunos ubicados fuera del Ecuador, entre ellos: servicios de{' '}
          <strong className={b}>alojamiento e infraestructura</strong>, de{' '}
          <strong className={b}>envío de correo electrónico</strong> y de{' '}
          <strong className={b}>inteligencia artificial</strong> para funciones del sitio. Estos
          encargados tratan los datos siguiendo nuestras instrucciones y con obligaciones de
          confidencialidad y seguridad. En las transferencias internacionales adoptamos las garantías
          adecuadas previstas en la LOPDP (cláusulas contractuales u otros mecanismos válidos).
        </p>

        <Titulo id="s13">13. Conservación</Titulo>
        <p className={pp}>
          Conservamos los datos durante el tiempo necesario para las finalidades descritas y mientras
          exista una relación con el Titular, y luego durante los plazos legales aplicables. Cumplidos
          dichos plazos, los datos se <strong className={b}>eliminan o anonimizan</strong> de forma
          segura.
        </p>

        <Titulo id="s14">14. Derechos del Titular</Titulo>
        <p className={pp}>
          El Titular puede ejercer, de forma gratuita, sus derechos de{' '}
          <strong className={b}>acceso, rectificación y actualización, eliminación (supresión),
          oposición, anulación, portabilidad, suspensión del tratamiento, limitación</strong> y a{' '}
          <strong className={b}>no ser objeto de decisiones automatizadas</strong>, así como{' '}
          <strong className={b}>retirar su consentimiento</strong>, escribiendo a{' '}
          <a href={`mailto:${CONTACTO}`} className={link}>
            {CONTACTO}
          </a>
          . Atenderemos la solicitud en los plazos previstos por la ley (por regla general,{' '}
          <strong className={b}>dentro de quince (15) días</strong> en el caso del derecho de acceso).
          Para verificar su identidad podremos solicitar información adicional. Si el Titular
          considera vulnerados sus derechos, puede presentar un reclamo ante la{' '}
          <strong className={b}>Superintendencia de Protección de Datos Personales del Ecuador (SPDP)</strong>.
        </p>

        <Titulo id="s15">15. Seguridad de la información</Titulo>
        <p className={pp}>
          Aplicamos medidas técnicas y organizativas razonables para proteger los datos frente a
          accesos no autorizados, pérdida, alteración o divulgación (entre otras, cifrado de
          contraseñas, control de acceso y conexiones seguras). Ningún sistema es completamente
          infalible; el Titular también es responsable de mantener la confidencialidad de sus
          credenciales.
        </p>

        <Titulo id="s16">16. Vulneraciones de seguridad</Titulo>
        <p className={pp}>
          Ante una vulneración de la seguridad de los datos personales que entrañe un riesgo para los
          derechos del Titular, notificaremos a la <strong className={b}>SPDP</strong> y, cuando
          corresponda, a los Titulares afectados, en el plazo previsto por la normativa{' '}
          (<strong className={b}>dentro de los cinco (5) días</strong> siguientes a su conocimiento),
          describiendo la naturaleza del incidente y las medidas adoptadas.
        </p>

        <Titulo id="s17">17. Permisos otorgados y desafiliación</Titulo>
        <p className={pp}>
          La aceptación de esta Política implica la concesión de los permisos necesarios para las
          finalidades descritas. Sin perjuicio de los derechos del Titular reconocidos por la ley
          (sección 14), tales permisos se mantienen vigentes mientras el Titular forme parte del
          proyecto y <strong className={b}>se retiran cuando: (i) el Titular solicita voluntariamente su
          desafiliación, o (ii) se produce su desafiliación por incumplimiento de las reglas</strong>.
          En ambos casos cesa el tratamiento basado en dichos permisos y se procede conforme a la
          sección 13.
        </p>

        <Titulo id="s18">18. Personas menores de edad</Titulo>
        <p className={pp}>
          El sitio está dirigido a personas mayores de edad. El tratamiento de datos de niñas, niños
          y adolescentes, de ser el caso, se realizará únicamente con el consentimiento de su
          representante legal y con las garantías reforzadas que exige la LOPDP, atendiendo a su
          interés superior.
        </p>

        <Titulo id="s19">19. Términos de uso del sitio</Titulo>
        <p className={pp}>
          El Titular se compromete a usar el sitio de forma lícita y de buena fe, a proporcionar
          información veraz y a no realizar actividades que afecten la seguridad o el funcionamiento
          del servicio. El responsable podrá suspender o cancelar el acceso ante usos indebidos. Los
          contenidos y signos distintivos del proyecto pertenecen a sus titulares y no podrán
          utilizarse sin autorización.
        </p>

        <Titulo id="s20">20. Modificaciones</Titulo>
        <p className={pp}>
          Podemos actualizar esta Política para reflejar cambios legales o del servicio. Publicaremos
          la versión vigente en esta página, indicando la fecha de última actualización. El uso
          continuado del sitio tras una actualización implica la aceptación de la versión vigente.
        </p>

        <Titulo id="eliminar-datos">21. Cómo eliminar tus datos</Titulo>
        <p className={pp}>
          El Titular puede solicitar la <strong className={b}>eliminación de sus datos personales</strong>{' '}
          en cualquier momento y de forma gratuita, siguiendo estos pasos:
        </p>
        <ol className={ul}>
          <li>
            Escribir a{' '}
            <a href={`mailto:${CONTACTO}`} className={link}>
              {CONTACTO}
            </a>{' '}
            desde el correo asociado a su cuenta, con el asunto{' '}
            <strong className={b}>«Eliminación de datos»</strong>.
          </li>
          <li>
            Indicar el nombre completo y, si aplica, el alias de usuario, para poder localizar la
            cuenta. Podremos solicitar información adicional únicamente para{' '}
            <strong className={b}>verificar la identidad</strong> del solicitante.
          </li>
          <li>
            Recibirá confirmación y respuesta dentro de los plazos legales (por regla general,{' '}
            <strong className={b}>quince (15) días</strong>).
          </li>
        </ol>
        <p className={pp}>
          Una vez atendida la solicitud, los datos se <strong className={b}>eliminan o anonimizan</strong>{' '}
          de forma segura, salvo aquellos que debamos conservar por obligación legal durante los
          plazos aplicables (ver sección 13). La eliminación de los datos implica la{' '}
          <strong className={b}>cancelación de la cuenta</strong> y el cese del tratamiento descrito en
          esta Política.
        </p>

        <Titulo id="s22">22. Contacto y autoridad de control</Titulo>
        <p className={pp}>
          Para cualquier consulta sobre esta Política o sobre el tratamiento de tus datos, escríbenos
          a{' '}
          <a href={`mailto:${CONTACTO}`} className={link}>
            {CONTACTO}
          </a>
          . La autoridad de control en materia de protección de datos en el Ecuador es la{' '}
          <strong className={b}>Superintendencia de Protección de Datos Personales (SPDP)</strong>.
        </p>

    </DocumentoLegal>
  );
}
