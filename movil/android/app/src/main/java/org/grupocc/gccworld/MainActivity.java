package org.grupocc.gccworld;

import android.content.Intent;
import android.os.Bundle;
import androidx.webkit.WebSettingsCompat;
import androidx.webkit.WebViewFeature;
import com.getcapacitor.BridgeActivity;
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
        super.onPause();
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
