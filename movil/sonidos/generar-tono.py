"""
Tono de los avisos de GCC World (2026-10-29): arpegio ascendente de campana Mi5 · Sol#5 · Si5
(Mi mayor), ~1,2 s, suave. Genera `gcc_aviso.wav` (Android, res/raw) y, con `afconvert`,
`gcc_aviso.caf` (iPhone/iPad, dentro de la app). Ejecutar: `python3 movil/sonidos/generar-tono.py`.
"""
import math, os, struct, subprocess, wave

TASA = 44100
DURACION = 1.25
NOTAS = [(659.25, 0.00), (830.61, 0.13), (987.77, 0.26)]  # (Hz, inicio en s)
aqui = os.path.dirname(os.path.abspath(__file__))

muestras = [0.0] * int(TASA * DURACION)
for f, t0 in NOTAS:
    for i in range(int(t0 * TASA), len(muestras)):
        t = i / TASA - t0
        ataque = min(1.0, t / 0.006)                     # sin chasquido al empezar
        caida = math.exp(-t * 4.2)
        # campana: fundamental + armónicos inarmónicos suaves que se apagan antes
        s = (math.sin(2 * math.pi * f * t)
             + 0.35 * math.sin(2 * math.pi * f * 2.0 * t) * math.exp(-t * 7)
             + 0.12 * math.sin(2 * math.pi * f * 3.01 * t) * math.exp(-t * 11))
        muestras[i] += s * ataque * caida
# cola: fundido final para no cortar en seco
for i in range(len(muestras)):
    resta = (len(muestras) - i) / TASA
    if resta < 0.15: muestras[i] *= resta / 0.15
pico = max(abs(m) for m in muestras)
datos = b''.join(struct.pack('<h', int(m / pico * 0.6 * 32767)) for m in muestras)  # -4,4 dBFS: suave

wav = os.path.join(aqui, 'gcc_aviso.wav')
with wave.open(wav, 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(TASA); w.writeframes(datos)
subprocess.run(['afconvert', '-f', 'caff', '-d', 'LEI16', wav, os.path.join(aqui, 'gcc_aviso.caf')], check=True)
print('listo:', wav)
