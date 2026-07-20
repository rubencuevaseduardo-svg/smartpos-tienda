'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import { UsuarioActual } from '@/lib/get-usuario-actual'

type Usuario = {
  id: string
  nombre: string
  email: string
  rol: 'admin' | 'vendedor'
  activo: boolean
  creado_en: string
}

export default function UsuariosPanel({
  usuarioActual,
  usuariosIniciales,
}: {
  usuarioActual: UsuarioActual
  usuariosIniciales: Usuario[]
}) {
  const [usuarios, setUsuarios] = useState<Usuario[]>(usuariosIniciales)
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState<string | null>(null)
  const [cambiandoId, setCambiandoId] = useState<string | null>(null)

  const router = useRouter()
  const supabase = createClient()

  function generarPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
    let pass = ''
    for (let i = 0; i < 8; i++) {
      pass += chars[Math.floor(Math.random() * chars.length)]
    }
    setPassword(pass)
  }

  async function handleCrearUsuario(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setExito(null)
    setLoading(true)

    try {
      const res = await fetch('/api/crear-vendedor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, email, password }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'No se pudo crear el usuario')
        setLoading(false)
        return
      }

      setExito(`Usuario ${email} creado con éxito. Contraseña: ${password}`)
      setNombre('')
      setEmail('')
      setPassword('')
      router.refresh()

      // Refrescar lista local
      const { data: nuevaLista } = await supabase
        .from('usuarios')
        .select('id, nombre, email, rol, activo, creado_en')
        .eq('comerciante_id', usuarioActual.comercianteId)
        .order('creado_en', { ascending: false })

      if (nuevaLista) setUsuarios(nuevaLista)
    } catch {
      setError('Error de conexión. Intentá de nuevo.')
    }
    setLoading(false)
  }

  async function toggleActivo(usuario: Usuario) {
    setCambiandoId(usuario.id)
    const { error } = await supabase
      .from('usuarios')
      .update({ activo: !usuario.activo })
      .eq('id', usuario.id)

    if (!error) {
      setUsuarios(prev =>
        prev.map(u => u.id === usuario.id ? { ...u, activo: !u.activo } : u)
      )
    }
    setCambiandoId(null)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-gray-900">Usuarios</h1>
            <p className="text-xs text-gray-500">{usuarioActual.comercianteNombre}</p>
          </div>
        </div>

        {/* Navegación por rol */}
        <nav className="max-w-2xl mx-auto px-4 flex gap-1 pb-2">
          <Link
            href="/pos"
            className="text-xs font-medium px-3 py-1.5 rounded-lg text-gray-600 hover:bg-gray-50"
          >
            Vender
          </Link>
          <Link
            href="/admin"
            className="text-xs font-medium px-3 py-1.5 rounded-lg text-gray-600 hover:bg-gray-50"
          >
            Artículos
          </Link>
          <Link
            href="/admin/reportes"
            className="text-xs font-medium px-3 py-1.5 rounded-lg text-gray-600 hover:bg-gray-50"
          >
            Reportes
          </Link>
          <span className="text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600">
            Usuarios
          </span>
        </nav>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Formulario de creación */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
          <h2 className="font-semibold text-gray-900 text-sm mb-4">Crear nuevo vendedor</h2>

          <form onSubmit={handleCrearUsuario} className="flex flex-col gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600">Nombre</label>
              <input
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                required
                placeholder="Ej: María Pérez"
                className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="maria@ejemplo.com"
                className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600">Contraseña temporal</label>
              <div className="mt-1 flex gap-2">
                <input
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Mínimo 6 caracteres"
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={generarPassword}
                  className="text-xs bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 font-medium text-gray-600 whitespace-nowrap"
                >
                  Generar
                </button>
              </div>
            </div>

            {error && (
              <div className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            {exito && (
              <div className="text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
                ✅ {exito}
                <br />
                <span className="text-emerald-600">Compartíselo por WhatsApp o el medio que prefieras.</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="bg-emerald-500 text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              {loading ? 'Creando...' : 'Crear vendedor'}
            </button>
          </form>
        </div>

        {/* Listado de usuarios */}
        <div>
          <p className="text-sm text-gray-500 mb-3">
            {usuarios.length} {usuarios.length === 1 ? 'usuario' : 'usuarios'}
          </p>

          <div className="flex flex-col gap-3">
            {usuarios.map(usuario => (
              <div
                key={usuario.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900 text-sm truncate">{usuario.nombre}</h3>
                    <span className={`text-[10px] rounded-full px-2 py-0.5 font-medium whitespace-nowrap ${
                      usuario.rol === 'admin'
                        ? 'bg-blue-50 text-blue-600'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {usuario.rol === 'admin' ? 'Admin' : 'Vendedor'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{usuario.email}</p>
                </div>

                {usuario.rol !== 'admin' && (
                  <button
                    onClick={() => toggleActivo(usuario)}
                    disabled={cambiandoId === usuario.id}
                    className={`text-xs rounded-lg px-3 py-1.5 font-medium whitespace-nowrap disabled:opacity-50 ${
                      usuario.activo
                        ? 'bg-red-50 text-red-500'
                        : 'bg-emerald-50 text-emerald-600'
                    }`}
                  >
                    {cambiandoId === usuario.id
                      ? '...'
                      : usuario.activo ? 'Desactivar' : 'Activar'}
                  </button>
                )}
              </div>
            ))}

            {usuarios.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">
                Todavía no creaste ningún vendedor
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
