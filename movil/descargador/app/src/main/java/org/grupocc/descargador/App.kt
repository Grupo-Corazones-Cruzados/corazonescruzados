package org.grupocc.descargador

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.util.Log
import com.yausername.ffmpeg.FFmpeg
import com.yausername.youtubedl_android.YoutubeDL
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async

/**
 * Arranca el motor (yt-dlp sobre Python + FFmpeg) UNA vez por proceso. La primera vez descomprime
 * unos 100 MB y tarda algunos segundos: va en segundo plano y todo lo demás espera a `motor`.
 */
class App : Application() {
    val alcance = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    lateinit var motor: kotlinx.coroutines.Deferred<Result<Unit>>

    override fun onCreate() {
        super.onCreate()
        instancia = this
        motor = alcance.async {
            runCatching {
                YoutubeDL.getInstance().init(this@App)
                FFmpeg.getInstance().init(this@App)
                actualizarSiToca()
            }
        }
        getSystemService(NotificationManager::class.java).createNotificationChannel(
            NotificationChannel(CANAL, getString(R.string.canal_descargas), NotificationManager.IMPORTANCE_LOW),
        )
    }

    /**
     * YouTube cambia cada pocas semanas y una versión vieja de yt-dlp deja de funcionar: el motor
     * se actualiza solo una vez al día (el botón de la pantalla lo fuerza). Sin red, sigue el que hay.
     */
    private fun actualizarSiToca() {
        val prefs = getSharedPreferences("app", MODE_PRIVATE)
        val ultima = prefs.getLong("motor_revisado", 0)
        if (System.currentTimeMillis() - ultima < 24 * 3600_000L) return
        runCatching { YoutubeDL.getInstance().updateYoutubeDL(this, YoutubeDL.UpdateChannel.STABLE) }
            .onSuccess { prefs.edit().putLong("motor_revisado", System.currentTimeMillis()).apply() }
            .onFailure { Log.w("Descargador", "no se pudo actualizar el motor: ${it.message}") }
    }

    companion object {
        const val CANAL = "descargas"
        lateinit var instancia: App
    }
}
