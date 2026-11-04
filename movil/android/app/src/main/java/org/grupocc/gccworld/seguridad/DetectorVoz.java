package org.grupocc.gccworld.seguridad;

import android.content.Context;
import android.util.Log;
import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URL;
import java.nio.file.Files;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import org.json.JSONArray;
import org.json.JSONObject;
import org.vosk.Model;
import org.vosk.Recognizer;
import org.vosk.android.RecognitionListener;
import org.vosk.android.SpeechService;

/**
 * Escucha continua de la frase, DENTRO del teléfono: Vosk trabaja sin red y el audio no sale de aquí
 * ni se guarda. El modelo pesa 40 MB, así que se baja una vez, al activar la voz, y se comprueba su
 * huella antes de usarlo.
 *
 * Por qué la gramática lleva palabras «señuelo» (medido el 2026-11-04 con voces en español): con
 * solo la frase y `[unk]`, el reconocedor fuerza lo que oye hacia la frase y «yo te entrego esto»
 * salta. Con señuelos detectó 20 de 20 y solo saltó con oraciones que contienen la frase literal.
 * Solo cuenta el resultado FINAL: los parciales cambian mientras se habla y daban falsas alarmas.
 */
final class DetectorVoz implements RecognitionListener {
    interface Oyente { void alDetectar(); void alCambiarProblema(String problema); }

    private static final String MODELO = "vosk-model-small-es-0.42";
    private static final String URL_MODELO = "https://alphacephei.com/vosk/models/" + MODELO + ".zip";
    private static final String HUELLA = "09b239888f633ef2f0b4e09736e3d9936acfd810bc65d53fad45261762c6511f";
    private static final String[] SENUELOS = ("no nada esto eso el la lo los las un una que de en y a me mi tu se es ya hoy ahora "
        + "mañana también pago presto cuento dije digo doy envié mando traigo tengo trabajo tarea dinero documento lunes tuyo hola").split(" ");

    private final Context contexto;
    private final Oyente oyente;
    private Pattern patron;
    private SpeechService servicio;
    private Model modelo;
    private volatile boolean encendido;

    DetectorVoz(Context contexto, Oyente oyente) {
        this.contexto = contexto.getApplicationContext();
        this.oyente = oyente;
    }

    /** Bloquea mientras baja el modelo: se llama desde un hilo de trabajo. */
    synchronized void encender(String frase) {
        if (servicio != null) return;
        encendido = true;
        try {
            File carpeta = asegurarModelo();
            if (!encendido) return;
            if (modelo == null) modelo = new Model(carpeta.getAbsolutePath());
            JSONArray gramatica = new JSONArray().put(frase);
            for (String s : SENUELOS) gramatica.put(s);
            gramatica.put("[unk]");
            patron = Pattern.compile("\\b" + Pattern.quote(frase) + "\\b");
            Recognizer r = new Recognizer(modelo, 16000f, gramatica.toString());
            servicio = new SpeechService(r, 16000f);
            servicio.startListening(this);
            oyente.alCambiarProblema("");
        } catch (Exception e) {
            Log.e("DetectorVoz", "No se pudo encender", e);
            oyente.alCambiarProblema("La detección de voz no pudo iniciar. Revisa la conexión y vuelve a abrir la app.");
        }
    }

    synchronized void apagar() {
        encendido = false;
        if (servicio != null) {
            servicio.stop();
            servicio.shutdown();
            servicio = null;
        }
    }

    private File asegurarModelo() throws Exception {
        File destino = new File(contexto.getFilesDir(), MODELO);
        if (new File(destino, "am/final.mdl").exists()) return destino;
        oyente.alCambiarProblema("Descargando el modelo de voz…");
        File zip = new File(contexto.getCacheDir(), MODELO + ".zip");
        MessageDigest sha = MessageDigest.getInstance("SHA-256");
        try (InputStream in = new DigestInputStream(new BufferedInputStream(new URL(URL_MODELO).openStream()), sha);
             FileOutputStream out = new FileOutputStream(zip)) {
            byte[] b = new byte[64 * 1024];
            for (int n; (n = in.read(b)) > 0; ) out.write(b, 0, n);
        }
        StringBuilder hex = new StringBuilder();
        for (byte x : sha.digest()) hex.append(String.format("%02x", x));
        if (!HUELLA.contentEquals(hex)) {
            zip.delete();
            throw new IOException("El modelo descargado no coincide con su huella");
        }
        File base = contexto.getFilesDir().getCanonicalFile();
        try (ZipInputStream z = new ZipInputStream(new BufferedInputStream(Files.newInputStream(zip.toPath())))) {
            for (ZipEntry e; (e = z.getNextEntry()) != null; ) {
                File f = new File(base, e.getName()).getCanonicalFile();
                if (!f.getPath().startsWith(base.getPath() + File.separator)) throw new IOException("Ruta no válida en el modelo");
                if (e.isDirectory()) { f.mkdirs(); continue; }
                f.getParentFile().mkdirs();
                try (FileOutputStream out = new FileOutputStream(f)) {
                    byte[] b = new byte[64 * 1024];
                    for (int n; (n = z.read(b)) > 0; ) out.write(b, 0, n);
                }
            }
        }
        zip.delete();
        return destino;
    }

    private void revisar(String hipotesis) {
        try {
            String texto = new JSONObject(hipotesis).optString("text");
            if (patron != null && patron.matcher(texto).find()) oyente.alDetectar();
        } catch (Exception ignorada) { }
    }

    @Override public void onResult(String hipotesis) { revisar(hipotesis); }
    @Override public void onFinalResult(String hipotesis) { revisar(hipotesis); }
    @Override public void onPartialResult(String hipotesis) { }
    @Override public void onError(Exception e) {
        Log.e("DetectorVoz", "Error escuchando", e);
        oyente.alCambiarProblema("La detección de voz se detuvo. Vuelve a abrir la app.");
    }
    @Override public void onTimeout() { }
}
