package org.grupocc.gccworld.reloj;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import androidx.core.app.RemoteInput;
import org.json.JSONObject;

/**
 * «Responder» desde el aviso de un chat: envía el texto con la sesión de la app (la cookie del
 * WebView, `Servidor`) y marca la conversación como leída hasta ese mensaje. El aviso muestra
 * «Tú: …» si salió, o el error si no.
 */
public class ResponderReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent intent) {
        if (!Chats.ACCION_RESPONDER.equals(intent.getAction())) return;
        Bundle entrada = RemoteInput.getResultsFromIntent(intent);
        if (entrada == null) return;
        CharSequence escrito = entrada.getCharSequence(Chats.CLAVE_TEXTO);
        String texto = escrito == null ? "" : escrito.toString().trim();
        String chat = intent.getStringExtra("chat");
        String titulo = intent.getStringExtra("titulo");
        String ruta = intent.getStringExtra("ruta");
        if (texto.isEmpty() || chat == null) return;

        PendingResult pendiente = goAsync();
        new Thread(() -> {
            try {
                String[] d = Chats.destino(chat, texto);
                Servidor.Respuesta r = Servidor.post(d[0], d[1]);
                if (r.codigo >= 200 && r.codigo < 300) {
                    try {
                        long ultimo = new JSONObject(r.cuerpo).getJSONObject("data").getLong("id");
                        JSONObject leido = new JSONObject().put("lastId", ultimo);
                        if (!"grupo".equals(chat)) {
                            String[] p = chat.split(":", 2);
                            leido.put("kind", p[0]).put("ref", p.length > 1 ? p[1] : "");
                        }
                        Servidor.post(d[2], leido.toString());
                    } catch (Exception ignorada) { }
                    Chats.anotarRespuesta(c, chat, titulo, ruta, texto);
                } else {
                    String motivo = r.codigo == 401 ? "Tu sesión caducó: abre la app para responder." : "No se pudo enviar (" + r.codigo + ").";
                    Chats.anotarRespuesta(c, chat, titulo, ruta, "⚠️ " + motivo);
                }
            } catch (Exception e) {
                Chats.anotarRespuesta(c, chat, titulo, ruta, "⚠️ Sin conexión: el mensaje no se envió.");
            } finally {
                pendiente.finish();
            }
        }).start();
    }
}
