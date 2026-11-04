package org.grupocc.gccworld.seguridad;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.concurrent.TimeUnit;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import org.grupocc.gccworld.MainActivity;
import org.grupocc.gccworld.R;
import org.grupocc.gccworld.reloj.Relojes;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * CONTROL PSICOSOCIAL en Android: la configuración de este teléfono, sus llamadas al servidor y sus
 * notificaciones. La configuración va en `noBackupFiles`: la llave del teléfono no debe viajar en
 * la copia de seguridad de Google, que `allowBackup` activa para el resto de la app.
 */
public final class Proteccion {
    public static final String RUTA = "/dashboard/centralized/colaborador/implementacion/control-psicosocial";
    static final String CANAL_ACTIVO = "proteccion-activa";
    static final String CANAL_AUXILIO = "auxilio-gcc";
    private static final String API = Relojes.BASE + "/api/centralized/control-psicosocial";
    private static final MediaType JSON = MediaType.get("application/json; charset=utf-8");
    private static final OkHttpClient HTTP = new OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS).readTimeout(20, TimeUnit.SECONDS).build();

    private Proteccion() {}

    /* ── Configuración ──────────────────────────────────────────────────── */

    private static File archivo(Context c) { return new File(c.getNoBackupFilesDir(), "control-psicosocial.json"); }

    static synchronized JSONObject leer(Context c) {
        try {
            return new JSONObject(new String(Files.readAllBytes(archivo(c).toPath()), StandardCharsets.UTF_8));
        } catch (IOException | JSONException e) {
            return new JSONObject();
        }
    }

    static synchronized void guardar(Context c, JSONObject config) {
        try {
            Files.write(archivo(c).toPath(), config.toString().getBytes(StandardCharsets.UTF_8));
        } catch (IOException e) {
            android.util.Log.e("Proteccion", "No se pudo guardar la configuración", e);
        }
    }

    static synchronized void borrar(Context c) { archivo(c).delete(); }

    static boolean activa(JSONObject config) {
        return config.optString("token").length() > 0 && (config.optBoolean("ubicacion") || config.optBoolean("voz"));
    }

    /* ── Servidor ───────────────────────────────────────────────────────── */

    static final class Respuesta {
        final int codigo; final JSONObject cuerpo;
        Respuesta(int codigo, JSONObject cuerpo) { this.codigo = codigo; this.cuerpo = cuerpo; }
    }

    /** Lanza IOException sin red: quien llama decide reintentar. */
    static Respuesta enviar(String metodo, String ruta, String token, JSONObject cuerpo) throws IOException {
        RequestBody body = cuerpo == null ? null : RequestBody.create(cuerpo.toString(), JSON);
        Request req = new Request.Builder().url(API + ruta).header("x-cp-dispositivo", token).method(metodo, body).build();
        try (Response r = HTTP.newCall(req).execute()) {
            JSONObject j;
            try { j = new JSONObject(r.body() != null ? r.body().string() : "{}"); } catch (JSONException e) { j = new JSONObject(); }
            return new Respuesta(r.code(), j);
        }
    }

    /* ── Servicio ───────────────────────────────────────────────────────── */

    static void iniciar(Context c) {
        ContextCompat.startForegroundService(c, new Intent(c, ProteccionService.class).setAction(ProteccionService.ACCION_APLICAR));
    }

    /* ── Notificaciones ─────────────────────────────────────────────────── */

    static void crearCanales(Context c) {
        NotificationManager m = c.getSystemService(NotificationManager.class);
        NotificationChannel activo = new NotificationChannel(CANAL_ACTIVO, "Protección activa", NotificationManager.IMPORTANCE_LOW);
        activo.setShowBadge(false);
        m.createNotificationChannel(activo);
        NotificationChannel auxilio = new NotificationChannel(CANAL_AUXILIO, "Auxilio de un miembro", NotificationManager.IMPORTANCE_HIGH);
        auxilio.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM),
            new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
        auxilio.enableVibration(true);
        auxilio.setVibrationPattern(new long[] {0, 800, 300, 800, 300, 800});
        auxilio.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        m.createNotificationChannel(auxilio);
    }

    static PendingIntent abrir(Context c, String ruta, int codigo) {
        Intent i = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        i.putExtra(MainActivity.EXTRA_RUTA, ruta);
        return PendingIntent.getActivity(c, codigo, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** El auxilio de OTRO miembro: con sonido de alarma y visible en la pantalla de bloqueo. */
    public static void mostrarAuxilio(Context c, String titulo, String cuerpo, String ruta) {
        crearCanales(c);
        int id = (int) (System.currentTimeMillis() % 1_000_000_000L) + 2_000_000;
        Notification n = new NotificationCompat.Builder(c, CANAL_AUXILIO)
            .setSmallIcon(R.drawable.ic_gcc)
            .setColor(0xFFB3261E)
            .setContentTitle(titulo)
            .setContentText(cuerpo)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(cuerpo))
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setContentIntent(abrir(c, ruta != null && ruta.startsWith("/") ? ruta : RUTA, id))
            .build();
        try { NotificationManagerCompat.from(c).notify(id, n); } catch (SecurityException ignorada) { }
    }
}
