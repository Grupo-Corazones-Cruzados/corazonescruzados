package org.grupocc.gccworld.seguridad;

import android.Manifest;
import android.app.Notification;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;
import java.io.IOException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.grupocc.gccworld.R;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * El servicio en primer plano: mientras corre hay SIEMPRE una notificación visible (lo exige
 * Android, y es lo acordado: nadie queda rastreado sin saberlo). Hace dos cosas, según lo que la
 * persona aceptó: mandar la ubicación y escuchar la frase.
 *
 * Android no deja arrancar el micrófono desde segundo plano (al encender el teléfono o si el sistema
 * reinicia el servicio): ahí sigue solo la ubicación y la notificación pide abrir la app.
 */
public class ProteccionService extends Service implements DetectorVoz.Oyente {
    static final String ACCION_APLICAR = "aplicar";
    static final String ACCION_ENVIAR_AHORA = "enviar-ahora";
    static final String ACCION_CANCELAR = "cancelar-auxilio";
    private static final int ID_ACTIVA = 7301;
    private static final int ID_CUENTA = 7302;
    private static final long REINTENTO_MS = 15_000;

    /** El último problema de la voz, para enseñarlo en la pantalla del sistema. */
    static volatile String problemaVoz = "";

    private final Handler hilo = new Handler(Looper.getMainLooper());
    private final ExecutorService red = Executors.newSingleThreadExecutor();
    private final ExecutorService voz = Executors.newSingleThreadExecutor();
    private final List<JSONObject> cola = new ArrayList<>();
    private FusedLocationProviderClient ubicacion;
    private DetectorVoz detector;
    private LocationCallback alRecibir;
    private Location ultima;
    private long intervaloS = 0;
    private boolean escuchando;
    private boolean enMarcha;
    private Runnable cuentaAtras;

    @Override public IBinder onBind(Intent i) { return null; }

    @Override
    public void onCreate() {
        super.onCreate();
        Proteccion.crearCanales(this);
        ubicacion = LocationServices.getFusedLocationProviderClient(this);
        detector = new DetectorVoz(this, this);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String accion = intent != null ? intent.getAction() : ACCION_APLICAR;
        JSONObject c = Proteccion.leer(this);
        if (!Proteccion.activa(c)) { apagar(); return START_NOT_STICKY; }
        // Con el servicio ya en marcha, estas dos no vuelven a declarar el micrófono: desde segundo
        // plano Android lo rechazaría y se perdería la escucha que ya funciona.
        if (enMarcha && ACCION_CANCELAR.equals(accion)) { cancelarCuenta(); return START_STICKY; }
        if (enMarcha && ACCION_ENVIAR_AHORA.equals(accion)) { pedirPosicionYa(); return START_STICKY; }
        boolean quiereVoz = c.optBoolean("voz") && tiene(Manifest.permission.RECORD_AUDIO);
        boolean conMicro = levantar(c.optBoolean("ubicacion"), quiereVoz);
        enMarcha = true;
        // Conserva el intervalo vigente: abrir la app durante un auxilio no debe volverlo lento.
        aplicarUbicacion(c.optBoolean("ubicacion"), intervaloS > 0 ? intervaloS : INTERVALO_NORMAL);
        if (conMicro) encenderVoz(c.optString("frase")); else apagarVoz();
        if (c.optBoolean("auxilioPendiente")) enviarAuxilio();
        return START_STICKY;
    }

    private static final long INTERVALO_NORMAL = 60;

    private boolean tiene(String permiso) {
        return ContextCompat.checkSelfPermission(this, permiso) == PackageManager.PERMISSION_GRANTED;
    }

