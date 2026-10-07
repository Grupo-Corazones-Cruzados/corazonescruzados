package org.grupocc.gccworld.reloj;

import android.Manifest;
import android.os.Build;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.concurrent.TimeUnit;
import org.json.JSONArray;

/**
 * El puente con la página (`lib/movil/reloj-nativo.ts`). La página le pasa la lista de relojes
 * en marcha que le dio el servidor y el plugin la enseña en notificaciones; nada más.
 */
@CapacitorPlugin(
    name = "RelojTicket",
    permissions = { @Permission(alias = "notificaciones", strings = { Manifest.permission.POST_NOTIFICATIONS }) }
)
public class RelojTicketPlugin extends Plugin {

    @Override
    public void load() {
        Relojes.crearCanal(getContext());
        PeriodicWorkRequest revisar = new PeriodicWorkRequest.Builder(RevisarWorker.class, 15, TimeUnit.MINUTES)
            .setConstraints(new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .build();
        WorkManager.getInstance(getContext())
            .enqueueUniquePeriodicWork("revisar-relojes", ExistingPeriodicWorkPolicy.KEEP, revisar);
    }

    @PluginMethod
    public void sincronizar(PluginCall call) {
        JSONArray lista = call.getArray("relojes");
        if (lista == null) lista = new JSONArray();
        if (lista.length() > 0 && Build.VERSION.SDK_INT >= 33
            && getPermissionState("notificaciones") != PermissionState.GRANTED) {
            // Se pide el permiso la primera vez que hay algo que enseñar, no al abrir la app.
            requestPermissionForAlias("notificaciones", call, "trasPermiso");
            return;
        }
        Relojes.aplicar(getContext(), lista);
        JSObject r = new JSObject();
        r.put("permitido", Relojes.puedeAvisar(getContext()));
        call.resolve(r);
    }

    @PermissionCallback
    private void trasPermiso(PluginCall call) {
        JSONArray lista = call.getArray("relojes");
        Relojes.aplicar(getContext(), lista != null ? lista : new JSONArray());
        JSObject r = new JSObject();
        r.put("permitido", Relojes.puedeAvisar(getContext()));
        call.resolve(r);
    }
}
