package org.grupocc.gccworld.reloj;

import android.content.Context;
import android.content.SharedPreferences;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationManagerCompat;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import java.io.IOException;
import java.util.HashSet;
import java.util.Set;
import org.json.JSONObject;

/**
 * Envía una parada al servidor, con reintentos mientras no haya red. Es idempotente del lado
 * del servidor: detener un reloj ya detenido no cambia nada, así que un reintento tras una
 * respuesta perdida no cuenta dos veces.
 */
public class DetenerWorker extends Worker {
    public DetenerWorker(@NonNull Context c, @NonNull WorkerParameters p) { super(c, p); }

    @NonNull
    @Override
    public Result doWork() {
        Context c = getApplicationContext();
        long ticketId = getInputData().getLong("ticketId", 0);
        long registroId = getInputData().getLong("registroId", 0);
        String en = getInputData().getString("en");
        NotificationManagerCompat nm = NotificationManagerCompat.from(c);
        try {
            JSONObject cuerpo = new JSONObject().put("accion", "detener").put("en", en);
            Servidor.Respuesta r = Servidor.patch("/api/tickets/" + ticketId + "/actions/" + registroId, cuerpo.toString());
            if (r.codigo >= 500) return Result.retry();
            quitarPendiente(c, registroId);
            if (r.codigo >= 200 && r.codigo < 300) {
                nm.cancel((int) registroId);
                return Result.success();
            }
            String motivo = r.codigo == 401
                ? "Tu sesión caducó. Abre GCC World, entra y detén el reloj desde el ticket."
                : mensaje(r.cuerpo, "El servidor no aceptó la parada (" + r.codigo + ").");
            nm.cancel((int) registroId);
            try {
                nm.notify((int) registroId, Relojes.error(c, "No se pudo detener el reloj", motivo, ticketId));
            } catch (SecurityException ignorada) { }
            return Result.failure();
        } catch (IOException sinRed) {
            return Result.retry();
        } catch (Exception e) {
            quitarPendiente(c, registroId);
            return Result.failure();
        }
    }

    private static String mensaje(String cuerpo, String porDefecto) {
        try { return new JSONObject(cuerpo).optString("error", porDefecto); }
        catch (Exception e) { return porDefecto; }
    }

    private static void quitarPendiente(Context c, long registroId) {
        SharedPreferences p = Relojes.prefs(c);
        Set<String> pendientes = new HashSet<>(p.getStringSet(Relojes.K_PENDIENTES, new HashSet<>()));
        pendientes.remove(String.valueOf(registroId));
        p.edit().putStringSet(Relojes.K_PENDIENTES, pendientes).apply();
    }
}
