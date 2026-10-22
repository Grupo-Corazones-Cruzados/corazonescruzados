import AVFoundation
import Photos

/// Lo que yt-dlp deja en la carpeta temporal pasa a su sitio: el video a Fotos (unido antes con
/// AVFoundation si vino en dos partes) y el audio solo a «Archivos», porque Fotos no guarda audio.
enum Guardar {
    enum Fallo: LocalizedError {
        case sinPista, sinPermiso, exportar(String)
        var errorDescription: String? {
            switch self {
            case .sinPista: "El archivo descargado no trae video o audio."
            case .sinPermiso: "La app no tiene permiso para guardar en Fotos. Actívalo en Ajustes ▸ Descargador GCC ▸ Fotos."
            case .exportar(let m): "No se pudo unir el video y el audio: \(m)"
            }
        }
    }

    /// Une video y audio en un MP4 copiando las pistas tal cual (sin recodificar: es instantáneo).
    static func unir(video: URL, audio: URL, en salida: URL) async throws {
        let comp = AVMutableComposition()
        let va = AVURLAsset(url: video), aa = AVURLAsset(url: audio)
        guard let pv = try await va.loadTracks(withMediaType: .video).first,
              let pa = try await aa.loadTracks(withMediaType: .audio).first,
              let cv = comp.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid),
              let ca = comp.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)
        else { throw Fallo.sinPista }
        let dv = try await va.load(.duration), da = try await aa.load(.duration)
        try cv.insertTimeRange(CMTimeRange(start: .zero, duration: dv), of: pv, at: .zero)
        cv.preferredTransform = try await pv.load(.preferredTransform)
        try ca.insertTimeRange(CMTimeRange(start: .zero, duration: CMTimeMinimum(dv, da)), of: pa, at: .zero)

        try? FileManager.default.removeItem(at: salida)
        guard let sesion = AVAssetExportSession(asset: comp, presetName: AVAssetExportPresetPassthrough) else {
            throw Fallo.exportar("el formato no admite copia directa")
        }
        do { try await sesion.export(to: salida, as: .mp4) } catch { throw Fallo.exportar(error.localizedDescription) }
    }

    /// Solo pide permiso para AÑADIR: la app no ve las fotos que ya hay.
    static func aFotos(_ archivo: URL, titulo: String) async throws {
        let permiso = await PHPhotoLibrary.requestAuthorization(for: .addOnly)
        guard permiso == .authorized || permiso == .limited else { throw Fallo.sinPermiso }
        try await PHPhotoLibrary.shared().performChanges {
            let opciones = PHAssetResourceCreationOptions()
            opciones.originalFilename = "\(nombreDeArchivo(titulo)).mp4"
            opciones.shouldMoveFile = true
            PHAssetCreationRequest.forAsset().addResource(with: .video, fileURL: archivo, options: opciones)
        }
    }

    /// El audio va a Documentos de la app, que «Archivos» muestra como «En mi iPhone ▸ Descargador GCC».
    static func aArchivos(_ archivo: URL, titulo: String) throws -> URL {
        let docs = try FileManager.default.url(for: .documentDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
        let base = nombreDeArchivo(titulo)
        var destino = docs.appendingPathComponent("\(base).\(archivo.pathExtension)")
        var n = 2
        while FileManager.default.fileExists(atPath: destino.path) {
            destino = docs.appendingPathComponent("\(base) (\(n)).\(archivo.pathExtension)")
            n += 1
        }
        try FileManager.default.moveItem(at: archivo, to: destino)
        return destino
    }

    static func nombreDeArchivo(_ titulo: String) -> String {
        let limpio = titulo.components(separatedBy: CharacterSet(charactersIn: "/\\:?%*|\"<>")).joined(separator: " ")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return String((limpio.isEmpty ? "video" : limpio).prefix(80))
    }
}
