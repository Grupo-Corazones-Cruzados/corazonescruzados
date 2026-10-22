import Foundation
import JavaScriptCore

/// Python con yt-dlp dentro de la app (`python/gcc_descargador.py` hace el trabajo).
///
/// Cada llamada a Python corre en un hilo propio con pila de 16 MB: los de GCD traen 512 KB y
/// el JavaScriptCore que resuelve los retos de YouTube recorre recursivamente un reproductor de
/// varios MB. Python habla con Swift por dos funciones de C cuyas direcciones se le pasan al
/// configurar: `avisarC` (eventos JSON para la pantalla) y `jsC` (ejecuta JavaScript).
final class Motor {
    static let compartido = Motor()

    /// Lo recibe `Descargas`, en el hilo principal.
    var alRecibir: (([String: Any]) -> Void)?

    private var listo = false
    private let pila = 16 << 20

    let dirMotor: URL = {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        let d = base.appendingPathComponent("motor", isDirectory: true)
        try? FileManager.default.createDirectory(at: d, withIntermediateDirectories: true)
        return d
    }()

    /// Arranca Python una vez. Tarda un par de segundos (importar yt-dlp).
    func arrancar(_ hecho: @escaping (Bool) -> Void) {
        enHilo { [self] in
            let ok = iniciarPython()
            if ok {
                let cache = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("yt-dlp").path
                let avisar = unsafeBitCast(avisarC, to: Int.self), js = unsafeBitCast(jsC, to: Int.self)
                listo = correr("gcc_descargador.configurar(\(avisar), \(js), \(py(dirMotor.path)), \(py(cache)))")
            }
            DispatchQueue.main.async { hecho(self.listo) }
        }
    }

    func buscar(_ url: String) { llamar("gcc_descargador.buscar(\(py(url)))") }

    func descargar(_ url: String, calidad: String, carpeta: URL) {
        llamar("gcc_descargador.descargar(\(py(url)), \(py(calidad)), \(py(carpeta.path)))")
    }

    /// Va por otro hilo: la descarga tiene el suyo ocupado, y Python suelta el GIL mientras baja.
    func cancelar() { llamar("gcc_descargador.cancelar()") }

    /// Tras dejar un yt-dlp nuevo en `dirMotor`: lo carga sin cerrar la app.
    func recargar() { llamar("gcc_descargador.recargar()") }

    // MARK: - Python

    private func llamar(_ codigo: String) {
        guard listo else { return }
        enHilo { [self] in _ = correr(codigo) }
    }

    private func enHilo(_ trabajo: @escaping () -> Void) {
        let hilo = Thread(block: trabajo)
        hilo.stackSize = pila
        hilo.start()
    }

    /// `PyRun_SimpleString` con el GIL tomado. Las funciones de Python ya convierten sus errores en
    /// eventos; si aun así algo se escapa, la traza va al registro del sistema.
    private func correr(_ codigo: String) -> Bool {
        let g = PyGILState_Ensure()
        defer { PyGILState_Release(g) }
        return PyRun_SimpleString("import gcc_descargador\n" + codigo) == 0
    }

    private func iniciarPython() -> Bool {
        let recursos = Bundle.main.resourcePath!
        var pre = PyPreConfig()
        PyPreConfig_InitIsolatedConfig(&pre)
        pre.utf8_mode = 1
        if PyStatus_Exception(Py_PreInitialize(&pre)) != 0 { return false }

        var config = PyConfig()
        PyConfig_InitIsolatedConfig(&config)
        defer { PyConfig_Clear(&config) }
        config.use_system_logger = 1
        config.buffered_stdio = 0
        // El paquete de la app está firmado: no se puede escribir .pyc dentro.
        config.write_bytecode = 0
        config.install_signal_handlers = 0
        let estado = withUnsafeMutablePointer(to: &config) { c -> PyStatus in
            let s = PyConfig_SetBytesString(c, &c.pointee.home, "\(recursos)/python")
            if PyStatus_Exception(s) != 0 { return s }
            return Py_InitializeFromConfig(c)
        }
        if PyStatus_Exception(estado) != 0 { return false }

        let rutas = ["\(recursos)/app", "\(recursos)/app_packages"]
        let ok = PyRun_SimpleString("import sys\nsys.path[:0] = \(py(rutas))") == 0
        // El hilo que arrancó Python suelta el GIL: a partir de aquí cada llamada lo toma con PyGILState.
        _ = PyEval_SaveThread()
        return ok
    }

    /// Un texto de Swift como literal de Python (JSON lo es, si no se escapan las barras).
    private func py(_ valor: Any) -> String {
        let datos = try! JSONSerialization.data(withJSONObject: valor, options: [.fragmentsAllowed, .withoutEscapingSlashes])
        return String(decoding: datos, as: UTF8.self)
    }

    // MARK: - Retos de YouTube

    /// yt-dlp manda el script de `yt-dlp-ejs` con el reproductor de YouTube y espera por `console.log`
    /// el JSON con las respuestas. Un contexto nuevo por llamada: no queda nada del anterior.
    static func correrJS(_ codigo: String) -> String {
        guard let ctx = JSContext() else { return error("No se pudo crear el contexto de JavaScript") }
        var fallo: String?
        ctx.exceptionHandler = { _, e in fallo = e?.toString() ?? "error de JavaScript" }
        ctx.evaluateScript("""
            var __salida = null;
            var console = { log: function (s) { __salida = String(s); }, error: function () {}, warn: function () {}, info: function () {}, debug: function () {} };
            """)
        ctx.evaluateScript(codigo)
        if let fallo { return error(fallo) }
        guard let v = ctx.objectForKeyedSubscript("__salida"), v.isString, let s = v.toString() else {
            return error("El script no devolvió nada")
        }
        return s
    }

    private static func error(_ m: String) -> String {
        let d = try! JSONSerialization.data(withJSONObject: ["type": "error", "error": m])
        return String(decoding: d, as: UTF8.self)
    }
}

/// Las dos funciones de C que Python llama con ctypes. No capturan nada: van por `Motor.compartido`.
private let avisarC: @convention(c) (UnsafePointer<CChar>?) -> Void = { p in
    guard let p, let datos = String(cString: p).data(using: .utf8),
          let evento = try? JSONSerialization.jsonObject(with: datos) as? [String: Any] else { return }
    DispatchQueue.main.async { Motor.compartido.alRecibir?(evento) }
}

/// Devuelve memoria de `strdup`; Python la libera con `free`.
private let jsC: @convention(c) (UnsafePointer<CChar>?) -> UnsafeMutablePointer<CChar>? = { p in
    strdup(Motor.correrJS(p.map { String(cString: $0) } ?? ""))
}
