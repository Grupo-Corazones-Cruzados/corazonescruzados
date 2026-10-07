package org.grupocc.gccworld.reloj;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.service.notification.StatusBarNotification;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.Person;
import androidx.core.app.RemoteInput;
import org.grupocc.gccworld.MainActivity;
import org.grupocc.gccworld.R;

/**
 * AVISOS DE CHAT, COMO WHATSAPP (Fernando, 2026-10-07).
 *
 *  · Una notificación POR CONVERSACIÓN (`chat` = «grupo» o «ticket:41»): los mensajes nuevos se
 *    van sumando a la misma (MessagingStyle), no se apilan sueltos.
 *  · Botón «Responder» con texto (RemoteInput): `ResponderReceiver` lo envía al servidor con la
 *    sesión de la app, aunque esté cerrada.
 *  · Tocarla abre la conversación (`/dashboard?chat=…`).
 *  · Con la app en primer plano no se avisa: el chat ya se ve en pantalla.
 */
public final class Chats {
    static final String CANAL = "chats";
    static final String CLAVE_TEXTO = "texto";
    static final String ACCION_RESPONDER = "org.grupocc.gccworld.RESPONDER";
    private static final int MORADO = 0xFF4B2D8E;

    private Chats() {}

    static int idDe(String chat) { return 500_000_000 + Math.abs(chat.hashCode() % 400_000_000); }

    static void crearCanal(Context c) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel canal = new NotificationChannel(CANAL, "Chats", NotificationManager.IMPORTANCE_HIGH);
        canal.setDescription("Mensajes nuevos de tus chats.");
        c.getSystemService(NotificationManager.class).createNotificationChannel(canal);
    }

    /** El estilo de mensajes que ya tenía la notificación de esa conversación, o uno nuevo. */
    private static NotificationCompat.MessagingStyle estiloDe(Context c, String chat, String titulo) {
        int id = idDe(chat);
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        for (StatusBarNotification sbn : nm.getActiveNotifications()) {
            if (sbn.getId() == id) {
                NotificationCompat.MessagingStyle viejo =
                    NotificationCompat.MessagingStyle.extractMessagingStyleFromNotification(sbn.getNotification());
                if (viejo != null) return viejo;
            }
        }
        NotificationCompat.MessagingStyle nuevo = new NotificationCompat.MessagingStyle(new Person.Builder().setName("Tú").build());
        nuevo.setConversationTitle(titulo);
        nuevo.setGroupConversation(true);
        return nuevo;
    }

    /** Mensaje de otra persona. */
    public static void mostrar(Context c, String chat, String titulo, String remitente, String mensaje, String ruta) {
        if (chat == null || chat.isEmpty()) return;
        if (MainActivity.enPrimerPlano) return;
        crearCanal(c);
        if (!Relojes.puedeAvisar(c)) return;
        NotificationCompat.MessagingStyle estilo = estiloDe(c, chat, titulo);
        estilo.addMessage(mensaje, System.currentTimeMillis(), new Person.Builder().setName(remitente).build());
        publicar(c, chat, titulo, ruta, estilo, true);
    }

    /** Tras responder desde el aviso: se añade «Tú: …» (o el error) y se deja sin sonido. */
    static void anotarRespuesta(Context c, String chat, String titulo, String ruta, String texto) {
        NotificationCompat.MessagingStyle estilo = estiloDe(c, chat, titulo);
        estilo.addMessage(texto, System.currentTimeMillis(), (Person) null);
        publicar(c, chat, titulo, ruta, estilo, false);
    }

    private static void publicar(Context c, String chat, String titulo, String ruta,
                                 NotificationCompat.MessagingStyle estilo, boolean sonar) {
        int id = idDe(chat);
        Intent abrir = new Intent(c, MainActivity.class)
            .putExtra(MainActivity.EXTRA_RUTA, ruta != null && ruta.startsWith("/") ? ruta : "/dashboard")
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent alTocar = PendingIntent.getActivity(c, id, abrir,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Intent responder = new Intent(c, ResponderReceiver.class)
            .setAction(ACCION_RESPONDER)
            .putExtra("chat", chat).putExtra("titulo", titulo).putExtra("ruta", ruta);
        // RemoteInput exige un PendingIntent MUTABLE: el sistema le añade el texto escrito.
        PendingIntent alResponder = PendingIntent.getBroadcast(c, id, responder,
            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0));
        NotificationCompat.Action accion = new NotificationCompat.Action.Builder(R.drawable.ic_gcc, "Responder", alResponder)
            .addRemoteInput(new RemoteInput.Builder(CLAVE_TEXTO).setLabel("Mensaje").build())
            .setAllowGeneratedReplies(true)
            .setSemanticAction(NotificationCompat.Action.SEMANTIC_ACTION_REPLY)
            .build();

        Notification n = new NotificationCompat.Builder(c, CANAL)
            .setSmallIcon(R.drawable.ic_gcc)
            .setColor(MORADO)
            .setStyle(estilo)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setAutoCancel(true)
            .setOnlyAlertOnce(!sonar)
            .setContentIntent(alTocar)
            .addAction(accion)
            .build();
        try { NotificationManagerCompat.from(c).notify(id, n); } catch (SecurityException ignorada) { }
    }

    /** Ruta del servidor y cuerpo para enviar a esa conversación. */
    static String[] destino(String chat, String texto) throws org.json.JSONException {
        org.json.JSONObject cuerpo = new org.json.JSONObject().put("body", texto);
        if ("grupo".equals(chat)) return new String[] { "/api/chat/grupo", cuerpo.toString(), "/api/chat/grupo/leido" };
        String[] p = chat.split(":", 2);
        cuerpo.put("kind", p[0]).put("ref", p.length > 1 ? p[1] : "");
        return new String[] { "/api/chat/personales/mensajes", cuerpo.toString(), "/api/chat/personales/leido" };
    }
}
