/**
 * SERVICIO DE AGENTE IA EN WHATSAPP — privacidad, condiciones y encargo del tratamiento.
 *
 * Esta página existe porque `/legal` describe a GCC como **responsable** del tratamiento
 * de los datos de candidatos y miembros del proyecto. Para el servicio de WhatsApp el
 * papel es EL CONTRARIO: los datos son de los clientes de la empresa contratante, la
 * empresa decide para qué se usan, y GCC solo los trata **por cuenta de ella**. Meter
 * las dos cosas en un mismo documento haría falso uno de los dos.
 *
 * Es también la URL que se declara ante Meta para la app de proveedor de tecnología, y
 * la que lee un revisor de App Review. Tres exigencias suyas están resueltas con ancla
 * propia para poder enlazarlas directamente:
 *   · #eliminar-datos → instrucciones de eliminación (Meta pide PASOS, no una promesa)
 *   · #autoridades    → compromisos ante solicitudes de autoridades
 *   · #condiciones    → condiciones del servicio
 *
 * ⚠️ REGLA QUE GOBIERNA ESTE ARCHIVO: aquí no se escribe ningún compromiso que el
 * sistema no cumpla ya. Cada afirmación técnica de la Parte A corresponde a código
 * desplegado (el cifrado, la firma del webhook, el aislamiento por canal, la purga de la
 * traza). Si algo cambia en el código y deja de ser cierto, se corrige AQUÍ el mismo día.
 *
 * AVISO: plantilla orientada al cumplimiento de la LOPDP; NO sustituye asesoría legal.
 */

import {
  pagina, articulo, h1, h2, h2Parte, ul, b, link, sutil, recuadro, tabla, th, td,
} from '../estilos';
import { RESPONSABLE, NOMBRE_COMERCIAL, RUC, DIRECCION, CONTACTO } from '../datos';

export const metadata = {
  title: 'Agente IA en WhatsApp — Privacidad y condiciones | Grupo Corazones Cruzados',
  description:
    'Cómo Grupo Corazones Cruzados trata los datos de las conversaciones de WhatsApp por cuenta de sus empresas clientes: qué datos, para qué, con quién, cuánto tiempo y cómo eliminarlos.',
};

const ULTIMA_ACTUALIZACION = '1 de agosto de 2026';

