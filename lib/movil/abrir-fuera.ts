/** Abre una dirección fuera de la app (`AbrirFueraPlugin`). `null`: esta app aún no lo sabe hacer. */
export async function abrirFuera(url: string): Promise<boolean | null> {
  const { Capacitor, registerPlugin } = await import('@capacitor/core');
  if (!Capacitor.isPluginAvailable('AbrirFuera')) return null;
  const p = registerPlugin<{ abrir(o: { url: string }): Promise<{ abierta: boolean }> }>('AbrirFuera');
  return (await p.abrir({ url })).abierta;
}
