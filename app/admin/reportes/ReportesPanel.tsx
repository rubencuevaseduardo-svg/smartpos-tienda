'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import type { UsuarioActual } from '@/lib/get-usuario-actual'
import HistorialAjustesPanel from './HistorialAjustesPanel'
import HistorialTurnosPanel from './HistorialTurnosPanel'

type ProductoInfo = {
  id: string
  Nombre: string
  Stock: number
  Categoria: string | null
  Activo: boolean
  Precio: number
  costo_actual: number | null
}

type VentaRaw = {
  id: string
  producto_id: string
  cantidad: number
  total: number
  canal: string
  fecha: string
}

type FilaRanking = {
  productoId: string
  nombre: string
  categoria: string | null
  stockActual: number
  activo: boolean
  unidadesVendidas: number
  totalFacturado: number
  cantidadVentas: number
}

type FilaMargen = {
  productoId: string
  nombre: string
  categoria: string | null
  unidadesVendidas: number
  totalFacturado: number
  tieneCosto: boolean
  costoActual: number | null
  margenTotal: number | null
  margenUnitarioPromedio: number | null
  margenPorcentaje: number | null
}

function hoyISO() {
  return new Date().toISOString().slice(0, 10)
}

function haceDiasISO(dias: number) {
  const d = new Date()
  d.setDate(d.getDate() - dias)
  return d.toISOString().slice(0, 10)
}

