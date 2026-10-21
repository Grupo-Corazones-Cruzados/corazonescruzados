package org.grupocc.descargador

import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.ContentValues
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.Uri
import android.os.Environment
import android.os.IBinder
import android.provider.MediaStore
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.ServiceCompat
import com.yausername.youtubedl_android.YoutubeDL
import com.yausername.youtubedl_android.YoutubeDLRequest
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import java.io.File

/**
 * La descarga corre aquí, en un servicio en primer plano con su notificación: si la persona sale
 * de la app o apaga la pantalla, Android no la mata a medias.
 *
 * yt-dlp baja video y audio por separado y FFmpeg los une en un MP4 (o deja el audio en M4A) en
 * la caché de la app; al terminar se copia a la galería (Movies/GCC Descargas o Music/GCC
 * Descargas) y la caché se vacía.
 */
class DescargaService : Service() {
    private var trabajo: Job? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACCION_CANCELAR) {
            YoutubeDL.getInstance().destroyProcessById(PROCESO)
            trabajo?.cancel()
            Descargas.estado.value = Estado.Libre
            parar()
            return START_NOT_STICKY
        }
        val url = intent?.getStringExtra(EXTRA_URL) ?: return START_NOT_STICKY
        val calidad = Calidad.valueOf(intent.getStringExtra(EXTRA_CALIDAD) ?: Calidad.MEJOR.name)
        val titulo = intent.getStringExtra(EXTRA_TITULO) ?: url
        if (trabajo?.isActive == true) return START_NOT_STICKY

        ServiceCompat.startForeground(this, NOTIF, notificacion(titulo, 0, true), ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
        Descargas.estado.value = Estado.Bajando(titulo, 0f, -1, 1)
        trabajo = App.instancia.alcance.launch { bajar(url, calidad, titulo) }
        return START_NOT_STICKY
    }

    private suspend fun bajar(url: String, calidad: Calidad, titulo: String) {
        val dir = File(cacheDir, "descarga").apply { deleteRecursively(); mkdirs() }
        try {
            App.instancia.motor.await().getOrThrow()
            val req = YoutubeDLRequest(url).apply {
                addOption("--no-playlist")
                addOption("-f", calidad.formato)
                addOption("-o", "${dir.absolutePath}/%(title).80B.%(ext)s")
                if (calidad.audio) { addOption("-x"); addOption("--audio-format", "m4a") }
                else addOption("--merge-output-format", "mp4")
            }
            var fase = 1
            var ultimo = 0L
            YoutubeDL.getInstance().execute(req, PROCESO) { pct, eta, linea ->
                // Video y audio van por separado: el segundo archivo es la fase 2.
                if (linea.startsWith("[download] Destination:") && fase == 1 && pct > 0f) fase = 2
                Descargas.estado.value = Estado.Bajando(titulo, pct, eta, fase)
                val ahora = System.currentTimeMillis()
                if (ahora - ultimo > 800) {
                    ultimo = ahora
                    NotificationManagerCompat.from(this).notify(NOTIF, notificacion(titulo, pct.toInt(), false))
                }
            }
            val archivo = dir.listFiles()?.filter { it.isFile && !it.name.endsWith(".part") }?.maxByOrNull { it.length() }
                ?: throw IllegalStateException(getString(R.string.error_sin_archivo))
            val uri = aGaleria(archivo, calidad.audio)
            Descargas.estado.value = Estado.Listo(archivo.nameWithoutExtension, uri, calidad.audio)
            avisarListo(archivo.nameWithoutExtension, uri, calidad.audio)
        } catch (e: YoutubeDL.CanceledException) {
            Descargas.estado.value = Estado.Libre
        } catch (e: Throwable) {
            Log.e("Descargador", "descarga fallida: ${e.message}", e)
            if (Descargas.estado.value !is Estado.Libre) Descargas.estado.value = Estado.Error(explicar(e))
        } finally {
            dir.deleteRecursively()
            parar()
        }
    }

    /** Copia a la galería con MediaStore (sin permisos de almacenamiento desde Android 10). */
    private fun aGaleria(archivo: File, audio: Boolean): Uri {
        val coleccion = if (audio) MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
            else MediaStore.Video.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
        val valores = ContentValues().apply {
            put(MediaStore.MediaColumns.DISPLAY_NAME, archivo.name)
            put(MediaStore.MediaColumns.MIME_TYPE, if (audio) "audio/mp4" else "video/mp4")
            put(MediaStore.MediaColumns.RELATIVE_PATH, "${if (audio) Environment.DIRECTORY_MUSIC else Environment.DIRECTORY_MOVIES}/GCC Descargas")
            put(MediaStore.MediaColumns.IS_PENDING, 1)
        }
        val uri = contentResolver.insert(coleccion, valores) ?: throw IllegalStateException(getString(R.string.error_galeria))
        try {
            contentResolver.openOutputStream(uri)!!.use { salida -> archivo.inputStream().use { it.copyTo(salida) } }
            contentResolver.update(uri, ContentValues().apply { put(MediaStore.MediaColumns.IS_PENDING, 0) }, null, null)
        } catch (e: Throwable) {
            contentResolver.delete(uri, null, null)
            throw e
        }
        return uri
    }

    private fun explicar(e: Throwable): String {
        val m = (e.message ?: "").lowercase()
        return when {
            "private video" in m || "privado" in m -> getString(R.string.error_privado)
            "sign in to confirm" in m || "not a bot" in m -> getString(R.string.error_bot)
            "unsupported url" in m -> getString(R.string.error_url)
            "unable to download" in m || "network" in m || "timed out" in m -> getString(R.string.error_red)
            else -> getString(R.string.error_general)
        }
    }

    private fun abrirApp(): PendingIntent = PendingIntent.getActivity(
        this, 0, Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )

    private fun notificacion(titulo: String, pct: Int, indeterminado: Boolean): Notification {
        val cancelar = PendingIntent.getService(
            this, 1, Intent(this, DescargaService::class.java).setAction(ACCION_CANCELAR), PendingIntent.FLAG_IMMUTABLE,
        )
        return NotificationCompat.Builder(this, App.CANAL)
            .setSmallIcon(R.drawable.ic_notificacion)
            .setContentTitle(titulo)
            .setContentText(if (indeterminado) getString(R.string.preparando) else "$pct %")
            .setProgress(100, pct, indeterminado)
            .setOngoing(true).setOnlyAlertOnce(true)
            .setContentIntent(abrirApp())
            .addAction(0, getString(R.string.cancelar), cancelar)
            .build()
    }

    private fun avisarListo(titulo: String, uri: Uri, audio: Boolean) {
        val ver = PendingIntent.getActivity(
            this, 2,
            Intent(Intent.ACTION_VIEW).setDataAndType(uri, if (audio) "audio/mp4" else "video/mp4").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION),
            PendingIntent.FLAG_IMMUTABLE,
        )
        val n = NotificationCompat.Builder(this, App.CANAL)
            .setSmallIcon(R.drawable.ic_notificacion)
            .setContentTitle(getString(R.string.listo))
            .setContentText(titulo)
            .setContentIntent(ver).setAutoCancel(true)
            .build()
        try { NotificationManagerCompat.from(this).notify(NOTIF_LISTO, n) } catch (_: SecurityException) { }
    }

    private fun parar() {
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    companion object {
        const val EXTRA_URL = "url"
        const val EXTRA_CALIDAD = "calidad"
        const val EXTRA_TITULO = "titulo"
        const val ACCION_CANCELAR = "cancelar"
        private const val PROCESO = "descarga"
        private const val NOTIF = 1
        private const val NOTIF_LISTO = 2
    }
}
