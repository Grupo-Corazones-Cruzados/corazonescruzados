package org.grupocc.gccworld;

import android.content.Context;
import org.grupocc.gccworld.seguridad.ControlPsicosocialPlugin;
import org.grupocc.gccworld.seguridad.Proteccion;

/** Lo que solo existe en GCC Centralizado, la app de los miembros. Ver el sabor `progreso`. */
public final class Extras {
    private Extras() {}

    /** Qué app es. La web lo lee de la cookie `gcc_app` para pintar su inicio de sesión. */
    public static final String APP = "centralizado";

    public static void registrarPlugins(MainActivity actividad) {
        actividad.registerPlugin(ControlPsicosocialPlugin.class);
    }

    public static void mostrarAuxilio(Context c, String titulo, String cuerpo, String ruta) {
        Proteccion.mostrarAuxilio(c, titulo, cuerpo, ruta);
    }
}
