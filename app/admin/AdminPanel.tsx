'use client'

import * as XLSX from 'xlsx'
import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Producto } from '@/lib/supabase'
import { UsuarioActual } from '@/lib/get-usuario-actual'

export default function AdminPanel({
  usuarioActual,
  productos,
}: {
  usuarioActual: UsuarioActual
  productos: Producto[]
}) {
  const esAdmin = usuarioActual.rol === 'admin'

  const [lista, setLista] = useState<Producto[]>(productos)
  const [editando, setEditando] = useState<Producto | null>(null)
  const [loading, setLoading] = useState(false)
  const [importando, setImportando] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('todas')
  const [ajustandoId, setAjustandoId] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const categorias = useMemo(() => {
    const set = new Set(
      lista
        .map(p => (p.Categoria ?? '').trim())
        .filter(c => c.length > 0)
    )
    return Array.from(set).sort()
  }, [lista])

  const listaFiltrada = lista.filter(p => {
    const coincideBusqueda = (p.Nombre ?? '').toLowerCase().includes(busqueda.toLowerCase())
    const coincideCategoria = filtroCategoria === 'todas' || (p.Categoria ?? '') === filtroCategoria
    return coincideBusqueda && coincideCategoria
  })

  const stats = useMemo(() => {
    const activos = lista.filter(p => p.Activo)
    const sinStock = lista.filter(p => (p.Stock ?? 0) <= 0)
    const valorInventario = lista.reduce(
      (acc, p) => acc + (p.Precio ?? 0) * (p.Stock ?? 0),
      0
    )
    return {
      totalActivos: activos.length,
      sinStock: sinStock.length,
      valorInventario,
    }
  }, [lista])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  async function handleSubirFoto(file: File) {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('upload_preset', 'smartpos_unsigned')
    formData.append('folder', 'smartpos/productos')

    const res = await fetch('https://api.cloudinary.com/v1_1/dl2k77ebi/image/upload', {
      method: 'POST',
      body: formData,
    })
    const data = await res.json()
    const url = data.secure_url.replace('/upload/', '/upload/ar_1.0,c_fill/')
    setEditando(prev => prev ? { ...prev, Foto_url: url } : null)
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
        Foto_url: editando.Foto_url,
        Categoria: editando.Categoria ?? null,
      })
      .eq('id', editando.id)

    if (!error) {
      setLista(lista.map(p => p.id === editando.id ? editando : p))
      setEditando(null)
    }
    setLoading(false)
  }

  async function handleAjustarStock(producto: Producto, delta: number) {
    const stockActual = producto.Stock ?? 0
    const nuevoStock = Math.max(0, stockActual + delta)
    if (nuevoStock === stockActual) return

    setAjustandoId(producto.id)
    const nuevoActivo = nuevoStock === 0 ? false : producto.Activo

    const { error } = await supabase
      .from('productos')
      .update({ Stock: nuevoStock, Activo: nuevoActivo })
      .eq('id', producto.id)

    if (!error) {
      setLista(prev =>
        prev.map(p =>
          p.id === producto.id ? { ...p, Stock: nuevoStock, Activo: nuevoActivo } : p
        )
      )
    }
    setAjustandoId(null)
  }

  function handleDescargarPlantilla() {
    const plantilla = [
      { Nombre: 'Ejemplo producto', Precio: 1000, Stock: 5, Descripcion: 'Descripción del producto', Categoria: 'General' }
    ]
    const ws = XLSX.utils.json_to_sheet(plantilla)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Productos')
    XLSX.writeFile(wb, 'plantilla_smartpos.xlsx')
  }

  async function handleImportar(file: File) {
    setImportando(true)
    const buffer = await file.arrayBuffer()
    const wb = XLSX.read(buffer)
    const ws = wb.Sheets[wb.SheetNames[0]]
    const filas = XLSX.utils.sheet_to_json(ws) as any[]

    for (const fila of filas) {
      await supabase.from('productos').insert({
        Comerciante_id: usuarioActual.comercianteId,
        Nombre: fila.Nombre || fila.nombre || '',
        Precio: parseFloat(fila.Precio || fila.precio || 0),
        Stock: parseInt(fila.Stock || fila.stock || 1),
        'Descripción_ia': fila.Descripcion || fila.descripcion || '',
        Categoria: fila.Categoria || fila.categoria || null,
        Activo: true,
      })
    }

    setImportando(false)
    router.refresh()
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
            <p className="text-xs text-gray-500">
              {usuarioActual.comercianteNombre} · {usuarioActual.nombre}
              {!esAdmin && <span className="ml-1 text-gray-400">(vendedor)</span>}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="text-xs text-gray-500 border border-gray-200 rounded-xl px-3 py-1.5"
          >
            Cerrar sesión
          </button>
        </div>

        {/* Navegación por rol */}
        <nav className="max-w-2xl mx-auto px-4 flex gap-1 pb-2">
          <Link
            href="/pos"
            className="text-xs font-medium px-3 py-1.5 rounded-lg text-gray-600 hover:bg-gray-50"
          >
            Vender
          </Link>
          <span className="text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600">
            Artículos
          </span>
          {esAdmin && (
            <>
              <Link
                href="/admin/reportes"
                className="text-xs font-medium px-3 py-1.5 rounded-lg text-gray-600 hover:bg-gray-50"
              >
                Reportes
              </Link>
              <Link
                href="/admin/usuarios"
                className="text-xs font-medium px-3 py-1.5 rounded-lg text-gray-600 hover:bg-gray-50"
              >
                Usuarios
              </Link>
            </>
          )}
        </nav>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Dashboard resumen */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 text-center">
            <p className="text-lg font-bold text-emerald-600">{stats.totalActivos}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">Activos</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 text-center">
            <p className={`text-lg font-bold ${stats.sinStock > 0 ? 'text-red-500' : 'text-gray-900'}`}>
              {stats.sinStock}
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">Sin stock</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 text-center">
            <p className="text-lg font-bold text-gray-900">
              ${stats.valorInventario.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">Valor inventario</p>
          </div>
        </div>

        {/* Buscador */}
        <input
          type="text"
          placeholder="Buscar producto..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-500 bg-white mb-3"
        />

        {/* Filtro de categoría */}
        {categorias.length > 0 && (
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
            <button
              onClick={() => setFiltroCategoria('todas')}
              className={`text-xs rounded-xl px-3 py-1.5 font-medium whitespace-nowrap ${
                filtroCategoria === 'todas'
                  ? 'bg-emerald-500 text-white'
                  : 'bg-white border border-gray-200 text-gray-600'
              }`}
            >
              Todas
            </button>
            {categorias.map(cat => (
              <button
                key={cat}
                onClick={() => setFiltroCategoria(cat)}
                className={`text-xs rounded-xl px-3 py-1.5 font-medium whitespace-nowrap ${
                  filtroCategoria === cat
                    ? 'bg-emerald-500 text-white'
                    : 'bg-white border border-gray-200 text-gray-600'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500">
            {listaFiltrada.length} {listaFiltrada.length === 1 ? 'producto' : 'productos'}
          </p>
          {esAdmin && (
            <div className="flex gap-2">
              <button
                onClick={handleDescargarPlantilla}
                className="text-xs bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 font-medium text-gray-600"
              >
                Descargar plantilla
              </button>
              <label className={`cursor-pointer text-xs border rounded-xl px-3 py-1.5 font-medium ${importando ? 'bg-gray-100 text-gray-400 pointer-events-none' : 'bg-emerald-50 border-emerald-200 text-emerald-600'}`}>
                {importando ? 'Importando...' : 'Importar Excel'}
                <input
                  type="file"
                  accept=".xlsx,.csv"
                  className="hidden"
                  onChange={e => e.target.files?.[0] && handleImportar(e.target.files[0])}
                />
              </label>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {listaFiltrada.map((producto) => {
            const stock = producto.Stock ?? 0
            return (
              <div key={producto.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex gap-3">
                <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                  {producto.Foto_url ? (
                    <Image src={producto.Foto_url} alt={producto.Nombre} fill className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 text-2xl">📷</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-gray-900 text-sm truncate">{producto.Nombre}</h2>
                    {producto.Categoria && (
                      <span className="text-[10px] bg-gray-100 text-gray-500 rounded-full px-2 py-0.5 whitespace-nowrap">
                        {producto.Categoria}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    ${producto.Precio?.toLocaleString('es-AR')}
                  </p>

                  <div className="flex items-center gap-2 mt-1.5">
                    {esAdmin ? (
                      <>
                        <button
                          onClick={() => handleAjustarStock(producto, -1)}
                          disabled={ajustandoId === producto.id || stock <= 0}
                          className="w-6 h-6 flex items-center justify-center rounded-lg bg-gray-100 text-gray-600 text-sm font-bold disabled:opacity-30"
                        >
                          −
                        </button>
                        <span className="text-xs font-medium text-gray-700 min-w-[1.5rem] text-center">
                          {stock}
                        </span>
                        <button
                          onClick={() => handleAjustarStock(producto, 1)}
                          disabled={ajustandoId === producto.id}
                          className="w-6 h-6 flex items-center justify-center rounded-lg bg-gray-100 text-gray-600 text-sm font-bold disabled:opacity-30"
                        >
                          +
                        </button>
                      </>
                    ) : (
                      <span className="text-xs font-medium text-gray-700">
                        Stock: {stock}
                      </span>
                    )}
                    {stock === 0 && (
                      <span className="text-[10px] bg-red-50 text-red-500 rounded-full px-2 py-0.5 font-medium">
                        Sin stock
                      </span>
                    )}
                    {stock > 0 && stock <= 3 && (
                      <span className="text-[10px] bg-amber-50 text-amber-600 rounded-full px-2 py-0.5 font-medium">
                        ¡Últimas {stock}!
                      </span>
                    )}
                  </div>

                  {esAdmin && (
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
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </main>

      {/* Modal edición — solo admin puede llegar acá */}
      {editando && esAdmin && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 px-4 pb-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <h2 className="font-bold text-gray-900">Editar producto</h2>
            <div>
              <label className="text-xs font-medium text-gray-600">Foto</label>
              <div className="mt-1 flex items-center gap-3">
                {editando.Foto_url && (
                  <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                    <Image src={editando.Foto_url} alt={editando.Nombre} fill className="object-cover" />
                  </div>
                )}
                <label className="cursor-pointer bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100">
                  {editando.Foto_url ? 'Cambiar foto' : 'Subir foto'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => e.target.files?.[0] && handleSubirFoto(e.target.files[0])}
                  />
                </label>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600">Nombre</label>
              <input
                value={editando.Nombre}
                onChange={e => setEditando({ ...editando, Nombre: e.target.value })}
                className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600">Categoría</label>
              <input
                list="categorias-sugeridas"
                value={editando.Categoria ?? ''}
                onChange={e => setEditando({ ...editando, Categoria: e.target.value })}
                placeholder="Ej: Indumentaria, Calzado, Accesorios..."
                className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-500"
              />
              <datalist id="categorias-sugeridas">
                {categorias.map(cat => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
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
