package org.grupocc.gccworld.reloj;

import android.content.Context;
import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import java.io.IOException;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Revisión periódica (cada 15 minutos, el mínimo que deja Android) de los relojes en marcha,
 * con la app cerrada. Es lo que hace que un reloj iniciado o detenido en el COMPUTADOR acabe
 * apareciendo o desapareciendo en el teléfono aunque no se abra la app. Al instante solo
 * llegará con notificaciones push (siguiente paso); esto es la red de seguridad.
 */
public class RevisarWorker extends Worker {
    public RevisarWorker(@NonNull Context c, @NonNull WorkerParameters p) { super(c, p); }

    @NonNull
    @Override
    public Result doWork() {
        try {
            Servidor.Respuesta r = Servidor.get("/api/tickets/relojes");
            if (r.codigo == 401) {
                // Sin sesión no hay de quién enseñar relojes.
                Relojes.aplicar(getApplicationContext(), new JSONArray());
                return Result.success();
            }
            if (r.codigo != 200) return Result.retry();
            JSONArray lista = new JSONObject(r.cuerpo).optJSONArray("data");
            Relojes.aplicar(getApplicationContext(), lista != null ? lista : new JSONArray());
            return Result.success();
        } catch (IOException sinRed) {
            return Result.retry();
        } catch (Exception e) {
            return Result.failure();
        }
    }
}
