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
import DocumentoLegal, { Titulo, ul, b, link, p as pp, type GrupoIndice } from '@/components/sitio/documento';
import { RESPONSABLE, RUC, DIRECCION, CONTACTO } from '@/lib/negocio/datos';

export const metadata: Metadata = {
  title: 'Términos y condiciones y política de privacidad',
  description:
    'Política de privacidad y tratamiento de datos personales de Grupo Corazones Cruzados conforme a la LOPDP del Ecuador, y términos de uso del sitio.',
  alternates: { canonical: '/legal' },
};

/**
 * El índice, por categorías y con los MISMOS títulos y números de las secciones (Fernando, 2026-11-13: el
 * índice tenía nombres distintos de los títulos y sus grupos desordenaban la numeración). Las secciones van en el
 * orden de los grupos.
 */
const INDICE: GrupoIndice[] = [
  { label: 'Generalidades', entradas: [
    { id: 's1', label: '1. Antecedentes y objeto' },
    { id: 's2', label: '2. Responsable del tratamiento y contacto de protección de datos' },
    { id: 's3', label: '3. Definiciones' },
    { id: 's4', label: '4. Principios' },
  ] },
  { label: 'Datos personales', entradas: [
    { id: 's5', label: '5. Datos que tratamos' },
    { id: 's6', label: '6. Momento de la recolección (minimización y responsabilidad)' },
    { id: 's7', label: '7. Finalidades del tratamiento' },
    { id: 's8', label: '8. Base de licitud' },
    { id: 's9', label: '9. Sistema de Control Psicosocial y geolocalización' },
    { id: 's10', label: '10. Cookies y tecnologías similares' },
    { id: 's11', label: '11. Decisiones automatizadas y elaboración de perfiles' },
  ] },
  { label: 'Encargados y seguridad', entradas: [
    { id: 's12', label: '12. Encargados del tratamiento y transferencias internacionales' },
    { id: 's13', label: '13. Conservación' },
    { id: 's15', label: '14. Seguridad de la información' },
    { id: 's16', label: '15. Vulneraciones de seguridad' },
  ] },
  { label: 'Derechos', entradas: [
    { id: 's14', label: '16. Derechos del Titular' },
    { id: 'eliminar-datos', label: '17. Eliminación de datos' },
    { id: 's17', label: '18. Permisos otorgados y desafiliación' },
    { id: 's18', label: '19. Personas menores de edad' },
  ] },
  { label: 'Uso del sitio', entradas: [
    { id: 's19', label: '20. Términos de uso del sitio' },
    { id: 's20', label: '21. Modificaciones' },
    { id: 's22', label: '22. Contacto y autoridad de control' },
  ] },
];

const ULTIMA_ACTUALIZACION = '13 de noviembre de 2026';

