package org.grupocc.descargador

import android.Manifest
import android.content.ClipboardManager
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.inputmethod.InputMethodManager
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import com.google.android.material.chip.Chip
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.yausername.youtubedl_android.YoutubeDL
import com.yausername.youtubedl_android.mapper.VideoInfo
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.grupocc.descargador.databinding.ActivityMainBinding
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class MainActivity : AppCompatActivity() {
    private lateinit var b: ActivityMainBinding
    private var info: VideoInfo? = null
    private var urlActual: String? = null

    private val pedirAvisos = registerForActivityResult(ActivityResultContracts.RequestPermission()) { arrancar() }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivityMainBinding.inflate(layoutInflater)
        setContentView(b.root)
        setSupportActionBar(b.barra)

        Calidad.entries.forEach { c ->
            b.calidades.addView(Chip(this).apply {
                id = View.generateViewId(); tag = c; text = getString(c.etiqueta); isCheckable = true
                isChecked = c == Calidad.MEJOR
            })
        }
        b.campo.setEndIconOnClickListener { pegar() }
        b.buscar.setOnClickListener { buscar() }
        b.descargar.setOnClickListener { pedirYArrancar() }
        b.cancelar.setOnClickListener {
            startService(Intent(this, DescargaService::class.java).setAction(DescargaService.ACCION_CANCELAR))
        }
        b.otra.setOnClickListener { Descargas.estado.value = Estado.Libre; limpiar() }
        b.actualizarMotor.setOnClickListener { actualizarMotor() }

        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) { Descargas.estado.collect { pintar(it) } }
        }
        avisoDeUso()
        revisarVersion()
        recibir(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        recibir(intent)
    }

    /** Lo compartido desde YouTube trae texto con el enlace dentro: se saca el primero. */
    private fun recibir(intent: Intent?) {
        if (intent?.action != Intent.ACTION_SEND) return
        val texto = intent.getStringExtra(Intent.EXTRA_TEXT) ?: return
        val url = Regex("https?://\\S+").find(texto)?.value ?: return
        b.url.setText(url)
        buscar()
    }

    private fun pegar() {
        val texto = getSystemService(ClipboardManager::class.java).primaryClip?.getItemAt(0)?.coerceToText(this)?.toString()
        Regex("https?://\\S+").find(texto ?: "")?.value?.let { b.url.setText(it); buscar() }
    }

    private fun buscar() {
        val url = b.url.text?.toString()?.trim().orEmpty()
        if (!url.startsWith("http")) { b.campo.error = getString(R.string.error_url); return }
        b.campo.error = null
        getSystemService(InputMethodManager::class.java).hideSoftInputFromWindow(b.url.windowToken, 0)
        urlActual = url; info = null
        b.tarjeta.visibility = View.GONE
        b.buscando.visibility = View.VISIBLE
        b.buscar.isEnabled = false
        lifecycleScope.launch {
            val r = withContext(Dispatchers.IO) {
                runCatching { App.instancia.motor.await().getOrThrow(); YoutubeDL.getInstance().getInfo(url) }
            }
            b.buscando.visibility = View.GONE
            b.buscar.isEnabled = true
            r.onSuccess { mostrar(it) }.onFailure {
                android.util.Log.e("Descargador", "buscar: ${it.message}", it)
                b.campo.error = getString(R.string.error_buscar)
            }
        }
    }

    private fun mostrar(v: VideoInfo) {
        info = v
        b.tarjeta.visibility = View.VISIBLE
        b.titulo.text = v.title ?: urlActual
        b.detalle.text = listOfNotNull(v.uploader, if (v.duration > 0) duracion(v.duration) else null).joinToString(" · ")
        b.miniatura.setImageDrawable(null)
        val mini = v.thumbnail ?: return
        lifecycleScope.launch {
            val bmp = withContext(Dispatchers.IO) { runCatching { URL(mini).openStream().use { BitmapFactory.decodeStream(it) } }.getOrNull() }
            if (bmp != null && info === v) b.miniatura.setImageBitmap(bmp)
        }
    }

    private fun duracion(s: Int) = if (s >= 3600) "%d:%02d:%02d".format(s / 3600, s / 60 % 60, s % 60) else "%d:%02d".format(s / 60, s % 60)

    private fun pedirYArrancar() {
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) pedirAvisos.launch(Manifest.permission.POST_NOTIFICATIONS) else arrancar()
    }

    private fun arrancar() {
        val url = urlActual ?: return
        val calidad = b.calidades.findViewById<Chip>(b.calidades.checkedChipId)?.tag as? Calidad ?: Calidad.MEJOR
        ContextCompat.startForegroundService(this, Intent(this, DescargaService::class.java)
            .putExtra(DescargaService.EXTRA_URL, url)
            .putExtra(DescargaService.EXTRA_CALIDAD, calidad.name)
            .putExtra(DescargaService.EXTRA_TITULO, info?.title ?: url))
    }

    private fun pintar(e: Estado) {
        val bajando = e is Estado.Bajando
        b.formulario.visibility = if (bajando || e is Estado.Listo) View.GONE else View.VISIBLE
        b.progreso.visibility = if (bajando) View.VISIBLE else View.GONE
        b.resultado.visibility = if (e is Estado.Listo) View.VISIBLE else View.GONE
        when (e) {
            is Estado.Bajando -> {
                b.progresoTitulo.text = e.titulo
                b.barraProgreso.isIndeterminate = e.porcentaje <= 0f
                b.barraProgreso.setProgressCompat(e.porcentaje.toInt(), true)
                val fase = getString(if (e.fase == 1) R.string.fase_video else R.string.fase_audio)
                b.progresoTexto.text = if (e.porcentaje <= 0f) getString(R.string.preparando)
                    else "$fase · ${e.porcentaje.toInt()} %" + if (e.etaSeg > 0) " · ${getString(R.string.quedan, duracion(e.etaSeg.toInt()))}" else ""
            }
            is Estado.Listo -> {
                b.resultadoTitulo.text = e.titulo
                b.resultadoTexto.setText(if (e.audio) R.string.guardado_audio else R.string.guardado_video)
                b.abrir.setOnClickListener { abrir(e.uri, e.audio) }
                b.compartir.setOnClickListener {
                    startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND)
                        .setType(if (e.audio) "audio/mp4" else "video/mp4")
                        .putExtra(Intent.EXTRA_STREAM, e.uri)
                        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION), null))
                }
            }
            is Estado.Error -> {
                MaterialAlertDialogBuilder(this).setTitle(R.string.no_se_pudo).setMessage(e.mensaje)
                    .setPositiveButton(R.string.entendido, null).show()
                Descargas.estado.value = Estado.Libre
            }
            Estado.Libre -> Unit
        }
    }

    private fun abrir(uri: Uri, audio: Boolean) {
        runCatching {
            startActivity(Intent(Intent.ACTION_VIEW).setDataAndType(uri, if (audio) "audio/mp4" else "video/mp4")
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION))
        }
    }

    private fun limpiar() {
        b.url.setText(""); info = null; urlActual = null
        b.tarjeta.visibility = View.GONE
    }

    /** YouTube cambia a menudo y una versión vieja de yt-dlp deja de funcionar: se actualiza desde aquí. */
    private fun actualizarMotor() {
        b.actualizarMotor.isEnabled = false
        b.actualizarMotor.setText(R.string.actualizando)
        lifecycleScope.launch {
            val r = withContext(Dispatchers.IO) {
                runCatching {
                    App.instancia.motor.await().getOrThrow()
                    YoutubeDL.getInstance().updateYoutubeDL(this@MainActivity, YoutubeDL.UpdateChannel.STABLE)
                }
            }
            b.actualizarMotor.isEnabled = true
            b.actualizarMotor.setText(R.string.actualizar_motor)
            val version = withContext(Dispatchers.IO) { runCatching { YoutubeDL.getInstance().versionName(this@MainActivity) }.getOrNull() }
            val msg = r.fold(
                { if (it == YoutubeDL.UpdateStatus.ALREADY_UP_TO_DATE) getString(R.string.motor_al_dia, version ?: "") else getString(R.string.motor_actualizado, version ?: "") },
                { getString(R.string.error_actualizar) },
            )
            MaterialAlertDialogBuilder(this@MainActivity).setMessage(msg).setPositiveButton(R.string.entendido, null).show()
        }
    }

    private fun avisoDeUso() {
        val prefs = getSharedPreferences("app", MODE_PRIVATE)
        if (prefs.getBoolean("aviso_aceptado", false)) return
        MaterialAlertDialogBuilder(this).setTitle(R.string.aviso_titulo).setMessage(R.string.aviso_texto)
            .setCancelable(false)
            .setPositiveButton(R.string.entendido) { _, _ -> prefs.edit().putBoolean("aviso_aceptado", true).apply() }
            .show()
    }

    /** ¿Hay una versión nueva de la app en GCC World? Se descarga desde Herramientas. */
    private fun revisarVersion() {
        lifecycleScope.launch {
            val nueva = withContext(Dispatchers.IO) {
                runCatching {
                    val c = URL("${BuildConfig.SERVIDOR}/api/herramientas/apps/${BuildConfig.SLUG}/version").openConnection() as HttpURLConnection
                    c.connectTimeout = 5000; c.readTimeout = 5000
                    val j = JSONObject(c.inputStream.bufferedReader().use { it.readText() })
                    if (j.optInt("version_code") > BuildConfig.VERSION_CODE) j.optString("version_name") else null
                }.getOrNull()
            } ?: return@launch
            b.nuevaVersion.visibility = View.VISIBLE
            b.nuevaVersionTexto.text = getString(R.string.nueva_version, nueva)
            b.nuevaVersionBoton.setOnClickListener {
                startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("${BuildConfig.SERVIDOR}/dashboard/tools?herramienta=${BuildConfig.SLUG}")))
            }
        }
    }
}
