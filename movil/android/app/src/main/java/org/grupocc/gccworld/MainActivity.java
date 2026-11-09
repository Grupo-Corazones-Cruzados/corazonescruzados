package org.grupocc.gccworld;

import android.content.Intent;
import android.os.Bundle;
import android.webkit.WebView;
import androidx.webkit.WebSettingsCompat;
import androidx.webkit.WebViewFeature;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;
import org.grupocc.gccworld.reloj.RelojTicketPlugin;
import org.grupocc.gccworld.reloj.Relojes;

public class MainActivity extends BridgeActivity {
    /** Ruta de la plataforma que abrir (p. ej. el ticket al tocar la notificación del reloj). */
    public static final String EXTRA_RUTA = "ruta";
    /** La app está a la vista: los avisos de chat no saltan (el chat ya se ve). */
    public static volatile boolean enPrimerPlano = false;

    @Override
    public void onResume() {
        super.onResume();
        enPrimerPlano = true;
    }

    @Override
    public void onPause() {
        enPrimerPlano = false;
        guardarCookies();
        super.onPause();
    }

    /** Si un aviso de permiso ya la tenía en pausa, salir de la app solo pasa por aquí. */
    @Override
    public void onStop() {
        guardarCookies();
        super.onStop();
    }

    /**
     * La WebView guarda las cookies en disco cada 30 s: cerrar la app antes de eso devolvía la sesión
     * recién cerrada (Fernando, 2026-11-06). Es lo último que se oye antes de que el sistema pueda matarla.
     */
    private void guardarCookies() {
        android.webkit.CookieManager.getInstance().flush();
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Antes de cargar la web: su inicio de sesión depende de qué app es.
        android.webkit.CookieManager.getInstance().setCookie(Relojes.BASE,
            "gcc_app=" + Extras.APP + "; Path=/; Max-Age=31536000; Secure; SameSite=Lax");
        registerPlugin(RelojTicketPlugin.class);
        registerPlugin(AbrirFueraPlugin.class);
        Extras.registrarPlugins(this);
        super.onCreate(savedInstanceState);
        // Sin esto la WebView no trae WebAuthn: «WebAuthn is not supported in this browser». La app se
        // asocia al dominio de las passkeys con `public/.well-known/assetlinks.json`.
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_AUTHENTICATION)) {
            WebSettingsCompat.setWebAuthenticationSupport(
                getBridge().getWebView().getSettings(), WebSettingsCompat.WEB_AUTHENTICATION_SUPPORT_FOR_APP);
        }
        // Entrar y salir de la cuenta acaban cargando una página: la sesión queda guardada en ese momento.
        getBridge().addWebViewListener(new WebViewListener() {
            @Override
            public void onPageLoaded(WebView webView) {
                guardarCookies();
            }
        });
        // DESCARGAR (Fernando, 2026-11-09: «no funciona el botón de descargar»). La WebView de Capacitor no
        // trae descargador: sin esto un enlace a un archivo no hacía nada. Lo baja el sistema con la sesión
        // de la app (sus cookies) a Descargas y lo avisa en la barra. El visor de la web (`VisorArchivos`)
        // manda aquí la dirección real del archivo.
        getBridge().getWebView().setDownloadListener((url, agente, disposicion, tipo, largo) -> {
            String nombre = android.webkit.URLUtil.guessFileName(url, disposicion, tipo);
            try {
                android.app.DownloadManager.Request pedido = new android.app.DownloadManager.Request(android.net.Uri.parse(url));
                String cookies = android.webkit.CookieManager.getInstance().getCookie(url);
                if (cookies != null) pedido.addRequestHeader("Cookie", cookies);
                pedido.addRequestHeader("User-Agent", agente);
                pedido.setTitle(nombre);
                pedido.setMimeType(tipo);
                pedido.setNotificationVisibility(android.app.DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                pedido.setDestinationInExternalPublicDir(android.os.Environment.DIRECTORY_DOWNLOADS, nombre);
                ((android.app.DownloadManager) getSystemService(DOWNLOAD_SERVICE)).enqueue(pedido);
                android.widget.Toast.makeText(this, "Descargando " + nombre, android.widget.Toast.LENGTH_SHORT).show();
            } catch (Exception e) {
                android.widget.Toast.makeText(this, "No se pudo descargar " + nombre, android.widget.Toast.LENGTH_LONG).show();
            }
        });
        abrirRuta(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        abrirRuta(intent);
    }

    private void abrirRuta(Intent intent) {
        if (intent == null) return;
        String ruta = intent.getStringExtra(EXTRA_RUTA);
        if (ruta == null || !ruta.startsWith("/") || getBridge() == null) return;
        intent.removeExtra(EXTRA_RUTA);
        getBridge().getWebView().post(() -> getBridge().getWebView().loadUrl(Relojes.BASE + ruta));
    }
}
