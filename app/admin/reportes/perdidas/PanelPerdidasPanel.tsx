'use client'

import Link from 'next/link'

type TopProducto = {
  nombre_producto: string
  stock_teorico: number
  stock_contado: number
  diferencia: number
  valorizado_costo: number
  valorizado_venta: number
}

type RankingUsuario = {
  usuario_id: string
  usuario_nombre: string
  diferencia_caja_total: number
  notas_credito_total: number
  anulaciones_total: number
  perdida_valorizada: number
  cantidad_ajustes: number
  unidades_ajustadas: number
  cantidad_anulaciones: number
}

type PanelPerdidasData = {
  hay_datos_suficientes: boolean
  periodo?: { desde: string; hasta: string }
  tendencia?: {
    valor_conteo_anterior: number
    valor_conteo_actual: number
    direccion: 'sube' | 'baja' | 'igual'
  }
  perdida_total?: { valorizado_costo: number; valorizado_venta: number }
  top_productos_diferencia?: TopProducto[]
  ranking_usuarios?: RankingUsuario[]
  descuentos_agregados?: { total_descontado: number; cantidad_tickets: number }
  compras_periodo?: { total_invertido: number }
}

function formatMoney(valor: number) {
  return `$${Math.round(Math.abs(valor)).toLocaleString('es-AR')}`
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export default function PanelPerdidasPanel({ data }: { data: PanelPerdidasData }) {
  if (!data.hay_datos_suficientes) {
    return (
      <div className="max-w-5xl mx-auto p-4 sm:p-6">
        <div className="mb-4">
          <Link href="/admin/reportes" className="text-sm text-gray-500 hover:underline">
            ← Volver a Reportes
          </Link>
        </div>
        <h1 className="text-2xl font-bold mb-4">Panel de Pérdidas</h1>
        <div className="bg-white rounded-lg border p-8 text-center">
          <p className="text-gray-600 mb-2">
            Todavía no hay suficientes conteos físicos para armar este panel.
          </p>
          <p className="text-sm text-gray-500">
            El panel compara el último conteo físico contra el anterior. Hacé un segundo
            conteo físico desde el módulo de Control de Fugas para poder verlo.
          </p>
        </div>
      </div>
    )
  }

  const { periodo, tendencia, perdida_total, top_productos_diferencia, ranking_usuarios, descuentos_agregados, compras_periodo } = data

  const esFaltante = (perdida_total?.valorizado_costo ?? 0) < 0

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6">
      <div className="mb-4">
        <Link href="/admin/reportes" className="text-sm text-gray-500 hover:underline">
          ← Volver a Reportes
        </Link>
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-6">
        <h1 className="text-2xl font-bold">Panel de Pérdidas</h1>
        {periodo && (
          <span className="text-sm text-gray-500">
            Período: {formatFecha(periodo.desde)} → {formatFecha(periodo.hasta)}
          </span>
        )}
      </div>

      {/* Pérdida total */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-lg border p-4">
          <div className="text-sm text-gray-500">Pérdida detectada (a costo)</div>
          <div className={`text-2xl font-bold ${esFaltante ? 'text-red-600' : 'text-green-600'}`}>
            {esFaltante ? '-' : '+'}
            {formatMoney(perdida_total?.valorizado_costo ?? 0)}
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-sm text-gray-500">Pérdida detectada (a precio de venta)</div>
          <div className={`text-2xl font-bold ${esFaltante ? 'text-red-600' : 'text-green-600'}`}>
            {esFaltante ? '-' : '+'}
            {formatMoney(perdida_total?.valorizado_venta ?? 0)}
          </div>
        </div>
      </div>

      {/* Tendencia */}
      {tendencia && (
        <div className="bg-white rounded-lg border p-4 mb-6 flex items-center gap-3">
          <span className="text-sm text-gray-500">Tendencia conteo a conteo:</span>
          <span
            className={`text-sm font-semibold ${
              tendencia.direccion === 'sube'
                ? 'text-red-600'
                : tendencia.direccion === 'baja'
                ? 'text-green-600'
                : 'text-gray-600'
            }`}
          >
            {tendencia.direccion === 'sube' && '↑ La pérdida aumentó'}
            {tendencia.direccion === 'baja' && '↓ La pérdida disminuyó'}
            {tendencia.direccion === 'igual' && '→ Sin cambios'}
          </span>
          <span className="text-xs text-gray-400">
            ({formatMoney(tendencia.valor_conteo_anterior)} → {formatMoney(tendencia.valor_conteo_actual)})
          </span>
        </div>
      )}

      {/* Top productos con diferencia */}
      <div className="bg-white rounded-lg border overflow-hidden mb-6">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Productos con mayor diferencia</h2>
        </div>
        {!top_productos_diferencia || top_productos_diferencia.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No hubo diferencias en el último conteo físico.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left p-3">Producto</th>
                  <th className="text-right p-3">Teórico</th>
                  <th className="text-right p-3">Contado</th>
                  <th className="text-right p-3">Diferencia</th>
                  <th className="text-right p-3">Valor (costo)</th>
                  <th className="text-right p-3">Valor (venta)</th>
                </tr>
              </thead>
              <tbody>
                {top_productos_diferencia.map((prod, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-3">{prod.nombre_producto}</td>
                    <td className="p-3 text-right text-gray-500">{prod.stock_teorico}</td>
                    <td className="p-3 text-right text-gray-500">{prod.stock_contado}</td>
                    <td
                      className={`p-3 text-right font-semibold ${
                        prod.diferencia < 0 ? 'text-red-600' : 'text-amber-600'
                      }`}
                    >
                      {prod.diferencia > 0 ? '+' : ''}
                      {prod.diferencia}
                    </td>
                    <td className="p-3 text-right">
                      {prod.valorizado_costo < 0 ? '-' : ''}
                      {formatMoney(prod.valorizado_costo)}
                    </td>
                    <td className="p-3 text-right">
                      {prod.valorizado_venta < 0 ? '-' : ''}
                      {formatMoney(prod.valorizado_venta)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ranking de usuarios */}
      <div className="bg-white rounded-lg border overflow-hidden mb-6">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Ranking por usuario</h2>
          <p className="text-xs text-gray-500 mt-1">
            El total valorizado suma diferencias de caja (faltantes), notas de crédito y
            anulaciones. Ajustes negativos se muestran aparte, en unidades, porque no
            tienen precio histórico guardado.
          </p>
        </div>
        {!ranking_usuarios || ranking_usuarios.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No hay movimientos de usuarios registrados en este período.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left p-3">Usuario</th>
                  <th className="text-right p-3">Total valorizado</th>
                  <th className="text-right p-3">Diferencia de caja</th>
                  <th className="text-right p-3">Notas de crédito</th>
                  <th className="text-right p-3">Anulaciones ($)</th>
                  <th className="text-right p-3">Anulaciones (cant.)</th>
                  <th className="text-right p-3">Ajustes negativos (unid.)</th>
                </tr>
              </thead>
              <tbody>
                {ranking_usuarios.map((u) => (
                  <tr key={u.usuario_id} className="border-t">
                    <td className="p-3">{u.usuario_nombre}</td>
                    <td className="p-3 text-right font-semibold text-red-600">
                      {formatMoney(u.perdida_valorizada)}
                    </td>
                    <td className="p-3 text-right text-gray-500">
                      {u.diferencia_caja_total < 0 ? '-' : ''}
                      {formatMoney(u.diferencia_caja_total)}
                    </td>
                    <td className="p-3 text-right text-gray-500">
                      {formatMoney(u.notas_credito_total)}
                    </td>
                    <td className="p-3 text-right text-gray-500">
                      {formatMoney(u.anulaciones_total)}
                    </td>
                    <td className="p-3 text-right text-gray-500">{u.cantidad_anulaciones}</td>
                    <td className="p-3 text-right text-gray-500">{u.unidades_ajustadas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Descuentos + compras (contexto) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <div className="text-sm text-gray-500">Descuentos aplicados en el período</div>
          <div className="text-xl font-bold">
            {formatMoney(descuentos_agregados?.total_descontado ?? 0)}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            en {descuentos_agregados?.cantidad_tickets ?? 0} ticket(s)
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-sm text-gray-500">Invertido en compras (contexto, no es pérdida)</div>
          <div className="text-xl font-bold">
            {formatMoney(compras_periodo?.total_invertido ?? 0)}
          </div>
        </div>
      </div>
    </div>
  )
}
