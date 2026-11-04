package org.grupocc.gccworld.seguridad;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.IOException;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * El puente con la página (`lib/movil/control-psicosocial.ts`). Nada de esto se ejecuta ni pide
 * permisos hasta que un miembro acepta en la pantalla de Control Psicosocial.
 */
@CapacitorPlugin(
    name = "ControlPsicosocial",
    permissions = {
        @Permission(alias = "ubicacion", strings = { Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION }),
        @Permission(alias = "fondo", strings = { Manifest.permission.ACCESS_BACKGROUND_LOCATION }),
        @Permission(alias = "microfono", strings = { Manifest.permission.RECORD_AUDIO }),
        @Permission(alias = "notificaciones", strings = { Manifest.permission.POST_NOTIFICATIONS }),
    }
)
public class ControlPsicosocialPlugin extends Plugin {

    @PluginMethod
    public void estado(PluginCall call) {
        JSONObject c = Proteccion.leer(getContext());
        JSObject r = new JSObject();
        r.put("activo", Proteccion.activa(c));
        r.put("ubicacion", c.optBoolean("ubicacion"));
        r.put("voz", c.optBoolean("voz"));
        r.put("userId", c.has("userId") ? c.optString("userId") : null);
        r.put("tieneLlave", c.optString("token").length() > 0);
        r.put("problemaVoz", ProteccionService.problemaVoz);
        call.resolve(r);
    }

    /* ── Permisos, en el orden que exige Android: sin el de uso no se puede pedir el de fondo. ── */

    @PluginMethod
    public void pedirPermisos(PluginCall call) {
        if (call.getBoolean("voz", false)) {
            requestPermissionForAliases(new String[] { "microfono", "notificaciones" }, call, "trasMicrofono");
        } else {
            requestPermissionForAliases(new String[] { "ubicacion", "notificaciones" }, call, "trasUbicacion");
        }
    }

    @PermissionCallback
    private void trasMicrofono(PluginCall call) {
        JSObject r = new JSObject();
        r.put("voz", getPermissionState("microfono") == PermissionState.GRANTED ? "concedido" : "denegado");
        r.put("ubicacion", getPermissionState("fondo") == PermissionState.GRANTED ? "siempre" : "en_uso");
        pedirSinRestriccionDeBateria();
        call.resolve(r);
    }

    @PermissionCallback
    private void trasUbicacion(PluginCall call) {
        if (getPermissionState("ubicacion") != PermissionState.GRANTED) {
            responderUbicacion(call, "denegado");
            return;
        }
        if (getPermissionState("fondo") == PermissionState.GRANTED) {
            pedirSinRestriccionDeBateria();
            responderUbicacion(call, "siempre");
            return;
        }
        // Android 11+ lleva a Ajustes para elegir «Permitir siempre».
        requestPermissionForAlias("fondo", call, "trasFondo");
    }

    @PermissionCallback
    private void trasFondo(PluginCall call) {
        pedirSinRestriccionDeBateria();
        responderUbicacion(call, getPermissionState("fondo") == PermissionState.GRANTED ? "siempre" : "en_uso");
    }

    private void responderUbicacion(PluginCall call, String ubicacion) {
        JSObject r = new JSObject();
        r.put("ubicacion", ubicacion);
        r.put("voz", getPermissionState("microfono") == PermissionState.GRANTED ? "concedido" : "denegado");
        call.resolve(r);
    }

    /** Samsung y otros cierran los servicios con «optimización de batería»: se pide la excepción. */
    @SuppressLint("BatteryLife")
    private void pedirSinRestriccionDeBateria() {
        PowerManager pm = getContext().getSystemService(PowerManager.class);
        if (pm == null || pm.isIgnoringBatteryOptimizations(getContext().getPackageName())) return;
        try {
            getActivity().startActivity(new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                Uri.parse("package:" + getContext().getPackageName())));
        } catch (RuntimeException ignorada) { }
    }

    /* ── Encender, ajustar y apagar ───────────────────────────────────── */

    @PluginMethod
    public void configurar(PluginCall call) {
        JSONObject c = Proteccion.leer(getContext());
        try {
            String token = call.getString("token");
            if (token != null) c.put("token", token);
            c.put("userId", call.getString("userId"));
            c.put("ubicacion", call.getBoolean("ubicacion", false));
            c.put("voz", call.getBoolean("voz", false));
            c.put("frase", call.getString("frase", ""));
            c.put("segundos", call.getInt("segundos", 10));
        } catch (JSONException e) {
            call.reject("Configuración no válida");
            return;
        }
        if (!Proteccion.activa(c)) { call.reject("Falta la llave de este teléfono"); return; }
        Proteccion.guardar(getContext(), c);
        Proteccion.iniciar(getContext());
        call.resolve();
    }

    @PluginMethod
    public void enviarAhora(PluginCall call) {
        if (Proteccion.activa(Proteccion.leer(getContext()))) {
            getContext().startService(new Intent(getContext(), ProteccionService.class).setAction(ProteccionService.ACCION_ENVIAR_AHORA));
        }
        call.resolve();
    }

    @PluginMethod
    public void apagar(PluginCall call) {
        JSONObject c = Proteccion.leer(getContext());
        String token = c.optString("token");
        Proteccion.borrar(getContext());
        getContext().stopService(new Intent(getContext(), ProteccionService.class));
        ProteccionService.problemaVoz = "";
        if (token.isEmpty()) { call.resolve(); return; }
        // Entregar la llave es lo último: si falla sin red, el servidor la rechaza al retirar el consentimiento.
        new Thread(() -> {
            try { Proteccion.enviar("DELETE", "/dispositivo", token, null); } catch (IOException ignorada) { }
            call.resolve();
        }).start();
    }
}