    /** Devuelve si el micrófono quedó permitido. El sistema lo rechaza si la app está en segundo plano. */
    private boolean levantar(boolean conUbicacion, boolean conVoz) {
        int tipos = (conUbicacion ? ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION : 0)
            | (conVoz ? ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE : 0);
        try {
            startForeground(ID_ACTIVA, notificacion(conUbicacion, conVoz, false), tipos);
            return conVoz;
        } catch (RuntimeException sinMicro) {
            if (!conVoz) { stopSelf(); return false; }
            if (!conUbicacion) { stopSelf(); return false; }
            try {
                startForeground(ID_ACTIVA, notificacion(true, false, true), ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
            } catch (RuntimeException e) {
                stopSelf();
            }
            return false;
        }
    }

    private Notification notificacion(boolean conUbicacion, boolean conVoz, boolean vozEnPausa) {
        String texto = conUbicacion && conVoz ? "Compartiendo ubicación y escuchando la frase de auxilio"
            : conUbicacion ? (vozEnPausa ? "Compartiendo ubicación. Abre la app para activar la voz" : "Compartiendo ubicación")
            : "Escuchando la frase de auxilio";
        return new NotificationCompat.Builder(this, Proteccion.CANAL_ACTIVO)
            .setSmallIcon(R.drawable.ic_gcc)
            .setContentTitle("Control Psicosocial activo")
            .setContentText(texto)
            .setOngoing(true)
            .setSilent(true)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .setContentIntent(Proteccion.abrir(this, Proteccion.RUTA, ID_ACTIVA))
            .build();
    }

    /* ── Ubicación ─────────────────────────────────────────────────────── */

    private void aplicarUbicacion(boolean activa, long segundos) {
        if (!activa || !(tiene(Manifest.permission.ACCESS_FINE_LOCATION) || tiene(Manifest.permission.ACCESS_COARSE_LOCATION))) {
            if (alRecibir != null) ubicacion.removeLocationUpdates(alRecibir);
            alRecibir = null;
            intervaloS = 0;
            return;
        }
        if (alRecibir != null && intervaloS == segundos) return;
        if (alRecibir != null) ubicacion.removeLocationUpdates(alRecibir);
        intervaloS = segundos;
        // Alta precisión siempre: con la de ahorro, el recorrido salta entre antenas y las llegadas fallan.
        LocationRequest pedido = new LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, segundos * 1000).build();
        alRecibir = new LocationCallback() {
            @Override public void onLocationResult(LocationResult r) {
                Location l = r.getLastLocation();
                if (l != null) alLlegar(l);
            }
        };
        try {
            ubicacion.requestLocationUpdates(pedido, alRecibir, Looper.getMainLooper());
        } catch (SecurityException e) {
            alRecibir = null;
        }
    }

