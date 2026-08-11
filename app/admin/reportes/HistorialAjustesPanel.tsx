'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import type { UsuarioActual } from '@/lib/get-usuario-actual'

type ProductoInfo = {
  id: string
  Nombre: string
  Stock: number
  Categoria: string | null
  Activo: boolean
  Precio: number
}

type MovimientoRaw = {
  id: string
  producto_id: string | null
  cantidad: number
  usuario_id: string
  motivo: string | null
  fecha: string
}

function hoyISO() {
  return new Date().toISOString().slice(0, 10)
}
function haceDiasISO(dias: number) {
  const d = new Date()
  d.setDate(d.getDate() - dias)
  return d.toISOString().slice(0, 10)
}

export default function HistorialAjustesPanel({
  usuarioActual,
  productos,
  mapaUsuarios,
}: {
  usuarioActual: UsuarioActual
  productos: ProductoInfo[]
  mapaUsuarios: Record<string, string>
}) {
  const supabase = createClient()

  const [desde, setDesde] = useState(haceDiasISO(30))
  const [hasta, setHasta] = useState(hoyISO())
  const [movimientos, setMovimientos] = useState<MovimientoRaw[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [filtroProducto, setFiltroProducto] = useState('todos')
  const [filtroUsuario, setFiltroUsuario] = useState('todos')
  const [filtroMotivo, setFiltroMotivo] = useState('todos')

  useEffect(() => {
    buscarMovimientos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function buscarMovimientos() {
    setCargando(true)
    setError(null)

    const desdeISO = `${desde}T00:00:00`
    const hastaISO = `${hasta}T23:59:59`

    const { data, error } = await supabase
      .from('movimientos_stock')
      .select('id, producto_id, cantidad, usuario_id, motivo, fecha')
      .eq('comerciante_id', usuarioActual.comercianteId)
      .eq('tipo', 'ajuste_manual')
      .gte('fecha', desdeISO)
      .lte('fecha', hastaISO)
      .order('fecha', { ascending: false })

    if (error) {
      setError('No se pudieron cargar los ajustes. Probá de nuevo.')
      setCargando(false)
      return
    }

    setMovimientos(data || [])
    setCargando(false)
  }

  const productosPorId = useMemo(() => {
    const mapa = new Map<string, ProductoInfo>()
    productos.forEach(p => mapa.set(p.id, p))
    return mapa
  }, [productos])

  const motivosPresentes = useMemo(() => {
    const set = new Set<string>()
    movimientos.forEach(m => { if (m.motivo) set.add(m.motivo) })
    return Array.from(set).sort()
  }, [movimientos])

  const filtrados = useMemo(() => {
    return movimientos.filter(m => {
      if (filtroProducto !== 'todos' && m.producto_id !== filtroProducto) return false
      if (filtroUsuario !== 'todos' && m.usuario_id !== filtroUsuario) return false
      if (filtroMotivo !== 'todos' && (m.motivo ?? '') !== filtroMotivo) return false
      return true
    })
  }, [movimientos, filtroProducto, filtroUsuario, filtroMotivo])

  const totalizadorPorUsuario = useMemo(() => {
    const mapa = new Map<string, { cantidadNegativos: number; valorizacion: number }>()
    filtrados.forEach(m => {
      if (m.cantidad >= 0) return
      const producto = m.producto_id ? productosPorId.get(m.producto_id) : undefined
      const precio = producto?.Precio ?? 0
      const actual = mapa.get(m.usuario_id) ?? { cantidadNegativos: 0, valorizacion: 0 }
      actual.cantidadNegativos += 1
      actual.valorizacion += Math.abs(m.cantidad) * precio
      mapa.set(m.usuario_id, actual)
    })
    return Array.from(mapa.entries())
      .map(([usuarioId, valores]) => ({
        usuarioId,
        nombre: mapaUsuarios[usuarioId] ?? 'Usuario',
        ...valores,
      }))
      .sort((a, b) => b.valorizacion - a.valorizacion)
  }, [filtrados, productosPorId, mapaUsuarios])

  return (
    <div>
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
          onClick={buscarMovimientos}
          disabled={cargando}
          className="bg-black text-white rounded px-4 py-2 disabled:opacity-50"
        >
          {cargando ? 'Buscando...' : 'Buscar'}
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3 mb-6 bg-white rounded-lg border p-4">
        <div>
          <label className="block text-sm text-gray-600 mb-1">Producto</label>
          <select
            value={filtroProducto}
            onChange={(e) => setFiltroProducto(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          >
            <option value="todos">Todos</option>
            {productos.map(p => (
              <option key={p.id} value={p.id}>{p.Nombre}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Usuario</label>
          <select
            value={filtroUsuario}
            onChange={(e) => setFiltroUsuario(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          >
            <option value="todos">Todos</option>
            {Object.entries(mapaUsuarios).map(([id, nombre]) => (
              <option key={id} value={id}>{nombre}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Motivo</label>
          <select
            value={filtroMotivo}
            onChange={(e) => setFiltroMotivo(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          >
            <option value="todos">Todos</option>
            {motivosPresentes.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-4 text-red-600 bg-red-50 border border-red-200 rounded p-3">
          {error}
        </div>
      )}

      {totalizadorPorUsuario.length > 0 && (
        <div className="bg-white rounded-lg border overflow-hidden mb-6">
          <div className="p-4 border-b">
            <h2 className="font-semibold">Totalizador por usuario (solo ajustes negativos)</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left p-3">Usuario</th>
                <th className="text-right p-3">Cantidad de ajustes</th>
                <th className="text-right p-3">Valorización estimada</th>
              </tr>
            </thead>
            <tbody>
              {totalizadorPorUsuario.map(fila => (
                <tr key={fila.usuarioId} className="border-t">
                  <td className="p-3">{fila.nombre}</td>
                  <td className="p-3 text-right">{fila.cantidadNegativos}</td>
                  <td className="p-3 text-right text-red-600 font-semibold">
                    ${fila.valorizacion.toLocaleString('es-AR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Detalle de ajustes ({filtrados.length})</h2>
        </div>

        {cargando ? (
          <div className="p-6 text-center text-gray-500">Cargando...</div>
        ) : filtrados.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No hay ajustes registrados con estos filtros.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left p-3">Fecha</th>
                  <th className="text-left p-3">Producto</th>
                  <th className="text-right p-3">Cantidad</th>
                  <th className="text-left p-3">Usuario</th>
                  <th className="text-left p-3">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(m => {
                  const producto = m.producto_id ? productosPorId.get(m.producto_id) : undefined
                  return (
                    <tr key={m.id} className="border-t">
                      <td className="p-3">
                        {new Date(m.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </td>
                      <td className="p-3">
                        {producto ? (
                          <Link href={`/admin/productos/${producto.id}/historial`} className="hover:underline">
                            {producto.Nombre}
                          </Link>
                        ) : (
                          '(producto eliminado)'
                        )}
                      </td>
                      <td className={`p-3 text-right font-medium ${m.cantidad < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {m.cantidad > 0 ? `+${m.cantidad}` : m.cantidad}
                      </td>
                      <td className="p-3">{mapaUsuarios[m.usuario_id] ?? 'Usuario'}</td>
                      <td className="p-3 text-gray-600">{m.motivo ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}