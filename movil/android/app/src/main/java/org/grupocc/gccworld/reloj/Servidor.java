package org.grupocc.gccworld.reloj;

import android.webkit.CookieManager;
import java.io.IOException;
import java.util.concurrent.TimeUnit;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

/**
 * Las llamadas que el teléfono hace SIN la página abierta (el botón «Detener» de la
 * notificación, la revisión periódica). Van con la MISMA sesión que la página: la cookie
 * `auth_token` que guardó el WebView, leída de su almacén. No hay un segundo tipo de sesión.
 */
final class Servidor {
    private static final OkHttpClient HTTP = new OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .build();
    private static final MediaType JSON = MediaType.get("application/json; charset=utf-8");

    static final class Respuesta {
        final int codigo;
        final String cuerpo;
        Respuesta(int codigo, String cuerpo) { this.codigo = codigo; this.cuerpo = cuerpo; }
    }

    private Servidor() {}

    private static Request.Builder base(String ruta) {
        Request.Builder b = new Request.Builder().url(Relojes.BASE + ruta);
        String cookie = CookieManager.getInstance().getCookie(Relojes.BASE);
        if (cookie != null) b.header("Cookie", cookie);
        return b;
    }

    /** Lanza IOException si no hay red: quien llama decide reintentar. */
    static Respuesta get(String ruta) throws IOException {
        try (Response r = HTTP.newCall(base(ruta).get().build()).execute()) {
            return new Respuesta(r.code(), r.body() != null ? r.body().string() : "");
        }
    }

    static Respuesta patch(String ruta, String json) throws IOException {
        try (Response r = HTTP.newCall(base(ruta).patch(RequestBody.create(json, JSON)).build()).execute()) {
            return new Respuesta(r.code(), r.body() != null ? r.body().string() : "");
        }
    }
}
