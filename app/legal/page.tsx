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
 * AVISO: Es una plantilla orientada al cumplimiento; NO sustituye asesoría legal.
 * Debe ser revisada por un abogado ecuatoriano antes de su uso definitivo, en
 * especial las secciones de datos sensibles / geolocalización.
 */

export const metadata = {
  title: 'Términos y Condiciones y Política de Privacidad — Grupo Corazones Cruzados',
};

const ULTIMA_ACTUALIZACION = '23 de junio de 2026';
const RESPONSABLE = 'Luis Fernando González Muyulema';
const RUC = '0930095922001';
const DIRECCION = 'Tabacundo, código postal 090102, Ecuador';
const CONTACTO = 'lfgonzalezm0@grupocc.org';

export default function LegalPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#0e1118',
        color: '#d9d4ea',
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        padding: '48px 20px 80px',
      }}
    >
      <article style={{ maxWidth: 820, margin: '0 auto', lineHeight: 1.65, fontSize: '0.98rem' }}>
        <h1 style={h1}>Términos y Condiciones y Política de Privacidad</h1>
        <p style={{ color: '#9b95b3', marginTop: 4 }}>
          Grupo Corazones Cruzados — Última actualización: {ULTIMA_ACTUALIZACION}
        </p>

        <h2 style={h2}>1. Antecedentes y objeto</h2>
        <p>
          El presente documento (en adelante, la “Política”) regula el uso de este sitio web y el{' '}
          <strong style={b}>tratamiento de datos personales</strong> de las personas usuarias y
          candidatas (en adelante, “el Usuario” o “el Titular”), de conformidad con la{' '}
          <strong style={b}>Constitución de la República del Ecuador</strong> (artículo 66, numeral
          19), la <strong style={b}>Ley Orgánica de Protección de Datos Personales (LOPDP)</strong>,
          su <strong style={b}>Reglamento General</strong> y demás normativa aplicable. Al aceptar la
          Política, el Titular declara haberla leído y comprendido, y otorga su consentimiento{' '}
          <strong style={b}>libre, específico, informado e inequívoco</strong> para el tratamiento de
          sus datos en los términos aquí descritos. El responsable podrá actualizar esta Política;
          la versión vigente se publicará siempre en esta página.
        </p>

        <h2 style={h2}>2. Responsable del tratamiento y contacto de protección de datos</h2>
        <p>
          <strong style={b}>Responsable del tratamiento:</strong> {RESPONSABLE}, en representación
          del proyecto <strong style={b}>Grupo Corazones Cruzados</strong>.
          <br />
          <strong style={b}>RUC:</strong> {RUC}.
          <br />
          <strong style={b}>Dirección:</strong> {DIRECCION}.
          <br />
          <strong style={b}>Correo de contacto y de protección de datos:</strong>{' '}
          <a href={`mailto:${CONTACTO}`} style={link}>
            {CONTACTO}
          </a>
          .
        </p>
        <p>
          El Titular puede dirigir a ese correo cualquier consulta, el ejercicio de sus derechos o
          el retiro de su consentimiento.
        </p>

        <h2 style={h2}>3. Definiciones</h2>
        <ul style={ul}>
          <li>
            <strong style={b}>Dato personal:</strong> cualquier información sobre una persona natural
            identificada o identificable.
          </li>
          <li>
            <strong style={b}>Dato sensible:</strong> aquel que, de tratarse indebidamente, pueda
            afectar derechos fundamentales (p. ej. salud, datos biométricos o que revelen origen,
            creencias o conducta).
          </li>
          <li>
            <strong style={b}>Titular:</strong> la persona natural a quien corresponden los datos.
          </li>
          <li>
            <strong style={b}>Responsable:</strong> quien decide sobre la finalidad y el tratamiento
            de los datos (en este caso, el indicado en la sección 2).
          </li>
          <li>
            <strong style={b}>Encargado:</strong> quien trata datos por cuenta del responsable.
          </li>
          <li>
            <strong style={b}>Tratamiento:</strong> cualquier operación sobre datos personales
            (recolección, registro, uso, conservación, supresión, etc.).
          </li>
          <li>
            <strong style={b}>Consentimiento:</strong> manifestación de voluntad libre, específica,
            informada e inequívoca del Titular para el tratamiento.
          </li>
        </ul>

        <h2 style={h2}>4. Principios que aplicamos</h2>
        <p>
          Tratamos los datos conforme a los principios de la LOPDP:{' '}
          <strong style={b}>juridicidad, lealtad, transparencia, finalidad, pertinencia y
          minimización, proporcionalidad, confidencialidad, calidad y exactitud, conservación,
          seguridad, y responsabilidad proactiva y demostrada</strong>, aplicando siempre la
          interpretación más favorable al Titular.
        </p>

        <h2 style={h2}>5. Datos que tratamos</h2>
        <p>
          Aplicamos el principio de <strong style={b}>minimización</strong>: solo tratamos los datos
          necesarios para las finalidades indicadas. Las categorías de datos que podemos recabar son:
        </p>
        <ul style={ul}>
          <li>
            <strong style={b}>Datos de postulación:</strong> nombre completo, correo electrónico,
            país, dirección y contacto telefónico, la motivación que el Titular redacta (texto libre)
            y el registro de las aceptaciones que otorga (qué aceptó y cuándo). Estos datos se
            solicitan únicamente en el formulario de postulación.
          </li>
          <li>
            <strong style={b}>Datos de cuenta y perfil:</strong> alias o nombre de usuario,
            configuración de su personaje/avatar y contraseña (almacenada de forma cifrada) para el
            acceso y la recuperación de la cuenta.
          </li>
          <li>
            <strong style={b}>Datos técnicos y de conexión:</strong> identificadores de dispositivo,
            cookies o tokens de sesión y <strong style={b}>dirección IP</strong>, utilizados para
            reconocer si el Titular es nuevo o recurrente y para la seguridad del servicio.
          </li>
          <li>
            <strong style={b}>Datos de comunicación:</strong> los que el Titular nos proporcione al
            contactarnos o participar en reuniones del proyecto.
          </li>
        </ul>

        <h2 style={h2}>6. Momento de la recolección (minimización y responsabilidad)</h2>
        <p>
          Como medida de responsabilidad proactiva, <strong style={b}>los datos de postulación se
          recolectan y conservan únicamente cuando el Titular completa y envía el formulario de
          postulación</strong> y otorga su aceptación final. Antes de ese momento, la información
          introducida permanece de forma temporal en el dispositivo del Titular y no es transmitida
          ni almacenada por el responsable con fines de tratamiento.
        </p>

        <h2 style={h2}>7. Finalidades del tratamiento</h2>
        <ul style={ul}>
          <li>Gestionar la postulación y, en su caso, la afiliación del Titular al proyecto.</li>
          <li>Crear y administrar su cuenta y permitir el acceso al sitio y a sus herramientas.</li>
          <li>Comunicarnos con el Titular respecto de su candidatura y del proyecto.</li>
          <li>Garantizar la seguridad del servicio y prevenir fraudes o usos indebidos.</li>
          <li>Cumplir obligaciones legales aplicables.</li>
        </ul>

        <h2 style={h2}>8. Base de licitud</h2>
        <p>
          El tratamiento se sustenta principalmente en el <strong style={b}>consentimiento</strong>{' '}
          del Titular, otorgado al aceptar esta Política, así como, cuando corresponda, en la
          ejecución de medidas precontractuales a petición del Titular, en el interés legítimo del
          responsable o en el cumplimiento de obligaciones legales. El Titular puede{' '}
          <strong style={b}>retirar su consentimiento</strong> en cualquier momento, sin que ello
          afecte la licitud del tratamiento realizado con anterioridad (ver sección 14).
        </p>

        <h2 style={h2}>9. Sistema de Control Psicosocial y geolocalización</h2>
        <p>
          El proyecto contempla un <em>Sistema de Control Psicosocial</em> compuesto por distintas
          herramientas. <strong style={b}>Cada herramienta de este sistema solicitará su propio
          consentimiento</strong>, de forma explícita, separada, específica e informada, antes de
          tratar cualquier dato.
        </p>
        <p>
          El consentimiento específico a cada dato se otorga{' '}
          <strong style={b}>antes de acceder a la herramienta correspondiente</strong>, no de forma
          anticipada. En su estado actual,{' '}
          <strong style={b}>este sistema no recopila datos del Titular a través del sitio</strong>.
          Si en el futuro se habilitan herramientas que requieran datos —incluida geolocalización u
          otros datos sensibles— se solicitará el consentimiento explícito y separado
          correspondiente y se adoptarán las garantías y, cuando proceda, la evaluación de impacto
          que exija la LOPDP. El Titular podrá negarse a dicho tratamiento sin que ello le impida
          usar las funciones que no dependan de esos datos.
        </p>

        <h2 style={h2}>10. Cookies y tecnologías similares</h2>
        <p>
          Utilizamos cookies o tokens de sesión estrictamente necesarios para el funcionamiento y la
          seguridad del sitio (por ejemplo, para mantener la sesión y distinguir entre usuarios
          nuevos y recurrentes). El Titular puede gestionar las cookies desde la configuración de su
          navegador; deshabilitarlas puede afectar el funcionamiento de algunas funciones.
        </p>

        <h2 style={h2}>11. Decisiones automatizadas y elaboración de perfiles</h2>
        <p>
          El Titular tiene derecho a no ser objeto de decisiones basadas únicamente en tratamientos
          automatizados que produzcan efectos jurídicos o le afecten significativamente. Si en algún
          momento se realizaran tratamientos de este tipo, se informará al Titular y se garantizará
          su derecho a obtener intervención humana, a expresar su punto de vista y a impugnar la
          decisión.
        </p>

        <h2 style={h2}>12. Encargados del tratamiento y transferencias internacionales</h2>
        <p>
          Para prestar el servicio utilizamos proveedores tecnológicos que actúan como encargados del
          tratamiento, algunos ubicados fuera del Ecuador, entre ellos: servicios de{' '}
          <strong style={b}>alojamiento e infraestructura</strong>, de{' '}
          <strong style={b}>envío de correo electrónico</strong> y de{' '}
          <strong style={b}>inteligencia artificial</strong> para funciones del sitio. Estos
          encargados tratan los datos siguiendo nuestras instrucciones y con obligaciones de
          confidencialidad y seguridad. En las transferencias internacionales adoptamos las garantías
          adecuadas previstas en la LOPDP (cláusulas contractuales u otros mecanismos válidos).
        </p>

        <h2 style={h2}>13. Conservación</h2>
        <p>
          Conservamos los datos durante el tiempo necesario para las finalidades descritas y mientras
          exista una relación con el Titular, y luego durante los plazos legales aplicables. Cumplidos
          dichos plazos, los datos se <strong style={b}>eliminan o anonimizan</strong> de forma
          segura.
        </p>

        <h2 style={h2}>14. Derechos del Titular</h2>
        <p>
          El Titular puede ejercer, de forma gratuita, sus derechos de{' '}
          <strong style={b}>acceso, rectificación y actualización, eliminación (supresión),
          oposición, anulación, portabilidad, suspensión del tratamiento, limitación</strong> y a{' '}
          <strong style={b}>no ser objeto de decisiones automatizadas</strong>, así como{' '}
          <strong style={b}>retirar su consentimiento</strong>, escribiendo a{' '}
          <a href={`mailto:${CONTACTO}`} style={link}>
            {CONTACTO}
          </a>
          . Atenderemos la solicitud en los plazos previstos por la ley (por regla general,{' '}
          <strong style={b}>dentro de quince (15) días</strong> en el caso del derecho de acceso).
          Para verificar su identidad podremos solicitar información adicional. Si el Titular
          considera vulnerados sus derechos, puede presentar un reclamo ante la{' '}
          <strong style={b}>Superintendencia de Protección de Datos Personales del Ecuador (SPDP)</strong>.
        </p>

        <h2 style={h2}>15. Seguridad de la información</h2>
        <p>
          Aplicamos medidas técnicas y organizativas razonables para proteger los datos frente a
          accesos no autorizados, pérdida, alteración o divulgación (entre otras, cifrado de
          contraseñas, control de acceso y conexiones seguras). Ningún sistema es completamente
          infalible; el Titular también es responsable de mantener la confidencialidad de sus
          credenciales.
        </p>

        <h2 style={h2}>16. Vulneraciones de seguridad</h2>
        <p>
          Ante una vulneración de la seguridad de los datos personales que entrañe un riesgo para los
          derechos del Titular, notificaremos a la <strong style={b}>SPDP</strong> y, cuando
          corresponda, a los Titulares afectados, en el plazo previsto por la normativa{' '}
          (<strong style={b}>dentro de los cinco (5) días</strong> siguientes a su conocimiento),
          describiendo la naturaleza del incidente y las medidas adoptadas.
        </p>

        <h2 style={h2}>17. Permisos otorgados y desafiliación</h2>
        <p>
          La aceptación de esta Política implica la concesión de los permisos necesarios para las
          finalidades descritas. Sin perjuicio de los derechos del Titular reconocidos por la ley
          (sección 14), tales permisos se mantienen vigentes mientras el Titular forme parte del
          proyecto y <strong style={b}>se retiran cuando: (i) el Titular solicita voluntariamente su
          desafiliación, o (ii) se produce su desafiliación por incumplimiento de las reglas</strong>.
          En ambos casos cesa el tratamiento basado en dichos permisos y se procede conforme a la
          sección 13.
        </p>

        <h2 style={h2}>18. Personas menores de edad</h2>
        <p>
          El sitio está dirigido a personas mayores de edad. El tratamiento de datos de niñas, niños
          y adolescentes, de ser el caso, se realizará únicamente con el consentimiento de su
          representante legal y con las garantías reforzadas que exige la LOPDP, atendiendo a su
          interés superior.
        </p>

        <h2 style={h2}>19. Términos de uso del sitio</h2>
        <p>
          El Titular se compromete a usar el sitio de forma lícita y de buena fe, a proporcionar
          información veraz y a no realizar actividades que afecten la seguridad o el funcionamiento
          del servicio. El responsable podrá suspender o cancelar el acceso ante usos indebidos. Los
          contenidos y signos distintivos del proyecto pertenecen a sus titulares y no podrán
          utilizarse sin autorización.
        </p>

        <h2 style={h2}>20. Modificaciones</h2>
        <p>
          Podemos actualizar esta Política para reflejar cambios legales o del servicio. Publicaremos
          la versión vigente en esta página, indicando la fecha de última actualización. El uso
          continuado del sitio tras una actualización implica la aceptación de la versión vigente.
        </p>

        <h2 style={h2}>21. Contacto y autoridad de control</h2>
        <p>
          Para cualquier consulta sobre esta Política o sobre el tratamiento de tus datos, escríbenos
          a{' '}
          <a href={`mailto:${CONTACTO}`} style={link}>
            {CONTACTO}
          </a>
          . La autoridad de control en materia de protección de datos en el Ecuador es la{' '}
          <strong style={b}>Superintendencia de Protección de Datos Personales (SPDP)</strong>.
        </p>

        <p style={{ marginTop: 40 }}>
          <a href="/" style={link}>
            ← Volver al inicio
          </a>
        </p>
      </article>
    </main>
  );
}

const h1: React.CSSProperties = { fontSize: '1.6rem', color: '#f1eefb', margin: 0 };
const h2: React.CSSProperties = {
  fontSize: '1.12rem',
  color: '#f1eefb',
  marginTop: 34,
  marginBottom: 8,
};
const ul: React.CSSProperties = { paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 };
const b: React.CSSProperties = { color: '#fff', fontWeight: 700 };
const link: React.CSSProperties = { color: '#7B5FBF', textDecoration: 'underline' };
