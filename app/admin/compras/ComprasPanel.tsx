'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import { Producto } from '@/lib/supabase'
import { UsuarioActual } from '@/lib/get-usuario-actual'

type Linea = {
  key: string
  modo: 'existente' | 'nuevo'
  productoId: string
  nombreNuevo: string
  cantidad: number
  costoUnitario: number
}

function lineaVacia(): Linea {
  return {
    key: crypto.randomUUID(),
    modo: 'existente',
    productoId: '',
    nombreNuevo: '',
    cantidad: 1,
    costoUnitario: 0,
  }
}

export default function ComprasPanel({
  usuarioActual,
  productosIniciales,
}: {
  usuarioActual: UsuarioActual
  productosIniciales: Producto[]
}) {
  const [productos, setProductos] = useState<Producto[]>(productosIniciales)
  const [proveedor, setProveedor] = useState('')
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10))
  const [lineas, setLineas] = useState<Linea[]>([lineaVacia()])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const total = lineas.reduce((acc, l) => acc + l.cantidad * l.costoUnitario, 0)

  function actualizarLinea(key: string, cambios: Partial<Linea>) {
    setLineas(prev => prev.map(l => (l.key === key ? { ...l, ...cambios } : l)))
  }

  function agregarLinea() {
    setLineas(prev => [...prev, lineaVacia()])
  }

  function quitarLinea(key: string) {
    setLineas(prev => (prev.length > 1 ? prev.filter(l => l.key !== key) : prev))
  }

  function lineasValidas() {
    return lineas.every(l => {
      const tieneProducto = l.modo === 'existente' ? !!l.productoId : l.nombreNuevo.trim().length > 0
      return tieneProducto && l.cantidad > 0 && l.costoUnitario >= 0
    })
  }

  async function handleGuardarCompra() {
    setError(null)
    setExito(null)

    if (!lineasValidas()) {
      setError('Revisá las líneas: cada una necesita producto, cantidad mayor a 0 y costo unitario.')
      return
    }

    setGuardando(true)

    try {
      const { data: userData } = await supabase.auth.getUser()
      const usuarioId = userData?.user?.id
      if (!usuarioId) throw new Error('No se pudo confirmar el usuario logueado.')

      // 1. Insertar cabecera de compra
      const { data: compraData, error: errorCompra } = await supabase
        .from('compras')
        .insert({
          comerciante_id: usuarioActual.comercianteId,
          proveedor: proveedor.trim() || null,
          fecha: new Date(fecha).toISOString(),
          total,
          usuario_id: usuarioId,
        })
        .select()
        .single()

      if (errorCompra || !compraData) throw errorCompra ?? new Error('No se pudo crear la compra.')

      const productosActualizados = [...productos]

      // 2. Procesar cada línea
      for (const linea of lineas) {
        let productoId = linea.productoId
        let stockActual = 0

        if (linea.modo === 'nuevo') {
          const { data: nuevoProducto, error: errorNuevo } = await supabase
            .from('productos')
            .insert({
              Comerciante_id: usuarioActual.comercianteId,
              Nombre: linea.nombreNuevo.trim(),
              Precio: linea.costoUnitario,
              Stock: 0,
              Foto_url: '',
              'Descripción_ia': '',
              Activo: true,
              Categoria: null,
            })
            .select()
            .single()

          if (errorNuevo || !nuevoProducto) throw errorNuevo ?? new Error('No se pudo crear el producto nuevo.')

          productoId = nuevoProducto.id
          stockActual = 0
          productosActualizados.push(nuevoProducto as Producto)
        } else {
          const productoExistente = productosActualizados.find(p => p.id === productoId)
          stockActual = productoExistente?.Stock ?? 0
        }

        const stockNuevo = stockActual + linea.cantidad
        const subtotal = linea.cantidad * linea.costoUnitario

        // 3. Insertar línea de compra_detalle
        const { error: errorDetalle } = await supabase.from('compra_detalle').insert({
          compra_id: compraData.id,
          producto_id: productoId,
          cantidad: linea.cantidad,
          costo_unitario: linea.costoUnitario,
          subtotal,
        })
        if (errorDetalle) throw errorDetalle

        // 4. Actualizar Stock + costo_actual del producto
        const { error: errorUpdate } = await supabase
          .from('productos')
          .update({ Stock: stockNuevo, costo_actual: linea.costoUnitario, Activo: true })
          .eq('id', productoId)
        if (errorUpdate) throw errorUpdate

        // 5. Registrar movimiento en el kardex
        const { error: errorMovimiento } = await supabase.from('movimientos_stock').insert({
          comerciante_id: usuarioActual.comercianteId,
          producto_id: productoId,
          tipo: 'compra',
          cantidad: linea.cantidad,
          stock_antes: stockActual,
          stock_despues: stockNuevo,
          usuario_id: usuarioId,
          motivo: null,
        })
        if (errorMovimiento) throw errorMovimiento

        const idx = productosActualizados.findIndex(p => p.id === productoId)
        if (idx >= 0) {
          productosActualizados[idx] = {
            ...productosActualizados[idx],
            Stock: stockNuevo,
            costo_actual: linea.costoUnitario,
          }
        }
      }

      setProductos(productosActualizados)
      setExito(`Compra guardada — total $${total.toLocaleString('es-AR')}`)
      setProveedor('')
      setLineas([lineaVacia()])
      router.refresh()
    } catch (err: any) {
      setError(err.message ?? 'Ocurrió un error al guardar la compra.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-gray-900">Compras</h1>
            <p className="text-xs text-gray-500">{usuarioActual.comercianteNombre}</p>
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
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
          <label className="text-xs font-medium text-gray-600">Proveedor</label>
          <input
            value={proveedor}
            onChange={e => setProveedor(e.target.value)}
            placeholder="Ej: Distribuidora San Martín"
            className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-500"
          />

          <label className="text-xs font-medium text-gray-600 mt-3 block">Fecha</label>
          <input
            type="date"
            value={fecha}
            onChange={e => setFecha(e.target.value)}
            className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex flex-col gap-3">
          {lineas.map((linea, i) => (
            <div key={linea.key} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-500">Línea {i + 1}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => actualizarLinea(linea.key, { modo: 'existente', nombreNuevo: '' })}
                    className={`text-[11px] rounded-lg px-2 py-1 font-medium ${
                      linea.modo === 'existente' ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    Producto existente
                  </button>
                  <button
                    onClick={() => actualizarLinea(linea.key, { modo: 'nuevo', productoId: '' })}
                    className={`text-[11px] rounded-lg px-2 py-1 font-medium ${
                      linea.modo === 'nuevo' ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    + Crear nuevo
                  </button>
                </div>
              </div>

              {linea.modo === 'existente' ? (
                <select
                  value={linea.productoId}
                  onChange={e => actualizarLinea(linea.key, { productoId: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-500"
                >
                  <option value="">Seleccioná un producto...</option>
                  {productos.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.Nombre} (stock actual: {p.Stock})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={linea.nombreNuevo}
                  onChange={e => actualizarLinea(linea.key, { nombreNuevo: e.target.value })}
                  placeholder="Nombre del producto nuevo"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-500"
                />
              )}

              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Cantidad</label>
                  <input
                    type="number"
                    min={1}
                    value={linea.cantidad}
                    onChange={e => actualizarLinea(linea.key, { cantidad: parseInt(e.target.value) || 0 })}
                    className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Costo unitario</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={linea.costoUnitario}
                    onChange={e => actualizarLinea(linea.key, { costoUnitario: parseFloat(e.target.value) || 0 })}
                    className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-gray-500">
                  Subtotal: ${(linea.cantidad * linea.costoUnitario).toLocaleString('es-AR')}
                </span>
                {lineas.length > 1 && (
                  <button
                    onClick={() => quitarLinea(linea.key)}
                    className="text-xs text-red-500 font-medium"
                  >
                    Quitar línea
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={agregarLinea}
          className="w-full mt-3 text-xs bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 font-medium text-gray-600"
        >
          + Agregar línea
        </button>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mt-4 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-600">Total de la compra</span>
          <span className="text-lg font-bold text-gray-900">${total.toLocaleString('es-AR')}</span>
        </div>

        {error && (
          <div className="mt-3 text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</div>
        )}
        {exito && (
          <div className="mt-3 text-xs text-emerald-600 bg-emerald-50 rounded-xl px-3 py-2">{exito}</div>
        )}

        <button
          onClick={handleGuardarCompra}
          disabled={guardando}
          className="w-full mt-4 bg-emerald-500 text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-50"
        >
          {guardando ? 'Guardando...' : 'Guardar compra'}
        </button>
      </main>
    </div>
  )
}