export default function ReportesPanel({
  usuarioActual,
  productosIniciales,
  mapaUsuarios,
}: {
  usuarioActual: UsuarioActual
  productosIniciales: ProductoInfo[]
  mapaUsuarios: Record<string, string>
}) {
  const supabase = createClient()

  const [tab, setTab] = useState<'ventas' | 'margen' | 'ajustes' | 'turnos'>('ventas')

  const [desde, setDesde] = useState(haceDiasISO(30))
  const [hasta, setHasta] = useState(hoyISO())
  const [ventas, setVentas] = useState<VentaRaw[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [orden, setOrden] = useState<'unidades' | 'total'>('unidades')
  const [ordenMargen, setOrdenMargen] = useState<'margenTotal' | 'margenPorcentaje'>('margenTotal')

  useEffect(() => {
    buscarVentas()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function buscarVentas() {
    setCargando(true)
    setError(null)

    const desdeISO = `${desde}T00:00:00`
    const hastaISO = `${hasta}T23:59:59`

    const { data, error } = await supabase
      .from('ventas')
      .select('id, producto_id, cantidad, total, canal, fecha')
      .eq('comerciante_id', usuarioActual.comercianteId)
      .gte('fecha', desdeISO)
      .lte('fecha', hastaISO)

    if (error) {
      setError('No se pudieron cargar las ventas. Probá de nuevo.')
      setCargando(false)
      return
    }

    setVentas(data || [])
    setCargando(false)
  }

  const productosPorId = useMemo(() => {
    const mapa = new Map<string, ProductoInfo>()
    productosIniciales.forEach((p) => mapa.set(p.id, p))
    return mapa
  }, [productosIniciales])

  // Agregados base por producto (unidades, total facturado, cantidad de ventas) —
  // se reutiliza tanto para "Ranking de ventas" como para "Margen real"
  const agregadosPorProducto = useMemo(() => {
    const agregados = new Map<string, { unidades: number; total: number; cantidadVentas: number }>()
    ventas.forEach((v) => {
      const actual = agregados.get(v.producto_id) || { unidades: 0, total: 0, cantidadVentas: 0 }
      actual.unidades += v.cantidad
      actual.total += v.total
      actual.cantidadVentas += 1
      agregados.set(v.producto_id, actual)
    })
    return agregados
  }, [ventas])

  const ranking: FilaRanking[] = useMemo(() => {
    const filas: FilaRanking[] = []
    agregadosPorProducto.forEach((valores, productoId) => {
      const producto = productosPorId.get(productoId)
      filas.push({
        productoId,
        nombre: producto?.Nombre ?? '(producto eliminado)',
        categoria: producto?.Categoria ?? null,
        stockActual: producto?.Stock ?? 0,
        activo: producto?.Activo ?? false,
        unidadesVendidas: valores.unidades,
        totalFacturado: valores.total,
        cantidadVentas: valores.cantidadVentas,
      })
    })

    filas.sort((a, b) =>
      orden === 'unidades'
        ? b.unidadesVendidas - a.unidadesVendidas
        : b.totalFacturado - a.totalFacturado
    )

    return filas
  }, [agregadosPorProducto, productosPorId, orden])

  // Margen real: precio realmente cobrado (totalFacturado / unidadesVendidas) menos costo_actual.
  // Productos sin costo_actual cargado (null o 0) se muestran pero quedan afuera del total agregado.
  const margenPorProducto: FilaMargen[] = useMemo(() => {
    const filas: FilaMargen[] = []
    agregadosPorProducto.forEach((valores, productoId) => {
      const producto = productosPorId.get(productoId)
      const costoActual = producto?.costo_actual ?? null
      const tieneCosto = costoActual !== null && costoActual > 0

      let margenTotal: number | null = null
      let margenUnitarioPromedio: number | null = null
      let margenPorcentaje: number | null = null

      if (tieneCosto) {
        margenTotal = valores.total - valores.unidades * (costoActual as number)
        margenUnitarioPromedio = margenTotal / valores.unidades
        margenPorcentaje = valores.total > 0 ? (margenTotal / valores.total) * 100 : null
      }

      filas.push({
        productoId,
        nombre: producto?.Nombre ?? '(producto eliminado)',
        categoria: producto?.Categoria ?? null,
        unidadesVendidas: valores.unidades,
        totalFacturado: valores.total,
        tieneCosto,
        costoActual,
        margenTotal,
        margenUnitarioPromedio,
        margenPorcentaje,
      })
    })

    filas.sort((a, b) => {
      // Productos sin costo cargado siempre van al final, sin importar el orden elegido
      if (a.tieneCosto && !b.tieneCosto) return -1
      if (!a.tieneCosto && b.tieneCosto) return 1
      if (!a.tieneCosto && !b.tieneCosto) return 0

      return ordenMargen === 'margenTotal'
        ? (b.margenTotal ?? 0) - (a.margenTotal ?? 0)
        : (b.margenPorcentaje ?? 0) - (a.margenPorcentaje ?? 0)
    })

    return filas
  }, [agregadosPorProducto, productosPorId, ordenMargen])

  const resumenMargen = useMemo(() => {
    const conCosto = margenPorProducto.filter((f) => f.tieneCosto)
    const sinCosto = margenPorProducto.filter((f) => !f.tieneCosto)
    const margenTotalPeriodo = conCosto.reduce((acc, f) => acc + (f.margenTotal ?? 0), 0)
    const facturadoConCosto = conCosto.reduce((acc, f) => acc + f.totalFacturado, 0)
    const margenPromedioPeriodo = facturadoConCosto > 0 ? (margenTotalPeriodo / facturadoConCosto) * 100 : null

    return {
      margenTotalPeriodo,
      margenPromedioPeriodo,
      cantidadSinCosto: sinCosto.length,
    }
  }, [margenPorProducto])

  const resumen = useMemo(() => {
    const totalFacturado = ventas.reduce((acc, v) => acc + v.total, 0)
    const unidadesVendidas = ventas.reduce((acc, v) => acc + v.cantidad, 0)
    return {
      totalFacturado,
      unidadesVendidas,
      cantidadVentas: ventas.length,
    }
  }, [ventas])

  function formatMoney(valor: number) {
    return `$${Math.round(valor).toLocaleString('es-AR')}`
  }

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6">
      <h1 className="text-2xl font-bold mb-4">Reportes</h1>

      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setTab('ventas')}
          className={`px-4 py-2 rounded text-sm font-medium ${tab === 'ventas' ? 'bg-black text-white' : 'bg-gray-100 text-gray-600'}`}
        >
          Ranking de ventas
        </button>
        <button
          onClick={() => setTab('margen')}
          className={`px-4 py-2 rounded text-sm font-medium ${tab === 'margen' ? 'bg-black text-white' : 'bg-gray-100 text-gray-600'}`}
        >
          Margen real
        </button>
        <button
          onClick={() => setTab('ajustes')}
          className={`px-4 py-2 rounded text-sm font-medium ${tab === 'ajustes' ? 'bg-black text-white' : 'bg-gray-100 text-gray-600'}`}
        >
          Historial de ajustes
        </button>
        <button
          onClick={() => setTab('turnos')}
          className={`px-4 py-2 rounded text-sm font-medium ${tab === 'turnos' ? 'bg-black text-white' : 'bg-gray-100 text-gray-600'}`}
        >
          Turnos
        </button>
        <Link
          href="/admin/reportes/perdidas"
          className="px-4 py-2 rounded text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200"
        >
          Panel de Pérdidas
        </Link>
      </div>

      {/* Selector de fechas compartido por Ranking de ventas y Margen real */}
      {(tab === 'ventas' || tab === 'margen') && (
        <div className="flex flex-wrap items-end gap-3 mb-6 bg-white rounded-lg border p-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Desde</label>
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="border rounded px-2 py-1"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Hasta</label>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="border rounded px-2 py-1"
            />
          </div>
          <button
            onClick={buscarVentas}
            disabled={cargando}
            className="bg-black text-white rounded px-4 py-2 disabled:opacity-50"
          >
            {cargando ? 'Buscando...' : 'Buscar'}
          </button>
        </div>
      )}

      {error && (tab === 'ventas' || tab === 'margen') && (
        <div className="mb-4 text-red-600 bg-red-50 border border-red-200 rounded p-3">
          {error}
        </div>
      )}

      {tab === 'ventas' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg border p-4">
              <div className="text-sm text-gray-500">Facturado en el período</div>
              <div className="text-2xl font-bold">
                ${resumen.totalFacturado.toLocaleString('es-AR')}
              </div>
            </div>
            <div className="bg-white rounded-lg border p-4">
              <div className="text-sm text-gray-500">Unidades vendidas</div>
              <div className="text-2xl font-bold">{resumen.unidadesVendidas}</div>
            </div>
            <div className="bg-white rounded-lg border p-4">
              <div className="text-sm text-gray-500">Ventas registradas</div>
              <div className="text-2xl font-bold">{resumen.cantidadVentas}</div>
            </div>
          </div>

          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-semibold">Ranking de productos</h2>
              <div className="flex gap-2 text-sm">
                <button
                  onClick={() => setOrden('unidades')}
                  className={`px-3 py-1 rounded ${orden === 'unidades' ? 'bg-black text-white' : 'bg-gray-100'}`}
                >
                  Por unidades
                </button>
                <button
                  onClick={() => setOrden('total')}
                  className={`px-3 py-1 rounded ${orden === 'total' ? 'bg-black text-white' : 'bg-gray-100'}`}
                >
                  Por facturación
                </button>
              </div>
            </div>

            {cargando ? (
              <div className="p-6 text-center text-gray-500">Cargando...</div>
            ) : ranking.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                No hay ventas registradas en este período.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="text-left p-3">Producto</th>
                      <th className="text-left p-3">Categoría</th>
                      <th className="text-right p-3">Unidades vendidas</th>
                      <th className="text-right p-3">Facturado</th>
                      <th className="text-right p-3">Stock actual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranking.map((fila) => (
                      <tr key={fila.productoId} className="border-t">
                        <td className="p-3">
                          {fila.nombre !== '(producto eliminado)' ? (
                            <Link href={`/admin/productos/${fila.productoId}/historial`} className="hover:underline">
                              {fila.nombre}
                            </Link>
                          ) : (
                            fila.nombre
                          )}
                          {!fila.activo && (
                            <span className="ml-2 text-xs text-red-600">(inactivo)</span>
                          )}
                        </td>
                        <td className="p-3 text-gray-500">{fila.categoria ?? '—'}</td>
                        <td className="p-3 text-right">{fila.unidadesVendidas}</td>
                        <td className="p-3 text-right">
                          ${fila.totalFacturado.toLocaleString('es-AR')}
                        </td>
                        <td className="p-3 text-right">
                          <span
                            className={
                              fila.stockActual === 0
                                ? 'text-red-600 font-semibold'
                                : fila.stockActual <= 3
                                ? 'text-amber-600 font-semibold'
                                : ''
                            }
                          >
                            {fila.stockActual}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'margen' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg border p-4">
              <div className="text-sm text-gray-500">Margen total del período</div>
              <div className="text-2xl font-bold text-green-700">
                {formatMoney(resumenMargen.margenTotalPeriodo)}
              </div>
            </div>
            <div className="bg-white rounded-lg border p-4">
              <div className="text-sm text-gray-500">Margen promedio</div>
              <div className="text-2xl font-bold">
                {resumenMargen.margenPromedioPeriodo !== null
                  ? `${resumenMargen.margenPromedioPeriodo.toFixed(1)}%`
                  : '—'}
              </div>
            </div>
            <div className="bg-white rounded-lg border p-4">
              <div className="text-sm text-gray-500">Productos sin costo cargado</div>
              <div className="text-2xl font-bold text-amber-600">
                {resumenMargen.cantidadSinCosto}
              </div>
            </div>
          </div>

          <div className="mb-4 text-xs text-gray-500">
            El margen se calcula sobre el precio realmente cobrado en cada venta (no el precio de
            catálogo actual), menos el costo actual del producto. Los productos sin costo cargado
            no entran en los totales de arriba.
          </div>

          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-semibold">Margen por producto</h2>
              <div className="flex gap-2 text-sm">
                <button
                  onClick={() => setOrdenMargen('margenTotal')}
                  className={`px-3 py-1 rounded ${ordenMargen === 'margenTotal' ? 'bg-black text-white' : 'bg-gray-100'}`}
                >
                  Por margen $
                </button>
                <button
                  onClick={() => setOrdenMargen('margenPorcentaje')}
                  className={`px-3 py-1 rounded ${ordenMargen === 'margenPorcentaje' ? 'bg-black text-white' : 'bg-gray-100'}`}
                >
                  Por margen %
                </button>
              </div>
            </div>

            {cargando ? (
              <div className="p-6 text-center text-gray-500">Cargando...</div>
            ) : margenPorProducto.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                No hay ventas registradas en este período.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="text-left p-3">Producto</th>
                      <th className="text-left p-3">Categoría</th>
                      <th className="text-right p-3">Unidades</th>
                      <th className="text-right p-3">Facturado</th>
                      <th className="text-right p-3">Costo actual</th>
                      <th className="text-right p-3">Margen unitario prom.</th>
                      <th className="text-right p-3">Margen total</th>
                      <th className="text-right p-3">Margen %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {margenPorProducto.map((fila) => (
                      <tr key={fila.productoId} className="border-t">
                        <td className="p-3">{fila.nombre}</td>
                        <td className="p-3 text-gray-500">{fila.categoria ?? '—'}</td>
                        <td className="p-3 text-right">{fila.unidadesVendidas}</td>
                        <td className="p-3 text-right">{formatMoney(fila.totalFacturado)}</td>
                        {fila.tieneCosto ? (
                          <>
                            <td className="p-3 text-right text-gray-500">
                              {formatMoney(fila.costoActual as number)}
                            </td>
                            <td className="p-3 text-right">
                              {formatMoney(fila.margenUnitarioPromedio as number)}
                            </td>
                            <td
                              className={`p-3 text-right font-semibold ${
                                (fila.margenTotal ?? 0) >= 0 ? 'text-green-700' : 'text-red-600'
                              }`}
                            >
                              {formatMoney(fila.margenTotal as number)}
                            </td>
                            <td
                              className={`p-3 text-right font-semibold ${
                                (fila.margenPorcentaje ?? 0) >= 0 ? 'text-green-700' : 'text-red-600'
                              }`}
                            >
                              {(fila.margenPorcentaje as number).toFixed(1)}%
                            </td>
                          </>
                        ) : (
                          <td className="p-3 text-right text-amber-600 text-xs" colSpan={4}>
                            Sin costo cargado
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'ajustes' && (
        <HistorialAjustesPanel
          usuarioActual={usuarioActual}
          productos={productosIniciales}
          mapaUsuarios={mapaUsuarios}
        />
      )}

      {tab === 'turnos' && (
        <HistorialTurnosPanel
          usuarioActual={usuarioActual}
          mapaUsuarios={mapaUsuarios}
        />
      )}
    </div>
  )
}
