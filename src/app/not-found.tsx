import Link from 'next/link'
import { Sparkles, ArrowLeft } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center safe-area-top safe-area-bottom">
      <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 mb-4">
        <Sparkles className="w-6 h-6 text-indigo-400" />
      </div>
      <h2 className="text-xl font-bold text-white mb-2">Página no encontrada</h2>
      <p className="text-xs text-zinc-400 max-w-xs mb-6">
        La ruta que buscas no existe o ha sido movida.
      </p>
      <Link
        href="/app/today"
        className="py-2.5 px-4 rounded-xl bg-zinc-100 text-zinc-950 text-xs font-semibold flex items-center gap-2 hover:bg-white active:scale-95 transition-all"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Volver a Hoy</span>
      </Link>
    </div>
  )
}
