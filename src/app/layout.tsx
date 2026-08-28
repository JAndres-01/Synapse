import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/context/AuthContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "Synapse — Control de Clases",
  description: "Hub mobile-first de horarios, tareas, fotos de pizarra y avisos del salón de clases.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Synapse",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#09090b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark h-full">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon.svg" />
      </head>
      <body className="h-[100dvh] w-full overflow-hidden bg-zinc-950 text-zinc-100 antialiased selection:bg-zinc-800 selection:text-white">
        <AuthProvider>
          <main className="max-w-md mx-auto h-[100dvh] relative flex flex-col bg-zinc-950 border-x border-zinc-900/50 shadow-2xl overflow-hidden">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
