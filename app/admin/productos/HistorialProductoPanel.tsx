'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'

type Producto = {
  id: string
  Nombre: string
  Stock: number
  Precio: number
  Foto_url: string
}

type Movimiento = {
  id: string
  tipo: string
  cantidad: number
  stock_antes: number
  stock_despues: number
  usuario_id: string
  motivo: string | null
  fecha: string
}

const ETIQUETAS_TIPO: Record<string, string> = {
  venta_pos: 'Venta POS',
  venta_whatsapp: 'Venta WhatsApp',
  carga_inicial: 'Carga inicial',
  compra: 'Compra',
  ajuste_manual: 'Ajuste manual',
  conteo_fisico: 'Conteo físico',
  devolucion: 'Devolución',
}

export default function HistorialProductoPanel({
  producto,
  movimientos,
  mapaUsuarios,
}: {
  producto: Producto
  movimientos: Movimiento[]
  mapaUsuarios: Record<string, string>
}) {
  const [filtroTipo, setFiltroTipo] = useState('todos')

  const tiposPresentes = useMemo(() => {
    const set = new Set(movimientos.map(m => m.tipo))
    return Array.from(set)
  }, [movimientos])

  const filtrados = useMemo(() => {
    if (filtroTipo === 'todos') return movimientos
    return movimientos.filter(m => m.tipo === filtroTipo)
  }, [movimientos, filtroTipo])

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-gray-900">{producto.Nombre}</h1>
            <p className="text-xs text-gray-500">Stock actual: {producto.Stock} · Historial completo de movimientos</p>
          </div>
          <Link
            href="/admin"
            className="text-xs text-gray-500 border border-gray-200 rounded-xl px-3 py-1.5"
          >
            Volver
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {tiposPresentes.length > 1 && (
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
            <button
              onClick={() => setFiltroTipo('todos')}
              className={`text-xs rounded-xl px-3 py-1.5 font-medium whitespace-nowrap ${
                filtroTipo === 'todos' ? 'bg-emerald-500 text-white' : 'bg-white border border-gray-200 text-gray-600'
              }`}
            >
              Todos
            </button>
            {tiposPresentes.map(t => (
              <button
                key={t}
                onClick={() => setFiltroTipo(t)}
                className={`text-xs rounded-xl px-3 py-1.5 font-medium whitespace-nowrap ${
                  filtroTipo === t ? 'bg-emerald-500 text-white' : 'bg-white border border-gray-200 text-gray-600'
                }`}
              >
                {ETIQUETAS_TIPO[t] ?? t}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2">
          {filtrados.map(m => (
            <div key={m.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-700">{ETIQUETAS_TIPO[m.tipo] ?? m.tipo}</span>
                <span className={`text-sm font-bold ${m.cantidad < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                  {m.cantidad > 0 ? `+${m.cantidad}` : m.cantidad}
                </span>
              </div>
              <p className="text-[11px] text-gray-500 mt-1">
                {new Date(m.fecha).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                {' · '}{mapaUsuarios[m.usuario_id] ?? 'Usuario'}
                {' · '}Stock: {m.stock_antes} → {m.stock_despues}
              </p>
              {m.motivo && (
                <p className="text-xs text-gray-600 mt-1">Motivo: {m.motivo}</p>
              )}
            </div>
          ))}

          {filtrados.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">No hay movimientos registrados para este producto.</p>
          )}
        </div>
      </main>
    </div>
  )
}