export default function LegalWhatsAppPage() {
  return (
    <main style={pagina}>
      <article style={articulo}>
        <h1 style={h1}>Servicio de Agente IA en WhatsApp</h1>
        <p style={{ ...sutil, marginTop: 4 }}>
          {NOMBRE_COMERCIAL} — Última actualización: {ULTIMA_ACTUALIZACION}
        </p>

        {/* ── Orientación ─────────────────────────────────────────────────────── */}
        <h2 style={h2}>Qué es este documento y a quién habla</h2>
        <p>
          {NOMBRE_COMERCIAL} ofrece un servicio que permite a una empresa conectar su
          propio número de <strong style={b}>WhatsApp Business</strong> a un agente de
          inteligencia artificial que atiende sus conversaciones. Este documento explica
          qué ocurre con los datos personales de ese servicio y bajo qué condiciones se
          presta. Tiene tres partes, dirigidas a públicos distintos:
        </p>
        <ul style={ul}>
          <li>
            <strong style={b}>Parte A — Privacidad.</strong> Para la persona que escribe
            por WhatsApp a una empresa que usa nuestro servicio.
          </li>
          <li>
            <strong style={b}>Parte B — Condiciones del servicio.</strong> Para la empresa
            que contrata el servicio.
          </li>
          <li>
            <strong style={b}>Parte C — Anexo de encargo del tratamiento.</strong> Las
            obligaciones que asumimos por escrito frente a esa empresa.
          </li>
        </ul>
        <p>
          Este documento <strong style={b}>no reemplaza</strong> a la{' '}
          <a href="/legal" style={link}>
            política general de {NOMBRE_COMERCIAL}
          </a>
          , que regula el sitio y los datos de las personas del propio proyecto. Aquella
          cubre un tratamiento distinto y con un rol distinto; esta prevalece para todo lo
          relativo al servicio de WhatsApp.
        </p>

        <h2 style={h2}>Quiénes somos</h2>
        <p>
          <strong style={b}>Prestador del servicio:</strong> {RESPONSABLE}, que opera bajo
          el nombre comercial <strong style={b}>{NOMBRE_COMERCIAL}</strong>.
          <br />
          <strong style={b}>RUC:</strong> {RUC}.
          <br />
          <strong style={b}>Dirección:</strong> {DIRECCION}.
          <br />
          <strong style={b}>Contacto y protección de datos:</strong>{' '}
          <a href={`mailto:${CONTACTO}`} style={link}>
            {CONTACTO}
          </a>
          .
        </p>

        {/* ═══════════════ PARTE A ═══════════════════════════════════════════════ */}
        <h2 style={h2Parte}>Parte A · Política de privacidad del servicio</h2>

        <h2 style={h2}>A.1 Quién decide y quién ejecuta</h2>
        <p>
          Esta es la distinción más importante de todo el documento:
        </p>
        <table style={tabla}>
          <thead>
            <tr>
              <th style={th}>Quién</th>
              <th style={th}>Papel</th>
              <th style={th}>Qué significa</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={td}>
                <strong style={b}>La empresa</strong> que conecta su número
              </td>
              <td style={td}>
                <strong style={b}>Responsable del tratamiento</strong>
              </td>
              <td style={td}>
                Es dueña de la relación con sus clientes. Decide para qué se usan los
                datos, qué contesta el agente, cuánto tiempo se conserva la conversación y
                cuándo se borra. Es a quien el titular reclama sus derechos.
              </td>
            </tr>
            <tr>
              <td style={td}>
                <strong style={b}>{NOMBRE_COMERCIAL}</strong>
              </td>
              <td style={td}>
                <strong style={b}>Encargado del tratamiento</strong>
              </td>
              <td style={td}>
                Trata los datos <em>únicamente por cuenta</em> de esa empresa y siguiendo
                sus instrucciones. No decide finalidades propias ni usa los datos para
                nada que no sea prestar el servicio.
              </td>
            </tr>
          </tbody>
        </table>
        <div style={recuadro('nota')}>
          <p style={{ margin: 0 }}>
            <strong style={b}>Si escribiste por WhatsApp a una empresa</strong> y quieres
            saber qué hacen con tus datos, la política que te aplica es{' '}
            <strong style={b}>la de esa empresa</strong>, no esta. Aquí solo explicamos la
            parte que ejecutamos nosotros por encargo suyo. Aun así, si nos escribes,
            trasladamos tu solicitud a la empresa y te lo confirmamos (sección A.10).
          </p>
        </div>

        <h2 style={h2}>A.2 Qué datos se tratan</h2>
        <p>
          Solo los que llegan por la propia conversación de WhatsApp o los que Meta envía
          junto a ella. No pedimos ni recogemos nada más:
        </p>
        <table style={tabla}>
          <thead>
            <tr>
              <th style={th}>Categoría</th>
              <th style={th}>Detalle</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={td}>Identificación del contacto</td>
              <td style={td}>
                El número de teléfono desde el que se escribe y el nombre que la persona
                tiene puesto en su perfil de WhatsApp.
              </td>
            </tr>
            <tr>
              <td style={td}>Contenido de la conversación</td>
              <td style={td}>
                Los mensajes intercambiados en ambos sentidos y su tipo (texto, imagen,
                audio, documento u otros), con la fecha y hora de cada uno.
              </td>
            </tr>
            <tr>
              <td style={td}>Ubicación</td>
              <td style={td}>
                <strong style={b}>Solo si la persona la comparte</strong> voluntariamente
                por WhatsApp, porque la empresa la necesita para atenderle (por ejemplo,
                una dirección de recogida). Nunca se obtiene de otra forma.
              </td>
            </tr>
            <tr>
              <td style={td}>Identificadores técnicos</td>
              <td style={td}>
                Los identificadores que asigna Meta al mensaje, al número y a la cuenta de
                WhatsApp Business. Sirven para no procesar dos veces el mismo mensaje.
              </td>
            </tr>
            <tr>
              <td style={td}>Registro de consumo</td>
              <td style={td}>
                Cuánto costó cada respuesta en unidades de procesamiento del modelo.{' '}
                <strong style={b}>No incluye el contenido</strong> de los mensajes.
              </td>
            </tr>
          </tbody>
        </table>
        <p>
          <strong style={b}>No tratamos datos sensibles a propósito.</strong> No los
          pedimos ni el agente los solicita. Si una persona los escribe por su cuenta en un
          mensaje, quedan dentro del contenido de la conversación y se les aplican las
          mismas medidas de seguridad y el mismo plazo de conservación.
        </p>

        <h2 style={h2}>A.3 Para qué se usan — y para qué no</h2>
        <p>
          La finalidad es <strong style={b}>una sola</strong>: atender la conversación por
          cuenta de la empresa, generando respuestas, decidiendo cuándo no responder y
          pasando el chat a una persona del equipo cuando hace falta.
        </p>
        <p>De forma expresa, {NOMBRE_COMERCIAL} se compromete a que los datos:</p>
        <ul style={ul}>
          <li>
            <strong style={b}>No se usan para entrenar modelos</strong> de inteligencia
            artificial, ni nuestros ni de terceros.
          </li>
          <li>
            <strong style={b}>No se venden, alquilan ni ceden</strong> a nadie, ni se usan
            con fines publicitarios o de perfilado comercial.
          </li>
          <li>
            <strong style={b}>No se cruzan entre empresas clientes distintas.</strong> Cada
            número conectado es un canal aislado: una conversación pertenece a un canal y
            el sistema no permite leerla desde otro.
          </li>
          <li>
            No se usan para ninguna finalidad propia de {NOMBRE_COMERCIAL}.
          </li>
        </ul>

        <h2 style={h2}>A.4 Base de licitud</h2>
        <p>
          La determina <strong style={b}>la empresa responsable</strong>, no nosotros. Con
          carácter general el tratamiento se ampara en la relación con el cliente y en el
          hecho de que es la propia persona quien inicia la conversación escribiendo al
          número de la empresa. Corresponde a la empresa informar de ello y recabar el
          consentimiento cuando la ley lo exija.
        </p>

        <h2 style={h2}>A.5 Respuestas automatizadas e intervención humana</h2>
        <p>
          Las respuestas las redacta un{' '}
          <strong style={b}>modelo de inteligencia artificial</strong>, a partir de la
          información que la empresa ha cargado sobre su negocio. Conviene saberlo:
        </p>
        <ul style={ul}>
          <li>
            El agente <strong style={b}>no toma decisiones</strong> con efectos jurídicos
            sobre las personas. Informa y atiende; no aprueba, deniega ni evalúa a nadie.
          </li>
          <li>
            <strong style={b}>Se puede pedir hablar con una persona en cualquier
            momento.</strong> El agente está instruido para pasar la conversación al equipo
            humano en cuanto se le solicita, y también lo hace por su cuenta cuando hay un
            reclamo o cuando no dispone del dato que se le pide.
          </li>
          <li>
            Cuando eso ocurre, el agente se apaga en ese chat y contesta una persona.
          </li>
        </ul>

        <h2 style={h2}>A.6 Con quién se comparten (subencargados)</h2>
        <p>
          Para prestar el servicio intervienen los siguientes proveedores, todos ellos
          tratando los datos por nuestra cuenta y bajo obligaciones de confidencialidad y
          seguridad. Algunos están fuera del Ecuador, por lo que existe{' '}
          <strong style={b}>transferencia internacional</strong> amparada en las garantías
          que prevé la LOPDP:
        </p>
        <table style={tabla}>
          <thead>
            <tr>
              <th style={th}>Proveedor</th>
              <th style={th}>Para qué</th>
              <th style={th}>Qué recibe</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={td}>
                <strong style={b}>Meta Platforms</strong> (WhatsApp Business Platform)
              </td>
              <td style={td}>Es el canal por el que viajan los mensajes.</td>
              <td style={td}>
                Los mensajes y el número, por la propia naturaleza de WhatsApp.
              </td>
            </tr>
            <tr>
              <td style={td}>
                <strong style={b}>Anthropic</strong> (modelo de IA)
              </td>
              <td style={td}>Redacta la respuesta.</td>
              <td style={td}>
                El texto de la conversación reciente y la información del negocio. La
                empresa usa <strong style={b}>su propia clave</strong> de acceso, de modo
                que la relación con el proveedor de IA es suya.
              </td>
            </tr>
            <tr>
              <td style={td}>
                <strong style={b}>Railway</strong> (alojamiento e infraestructura)
              </td>
              <td style={td}>Ejecuta la aplicación y aloja la base de datos.</td>
              <td style={td}>Los datos almacenados del servicio.</td>
            </tr>
          </tbody>
        </table>
        <p>
          Si en el futuro incorporamos o sustituimos un subencargado,{' '}
          <strong style={b}>se avisa a la empresa responsable antes</strong> de hacerlo,
          para que pueda oponerse (Parte C).
        </p>

        <h2 style={h2}>A.7 Seguridad</h2>
        <p>Medidas técnicas efectivamente aplicadas hoy:</p>
        <ul style={ul}>
          <li>
            <strong style={b}>Conexiones cifradas</strong> en todo el trayecto.
          </li>
          <li>
            <strong style={b}>Verificación criptográfica de cada mensaje entrante.</strong>{' '}
            Todo aviso que llega desde Meta se comprueba con una firma; el que no la supera
            se rechaza y queda registrado el intento.
          </li>
          <li>
            <strong style={b}>Secretos cifrados en reposo</strong> con AES-256-GCM. Además,
            cada secreto queda <em>atado</em> criptográficamente al canal y al campo al que
            pertenece: copiado a otro sitio de la base de datos, no se puede descifrar.
          </li>
          <li>
            <strong style={b}>Las claves no se pueden volver a leer</strong> una vez
            guardadas, ni siquiera desde el panel: solo se muestran los últimos caracteres
            para reconocerlas.
          </li>
          <li>
            <strong style={b}>Control de acceso por rol</strong> y aislamiento por canal:
            quien atiende un número no ve las conversaciones de otro.
          </li>
        </ul>

        <h2 style={h2}>A.8 Cuánto tiempo se conservan</h2>
        <table style={tabla}>
          <thead>
            <tr>
              <th style={th}>Qué</th>
              <th style={th}>Plazo</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={td}>Conversaciones y mensajes</td>
              <td style={td}>
                Mientras el servicio esté activo, porque son el historial de atención de la
                empresa. Se borran cuando la empresa lo pide, y{' '}
                <strong style={b}>de forma automática y completa al desconectar el
                número</strong> del servicio.
              </td>
            </tr>
            <tr>
              <td style={td}>
                Copia técnica de los avisos recibidos de Meta
                <br />
                <span style={sutil}>(traza de diagnóstico)</span>
              </td>
              <td style={td}>
                <strong style={b}>30 días</strong>, y después se elimina automáticamente. Es
                una copia duplicada que solo sirve para diagnosticar fallos.
              </td>
            </tr>
            <tr>
              <td style={td}>Registro de consumo del modelo</td>
              <td style={td}>
                Mientras dure el servicio. No contiene el contenido de los mensajes.
              </td>
            </tr>
          </tbody>
        </table>

        <h2 style={h2}>A.9 Vulneraciones de seguridad</h2>
        <p>
          Si se produce una vulneración que afecte a datos tratados por encargo,{' '}
          <strong style={b}>notificamos a la empresa responsable sin dilación
          indebida</strong> en cuanto tengamos conocimiento, describiendo lo ocurrido, los
          datos afectados y las medidas adoptadas, y colaborando en lo que necesite. La
          notificación a la <strong style={b}>Superintendencia de Protección de Datos
          Personales (SPDP)</strong> y, en su caso, a las personas afectadas corresponde a
          la empresa responsable, por serlo.
        </p>

        <h2 style={h2}>A.10 Derechos de las personas</h2>
        <p>
          Toda persona tiene derecho de{' '}
          <strong style={b}>acceso, rectificación y actualización, eliminación,
          oposición, anulación, portabilidad, suspensión y limitación</strong> del
          tratamiento, y a no ser objeto de decisiones automatizadas.
        </p>
        <p>
          Estos derechos <strong style={b}>se ejercen ante la empresa</strong> con la que se
          está conversando, que es la responsable. Si nos escribes a{' '}
          <a href={`mailto:${CONTACTO}`} style={link}>
            {CONTACTO}
          </a>
          , <strong style={b}>trasladamos tu solicitud a esa empresa</strong> y te
          confirmamos que lo hemos hecho; nosotros no podemos resolverla por nuestra cuenta,
          porque la decisión no nos corresponde. Si consideras vulnerados tus derechos,
          puedes reclamar ante la <strong style={b}>SPDP</strong>.
        </p>

        <h2 style={h2} id="autoridades">
          A.11 Solicitudes de autoridades
        </h2>
        <p>
          Cuando una autoridad nos requiera datos personales tratados por encargo de una
          empresa cliente, aplicamos estos compromisos:
        </p>
        <ul style={ul}>
          <li>
            <strong style={b}>Exigimos un requerimiento válido.</strong> Solo atendemos
            solicitudes formuladas por autoridad competente, por escrito y con fundamento
            legal. No entregamos datos por una petición informal.
          </li>
          <li>
            <strong style={b}>Avisamos antes a la empresa responsable</strong>, para que
            pueda ejercer sus derechos, salvo que una norma o una orden judicial nos
            prohíba comunicarlo. Si nos lo prohíben, avisamos en cuanto la prohibición
            decaiga.
          </li>
          <li>
            <strong style={b}>Impugnamos lo desproporcionado.</strong> Si el requerimiento
            es excesivo, genérico o carece de base legal, lo objetamos por los cauces
            disponibles.
          </li>
          <li>
            <strong style={b}>Entregamos el mínimo.</strong> Solo los datos estrictamente
            comprendidos en el requerimiento; nunca acceso general ni volcados completos.
          </li>
          <li>
            <strong style={b}>Dejamos constancia</strong> de cada solicitud recibida y de la
            respuesta dada.
          </li>
        </ul>

        <h2 style={h2} id="eliminar-datos">
          A.12 Cómo eliminar tus datos
        </h2>
        <p>
          <strong style={b}>Si eres una persona que escribió por WhatsApp</strong> a una
          empresa que usa este servicio:
        </p>
        <ol style={ul}>
          <li>
            Pídeselo directamente a esa empresa, por el mismo chat o por su canal de
            contacto. Es la responsable y puede resolverlo de inmediato.
          </li>
          <li>
            Si no sabes cómo llegar a ella, escríbenos a{' '}
            <a href={`mailto:${CONTACTO}`} style={link}>
              {CONTACTO}
            </a>{' '}
            con el asunto <strong style={b}>«Eliminación de datos — WhatsApp»</strong>,
            indicando <strong style={b}>el número de teléfono desde el que escribiste</strong>{' '}
            y el nombre de la empresa. Nos sirve para localizar la conversación; no pedimos
            ningún otro dato.
          </li>
          <li>
            Trasladamos la solicitud a la empresa responsable y{' '}
            <strong style={b}>te confirmamos por correo</strong> que lo hemos hecho, dentro
            de los <strong style={b}>quince (15) días</strong> siguientes.
          </li>
          <li>
            Una vez la empresa lo autoriza, se eliminan la conversación completa y el
            contacto asociado. La eliminación{' '}
            <strong style={b}>es definitiva y no reversible</strong>.
          </li>
        </ol>
        <p>
          <strong style={b}>Si eres la empresa cliente:</strong> puedes pedir en cualquier
          momento la eliminación de una conversación concreta o de todo el historial
          escribiendo a la misma dirección. Además,{' '}
          <strong style={b}>desconectar el número del servicio borra automáticamente</strong>{' '}
          todas las conversaciones, contactos y mensajes asociados a ese canal.
        </p>

        {/* ═══════════════ PARTE B ═══════════════════════════════════════════════ */}
        <h2 style={h2Parte} id="condiciones">
          Parte B · Condiciones del servicio para empresas clientes
        </h2>

        <h2 style={h2}>B.1 Objeto</h2>
        <p>
          {NOMBRE_COMERCIAL} presta a la empresa cliente un servicio de atención automatizada
          sobre su propio número de WhatsApp Business, que incluye la conexión del número, la
          configuración del agente con la información del negocio, la generación de
          respuestas y una bandeja de conversaciones.
        </p>

        <h2 style={h2}>B.2 Qué pone cada parte</h2>
        <ul style={ul}>
          <li>
            <strong style={b}>La empresa pone su número</strong> de WhatsApp Business y su
            portafolio de negocio de Meta. El número sigue siendo suyo en todo momento.
          </li>
          <li>
            <strong style={b}>La empresa pone su propia clave</strong> de acceso al proveedor
            de inteligencia artificial, y asume su coste. Nosotros la guardamos cifrada y la
            usamos exclusivamente para atender su canal.
          </li>
          <li>
            <strong style={b}>La empresa aporta la información del negocio</strong> con la
            que responde el agente, y es responsable de que sea veraz y esté al día.
          </li>
          <li>
            <strong style={b}>{NOMBRE_COMERCIAL} pone</strong> la plataforma, la integración
            con Meta como proveedor de tecnología, y la operación del servicio.
          </li>
        </ul>

        <h2 style={h2}>B.3 Coexistencia: el número no se pierde</h2>
        <p>
          El servicio se conecta en modo <strong style={b}>coexistencia</strong>: la empresa
          conserva la aplicación WhatsApp Business en el teléfono y el acceso por WhatsApp
          Web, y su equipo puede seguir atendiendo a mano.
        </p>
        <div style={recuadro('aviso')}>
          <p style={{ margin: 0 }}>
            <strong style={b}>Aviso importante durante la conexión.</strong> El asistente de
            Meta ofrece dos caminos: <em>conectar una cuenta existente</em> (coexistencia) o{' '}
            <em>dar de alta un número nuevo</em>. El segundo{' '}
            <strong style={b}>retira el número del teléfono</strong> y el equipo pierde
            WhatsApp Web de inmediato. Es <strong style={b}>irreversible</strong> y hay que
            evitarlo. Por eso la conexión se hace acompañada.
          </p>
        </div>

        <h2 style={h2}>B.4 Quién atiende</h2>
        <p>
          En la versión actual del servicio, la bandeja de conversaciones{' '}
          <strong style={b}>la opera {NOMBRE_COMERCIAL} por cuenta de la empresa</strong>,
          siguiendo sus instrucciones. La empresa recibe la información que solicite sobre la
          atención prestada. Cuando se habilite el acceso directo de la empresa a su propia
          bandeja, se le comunicará y estas condiciones se actualizarán.
        </p>

        <h2 style={h2}>B.5 Uso aceptable</h2>
        <p>La empresa se obliga a:</p>
        <ul style={ul}>
          <li>
            Cumplir las <strong style={b}>políticas de WhatsApp Business</strong> y las
            condiciones de Meta que resulten aplicables a su número.
          </li>
          <li>
            No usar el servicio para <strong style={b}>mensajería masiva no solicitada</strong>,
            ni para contenidos ilícitos, engañosos o prohibidos por dichas políticas.
          </li>
          <li>
            Informar a sus clientes del tratamiento de sus datos y recabar el consentimiento
            cuando corresponda, en su condición de responsable.
          </li>
          <li>Mantener la confidencialidad de las credenciales de acceso al panel.</li>
        </ul>
        <p>
          El incumplimiento de estas obligaciones puede acarrear la suspensión del número por
          parte de Meta, ajena a nuestro control, y faculta a {NOMBRE_COMERCIAL} para
          suspender el servicio.
        </p>

        <h2 style={h2}>B.6 Límites del servicio</h2>
        <ul style={ul}>
          <li>
            <strong style={b}>El agente puede equivocarse.</strong> Genera texto a partir de
            la información cargada y, como todo sistema de este tipo, puede producir
            respuestas inexactas. La empresa debe revisar la atención y mantener la
            supervisión humana. No se garantiza la exactitud del contenido generado.
          </li>
          <li>
            <strong style={b}>El agente no sustituye a una persona</strong> en asuntos
            sensibles: reclamos, cobros o compromisos contractuales deben pasar a una persona
            del equipo.
          </li>
          <li>
            El servicio depende de la disponibilidad de la plataforma de Meta y del proveedor
            de IA. No se ofrece garantía de disponibilidad ininterrumpida.
          </li>
          <li>
            El agente <strong style={b}>se enciende de forma manual</strong> y nunca por
            defecto, para que nadie empiece a responder sin haberlo probado antes.
          </li>
        </ul>

        <h2 style={h2}>B.7 Terminación</h2>
        <p>
          Cualquiera de las partes puede terminar el servicio. Al desconectar el número: el
          agente deja de responder de inmediato, la empresa conserva íntegro su número y su
          WhatsApp Business, y{' '}
          <strong style={b}>los datos de las conversaciones se eliminan</strong> conforme a la
          sección A.8, salvo que la empresa pida antes una copia.
        </p>

        {/* ═══════════════ PARTE C ═══════════════════════════════════════════════ */}
        <h2 style={h2Parte} id="encargo">
          Parte C · Anexo de encargo del tratamiento
        </h2>
        <p style={sutil}>
          Este anexo forma parte de las condiciones del servicio y regula el tratamiento de
          datos personales que {NOMBRE_COMERCIAL} realiza <strong style={b}>por cuenta</strong>{' '}
          de la empresa cliente, conforme a la Ley Orgánica de Protección de Datos Personales
          del Ecuador y su Reglamento General.
        </p>

        <h2 style={h2}>C.1 Alcance del encargo</h2>
        <table style={tabla}>
          <tbody>
            <tr>
              <td style={td}>
                <strong style={b}>Objeto</strong>
              </td>
              <td style={td}>
                Atención automatizada y asistida de las conversaciones de WhatsApp del
                responsable.
              </td>
            </tr>
            <tr>
              <td style={td}>
                <strong style={b}>Duración</strong>
              </td>
              <td style={td}>Mientras el número esté conectado al servicio.</td>
            </tr>
            <tr>
              <td style={td}>
                <strong style={b}>Naturaleza y finalidad</strong>
              </td>
              <td style={td}>
                Recepción, almacenamiento, consulta, generación de respuestas y supresión, con
                la única finalidad de atender esas conversaciones.
              </td>
            </tr>
            <tr>
              <td style={td}>
                <strong style={b}>Tipo de datos</strong>
              </td>
              <td style={td}>Los descritos en la sección A.2.</td>
            </tr>
            <tr>
              <td style={td}>
                <strong style={b}>Categorías de titulares</strong>
              </td>
              <td style={td}>
                Las personas que escriben al número de WhatsApp del responsable.
              </td>
            </tr>
          </tbody>
        </table>

        <h2 style={h2}>C.2 Obligaciones de {NOMBRE_COMERCIAL} como encargado</h2>
        <ul style={ul}>
          <li>
            <strong style={b}>Actuar solo bajo instrucciones</strong> del responsable, y
            advertirle si a nuestro juicio una instrucción infringe la normativa.
          </li>
          <li>
            <strong style={b}>No usar los datos para finalidad propia alguna</strong>, ni para
            entrenar modelos, ni cederlos a terceros distintos de los subencargados de la
            sección A.6.
          </li>
          <li>
            <strong style={b}>Confidencialidad</strong>, extensiva a toda persona autorizada
            para tratar los datos y subsistente tras el fin del encargo.
          </li>
          <li>
            <strong style={b}>Aplicar las medidas de seguridad</strong> de la sección A.7 y
            mantenerlas actualizadas.
          </li>
          <li>
            <strong style={b}>Subencargados:</strong> los de la sección A.6 quedan autorizados
            al aceptar estas condiciones. Cualquier alta o sustitución posterior{' '}
            <strong style={b}>se comunica previamente</strong> al responsable, que puede
            oponerse; si se opone y no hay alternativa, podrá terminar el servicio sin
            penalización.
          </li>
          <li>
            <strong style={b}>Asistir al responsable</strong> en la atención de los derechos de
            los titulares, en las evaluaciones de impacto y en las consultas a la autoridad,
            en la medida de la información de que dispongamos.
          </li>
          <li>
            <strong style={b}>Notificar las vulneraciones</strong> conforme a la sección A.9.
          </li>
          <li>
            <strong style={b}>Suprimir o devolver</strong> los datos al terminar el encargo, a
            elección del responsable, salvo obligación legal de conservación.
          </li>
          <li>
            <strong style={b}>Poner a disposición del responsable</strong> la información
            necesaria para acreditar el cumplimiento de estas obligaciones.
          </li>
        </ul>

        <h2 style={h2}>C.3 Obligaciones del responsable</h2>
        <ul style={ul}>
          <li>
            Determinar la finalidad y la base de licitud, e informar a los titulares del
            tratamiento y de la intervención de un encargado.
          </li>
          <li>
            Impartir instrucciones lícitas y documentadas, y mantener al día la información
            del negocio con la que responde el agente.
          </li>
          <li>
            Resolver el ejercicio de derechos de los titulares y las notificaciones a la
            autoridad de control.
          </li>
        </ul>

        <h2 style={h2}>C.4 Aceptación</h2>
        <p>
          Este anexo se entiende aceptado por la empresa cliente al conectar su número al
          servicio. A petición del responsable, {NOMBRE_COMERCIAL} suscribirá además un
          documento contractual separado con este mismo contenido.
        </p>

        <h2 style={h2}>Modificaciones</h2>
        <p>
          Podemos actualizar este documento para reflejar cambios legales o del servicio.
          Publicaremos siempre la versión vigente en esta página con su fecha. Los cambios que
          afecten al encargo del tratamiento se comunican previamente a las empresas clientes.
        </p>

        <p style={{ marginTop: 40 }}>
          <a href="/legal" style={link}>
            ← Política general de {NOMBRE_COMERCIAL}
          </a>
          {'   ·   '}
          <a href="/" style={link}>
            Inicio
          </a>
        </p>
      </article>
    </main>
  );
}
