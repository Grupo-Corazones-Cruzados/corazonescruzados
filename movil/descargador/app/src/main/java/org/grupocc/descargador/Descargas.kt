package org.grupocc.descargador

import android.net.Uri
import kotlinx.coroutines.flow.MutableStateFlow

/**
 * Hasta `h` de alto, prefiriendo H.264 (avc1) + AAC en MP4: lo reproduce cualquier teléfono. YouTube
 * da también AV1/VP9, que algunos no decodifican bien; esos quedan solo como respaldo.
 */
private fun hasta(h: Int) =
    "bv*[height<=$h][vcodec^=avc1]+ba[ext=m4a]/bv*[height<=$h][ext=mp4]+ba[ext=m4a]/b[height<=$h][ext=mp4]/bv*[height<=$h]+ba/b[height<=$h]"

/** Calidades que se ofrecen. `formato` es el selector de yt-dlp. «Mejor» toma la máxima, sea cual sea el códec. */
enum class Calidad(val etiqueta: Int, val formato: String, val audio: Boolean = false) {
    MEJOR(R.string.calidad_mejor, "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b"),
    P1080(R.string.calidad_1080, hasta(1080)),
    P720(R.string.calidad_720, hasta(720)),
    P480(R.string.calidad_480, hasta(480)),
    AUDIO(R.string.calidad_audio, "ba[ext=m4a]/ba", audio = true),
}

sealed class Estado {
    data object Libre : Estado()
    data class Bajando(val titulo: String, val porcentaje: Float, val etaSeg: Long, val fase: Int) : Estado()
    data class Listo(val titulo: String, val uri: Uri, val audio: Boolean) : Estado()
    data class Error(val mensaje: String) : Estado()
}

/** Una descarga a la vez; el servicio la escribe y la pantalla la lee. */
object Descargas {
    val estado = MutableStateFlow<Estado>(Estado.Libre)
}
