package org.grupocc.gccworld.seguridad;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import androidx.core.content.ContextCompat;
import org.json.JSONObject;

/** Al encender el teléfono o actualizar la app, retoma lo que la persona dejó activado. */
public class ArranqueReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent i) {
        String accion = i.getAction();
        if (!Intent.ACTION_BOOT_COMPLETED.equals(accion) && !Intent.ACTION_MY_PACKAGE_REPLACED.equals(accion)) return;
        JSONObject config = Proteccion.leer(c);
        if (!Proteccion.activa(config)) return;
        // Sin «Permitir siempre», Android no deja arrancar la ubicación desde aquí. El micrófono
        // tampoco arranca en segundo plano: el servicio sigue sin él y pide abrir la app.
        boolean fondo = ContextCompat.checkSelfPermission(c, Manifest.permission.ACCESS_BACKGROUND_LOCATION) == PackageManager.PERMISSION_GRANTED;
        if (!config.optBoolean("ubicacion") || !fondo) return;
        try { Proteccion.iniciar(c); } catch (RuntimeException ignorada) { }
    }
}
