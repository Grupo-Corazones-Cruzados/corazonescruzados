package org.grupocc.gccworld.reloj;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import java.text.NumberFormat;
import java.time.Instant;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import org.grupocc.gccworld.MainActivity;
import org.grupocc.gccworld.R;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * EL RELOJ DEL TICKET EN LA NOTIFICACIÓN (Fernando, 2026-10-06).
 *
 * El reloj vive en el servidor (`ticket_actions.timer_started_at`). Aquí NO se cuenta nada:
 * se le da a Android la hora desde la que contar (`inicio`, que ya trae restado lo acumulado)
 * y el sistema dibuja el cronómetro solo, con la app cerrada o el teléfono bloqueado.
 *
 * Todo pasa por `aplicar(lista)`: la lista es la verdad del servidor y la notificación se
 * ajusta a ella — aparece lo que se arrancó en el computador, desaparece lo que se detuvo
 * allí. Una parada hecha aquí y aún sin enviar (sin conexión) manda sobre la lista: el
 * servidor todavía no la conoce y volvería a enseñar el reloj contando.
 */
public final class Relojes {
    public static final String BASE = "https://app.grupocc.org";
    static final String CANAL = "reloj-ticket";
    static final String PREFS = "relojes";
    static final String K_MOSTRADOS = "mostrados";
    static final String K_PENDIENTES = "pendientes";
    static final String ACCION_DETENER = "org.grupocc.gccworld.DETENER";
    private static final int MORADO = 0xFF4B2D8E;

    private Relojes() {}

    static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static void crearCanal(Context c) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel canal = new NotificationChannel(CANAL, "Reloj del ticket", NotificationManager.IMPORTANCE_LOW);
        canal.setDescription("El tiempo que llevas en un ticket, mientras el reloj está en marcha.");
        canal.setShowBadge(false);
        canal.setSound(null, null);
        canal.enableVibration(false);
        c.getSystemService(NotificationManager.class).createNotificationChannel(canal);
    }

    static boolean puedeAvisar(Context c) {
        if (Build.VERSION.SDK_INT >= 33
            && ContextCompat.checkSelfPermission(c, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            return false;
        }
        return NotificationManagerCompat.from(c).areNotificationsEnabled();
    }

    static String dinero(double v) {
        NumberFormat f = NumberFormat.getNumberInstance(new Locale("es", "ES"));
        f.setMinimumFractionDigits(2);
        f.setMaximumFractionDigits(2);
        f.setGroupingUsed(true);
        return "$" + f.format(v);
    }

    /** La lista del servidor manda: lo que no viene se quita, lo que viene se enseña. */
    public static synchronized void aplicar(Context c, JSONArray lista) {
        crearCanal(c);
        SharedPreferences p = prefs(c);
        Set<String> pendientes = p.getStringSet(K_PENDIENTES, new HashSet<>());
        Set<String> antes = new HashSet<>(p.getStringSet(K_MOSTRADOS, new HashSet<>()));
        Set<String> ahora = new HashSet<>();
        NotificationManagerCompat nm = NotificationManagerCompat.from(c);
        boolean puede = puedeAvisar(c);

        for (int i = 0; i < lista.length(); i++) {
            JSONObject r = lista.optJSONObject(i);
            if (r == null) continue;
            String id = String.valueOf(r.optLong("registroId"));
            if (pendientes.contains(id)) continue; // detenido aquí, aún sin enviar
            ahora.add(id);
            if (puede) {
                try {
                    nm.notify(Integer.parseInt(id), construir(c, r));
                } catch (SecurityException ignorada) {
                    // Permiso retirado entre la comprobación y el aviso.
                }
            }
        }
        for (String id : antes) {
            if (!ahora.contains(id) && !pendientes.contains(id)) nm.cancel(Integer.parseInt(id));
        }
        p.edit().putStringSet(K_MOSTRADOS, ahora).apply();
    }

    static Notification construir(Context c, JSONObject r) {
        long registroId = r.optLong("registroId");
        long ticketId = r.optLong("ticketId");
        long inicio = Instant.parse(r.optString("inicio")).toEpochMilli();
        String cliente = r.isNull("cliente") ? "" : r.optString("cliente");
        String registro = r.optString("registro");
        double tarifa = r.optDouble("tarifa", 0);

        Intent abrir = new Intent(c, MainActivity.class)
            .putExtra(MainActivity.EXTRA_RUTA, "/dashboard/tickets/" + ticketId)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent alTocar = PendingIntent.getActivity(c, (int) registroId, abrir,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Intent detener = new Intent(c, DetenerReceiver.class)
            .setAction(ACCION_DETENER)
            .putExtra("ticketId", ticketId)
            .putExtra("registroId", registroId)
            .putExtra("json", r.toString());
        PendingIntent alDetener = PendingIntent.getBroadcast(c, (int) registroId, detener,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        StringBuilder texto = new StringBuilder();
        if (!cliente.isEmpty()) texto.append(cliente);
        if (!registro.isEmpty()) texto.append(texto.length() > 0 ? " · " : "").append(registro);

        NotificationCompat.Builder b = new NotificationCompat.Builder(c, CANAL)
            .setSmallIcon(R.drawable.ic_reloj)
            .setColor(MORADO)
            .setContentTitle(r.optString("titulo"))
            .setContentText(texto.toString())
            .setSubText(tarifa > 0 ? dinero(tarifa) + "/h" : null)
            .setWhen(inicio)
            .setShowWhen(true)
            .setUsesChronometer(true)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(alTocar)
            .addAction(R.drawable.ic_detener, "Detener", alDetener);
        // Android 16: pide que el sistema lo trate como «actualización en vivo» (chip en la
        // barra de estado y arriba en la pantalla de bloqueo). Si no lo concede, queda normal.
        b.getExtras().putBoolean("android.requestPromotedOngoing", true);
        return b.build();
    }

    /** Detenido aquí sin conexión: el cronómetro se congela en el tiempo hecho y avisa. */
    static Notification pendienteDeEnviar(Context c, JSONObject r, long detenidoEn) {
        long inicio = Instant.parse(r.optString("inicio")).toEpochMilli();
        long seg = Math.max(0, (detenidoEn - inicio) / 1000);
        String tiempo = String.format(Locale.ROOT, "%d:%02d:%02d", seg / 3600, (seg % 3600) / 60, seg % 60);
        return new NotificationCompat.Builder(c, CANAL)
            .setSmallIcon(R.drawable.ic_reloj)
            .setColor(MORADO)
            .setContentTitle(r.optString("titulo"))
            .setContentText("Detenido en " + tiempo + " · se enviará al volver la conexión")
            .setOngoing(true)
            .setSilent(true)
            .setShowWhen(false)
            .setCategory(NotificationCompat.CATEGORY_STATUS)
            .build();
    }

    static Notification error(Context c, String titulo, String mensaje, long ticketId) {
        Intent abrir = new Intent(c, MainActivity.class)
            .putExtra(MainActivity.EXTRA_RUTA, "/dashboard/tickets/" + ticketId)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent alTocar = PendingIntent.getActivity(c, (int) (ticketId + 900000), abrir,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new NotificationCompat.Builder(c, CANAL)
            .setSmallIcon(R.drawable.ic_reloj)
            .setColor(MORADO)
            .setContentTitle(titulo)
            .setContentText(mensaje)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(mensaje))
            .setAutoCancel(true)
            .setContentIntent(alTocar)
            .build();
    }
}
