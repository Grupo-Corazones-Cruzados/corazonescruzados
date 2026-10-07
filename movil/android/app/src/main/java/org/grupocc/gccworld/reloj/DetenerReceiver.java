package org.grupocc.gccworld.reloj;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import androidx.core.app.NotificationManagerCompat;
import androidx.work.BackoffPolicy;
import androidx.work.Constraints;
import androidx.work.Data;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkManager;
import java.time.Instant;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import org.json.JSONObject;

/**
 * «Detener» desde la notificación. La HORA se toma aquí, al pulsar —no cuando llega al
 * servidor—, y viaja como `en`: si no hay conexión, la orden espera a la red (WorkManager) y
 * el tiempo cobrado es el que de verdad se trabajó, no el que tardó en volver la cobertura.
 */
public class DetenerReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent intent) {
        if (!Relojes.ACCION_DETENER.equals(intent.getAction())) return;
        long ticketId = intent.getLongExtra("ticketId", 0);
        long registroId = intent.getLongExtra("registroId", 0);
        if (ticketId == 0 || registroId == 0) return;
        long ahora = System.currentTimeMillis();

        String id = String.valueOf(registroId);
        SharedPreferences p = Relojes.prefs(c);
        Set<String> pendientes = new HashSet<>(p.getStringSet(Relojes.K_PENDIENTES, new HashSet<>()));
        pendientes.add(id);
        p.edit().putStringSet(Relojes.K_PENDIENTES, pendientes).apply();

        // Se congela ya, sin esperar al servidor: el usuario pulsó y tiene que verlo.
        try {
            JSONObject r = new JSONObject(intent.getStringExtra("json"));
            NotificationManagerCompat.from(c).notify((int) registroId, Relojes.pendienteDeEnviar(c, r, ahora));
        } catch (Exception ignorada) {
            NotificationManagerCompat.from(c).cancel((int) registroId);
        }

        Data datos = new Data.Builder()
            .putLong("ticketId", ticketId)
            .putLong("registroId", registroId)
            .putString("en", Instant.ofEpochMilli(ahora).toString())
            .build();
        OneTimeWorkRequest orden = new OneTimeWorkRequest.Builder(DetenerWorker.class)
            .setInputData(datos)
            .setConstraints(new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .build();
        WorkManager.getInstance(c).enqueueUniqueWork("detener-" + registroId, ExistingWorkPolicy.KEEP, orden);
    }
}
