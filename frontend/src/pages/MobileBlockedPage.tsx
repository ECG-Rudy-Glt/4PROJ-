import { Monitor, QrCode, Smartphone } from 'lucide-react';

export default function MobileBlockedPage() {
  return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-6 py-10">
      <section className="w-full max-w-2xl space-y-8">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-sm text-gray-200">
            <Smartphone className="h-4 w-4" />
            Acces mobile bloque
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-normal">
            SUPFile Web est disponible depuis un ordinateur
          </h1>
          <p className="text-base sm:text-lg text-gray-300 leading-7">
            Pour utiliser SUPFile sur mobile pendant le developpement, installez Expo Go puis scannez le QR code Expo ou saisissez l'URL Expo generee par le terminal.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-white/10 bg-white/5 p-5">
            <Monitor className="h-7 w-7 text-primary-300 mb-4" />
            <h2 className="text-lg font-semibold mb-2">Acces web</h2>
            <p className="text-sm text-gray-300 leading-6">
              Ouvrez le site depuis un PC ou un Mac pour acceder a l'application web complete.
            </p>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/5 p-5">
            <QrCode className="h-7 w-7 text-primary-300 mb-4" />
            <h2 className="text-lg font-semibold mb-2">Acces mobile</h2>
            <p className="text-sm text-gray-300 leading-6">
              Lancez l'app mobile avec Expo, puis utilisez Expo Go pour scanner le QR code ou entrer l'URL Expo affichee.
            </p>
          </div>
        </div>

        <a
          href="https://expo.dev/client"
          className="inline-flex items-center justify-center rounded-lg bg-white px-5 py-3 text-sm font-semibold text-gray-950 hover:bg-gray-100 transition-colors"
          rel="noreferrer"
        >
          Telecharger Expo Go
        </a>
      </section>
    </main>
  );
}
