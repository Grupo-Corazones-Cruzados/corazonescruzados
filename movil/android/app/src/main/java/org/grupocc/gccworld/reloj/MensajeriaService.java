package org.grupocc.gccworld.reloj;

import androidx.annotation.NonNull;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Recibe las push de la plataforma (Firebase, proyecto `grupo-corazones-cruzados`).
 *
 * `tipo = aviso`: recordatorio, suscripción por vencer… → notificación normal con el logo GCC,
 * que al tocarla abre `ruta` en la app (2026-10-07).
 *
 * `tipo = relojes`: un reloj de mis tickets cambió (en el computador, en otro teléfono…). El
 * aviso no trae el reloj; se pregunta al servidor y se ajusta la notificación — así un aviso
 * perdido o desordenado nunca deja un reloj mal. Se hace aquí mismo y no con WorkManager: la
 * prioridad alta da unos segundos de ejecución garantizados, y encolar podría retrasarlo.
 *
 * El token NO se registra aquí (no hay a quién atribuirlo sin la página): lo registra la página
 * cada vez que se abre con sesión (`lib/movil/reloj-nativo.ts`).
 */
public class MensajeriaService extends FirebaseMessagingService {
    @Override
    public void onMessageReceived(@NonNull RemoteMessage mensaje) {
        if ("aviso".equals(mensaje.getData().get("tipo"))) {
            Relojes.mostrarAviso(this, mensaje.getData().get("titulo"), mensaje.getData().get("cuerpo"), mensaje.getData().get("ruta"));
            return;
        }
        if (!"relojes".equals(mensaje.getData().get("tipo"))) return;
        try {
            Servidor.Respuesta r = Servidor.get("/api/tickets/relojes");
            if (r.codigo == 401) { Relojes.aplicar(this, new JSONArray()); return; }
            if (r.codigo != 200) return;
            JSONArray lista = new JSONObject(r.cuerpo).optJSONArray("data");
            Relojes.aplicar(this, lista != null ? lista : new JSONArray());
        } catch (Exception ignorada) {
            // Sin red: la revisión periódica lo corregirá.
        }
    }

    @Override
    public void onNewToken(@NonNull String token) {
        // Se registra al abrir la app con sesión.
    }
}
