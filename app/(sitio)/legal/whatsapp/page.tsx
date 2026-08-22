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

import type { Metadata } from 'next';
import DocumentoLegal, {
  Titulo, ul, b, link, p as pp, sutil, recuadro, tabla, th, td, type GrupoIndice,
} from '@/components/sitio/documento';
import { RESPONSABLE, NOMBRE_COMERCIAL, RUC, DIRECCION, CONTACTO } from '@/lib/negocio/datos';

export const metadata: Metadata = {
  title: 'Agente IA en WhatsApp — privacidad y condiciones',
  alternates: { canonical: '/legal/whatsapp' },
  description:
    'Cómo Grupo Corazones Cruzados trata los datos de las conversaciones de WhatsApp por cuenta de sus empresas clientes: qué datos, para qué, con quién, cuánto tiempo y cómo eliminarlos.',
};

const ULTIMA_ACTUALIZACION = '1 de agosto de 2026';

/** Las tres partes del documento son sus categorías naturales. */
const INDICE: GrupoIndice[] = [
  { label: 'Antes de empezar', entradas: [
    { id: 'que-es', label: 'Qué es este documento' },
    { id: 'quienes', label: 'Quiénes somos' },
  ] },
  { label: 'A · Privacidad', entradas: [
    { id: 'a1', label: 'Quién decide y quién ejecuta' },
    { id: 'a2', label: 'Qué datos se tratan' },
    { id: 'a3', label: 'Para qué se usan' },
    { id: 'a4', label: 'Base de licitud' },
    { id: 'a5', label: 'Respuestas automatizadas' },
    { id: 'a6', label: 'Con quién se comparten' },
    { id: 'a7', label: 'Seguridad' },
    { id: 'a8', label: 'Conservación' },
    { id: 'a9', label: 'Vulneraciones' },
    { id: 'a10', label: 'Derechos' },
    { id: 'autoridades', label: 'Solicitudes de autoridades' },
    { id: 'eliminar-datos', label: 'Cómo eliminar tus datos' },
  ] },
  { label: 'B · Condiciones del servicio', entradas: [
    { id: 'b1', label: 'Objeto' },
    { id: 'b2', label: 'Qué pone cada parte' },
    { id: 'b3', label: 'Coexistencia' },
    { id: 'b4', label: 'Quién atiende' },
    { id: 'b5', label: 'Uso aceptable' },
    { id: 'b6', label: 'Límites del servicio' },
    { id: 'b7', label: 'Terminación' },
  ] },
  { label: 'C · Anexo de encargo', entradas: [
    { id: 'c1', label: 'Alcance del encargo' },
    { id: 'c2', label: 'Nuestras obligaciones' },
    { id: 'c3', label: 'Obligaciones del responsable' },
    { id: 'c4', label: 'Aceptación' },
  ] },
];

