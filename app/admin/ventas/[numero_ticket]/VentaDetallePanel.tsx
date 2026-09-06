'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'

type Linea = {
  id: string
  producto_id: string
  cantidad: number
  total: number
  canal: string
  metodo_pago: string | null
  turno_id: string | null
  fecha: string
  estado: string
  motivo_anulacion: string | null
  anulado_por: string | null
  anulado_en: string | null
  descuento_tipo: string | null
  descuento_valor: number | null
  descuento_monto_aplicado: number | null
  nombreProducto: string
}

export default function VentaDetallePanel({
  numeroTicket,
  lineas,
  vendedorNombre,
  mapaUsuarios,
  comercianteId,
  usuarioId,
  esAdmin,
  puedeAnular,
  turnoAbierto,
}: {
  numeroTicket: number
  lineas: Linea[]
  vendedorNombre: string
  mapaUsuarios: Record<string, string>
  comercianteId: string
  usuarioId: string
  esAdmin: boolean
  puedeAnular: boolean
  turnoAbierto: boolean
}) {
  const router = useRouter()
  const supabase = createClient()

  const [modalAbierto, setModalAbierto] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [anulando, setAnulando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function fmt(n: number) {
    return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 })
  }

  const primeraLinea = lineas[0]
  const yaAnulada = lineas.some((l) => l.estado === 'anulada')
  const descuentoMonto = primeraLinea.descuento_monto_aplicado ?? 0
  const subtotal = lineas.reduce((s, l) => s + l.total, 0)
  const totalCobrado = subtotal - descuentoMonto

  async function confirmarAnulacion() {
    if (!motivo.trim()) {
      setError('El motivo es obligatorio')
      return
    }
    setAnulando(true)
    setError(null)

    const { error: rpcError } = await supabase.rpc('anular_venta', {
      p_comerciante_id: comercianteId,
      p_numero_ticket: numeroTicket,
      p_usuario_id: usuarioId,
      p_es_admin: esAdmin,
      p_motivo: motivo.trim(),
    })

    if (rpcError) {
      setError(rpcError.message || 'No se pudo anular la venta')
      setAnulando(false)
      return
    }

    setModalAbierto(false)
    setAnulando(false)
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-gray-900">Ticket #{numeroTicket}</h1>
            <p className="text-xs text-gray-500">
              {new Date(primeraLinea.fecha).toLocaleString('es-AR', {
                day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
              })}
              {' · '}Vendedor: {vendedorNombre}
            </p>
          </div>
          <Link href="/admin" className="text-xs text-gray-500 border border-gray-200 rounded-xl px-3 py-1.5">
            Volver
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {yaAnulada && (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-3 mb-4">
            <p className="text-sm font-semibold text-red-600">Venta anulada</p>
            <p className="text-xs text-red-500 mt-1">Motivo: {primeraLinea.motivo_anulacion}</p>
            <p className="text-xs text-red-500">
              Por {primeraLinea.anulado_por ? mapaUsuarios[primeraLinea.anulado_por] ?? 'Usuario' : '—'}
              {primeraLinea.anulado_en &&
                ` · ${new Date(primeraLinea.anulado_en).toLocaleString('es-AR', {
                  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                })}`}
            </p>
          </div>
        )}

        {!yaAnulada && !turnoAbierto && (
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3 mb-4">
            <p className="text-xs text-amber-700">
              El turno de esta venta ya está cerrado — no se puede anular. Si hace falta corregirla, usá una nota de crédito.
            </p>
          </div>
        )}

        {!yaAnulada && turnoAbierto && !esAdmin && !puedeAnular && (
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3 mb-4">
            <p className="text-xs text-amber-700">Solo el vendedor que hizo esta venta puede anularla.</p>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
          <div className="flex flex-col gap-2">
            {lineas.map((l) => (
              <div key={l.id} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800">{l.nombreProducto}</p>
                  <p className="text-xs text-gray-500">{l.cantidad} unidad{l.cantidad !== 1 ? 'es' : ''}</p>
                </div>
                <span className="text-sm font-semibold text-gray-800">{fmt(l.total)}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-100 mt-3 pt-3 flex flex-col gap-1">
            {descuentoMonto > 0 && (
              <>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Subtotal</span>
                  <span>{fmt(subtotal)}</span>
                </div>
                <div className="flex justify-between text-xs text-red-500">
                  <span>
                    Descuento {primeraLinea.descuento_tipo === 'porcentaje' ? `(${primeraLinea.descuento_valor}%)` : ''}
                  </span>
                  <span>-{fmt(descuentoMonto)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between text-sm font-bold text-gray-900">
              <span>TOTAL</span>
              <span>{fmt(totalCobrado)}</span>
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              Canal: {primeraLinea.canal} · Método de pago: {primeraLinea.metodo_pago ?? '—'}
            </p>
          </div>
        </div>

        {puedeAnular && (
          <button
            onClick={() => setModalAbierto(true)}
            className="w-full py-3 rounded-xl bg-red-50 text-red-600 font-semibold text-sm border border-red-100"
          >
            Anular venta
          </button>
        )}
      </main>

      {modalAbierto && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-20">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm p-5">
            <h2 className="font-bold text-gray-900 mb-1">Anular ticket #{numeroTicket}</h2>
            <p className="text-xs text-gray-500 mb-3">
              Se revierte el stock de cada producto y queda registrado en el kardex. Esta acción no se puede deshacer.
            </p>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Motivo de la anulación (obligatorio)"
              className="w-full border border-gray-200 rounded-xl p-3 text-sm mb-2 resize-none"
              rows={3}
            />
            {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => { setModalAbierto(false); setError(null); setMotivo('') }}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600"
                disabled={anulando}
              >
                Cancelar
              </button>
              <button
                onClick={confirmarAnulacion}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold disabled:opacity-50"
                disabled={anulando}
              >
                {anulando ? 'Anulando...' : 'Confirmar anulación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
