package org.grupocc.gccworld;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Abre una dirección fuera de la app: GCC Centralizado (`gcccentralizado://`) o el navegador. El visor web
 * no sirve para esto: `*.grupocc.org` se queda dentro, y ahí no se puede descargar un paquete.
 */
@CapacitorPlugin(name = "AbrirFuera")
public class AbrirFueraPlugin extends Plugin {
    @PluginMethod
    public void abrir(PluginCall call) {
        String url = call.getString("url");
        if (url == null) { call.reject("Falta la dirección"); return; }
        JSObject r = new JSObject();
        try {
            getActivity().startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
            r.put("abierta", true);
        } catch (ActivityNotFoundException e) {
            // Sin GCC Centralizado instalada: la pantalla ofrece descargarla.
            r.put("abierta", false);
        }
        call.resolve(r);
    }
}
