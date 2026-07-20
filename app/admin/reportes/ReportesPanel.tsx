'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase-browser'
import type { UsuarioActual } from '@/lib/get-usuario-actual'

type ProductoInfo = {
  id: string
  Nombre: string
  Stock: number
  Categoria: string | null
  Activo: boolean
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
}: {
  usuarioActual: UsuarioActual
  productosIniciales: ProductoInfo[]
}) {
  const supabase = createClient()

  const [desde, setDesde] = useState(haceDiasISO(30))
  const [hasta, setHasta] = useState(hoyISO())
  const [ventas, setVentas] = useState<VentaRaw[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [orden, setOrden] = useState<'unidades' | 'total'>('unidades')

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

  const ranking: FilaRanking[] = useMemo(() => {
    const agregados = new Map<string, { unidades: number; total: number; cantidadVentas: number }>()

    ventas.forEach((v) => {
      const actual = agregados.get(v.producto_id) || { unidades: 0, total: 0, cantidadVentas: 0 }
      actual.unidades += v.cantidad
      actual.total += v.total
      actual.cantidadVentas += 1
      agregados.set(v.producto_id, actual)
    })

    const filas: FilaRanking[] = []
    agregados.forEach((valores, productoId) => {
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
  }, [ventas, productosPorId, orden])

  const resumen = useMemo(() => {
    const totalFacturado = ventas.reduce((acc, v) => acc + v.total, 0)
    const unidadesVendidas = ventas.reduce((acc, v) => acc + v.cantidad, 0)
    return {
      totalFacturado,
      unidadesVendidas,
      cantidadVentas: ventas.length,
    }
  }, [ventas])

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6">
      <h1 className="text-2xl font-bold mb-4">Reportes de ventas</h1>

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

      {error && (
        <div className="mb-4 text-red-600 bg-red-50 border border-red-200 rounded p-3">
          {error}
        </div>
      )}

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
                      {fila.nombre}
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
    </div>
  )
}