export default function LegalPage() {
  return (
    <DocumentoLegal
      id="general"
      titulo="Términos y condiciones y política de privacidad"
      subtitulo="Tratamiento de los datos de los candidatos y miembros del proyecto, y condiciones de uso de este sitio."
      actualizado={ULTIMA_ACTUALIZACION}
      indice={INDICE}
    >

        <Titulo id="s1">1. Antecedentes y objeto</Titulo>
        <p className={pp}>
          El presente documento (en adelante, la “Política”) regula el uso de este sitio web y el{' '}
          <strong className={b}>tratamiento de datos personales</strong> de los usuarios, candidatos y
          miembros del proyecto (en adelante, “el Usuario” o “el Titular”), de conformidad con la{' '}
          <strong className={b}>Constitución de la República del Ecuador</strong> (artículo 66, numeral
          19), la <strong className={b}>Ley Orgánica de Protección de Datos Personales (LOPDP)</strong>,
          su <strong className={b}>Reglamento General</strong> y demás normativa aplicable. Al aceptar la
          Política, el Titular declara haberla leído y comprendido, y otorga su consentimiento{' '}
          <strong className={b}>libre, específico, informado e inequívoco</strong> para el tratamiento de
          sus datos en los términos aquí descritos. El responsable podrá actualizar esta Política, y
          la versión vigente se publicará siempre en esta página.
        </p>

        <Titulo id="s2">2. Responsable del tratamiento y contacto de protección de datos</Titulo>
        <p className={pp}>
          <strong className={b}>Alcance de esta Política.</strong> Esta Política regula el sitio web y
          los datos de los candidatos y miembros del proyecto, de los cuales el Grupo Corazones
          Cruzados es <strong className={b}>responsable</strong>. Las conversaciones de WhatsApp que
          atendemos <strong className={b}>por cuenta de empresas clientes</strong> no forman parte de
          esta Política, ya que en ese servicio el Grupo Corazones Cruzados actúa como{' '}
          <strong className={b}>encargado</strong> y la responsable es la empresa, conforme a su propio
          documento en{' '}
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

        <Titulo id="s4">4. Principios</Titulo>
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
          necesarios para las finalidades indicadas. A continuación se presentan las categorías de
          datos que podemos recabar:
        </p>
        <ul className={ul}>
          <li>
            <strong className={b}>Datos de postulación:</strong> nombres y apellidos, correo
            electrónico personal, la motivación que el Titular redacta (texto libre) y el registro de
            las aceptaciones que otorga (qué aceptó y cuándo). Estos datos se solicitan en el
            formulario de postulación.
          </li>
          <li>
            <strong className={b}>Datos del alta del candidato aceptado:</strong> al aprobarse la
            postulación se crea un <strong className={b}>correo corporativo</strong> con los nombres y
            apellidos del Titular, el cual reenvía los mensajes a su correo personal, y con ese correo
            el Titular completa su cuenta con su país, teléfono y dirección.
          </li>
          <li>
            <strong className={b}>Datos de cuenta y perfil:</strong> nombre de usuario, foto de
            perfil y contraseña (almacenada de forma cifrada) para el acceso y la recuperación de la
            cuenta.
          </li>
          <li>
            <strong className={b}>Datos técnicos y de conexión:</strong> identificadores de dispositivo,
            cookies o tokens de sesión y la <strong className={b}>dirección IP</strong>, los cuales se
            utilizan para reconocer si el Titular es nuevo o recurrente y para la seguridad del
            servicio.
          </li>
          <li>
            <strong className={b}>Datos de comunicación:</strong> los que el Titular nos proporcione al
            contactarnos o al participar en las reuniones del proyecto.
          </li>
          <li>
            <strong className={b}>Datos de ubicación y seguridad de los miembros:</strong> solo de los
            miembros que lo aceptan en el Sistema de Control Psicosocial (ver sección 9), los cuales son
            la ubicación con su precisión y su hora, el nivel de batería, las llegadas y salidas de los
            puntos de reunión y las alertas de auxilio.
          </li>
        </ul>

        <Titulo id="s6">6. Momento de la recolección (minimización y responsabilidad)</Titulo>
        <p className={pp}>
          Como medida de responsabilidad proactiva, <strong className={b}>los datos de postulación se
          recolectan y conservan únicamente cuando el Titular completa y envía el formulario de
          postulación</strong> y otorga su aceptación final. Antes de ese momento, la información
          que introduce permanece de forma temporal en su dispositivo, y no es transmitida ni
          almacenada por el responsable con fines de tratamiento.
        </p>

        <Titulo id="s7">7. Finalidades del tratamiento</Titulo>
        <ul className={ul}>
          <li>Gestionar la postulación y, en su caso, la afiliación del Titular al proyecto, incluida la
            creación de su correo corporativo.</li>
          <li>Crear y administrar su cuenta y permitir el acceso al sitio y a sus herramientas.</li>
          <li>Comunicarnos con el Titular respecto de su candidatura y del proyecto.</li>
          <li>Garantizar la seguridad del servicio y prevenir fraudes o usos indebidos.</li>
          <li>
            Proteger la seguridad de los miembros que lo aceptan, con el fin de localizarlos en una
            emergencia, avisar a los demás miembros y saber quién ha llegado a un punto de reunión.
          </li>
          <li>Cumplir obligaciones legales aplicables.</li>
        </ul>

        <Titulo id="s8">8. Base de licitud</Titulo>
        <p className={pp}>
          El tratamiento se sustenta principalmente en el <strong className={b}>consentimiento</strong>{' '}
          del Titular, otorgado al aceptar esta Política, así como, cuando corresponda, en la
          ejecución de medidas precontractuales a petición del Titular, en el interés legítimo del
          responsable o en el cumplimiento de obligaciones legales. El Titular puede{' '}
          <strong className={b}>retirar su consentimiento</strong> en cualquier momento, sin que ello
          afecte la licitud del tratamiento realizado con anterioridad (ver sección 16).
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
          anticipada. Hoy está en funcionamiento la herramienta de{' '}
          <strong className={b}>Rastreo</strong>, disponible únicamente para los{' '}
          <strong className={b}>miembros</strong> de la organización en la aplicación de su teléfono, y
          no se aplica a candidatos, clientes ni visitantes del sitio.
        </p>
        <ul className={ul}>
          <li>
            <strong className={b}>Ubicación.</strong> Si el miembro la activa, su teléfono envía la
            ubicación cada minuto, también con la aplicación cerrada, y cada 15 segundos durante un
            auxilio, junto con su precisión, su hora y el nivel de batería.
          </li>
          <li>
            <strong className={b}>Quién la ve.</strong> Todos los miembros, incluido el administrador,
            pueden ver la ubicación actual y el recorrido de quienes lo han aceptado. Cada consulta queda
            registrada, y el miembro puede ver quién la hizo.
          </li>
          <li>
            <strong className={b}>Puntos de reunión.</strong> Los marcan los administradores, y cuando un
            miembro llega a uno de ellos o sale de él, los demás miembros reciben un aviso y queda
            registrado.
          </li>
          <li>
            <strong className={b}>Detección de voz.</strong> Requiere un consentimiento aparte. Si el
            miembro la activa, el teléfono escucha de forma continua con el fin de detectar una frase de
            auxilio, y el audio se procesa solo dentro del teléfono, por lo que{' '}
            <strong className={b}>no se graba, no se guarda y no se envía</strong>. Al detectar la frase,
            el miembro tiene unos segundos para cancelar, y después se envía la alerta.
          </li>
          <li>
            <strong className={b}>Auxilio.</strong> Lo envía el miembro con un botón o con la frase de voz,
            y todos los miembros reciben la alerta y la ubicación de quien lo pidió. La plataforma{' '}
            <strong className={b}>no avisa por sí sola a las autoridades</strong>, ya que el botón del 911
            abre el marcador del teléfono y es la persona quien hace la llamada.
          </li>
          <li>
            <strong className={b}>Conservación.</strong> El recorrido, las llegadas y las salidas se
            eliminan a los 7 días. Lo registrado durante un auxilio se conserva junto con ese auxilio, al
            igual que la constancia de cada aceptación y retiro del consentimiento.
          </li>
          <li>
            <strong className={b}>Control del miembro.</strong> Nadie puede activar estas funciones por
            otra persona, y el teléfono muestra siempre que están en uso. El miembro puede apagarlas en
            cualquier momento desde la misma pantalla, y en ese momento su ubicación deja de enviarse y
            se eliminan su recorrido, sus llegadas y sus salidas.
          </li>
        </ul>
        <p className={pp}>
          Si en el futuro se habilitan otras herramientas que requieran datos, se solicitará el
          consentimiento explícito y separado correspondiente, y se adoptarán las garantías y, cuando
          proceda, la evaluación de impacto que exija la LOPDP. El Titular podrá negarse a cualquiera de
          estos tratamientos sin que ello le impida usar las funciones que no dependan de esos datos.
        </p>

        <Titulo id="s10">10. Cookies y tecnologías similares</Titulo>
        <p className={pp}>
          Utilizamos cookies o tokens de sesión estrictamente necesarios para el funcionamiento y la
          seguridad del sitio (por ejemplo, para mantener la sesión y distinguir entre usuarios
          nuevos y recurrentes). El Titular puede gestionar las cookies desde la configuración de su
          navegador, aunque deshabilitarlas puede afectar el funcionamiento de algunas funciones.
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
          tratamiento, algunos de ellos ubicados fuera del Ecuador, los cuales son los servicios de{' '}
          <strong className={b}>alojamiento e infraestructura</strong>, de{' '}
          <strong className={b}>correo electrónico</strong> (incluido Google Workspace, en donde se
          crean los correos corporativos), de <strong className={b}>inteligencia artificial</strong>{' '}
          para funciones del sitio, y de <strong className={b}>notificaciones</strong> de Google y Apple,
          por donde pasan los avisos que llegan al teléfono. El mapa del Sistema de Control Psicosocial
          se dibuja con <strong className={b}>OpenStreetMap</strong>, el cual recibe la zona que se está
          mirando. Estos encargados tratan los datos siguiendo nuestras instrucciones y con
          obligaciones de confidencialidad y seguridad. En las transferencias internacionales adoptamos las garantías
          adecuadas previstas en la LOPDP (cláusulas contractuales u otros mecanismos válidos).
        </p>

        <Titulo id="s13">13. Conservación</Titulo>
        <p className={pp}>
          Conservamos los datos durante el tiempo necesario para las finalidades descritas y mientras
          exista una relación con el Titular, y luego durante los plazos legales aplicables. Cumplidos
          dichos plazos, los datos se <strong className={b}>eliminan o anonimizan</strong> de forma
          segura. Los datos de ubicación del Sistema de Control Psicosocial tienen su propio plazo, descrito
          en la sección 9.
        </p>

        <Titulo id="s15">14. Seguridad de la información</Titulo>
        <p className={pp}>
          Aplicamos medidas técnicas y organizativas razonables para proteger los datos frente a
          accesos no autorizados, pérdida, alteración o divulgación (entre otras, cifrado de
          contraseñas, control de acceso y conexiones seguras). Ningún sistema es infalible, por lo
          que el Titular también es responsable de mantener la confidencialidad de sus credenciales.
        </p>

        <Titulo id="s16">15. Vulneraciones de seguridad</Titulo>
        <p className={pp}>
          Ante una vulneración de la seguridad de los datos personales que entrañe un riesgo para los
          derechos del Titular, notificaremos a la <strong className={b}>SPDP</strong> y, cuando
          corresponda, a los Titulares afectados, en el plazo previsto por la normativa{' '}
          (<strong className={b}>dentro de los cinco (5) días</strong> siguientes a su conocimiento),
          describiendo la naturaleza del incidente y las medidas adoptadas.
        </p>

        <Titulo id="s14">16. Derechos del Titular</Titulo>
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

        <Titulo id="eliminar-datos">17. Eliminación de datos</Titulo>
        <p className={pp}>
          El Titular puede solicitar la <strong className={b}>eliminación de sus datos personales</strong>{' '}
          en cualquier momento y de forma gratuita. Si su cuenta es de cliente o de candidato, puede
          hacerlo por sí mismo desde el sitio o desde la app GCC World, iniciando sesión y entrando en{' '}
          <strong className={b}>Configuración ▸ Perfil ▸ Eliminar mi cuenta</strong> (la papelera). Si
          no puede iniciar sesión, o su cuenta es de miembro, a continuación se presentan los pasos a
          seguir:
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

        <Titulo id="s17">18. Permisos otorgados y desafiliación</Titulo>
        <p className={pp}>
          La aceptación de esta Política implica la concesión de los permisos necesarios para las
          finalidades descritas. Sin perjuicio de los derechos del Titular reconocidos por la ley
          (sección 16), tales permisos se mantienen vigentes mientras el Titular forme parte del
          proyecto y <strong className={b}>se retiran cuando: (i) el Titular solicita voluntariamente su
          desafiliación, o (ii) se produce su desafiliación por incumplimiento de las reglas</strong>.
          En ambos casos cesa el tratamiento basado en dichos permisos y se procede conforme a la
          sección 13.
        </p>

        <Titulo id="s18">19. Personas menores de edad</Titulo>
        <p className={pp}>
          El sitio está dirigido a personas mayores de edad. El tratamiento de datos de niñas, niños
          y adolescentes, de ser el caso, se realizará únicamente con el consentimiento de su
          representante legal y con las garantías reforzadas que exige la LOPDP, atendiendo a su
          interés superior.
        </p>

        <Titulo id="s19">20. Términos de uso del sitio</Titulo>
        <p className={pp}>
          El Titular se compromete a usar el sitio de forma lícita y de buena fe, a proporcionar
          información veraz y a no realizar actividades que afecten la seguridad o el funcionamiento
          del servicio. El responsable podrá suspender o cancelar el acceso ante usos indebidos. Los
          contenidos y signos distintivos del proyecto pertenecen a sus titulares y no podrán
          utilizarse sin autorización.
        </p>
        {/* Apple, norma 1.2 (2026-11-13): los términos tienen que decir que no se tolera el contenido ofensivo ni a
            quien lo publica, y cómo se denuncia y se bloquea. Texto pendiente de que lo corrija Fernando. */}
        <p className={pp} id="contenido-de-usuarios">
          <strong className={b}>Contenido que publican los usuarios.</strong> No se tolera el contenido
          ofensivo, el acoso, el engaño ni el spam, ni a quien lo publica. Cualquier persona puede
          denunciar una publicación del Marketplace o un mensaje con el botón{' '}
          <strong className={b}>⋯ ▸ Denunciar</strong>, y bloquear a quien lo publicó con{' '}
          <strong className={b}>⋯ ▸ Bloquear</strong>, con lo cual deja de ver lo que esa persona
          publica, y puede desbloquearla en Configuración ▸ Perfil. Las denuncias se revisan en menos
          de 24 horas, y cuando el contenido incumple estas reglas se retira y se suspende la cuenta
          de quien lo publicó.
        </p>

        <Titulo id="s20">21. Modificaciones</Titulo>
        <p className={pp}>
          Podemos actualizar esta Política para reflejar cambios legales o del servicio. Publicaremos
          la versión vigente en esta página, indicando la fecha de última actualización. El uso
          continuado del sitio tras una actualización implica la aceptación de la versión vigente.
        </p>

        <Titulo id="s22">22. Contacto y autoridad de control</Titulo>
        <p className={pp}>
          Para cualquier consulta sobre esta Política o sobre el tratamiento de sus datos, el Titular
          puede escribir a{' '}
          <a href={`mailto:${CONTACTO}`} className={link}>
            {CONTACTO}
          </a>
          . La autoridad de control en materia de protección de datos en el Ecuador es la{' '}
          <strong className={b}>Superintendencia de Protección de Datos Personales (SPDP)</strong>.
        </p>

    </DocumentoLegal>
  );
}
