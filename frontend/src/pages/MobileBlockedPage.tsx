import { ExternalLink, Monitor, QrCode, ShieldCheck, Smartphone } from 'lucide-react';

const EXPO_MOBILE_URL = 'exp://supfile.tech:8081';
const EXPO_GO_URL = 'https://expo.dev/client';

export default function MobileBlockedPage() {
  return (
    <main className="min-h-screen bg-[#f6faf7] px-5 py-8 text-[#102a27]">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center">
        <div className="w-full overflow-hidden rounded-lg border border-[#d9e8dc] bg-white shadow-[0_24px_80px_rgba(37,68,65,0.16)]">
          <div className="bg-[#254441] px-6 py-5 text-white sm:px-8">
            <img src="/icon-full-light.svg" alt="SUPFile" className="h-10 w-auto" />
          </div>

          <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-7 p-6 sm:p-8 lg:p-10">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#cfe0d3] bg-[#eef7f0] px-3 py-1 text-sm font-semibold text-[#254441]">
                  <Smartphone className="h-4 w-4" />
                  Acces mobile dedie
                </div>
                <h1 className="max-w-xl text-3xl font-bold leading-tight tracking-normal text-[#254441] sm:text-4xl">
                  SUPFile Web reste optimise pour ordinateur
                </h1>
                <p className="max-w-2xl text-base leading-7 text-[#47635f] sm:text-lg">
                  Sur mobile, utilisez l'app SUPFile avec Expo Go. Scannez le QR code ou ouvrez le lien Expo public du VPS pour lancer l'application mobile.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-[#d9e8dc] bg-[#fbfdfb] p-5">
                  <Monitor className="mb-4 h-7 w-7 text-[#d4785c]" />
                  <h2 className="mb-2 text-base font-bold text-[#254441]">Acces web complet</h2>
                  <p className="text-sm leading-6 text-[#5f7470]">
                    Ouvrez supfile.tech depuis un PC ou un Mac pour utiliser toute l'interface web.
                  </p>
                </div>

                <div className="rounded-lg border border-[#d9e8dc] bg-[#fbfdfb] p-5">
                  <ShieldCheck className="mb-4 h-7 w-7 text-[#e8b84a]" />
                  <h2 className="mb-2 text-base font-bold text-[#254441]">App mobile Expo</h2>
                  <p className="text-sm leading-6 text-[#5f7470]">
                    Installez Expo Go, puis scannez le QR code ci-contre pour lancer SUPFile Mobile.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <a
                  href={EXPO_MOBILE_URL}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#254441] px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-[#1d3633]"
                >
                  Ouvrir l'app Expo
                  <ExternalLink className="h-4 w-4" />
                </a>
                <a
                  href={EXPO_GO_URL}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#254441]/20 bg-white px-5 py-3 text-sm font-bold text-[#254441] transition-colors hover:bg-[#eef7f0]"
                  rel="noreferrer"
                >
                  Telecharger Expo Go
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>

            <aside className="border-t border-[#d9e8dc] bg-[#eef7f0] p-6 sm:p-8 lg:border-l lg:border-t-0 lg:p-10">
              <div className="mx-auto max-w-sm space-y-5">
                <div className="rounded-lg border border-[#d9e8dc] bg-white p-4 shadow-sm">
                  <img src="/expo-mobile-qr.svg" alt="QR code Expo SUPFile Mobile" className="aspect-square w-full" />
                </div>

                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 rounded-full bg-[#d4785c]/15 px-3 py-1 text-sm font-bold text-[#8f412d]">
                    <QrCode className="h-4 w-4" />
                    QR code Expo
                  </div>
                  <p className="text-sm leading-6 text-[#47635f]">
                    Lien Expo VPS a saisir dans Expo Go si le scan ne s'ouvre pas automatiquement.
                  </p>
                  <a
                    href={EXPO_MOBILE_URL}
                    className="block break-all rounded-lg border border-[#cfe0d3] bg-white px-4 py-3 font-mono text-xs font-semibold text-[#254441]"
                  >
                    {EXPO_MOBILE_URL}
                  </a>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}
