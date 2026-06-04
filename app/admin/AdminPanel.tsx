'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Comerciante, Producto } from '@/lib/supabase'

export default function AdminPanel({
  comerciante,
  productos,
}: {
  comerciante: Comerciante
  productos: Producto[]
}) {
  const [lista, setLista] = useState<Producto[]>(productos)
  const [editando, setEditando] = useState<Producto | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  async function handleGuardar() {
    if (!editando) return
    setLoading(true)
    const { error } = await supabase
      .from('productos')
      .update({
        Nombre: editando.Nombre,
        Precio: editando.Precio,
        Stock: editando.Stock,
        'Descripción_ia': editando['Descripción_ia'],
        Activo: editando.Activo,
      })
      .eq('id', editando.id)

    if (!error) {
      setLista(lista.map(p => p.id === editando.id ? editando : p))
      setEditando(null)
    }
    setLoading(false)
  }

  async function handleEliminar(id: string) {
    if (!confirm('¿Eliminár este producto?')) return
    await supabase.from('productos').delete().eq('id', id)
    setLista(lista.filter(p => p.id !== id))
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-gray-900">Panel Admin</h1>
            <p className="text-xs text-gray-500">{comerciante.nombre}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-xs text-gray-500 border border-gray-200 rounded-xl px-3 py-1.5"
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <p className="text-sm text-gray-500 mb-4">
          {lista.length} {lista.length === 1 ? 'producto' : 'productos'}
        </p>

        <div className="flex flex-col gap-3">
          {lista.map((producto) => (
            <div key={producto.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex gap-3">
              <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                {producto.Foto_url ? (
                  <Image src={producto.Foto_url} alt={producto.Nombre} fill className="object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300 text-2xl">📷</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-gray-900 text-sm truncate">{producto.Nombre}</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  ${producto.Precio?.toLocaleString('es-AR')} · Stock: {producto.Stock ?? 'N/A'}
                </p>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => setEditando(producto)}
                    className="text-xs bg-emerald-50 text-emerald-600 rounded-lg px-3 py-1 font-medium"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleEliminar(producto.id)}
                    className="text-xs bg-red-50 text-red-500 rounded-lg px-3 py-1 font-medium"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Modal edición */}
      {editando && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 px-4 pb-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 flex flex-col gap-4">
            <h2 className="font-bold text-gray-900">Editar producto</h2>

            <div>
              <label className="text-xs font-medium text-gray-600">Nombre</label>
              <input
                value={editando.Nombre}
                onChange={e => setEditando({ ...editando, Nombre: e.target.value })}
                className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600">Precio</label>
              <input
                type="number"
                value={editando.Precio}
                onChange={e => setEditando({ ...editando, Precio: parseFloat(e.target.value) })}
                className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600">Stock</label>
              <input
                type="number"
                value={editando.Stock ?? ''}
                onChange={e => setEditando({ ...editando, Stock: parseInt(e.target.value) })}
                className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600">Descripción</label>
              <textarea
                value={editando['Descripción_ia'] ?? ''}
                onChange={e => setEditando({ ...editando, 'Descripción_ia': e.target.value })}
                rows={3}
                className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-500 resize-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-600">Activo</label>
              <input
                type="checkbox"
                checked={editando.Activo ?? false}
                onChange={e => setEditando({ ...editando, Activo: e.target.checked })}
                className="rounded"
              />
            </div>

            <div className="flex gap-2 mt-2">
              <button
                onClick={() => setEditando(null)}
                className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium text-gray-600"
              >
                Cancelar
              </button>
              <button
                onClick={handleGuardar}
                disabled={loading}
                className="flex-1 bg-emerald-500 text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50"
              >
                {loading ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}