export default function LegalWhatsAppPage() {
  return (
    <DocumentoLegal
      id="whatsapp"
      titulo="Servicio de Agente IA en WhatsApp"
      subtitulo="Privacidad, condiciones del servicio y anexo de encargo del tratamiento. Para quien escribe por WhatsApp, para la empresa que contrata y para quien revise cómo se tratan los datos."
      actualizado={ULTIMA_ACTUALIZACION}
      indice={INDICE}
    >

        {/* ── Orientación ─────────────────────────────────────────────────────── */}
        <Titulo id="que-es">Qué es este documento y a quién habla</Titulo>
        <p className={pp}>
          {NOMBRE_COMERCIAL} ofrece un servicio que permite a una empresa conectar su
          propio número de <strong className={b}>WhatsApp Business</strong> a un agente de
          inteligencia artificial que atiende sus conversaciones. Este documento explica
          qué ocurre con los datos personales de ese servicio y bajo qué condiciones se
          presta. Tiene tres partes, dirigidas a públicos distintos:
        </p>
        <ul className={ul}>
          <li>
            <strong className={b}>Parte A — Privacidad.</strong> Para la persona que escribe
            por WhatsApp a una empresa que usa nuestro servicio.
          </li>
          <li>
            <strong className={b}>Parte B — Condiciones del servicio.</strong> Para la empresa
            que contrata el servicio.
          </li>
          <li>
            <strong className={b}>Parte C — Anexo de encargo del tratamiento.</strong> Las
            obligaciones que asumimos por escrito frente a esa empresa.
          </li>
        </ul>
        <p className={pp}>
          Este documento <strong className={b}>no reemplaza</strong> a la{' '}
          <a href="/legal" className={link}>
            política general de {NOMBRE_COMERCIAL}
          </a>
          , que regula el sitio y los datos de las personas del propio proyecto. Aquella
          cubre un tratamiento distinto y con un rol distinto; esta prevalece para todo lo
          relativo al servicio de WhatsApp.
        </p>

        <Titulo id="quienes">Quiénes somos</Titulo>
        <p className={pp}>
          <strong className={b}>Prestador del servicio:</strong> {RESPONSABLE}, que opera bajo
          el nombre comercial <strong className={b}>{NOMBRE_COMERCIAL}</strong>.
          <br />
          <strong className={b}>RUC:</strong> {RUC}.
          <br />
          <strong className={b}>Dirección:</strong> {DIRECCION}.
          <br />
          <strong className={b}>Contacto y protección de datos:</strong>{' '}
          <a href={`mailto:${CONTACTO}`} className={link}>
            {CONTACTO}
          </a>
          .
        </p>

        {/* ═══════════════ PARTE A ═══════════════════════════════════════════════ */}
        <Titulo id="parte-a" parte>Parte A · Política de privacidad del servicio</Titulo>

        <Titulo id="a1">A.1 Quién decide y quién ejecuta</Titulo>
        <p className={pp}>
          Esta es la distinción más importante de todo el documento:
        </p>
        <table className={tabla}>
          <thead>
            <tr>
              <th className={th}>Quién</th>
              <th className={th}>Papel</th>
              <th className={th}>Qué significa</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={td}>
                <strong className={b}>La empresa</strong> que conecta su número
              </td>
              <td className={td}>
                <strong className={b}>Responsable del tratamiento</strong>
              </td>
              <td className={td}>
                Es dueña de la relación con sus clientes. Decide para qué se usan los
                datos, qué contesta el agente, cuánto tiempo se conserva la conversación y
                cuándo se borra. Es a quien el titular reclama sus derechos.
              </td>
            </tr>
            <tr>
              <td className={td}>
                <strong className={b}>{NOMBRE_COMERCIAL}</strong>
              </td>
              <td className={td}>
                <strong className={b}>Encargado del tratamiento</strong>
              </td>
              <td className={td}>
                Trata los datos <em>únicamente por cuenta</em> de esa empresa y siguiendo
                sus instrucciones. No decide finalidades propias ni usa los datos para
                nada que no sea prestar el servicio.
              </td>
            </tr>
          </tbody>
        </table>
        <div className={recuadro('nota')}>
          <p style={{ margin: 0 }}>
            <strong className={b}>Si escribiste por WhatsApp a una empresa</strong> y quieres
            saber qué hacen con tus datos, la política que te aplica es{' '}
            <strong className={b}>la de esa empresa</strong>, no esta. Aquí solo explicamos la
            parte que ejecutamos nosotros por encargo suyo. Aun así, si nos escribes,
            trasladamos tu solicitud a la empresa y te lo confirmamos (sección A.10).
          </p>
        </div>

        <Titulo id="a2">A.2 Qué datos se tratan</Titulo>
        <p className={pp}>
          Solo los que llegan por la propia conversación de WhatsApp o los que Meta envía
          junto a ella. No pedimos ni recogemos nada más:
        </p>
        <table className={tabla}>
          <thead>
            <tr>
              <th className={th}>Categoría</th>
              <th className={th}>Detalle</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={td}>Identificación del contacto</td>
              <td className={td}>
                El número de teléfono desde el que se escribe y el nombre que la persona
                tiene puesto en su perfil de WhatsApp.
              </td>
            </tr>
            <tr>
              <td className={td}>Contenido de la conversación</td>
              <td className={td}>
                Los mensajes intercambiados en ambos sentidos y su tipo (texto, imagen,
                audio, documento u otros), con la fecha y hora de cada uno.
              </td>
            </tr>
            <tr>
              <td className={td}>Ubicación</td>
              <td className={td}>
                <strong className={b}>Solo si la persona la comparte</strong> voluntariamente
                por WhatsApp, porque la empresa la necesita para atenderle (por ejemplo,
                una dirección de recogida). Nunca se obtiene de otra forma.
              </td>
            </tr>
            <tr>
              <td className={td}>Identificadores técnicos</td>
              <td className={td}>
                Los identificadores que asigna Meta al mensaje, al número y a la cuenta de
                WhatsApp Business. Sirven para no procesar dos veces el mismo mensaje.
              </td>
            </tr>
            <tr>
              <td className={td}>Registro de consumo</td>
              <td className={td}>
                Cuánto costó cada respuesta en unidades de procesamiento del modelo.{' '}
                <strong className={b}>No incluye el contenido</strong> de los mensajes.
              </td>
            </tr>
          </tbody>
        </table>
        <p className={pp}>
          <strong className={b}>No tratamos datos sensibles a propósito.</strong> No los
          pedimos ni el agente los solicita. Si una persona los escribe por su cuenta en un
          mensaje, quedan dentro del contenido de la conversación y se les aplican las
          mismas medidas de seguridad y el mismo plazo de conservación.
        </p>

        <Titulo id="a3">A.3 Para qué se usan — y para qué no</Titulo>
        <p className={pp}>
          La finalidad es <strong className={b}>una sola</strong>: atender la conversación por
          cuenta de la empresa, generando respuestas, decidiendo cuándo no responder y
          pasando el chat a una persona del equipo cuando hace falta.
        </p>
        <p className={pp}>De forma expresa, {NOMBRE_COMERCIAL} se compromete a que los datos:</p>
        <ul className={ul}>
          <li>
            <strong className={b}>No se usan para entrenar modelos</strong> de inteligencia
            artificial, ni nuestros ni de terceros.
          </li>
          <li>
            <strong className={b}>No se venden, alquilan ni ceden</strong> a nadie, ni se usan
            con fines publicitarios o de perfilado comercial.
          </li>
          <li>
            <strong className={b}>No se cruzan entre empresas clientes distintas.</strong> Cada
            número conectado es un canal aislado: una conversación pertenece a un canal y
            el sistema no permite leerla desde otro.
          </li>
          <li>
            No se usan para ninguna finalidad propia de {NOMBRE_COMERCIAL}.
          </li>
        </ul>

        <Titulo id="a4">A.4 Base de licitud</Titulo>
        <p className={pp}>
          La determina <strong className={b}>la empresa responsable</strong>, no nosotros. Con
          carácter general el tratamiento se ampara en la relación con el cliente y en el
          hecho de que es la propia persona quien inicia la conversación escribiendo al
          número de la empresa. Corresponde a la empresa informar de ello y recabar el
          consentimiento cuando la ley lo exija.
        </p>

        <Titulo id="a5">A.5 Respuestas automatizadas e intervención humana</Titulo>
        <p className={pp}>
          Las respuestas las redacta un{' '}
          <strong className={b}>modelo de inteligencia artificial</strong>, a partir de la
          información que la empresa ha cargado sobre su negocio. Conviene saberlo:
        </p>
        <ul className={ul}>
          <li>
            El agente <strong className={b}>no toma decisiones</strong> con efectos jurídicos
            sobre las personas. Informa y atiende; no aprueba, deniega ni evalúa a nadie.
          </li>
          <li>
            <strong className={b}>Se puede pedir hablar con una persona en cualquier
            momento.</strong> El agente está instruido para pasar la conversación al equipo
            humano en cuanto se le solicita, y también lo hace por su cuenta cuando hay un
            reclamo o cuando no dispone del dato que se le pide.
          </li>
          <li>
            Cuando eso ocurre, el agente se apaga en ese chat y contesta una persona.
          </li>
        </ul>

        <Titulo id="a6">A.6 Con quién se comparten (subencargados)</Titulo>
        <p className={pp}>
          Para prestar el servicio intervienen los siguientes proveedores, todos ellos
          tratando los datos por nuestra cuenta y bajo obligaciones de confidencialidad y
          seguridad. Algunos están fuera del Ecuador, por lo que existe{' '}
          <strong className={b}>transferencia internacional</strong> amparada en las garantías
          que prevé la LOPDP:
        </p>
        <table className={tabla}>
          <thead>
            <tr>
              <th className={th}>Proveedor</th>
              <th className={th}>Para qué</th>
              <th className={th}>Qué recibe</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={td}>
                <strong className={b}>Meta Platforms</strong> (WhatsApp Business Platform)
              </td>
              <td className={td}>Es el canal por el que viajan los mensajes.</td>
              <td className={td}>
                Los mensajes y el número, por la propia naturaleza de WhatsApp.
              </td>
            </tr>
            <tr>
              <td className={td}>
                <strong className={b}>OpenAI</strong> (modelo de IA)
              </td>
              <td className={td}>Redacta la respuesta.</td>
              <td className={td}>
                El texto de la conversación reciente y la información del negocio. La
                empresa usa <strong className={b}>su propia clave</strong> de acceso, de modo
                que la relación con el proveedor de IA es suya. Las conversaciones{' '}
                <strong className={b}>no quedan almacenadas como historial</strong> en el
                proveedor ni se usan para entrenar sus modelos: el historial vive
                únicamente en esta plataforma.
              </td>
            </tr>
            <tr>
              <td className={td}>
                <strong className={b}>Railway</strong> (alojamiento e infraestructura)
              </td>
              <td className={td}>Ejecuta la aplicación y aloja la base de datos.</td>
              <td className={td}>Los datos almacenados del servicio.</td>
            </tr>
          </tbody>
        </table>
        <p className={pp}>
          Si en el futuro incorporamos o sustituimos un subencargado,{' '}
          <strong className={b}>se avisa a la empresa responsable antes</strong> de hacerlo,
          para que pueda oponerse (Parte C).
        </p>

        <Titulo id="a7">A.7 Seguridad</Titulo>
        <p className={pp}>Medidas técnicas efectivamente aplicadas hoy:</p>
        <ul className={ul}>
          <li>
            <strong className={b}>Conexiones cifradas</strong> en todo el trayecto.
          </li>
          <li>
            <strong className={b}>Verificación criptográfica de cada mensaje entrante.</strong>{' '}
            Todo aviso que llega desde Meta se comprueba con una firma; el que no la supera
            se rechaza y queda registrado el intento.
          </li>
          <li>
            <strong className={b}>Secretos cifrados en reposo</strong> con AES-256-GCM. Además,
            cada secreto queda <em>atado</em> criptográficamente al canal y al campo al que
            pertenece: copiado a otro sitio de la base de datos, no se puede descifrar.
          </li>
          <li>
            <strong className={b}>Las claves no se pueden volver a leer</strong> una vez
            guardadas, ni siquiera desde el panel: solo se muestran los últimos caracteres
            para reconocerlas.
          </li>
          <li>
            <strong className={b}>Control de acceso por rol</strong> y aislamiento por canal:
            quien atiende un número no ve las conversaciones de otro.
          </li>
        </ul>

        <Titulo id="a8">A.8 Cuánto tiempo se conservan</Titulo>
        <table className={tabla}>
          <thead>
            <tr>
              <th className={th}>Qué</th>
              <th className={th}>Plazo</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={td}>Conversaciones y mensajes</td>
              <td className={td}>
                Mientras el servicio esté activo, porque son el historial de atención de la
                empresa. Se borran cuando la empresa lo pide, y{' '}
                <strong className={b}>de forma automática y completa al desconectar el
                número</strong> del servicio.
              </td>
            </tr>
            <tr>
              <td className={td}>
                Copia técnica de los avisos recibidos de Meta
                <br />
                <span className={sutil}>(traza de diagnóstico)</span>
              </td>
              <td className={td}>
                <strong className={b}>30 días</strong>, y después se elimina automáticamente. Es
                una copia duplicada que solo sirve para diagnosticar fallos.
              </td>
            </tr>
            <tr>
              <td className={td}>Registro de consumo del modelo</td>
              <td className={td}>
                Mientras dure el servicio. No contiene el contenido de los mensajes.
              </td>
            </tr>
          </tbody>
        </table>

        <Titulo id="a9">A.9 Vulneraciones de seguridad</Titulo>
        <p className={pp}>
          Si se produce una vulneración que afecte a datos tratados por encargo,{' '}
          <strong className={b}>notificamos a la empresa responsable sin dilación
          indebida</strong> en cuanto tengamos conocimiento, describiendo lo ocurrido, los
          datos afectados y las medidas adoptadas, y colaborando en lo que necesite. La
          notificación a la <strong className={b}>Superintendencia de Protección de Datos
          Personales (SPDP)</strong> y, en su caso, a las personas afectadas corresponde a
          la empresa responsable, por serlo.
        </p>

        <Titulo id="a10">A.10 Derechos de las personas</Titulo>
        <p className={pp}>
          Toda persona tiene derecho de{' '}
          <strong className={b}>acceso, rectificación y actualización, eliminación,
          oposición, anulación, portabilidad, suspensión y limitación</strong> del
          tratamiento, y a no ser objeto de decisiones automatizadas.
        </p>
        <p className={pp}>
          Estos derechos <strong className={b}>se ejercen ante la empresa</strong> con la que se
          está conversando, que es la responsable. Si nos escribes a{' '}
          <a href={`mailto:${CONTACTO}`} className={link}>
            {CONTACTO}
          </a>
          , <strong className={b}>trasladamos tu solicitud a esa empresa</strong> y te
          confirmamos que lo hemos hecho; nosotros no podemos resolverla por nuestra cuenta,
          porque la decisión no nos corresponde. Si consideras vulnerados tus derechos,
          puedes reclamar ante la <strong className={b}>SPDP</strong>.
        </p>

        <Titulo id="autoridades">A.11 Solicitudes de autoridades</Titulo>
        <p className={pp}>
          Cuando una autoridad nos requiera datos personales tratados por encargo de una
          empresa cliente, aplicamos estos compromisos:
        </p>
        <ul className={ul}>
          <li>
            <strong className={b}>Exigimos un requerimiento válido.</strong> Solo atendemos
            solicitudes formuladas por autoridad competente, por escrito y con fundamento
            legal. No entregamos datos por una petición informal.
          </li>
          <li>
            <strong className={b}>Avisamos antes a la empresa responsable</strong>, para que
            pueda ejercer sus derechos, salvo que una norma o una orden judicial nos
            prohíba comunicarlo. Si nos lo prohíben, avisamos en cuanto la prohibición
            decaiga.
          </li>
          <li>
            <strong className={b}>Impugnamos lo desproporcionado.</strong> Si el requerimiento
            es excesivo, genérico o carece de base legal, lo objetamos por los cauces
            disponibles.
          </li>
          <li>
            <strong className={b}>Entregamos el mínimo.</strong> Solo los datos estrictamente
            comprendidos en el requerimiento; nunca acceso general ni volcados completos.
          </li>
          <li>
            <strong className={b}>Dejamos constancia</strong> de cada solicitud recibida y de la
            respuesta dada.
          </li>
        </ul>

        <Titulo id="eliminar-datos">A.12 Cómo eliminar tus datos</Titulo>
        <p className={pp}>
          <strong className={b}>Si eres una persona que escribió por WhatsApp</strong> a una
          empresa que usa este servicio:
        </p>
        <ol className={ul}>
          <li>
            Pídeselo directamente a esa empresa, por el mismo chat o por su canal de
            contacto. Es la responsable y puede resolverlo de inmediato.
          </li>
          <li>
            Si no sabes cómo llegar a ella, escríbenos a{' '}
            <a href={`mailto:${CONTACTO}`} className={link}>
              {CONTACTO}
            </a>{' '}
            con el asunto <strong className={b}>«Eliminación de datos — WhatsApp»</strong>,
            indicando <strong className={b}>el número de teléfono desde el que escribiste</strong>{' '}
            y el nombre de la empresa. Nos sirve para localizar la conversación; no pedimos
            ningún otro dato.
          </li>
          <li>
            Trasladamos la solicitud a la empresa responsable y{' '}
            <strong className={b}>te confirmamos por correo</strong> que lo hemos hecho, dentro
            de los <strong className={b}>quince (15) días</strong> siguientes.
          </li>
          <li>
            Una vez la empresa lo autoriza, se eliminan la conversación completa y el
            contacto asociado. La eliminación{' '}
            <strong className={b}>es definitiva y no reversible</strong>.
          </li>
        </ol>
        <p className={pp}>
          <strong className={b}>Si eres la empresa cliente:</strong> puedes pedir en cualquier
          momento la eliminación de una conversación concreta o de todo el historial
          escribiendo a la misma dirección. Además,{' '}
          <strong className={b}>desconectar el número del servicio borra automáticamente</strong>{' '}
          todas las conversaciones, contactos y mensajes asociados a ese canal.
        </p>

        {/* ═══════════════ PARTE B ═══════════════════════════════════════════════ */}
        <Titulo id="condiciones" parte>Parte B · Condiciones del servicio para empresas clientes</Titulo>

        <Titulo id="b1">B.1 Objeto</Titulo>
        <p className={pp}>
          {NOMBRE_COMERCIAL} presta a la empresa cliente un servicio de atención automatizada
          sobre su propio número de WhatsApp Business, que incluye la conexión del número, la
          configuración del agente con la información del negocio, la generación de
          respuestas y una bandeja de conversaciones.
        </p>

        <Titulo id="b2">B.2 Qué pone cada parte</Titulo>
        <ul className={ul}>
          <li>
            <strong className={b}>La empresa pone su número</strong> de WhatsApp Business y su
            portafolio de negocio de Meta. El número sigue siendo suyo en todo momento.
          </li>
          <li>
            <strong className={b}>La empresa pone su propia clave</strong> de acceso al proveedor
            de inteligencia artificial, y asume su coste. Nosotros la guardamos cifrada y la
            usamos exclusivamente para atender su canal.
          </li>
          <li>
            <strong className={b}>La empresa aporta la información del negocio</strong> con la
            que responde el agente, y es responsable de que sea veraz y esté al día.
          </li>
          <li>
            <strong className={b}>{NOMBRE_COMERCIAL} pone</strong> la plataforma, la integración
            con Meta como proveedor de tecnología, y la operación del servicio.
          </li>
        </ul>

        <Titulo id="b3">B.3 Coexistencia: el número no se pierde</Titulo>
        <p className={pp}>
          El servicio se conecta en modo <strong className={b}>coexistencia</strong>: la empresa
          conserva la aplicación WhatsApp Business en el teléfono y el acceso por WhatsApp
          Web, y su equipo puede seguir atendiendo a mano.
        </p>
        <div className={recuadro('aviso')}>
          <p style={{ margin: 0 }}>
            <strong className={b}>Aviso importante durante la conexión.</strong> El asistente de
            Meta ofrece dos caminos: <em>conectar una cuenta existente</em> (coexistencia) o{' '}
            <em>dar de alta un número nuevo</em>. El segundo{' '}
            <strong className={b}>retira el número del teléfono</strong> y el equipo pierde
            WhatsApp Web de inmediato. Es <strong className={b}>irreversible</strong> y hay que
            evitarlo. Por eso la conexión se hace acompañada.
          </p>
        </div>

        <Titulo id="b4">B.4 Quién atiende</Titulo>
        <p className={pp}>
          En la versión actual del servicio, la bandeja de conversaciones{' '}
          <strong className={b}>la opera {NOMBRE_COMERCIAL} por cuenta de la empresa</strong>,
          siguiendo sus instrucciones. La empresa recibe la información que solicite sobre la
          atención prestada. Cuando se habilite el acceso directo de la empresa a su propia
          bandeja, se le comunicará y estas condiciones se actualizarán.
        </p>

        <Titulo id="b5">B.5 Uso aceptable</Titulo>
        <p className={pp}>La empresa se obliga a:</p>
        <ul className={ul}>
          <li>
            Cumplir las <strong className={b}>políticas de WhatsApp Business</strong> y las
            condiciones de Meta que resulten aplicables a su número.
          </li>
          <li>
            No usar el servicio para <strong className={b}>mensajería masiva no solicitada</strong>,
            ni para contenidos ilícitos, engañosos o prohibidos por dichas políticas.
          </li>
          <li>
            Informar a sus clientes del tratamiento de sus datos y recabar el consentimiento
            cuando corresponda, en su condición de responsable.
          </li>
          <li>Mantener la confidencialidad de las credenciales de acceso al panel.</li>
        </ul>
        <p className={pp}>
          El incumplimiento de estas obligaciones puede acarrear la suspensión del número por
          parte de Meta, ajena a nuestro control, y faculta a {NOMBRE_COMERCIAL} para
          suspender el servicio.
        </p>

        <Titulo id="b6">B.6 Límites del servicio</Titulo>
        <ul className={ul}>
          <li>
            <strong className={b}>El agente puede equivocarse.</strong> Genera texto a partir de
            la información cargada y, como todo sistema de este tipo, puede producir
            respuestas inexactas. La empresa debe revisar la atención y mantener la
            supervisión humana. No se garantiza la exactitud del contenido generado.
          </li>
          <li>
            <strong className={b}>El agente no sustituye a una persona</strong> en asuntos
            sensibles: reclamos, cobros o compromisos contractuales deben pasar a una persona
            del equipo.
          </li>
          <li>
            El servicio depende de la disponibilidad de la plataforma de Meta y del proveedor
            de IA. No se ofrece garantía de disponibilidad ininterrumpida.
          </li>
          <li>
            El agente <strong className={b}>se enciende de forma manual</strong> y nunca por
            defecto, para que nadie empiece a responder sin haberlo probado antes.
          </li>
        </ul>

        <Titulo id="b7">B.7 Terminación</Titulo>
        <p className={pp}>
          Cualquiera de las partes puede terminar el servicio. Al desconectar el número: el
          agente deja de responder de inmediato, la empresa conserva íntegro su número y su
          WhatsApp Business, y{' '}
          <strong className={b}>los datos de las conversaciones se eliminan</strong> conforme a la
          sección A.8, salvo que la empresa pida antes una copia.
        </p>

        {/* ═══════════════ PARTE C ═══════════════════════════════════════════════ */}
        <Titulo id="encargo" parte>Parte C · Anexo de encargo del tratamiento</Titulo>
        <p className={sutil}>
          Este anexo forma parte de las condiciones del servicio y regula el tratamiento de
          datos personales que {NOMBRE_COMERCIAL} realiza <strong className={b}>por cuenta</strong>{' '}
          de la empresa cliente, conforme a la Ley Orgánica de Protección de Datos Personales
          del Ecuador y su Reglamento General.
        </p>

        <Titulo id="c1">C.1 Alcance del encargo</Titulo>
        <table className={tabla}>
          <tbody>
            <tr>
              <td className={td}>
                <strong className={b}>Objeto</strong>
              </td>
              <td className={td}>
                Atención automatizada y asistida de las conversaciones de WhatsApp del
                responsable.
              </td>
            </tr>
            <tr>
              <td className={td}>
                <strong className={b}>Duración</strong>
              </td>
              <td className={td}>Mientras el número esté conectado al servicio.</td>
            </tr>
            <tr>
              <td className={td}>
                <strong className={b}>Naturaleza y finalidad</strong>
              </td>
              <td className={td}>
                Recepción, almacenamiento, consulta, generación de respuestas y supresión, con
                la única finalidad de atender esas conversaciones.
              </td>
            </tr>
            <tr>
              <td className={td}>
                <strong className={b}>Tipo de datos</strong>
              </td>
              <td className={td}>Los descritos en la sección A.2.</td>
            </tr>
            <tr>
              <td className={td}>
                <strong className={b}>Categorías de titulares</strong>
              </td>
              <td className={td}>
                Las personas que escriben al número de WhatsApp del responsable.
              </td>
            </tr>
          </tbody>
        </table>

        <Titulo id="c2">C.2 Obligaciones de {NOMBRE_COMERCIAL} como encargado</Titulo>
        <ul className={ul}>
          <li>
            <strong className={b}>Actuar solo bajo instrucciones</strong> del responsable, y
            advertirle si a nuestro juicio una instrucción infringe la normativa.
          </li>
          <li>
            <strong className={b}>No usar los datos para finalidad propia alguna</strong>, ni para
            entrenar modelos, ni cederlos a terceros distintos de los subencargados de la
            sección A.6.
          </li>
          <li>
            <strong className={b}>Confidencialidad</strong>, extensiva a toda persona autorizada
            para tratar los datos y subsistente tras el fin del encargo.
          </li>
          <li>
            <strong className={b}>Aplicar las medidas de seguridad</strong> de la sección A.7 y
            mantenerlas actualizadas.
          </li>
          <li>
            <strong className={b}>Subencargados:</strong> los de la sección A.6 quedan autorizados
            al aceptar estas condiciones. Cualquier alta o sustitución posterior{' '}
            <strong className={b}>se comunica previamente</strong> al responsable, que puede
            oponerse; si se opone y no hay alternativa, podrá terminar el servicio sin
            penalización.
          </li>
          <li>
            <strong className={b}>Asistir al responsable</strong> en la atención de los derechos de
            los titulares, en las evaluaciones de impacto y en las consultas a la autoridad,
            en la medida de la información de que dispongamos.
          </li>
          <li>
            <strong className={b}>Notificar las vulneraciones</strong> conforme a la sección A.9.
          </li>
          <li>
            <strong className={b}>Suprimir o devolver</strong> los datos al terminar el encargo, a
            elección del responsable, salvo obligación legal de conservación.
          </li>
          <li>
            <strong className={b}>Poner a disposición del responsable</strong> la información
            necesaria para acreditar el cumplimiento de estas obligaciones.
          </li>
        </ul>

        <Titulo id="c3">C.3 Obligaciones del responsable</Titulo>
        <ul className={ul}>
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

        <Titulo id="c4">C.4 Aceptación</Titulo>
        <p className={pp}>
          Este anexo se entiende aceptado por la empresa cliente al conectar su número al
          servicio. A petición del responsable, {NOMBRE_COMERCIAL} suscribirá además un
          documento contractual separado con este mismo contenido.
        </p>

        <Titulo id="modificaciones">Modificaciones</Titulo>
        <p className={pp}>
          Podemos actualizar este documento para reflejar cambios legales o del servicio.
          Publicaremos siempre la versión vigente en esta página con su fecha. Los cambios que
          afecten al encargo del tratamiento se comunican previamente a las empresas clientes.
        </p>

    </DocumentoLegal>
  );
}