    private void pedirPosicionYa() {
        if (!(tiene(Manifest.permission.ACCESS_FINE_LOCATION) || tiene(Manifest.permission.ACCESS_COARSE_LOCATION))) return;
        try {
            ubicacion.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, null)
                .addOnSuccessListener(l -> { if (l != null) alLlegar(l); else enviarCola(); });
        } catch (SecurityException ignorada) { }
    }

    private void alLlegar(Location l) {
        ultima = l;
        try {
            BatteryManager b = getSystemService(BatteryManager.class);
            synchronized (cola) {
                cola.add(new JSONObject().put("lat", l.getLatitude()).put("lng", l.getLongitude())
                    .put("precision", l.hasAccuracy() ? l.getAccuracy() : JSONObject.NULL)
                    .put("bateria", b != null ? b.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY) : JSONObject.NULL)
                    .put("en", Instant.ofEpochMilli(l.getTime()).toString()));
                // Sin red se acumula para enviar al volver; un corte muy largo descarta lo más viejo.
                if (cola.size() > 100) cola.remove(0);
            }
        } catch (JSONException ignorada) { }
        enviarCola();
    }

    private void enviarCola() {
        red.execute(() -> {
            JSONObject c = Proteccion.leer(this);
            List<JSONObject> lote;
            synchronized (cola) { lote = new ArrayList<>(cola); }
            try {
                Proteccion.Respuesta r = Proteccion.enviar("POST", "/posicion", c.optString("token"),
                    new JSONObject().put("puntos", new JSONArray(lote)));
                if (r.codigo == 401 || r.codigo == 403) { hilo.post(this::retiradoEnServidor); return; }
                if (r.codigo >= 300) return;
                synchronized (cola) { cola.removeAll(lote); }
                long intervalo = r.cuerpo.optLong("intervalo_s", INTERVALO_NORMAL);
                boolean quiereVoz = r.cuerpo.optBoolean("voz");
                hilo.post(() -> {
                    if (intervalo != intervaloS) aplicarUbicacion(true, intervalo);
                    if (!quiereVoz && escuchando) quitarVoz();
                });
            } catch (IOException | JSONException sinRed) {
                // Queda en la cola para el siguiente envío.
            }
        });
    }

    /** Retiró el consentimiento o dejó de ser miembro: se apaga y se olvida la llave. */
    private void retiradoEnServidor() {
        Proteccion.borrar(this);
        apagar();
    }

    private void quitarVoz() {
        JSONObject c = Proteccion.leer(this);
        try { c.put("voz", false); } catch (JSONException ignorada) { }
        Proteccion.guardar(this, c);
        apagarVoz();
        if (Proteccion.activa(c)) levantar(c.optBoolean("ubicacion"), false); else apagar();
    }

    /* ── Voz y auxilio ─────────────────────────────────────────────────── */

    private void encenderVoz(String frase) {
        if (escuchando) return;
        escuchando = true;
        voz.execute(() -> detector.encender(frase));
    }

    private void apagarVoz() {
        if (!escuchando) return;
        escuchando = false;
        voz.execute(detector::apagar);
    }

    @Override public void alCambiarProblema(String problema) { problemaVoz = problema; }

    @Override
    public void alDetectar() {
        hilo.post(() -> {
            if (cuentaAtras != null || Proteccion.leer(this).optBoolean("auxilioPendiente")) return;
            int segundos = Proteccion.leer(this).optInt("segundos", 10);
            vibrar();
            // Texto discreto a propósito: la pantalla puede estar a la vista de quien amenaza.
            PendingIntent cancelar = PendingIntent.getService(this, ID_CUENTA,
                new Intent(this, ProteccionService.class).setAction(ACCION_CANCELAR),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            Notification n = new NotificationCompat.Builder(this, Proteccion.CANAL_ACTIVO)
                .setSmallIcon(R.drawable.ic_gcc)
                .setContentTitle("GCC World")
                .setContentText("Procesando aviso")
                .setTimeoutAfter(segundos * 1000L)
                .addAction(0, "Cancelar", cancelar)
                .build();
            try { NotificationManagerCompat.from(this).notify(ID_CUENTA, n); } catch (SecurityException ignorada) { }
            cuentaAtras = () -> {
                cuentaAtras = null;
                JSONObject c = Proteccion.leer(this);
                try { c.put("auxilioPendiente", true); } catch (JSONException ignorada) { }
                Proteccion.guardar(this, c);
                enviarAuxilio();
            };
            hilo.postDelayed(cuentaAtras, segundos * 1000L);
        });
    }

    private void cancelarCuenta() {
        if (cuentaAtras != null) hilo.removeCallbacks(cuentaAtras);
        cuentaAtras = null;
        NotificationManagerCompat.from(this).cancel(ID_CUENTA);
    }

    /** Se reintenta hasta que el servidor lo reciba: sin red, el aviso sale en cuanto vuelva. */
    private void enviarAuxilio() {
        Location l = ultima;
        red.execute(() -> {
            JSONObject c = Proteccion.leer(this);
            try {
                JSONObject cuerpo = new JSONObject().put("origen", "voz")
                    .put("lat", l != null ? l.getLatitude() : JSONObject.NULL)
                    .put("lng", l != null ? l.getLongitude() : JSONObject.NULL);
                Proteccion.Respuesta r = Proteccion.enviar("POST", "/alertas", c.optString("token"), cuerpo);
                if (r.codigo >= 500) throw new IOException("Servidor " + r.codigo);
                if (r.codigo >= 400) { hilo.post(this::retiradoEnServidor); return; }
                c = Proteccion.leer(this);
                c.remove("auxilioPendiente");
                Proteccion.guardar(this, c);
                hilo.post(this::pedirPosicionYa);
            } catch (IOException | JSONException e) {
                hilo.postDelayed(this::enviarAuxilio, REINTENTO_MS);
            }
        });
    }

    private void vibrar() {
        Vibrator v = getSystemService(Vibrator.class);
        if (v != null) v.vibrate(VibrationEffect.createWaveform(new long[] {0, 300, 150, 300}, -1));
    }

    private void apagar() {
        enMarcha = false;
        cancelarCuenta();
        hilo.removeCallbacksAndMessages(null);
        if (alRecibir != null) ubicacion.removeLocationUpdates(alRecibir);
        alRecibir = null;
        escuchando = false;
        voz.execute(detector::apagar);
        stopForeground(STOP_FOREGROUND_REMOVE);
        stopSelf();
    }

    @Override
    public void onDestroy() {
        if (alRecibir != null) ubicacion.removeLocationUpdates(alRecibir);
        voz.execute(detector::apagar);
        voz.shutdown();
        red.shutdown();
        super.onDestroy();
    }
}
