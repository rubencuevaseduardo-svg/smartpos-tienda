'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import { Producto } from '@/lib/supabase'
import { UsuarioActual } from '@/lib/get-usuario-actual'

type LineaSeleccion = {
  incluir: boolean
  cantidad: string
}

export default function ConteoPanel({
  usuarioActual,
  productos,
}: {
  usuarioActual: UsuarioActual
  productos: Producto[]
}) {
  const [seleccion, setSeleccion] = useState<Record<string, LineaSeleccion>>({})
  const [busqueda, setBusqueda] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const productosFiltrados = useMemo(() => {
    if (busqueda.trim() === '') return productos
    return productos.filter(p =>
      (p.Nombre ?? '').toLowerCase().includes(busqueda.toLowerCase())
    )
  }, [productos, busqueda])

  function toggleIncluir(id: string) {
    setSeleccion(prev => ({
      ...prev,
      [id]: {
        incluir: !prev[id]?.incluir,
        cantidad: prev[id]?.cantidad ?? '',
      },
    }))
  }

  function setCantidad(id: string, cantidad: string) {
    setSeleccion(prev => ({
      ...prev,
      [id]: {
        incluir: prev[id]?.incluir ?? true,
        cantidad,
      },
    }))
  }

  // Líneas válidas: incluidas Y con cantidad cargada (no vacía) — se calcula sobre TODOS los productos, no solo los filtrados por búsqueda
  const lineasValidas = useMemo(() => {
    return productos
      .map(p => {
        const sel = seleccion[p.id]
        if (!sel?.incluir || sel.cantidad.trim() === '') return null
        const stockContado = parseInt(sel.cantidad)
        if (isNaN(stockContado) || stockContado < 0) return null
        const stockTeorico = p.Stock ?? 0
        const diferencia = stockContado - stockTeorico
        const valorDiferencia = diferencia * (p.Precio ?? 0)
        return { producto: p, stockTeorico, stockContado, diferencia, valorDiferencia }
      })
      .filter((l): l is NonNullable<typeof l> => l !== null)
  }, [productos, seleccion])

  const totalDiferenciaValor = lineasValidas.reduce((acc, l) => acc + l.valorDiferencia, 0)

  async function handleGuardarConteo() {
    setError(null)
    setExito(null)

    if (lineasValidas.length === 0) {
      setError('Tildá al menos un producto y cargale la cantidad contada.')
      return
    }

    setGuardando(true)

    try {
      const { data: userData } = await supabase.auth.getUser()
      const usuarioId = userData?.user?.id
      if (!usuarioId) throw new Error('No se pudo confirmar el usuario logueado.')

      const { data: conteoData, error: errorConteo } = await supabase
        .from('conteos_fisicos')
        .insert({
          comerciante_id: usuarioActual.comercianteId,
          usuario_id: usuarioId,
          cantidad_productos_contados: lineasValidas.length,
          total_diferencia_valor: totalDiferenciaValor,
        })
        .select()
        .single()

      if (errorConteo || !conteoData) throw errorConteo ?? new Error('No se pudo crear el conteo.')

      for (const linea of lineasValidas) {
        const { error: errorDetalle } = await supabase.from('conteo_detalle').insert({
          conteo_id: conteoData.id,
          producto_id: linea.producto.id,
          stock_teorico: linea.stockTeorico,
          stock_contado: linea.stockContado,
          diferencia: linea.diferencia,
          precio_unitario: linea.producto.Precio ?? 0,
          valor_diferencia: linea.valorDiferencia,
        })
        if (errorDetalle) throw errorDetalle

        const nuevoActivo = linea.stockContado === 0 ? false : true

        const { error: errorUpdate } = await supabase
          .from('productos')
          .update({ Stock: linea.stockContado, Activo: nuevoActivo })
          .eq('id', linea.producto.id)
        if (errorUpdate) throw errorUpdate

        if (linea.diferencia !== 0) {
          const { error: errorMovimiento } = await supabase.from('movimientos_stock').insert({
            comerciante_id: usuarioActual.comercianteId,
            producto_id: linea.producto.id,
            tipo: 'conteo_fisico',
            cantidad: linea.diferencia,
            stock_antes: linea.stockTeorico,
            stock_despues: linea.stockContado,
            usuario_id: usuarioId,
            motivo: null,
          })
          if (errorMovimiento) throw errorMovimiento
        }
      }

      setExito(`Conteo guardado — ${lineasValidas.length} productos contados.`)
      setSeleccion({})
      router.refresh()
    } catch (err: any) {
      setError(err.message ?? 'Ocurrió un error al guardar el conteo.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-gray-900">Conteo físico</h1>
            <p className="text-xs text-gray-500">{usuarioActual.comercianteNombre}</p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/admin/conteo/historial"
              className="text-xs text-gray-500 border border-gray-200 rounded-xl px-3 py-1.5"
            >
              Historial
            </Link>
            <Link
              href="/admin"
              className="text-xs text-gray-500 border border-gray-200 rounded-xl px-3 py-1.5"
            >
              Volver
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <p className="text-xs text-gray-500 mb-3">
          Tildá los productos que vas a contar y cargá la cantidad real encontrada en el local. Los que no tildes, o que dejes sin cantidad, no se tocan.
        </p>

        <input
          type="text"
          placeholder="Buscar producto..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-500 bg-white mb-3"
        />

        <div className="flex flex-col gap-2">
          {productosFiltrados.map(p => {
            const sel = seleccion[p.id]
            const incluido = sel?.incluir ?? false
            return (
              <div
                key={p.id}
                className={`bg-white rounded-2xl border shadow-sm p-3 flex items-center gap-3 ${
                  incluido ? 'border-emerald-300' : 'border-gray-100'
                }`}
              >
                <input
                  type="checkbox"
                  checked={incluido}
                  onChange={() => toggleIncluir(p.id)}
                  className="w-4 h-4"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{p.Nombre}</p>
                  <p className="text-[11px] text-gray-500">Stock teórico: {p.Stock ?? 0}</p>
                </div>
                <input
                  type="number"
                  min={0}
                  disabled={!incluido}
                  value={sel?.cantidad ?? ''}
                  onChange={e => setCantidad(p.id, e.target.value)}
                  placeholder="Contado"
                  className="w-20 border border-gray-200 rounded-xl px-2 py-1.5 text-sm outline-none focus:border-emerald-500 disabled:bg-gray-50 disabled:text-gray-300"
                />
              </div>
            )
          })}

          {productosFiltrados.length === 0 && productos.length > 0 && (
            <p className="text-sm text-gray-400 text-center py-8">Ningún producto coincide con "{busqueda}".</p>
          )}

          {productos.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">No hay productos activos para contar.</p>
          )}
        </div>

        {lineasValidas.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mt-4">
            <p className="text-xs font-medium text-gray-600 mb-2">
              {lineasValidas.length} producto{lineasValidas.length !== 1 ? 's' : ''} listo{lineasValidas.length !== 1 ? 's' : ''} para guardar
              {busqueda.trim() !== '' && ' (de toda la lista, no solo lo filtrado)'}
            </p>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">Diferencia neta detectada</span>
              <span className={`text-lg font-bold ${totalDiferenciaValor < 0 ? 'text-red-500' : 'text-gray-900'}`}>
                ${totalDiferenciaValor.toLocaleString('es-AR')}
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-3 text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</div>
        )}
        {exito && (
          <div className="mt-3 text-xs text-emerald-600 bg-emerald-50 rounded-xl px-3 py-2">{exito}</div>
        )}

        <button
          onClick={handleGuardarConteo}
          disabled={guardando || lineasValidas.length === 0}
          className="w-full mt-4 bg-emerald-500 text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-50"
        >
          {guardando ? 'Guardando...' : 'Guardar conteo'}
        </button>
      </main>
    </div>
  )
}