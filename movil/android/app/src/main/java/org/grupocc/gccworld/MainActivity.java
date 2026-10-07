package org.grupocc.gccworld;

import android.content.Intent;
import android.os.Bundle;
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
        registerPlugin(RelojTicketPlugin.class);
        super.onCreate(savedInstanceState);
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
