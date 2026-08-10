'use client'

import Link from 'next/link'

type Conteo = {
  id: string
  fecha: string
  usuario_id: string
  cantidad_productos_contados: number
  total_diferencia_valor: number
}

type Detalle = {
  id: string
  conteo_id: string
  producto_id: string | null
  stock_teorico: number
  stock_contado: number
  diferencia: number
  valor_diferencia: number
  productos: { Nombre: string } | { Nombre: string }[] | null
}

function nombreProducto(d: Detalle) {
  if (!d.productos) return '(producto eliminado)'
  return Array.isArray(d.productos) ? d.productos[0]?.Nombre ?? '(producto eliminado)' : d.productos.Nombre
}

export default function HistorialConteoPanel({
  conteos,
  detalles,
  mapaUsuarios,
}: {
  conteos: Conteo[]
  detalles: Detalle[]
  mapaUsuarios: Record<string, string>
}) {
  const conteosCronologicos = [...conteos].reverse()

  function tendenciaVs(conteoId: string) {
    const idx = conteosCronologicos.findIndex(c => c.id === conteoId)
    if (idx <= 0) return null
    const actual = conteosCronologicos[idx].total_diferencia_valor
    const anterior = conteosCronologicos[idx - 1].total_diferencia_valor
    return actual - anterior
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="font-bold text-gray-900">Historial de conteos</h1>
          <Link
            href="/admin/conteo"
            className="text-xs text-gray-500 border border-gray-200 rounded-xl px-3 py-1.5"
          >
            Nuevo conteo
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {conteos.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">Todavía no se registró ningún conteo físico.</p>
        )}

        <div className="flex flex-col gap-3">
          {conteos.map(conteo => {
            const lineasAjustadas = detalles
              .filter(d => d.conteo_id === conteo.id && d.diferencia !== 0)
              .sort((a, b) => Math.abs(b.valor_diferencia) - Math.abs(a.valor_diferencia))

            const tendencia = tendenciaVs(conteo.id)
            const usuarioNombre = mapaUsuarios[conteo.usuario_id] ?? 'Usuario'

            return (
              <div key={conteo.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {new Date(conteo.fecha).toLocaleDateString('es-AR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                      })}
                    </p>
                    <p className="text-[11px] text-gray-500">
                      {usuarioNombre} · {conteo.cantidad_productos_contados} contados · {lineasAjustadas.length} con diferencia
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${conteo.total_diferencia_valor < 0 ? 'text-red-500' : 'text-gray-900'}`}>
                      ${conteo.total_diferencia_valor.toLocaleString('es-AR')}
                    </p>
                    {tendencia !== null && (
                      <p className={`text-[10px] ${tendencia < 0 ? 'text-red-400' : 'text-emerald-500'}`}>
                        {tendencia < 0 ? '↓' : '↑'} ${Math.abs(tendencia).toLocaleString('es-AR')} vs anterior
                      </p>
                    )}
                  </div>
                </div>

                {lineasAjustadas.length > 0 ? (
                  <div className="mt-3 pt-3 border-t border-gray-100 flex flex-col gap-2">
                    {lineasAjustadas.map(linea => (
                      <div key={linea.id} className="flex items-center justify-between text-xs">
                        <span className="text-gray-700 truncate flex-1">{nombreProducto(linea)}</span>
                        <span className="text-gray-500 mx-2">
                          {linea.stock_teorico} → {linea.stock_contado}
                        </span>
                        <span className={`font-medium ${linea.valor_diferencia < 0 ? 'text-red-500' : 'text-gray-700'}`}>
                          ${linea.valor_diferencia.toLocaleString('es-AR')}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400">
                    Sin diferencias — todo coincidió con el stock teórico.
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}