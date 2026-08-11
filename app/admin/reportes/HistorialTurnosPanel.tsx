'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase-browser'
import type { UsuarioActual } from '@/lib/get-usuario-actual'

type Turno = {
  id: string
  usuario_apertura_id: string
  usuario_cierre_id: string | null
  fecha_apertura: string
  fecha_cierre: string | null
  efectivo_inicial: number
  efectivo_esperado: number | null
  efectivo_contado: number | null
  diferencia: number | null
  estado: 'abierto' | 'cerrado'
}

function hoyISO() {
  return new Date().toISOString().slice(0, 10)
}
function haceDiasISO(dias: number) {
  const d = new Date()
  d.setDate(d.getDate() - dias)
  return d.toISOString().slice(0, 10)
}

function duracion(inicio: string, fin: string | null) {
  if (!fin) return 'En curso'
  const ms = new Date(fin).getTime() - new Date(inicio).getTime()
  const horas = Math.floor(ms / (1000 * 60 * 60))
  const minutos = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
  return `${horas}h ${minutos}m`
}

export default function HistorialTurnosPanel({
  usuarioActual,
  mapaUsuarios,
}: {
  usuarioActual: UsuarioActual
  mapaUsuarios: Record<string, string>
}) {
  const supabase = createClient()

  const [desde, setDesde] = useState(haceDiasISO(30))
  const [hasta, setHasta] = useState(hoyISO())
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    buscarTurnos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function buscarTurnos() {
    setCargando(true)
    setError(null)

    const desdeISO = `${desde}T00:00:00`
    const hastaISO = `${hasta}T23:59:59`

    const { data, error } = await supabase
      .from('turnos')
      .select('*')
      .eq('comerciante_id', usuarioActual.comercianteId)
      .gte('fecha_apertura', desdeISO)
      .lte('fecha_apertura', hastaISO)
      .order('fecha_apertura', { ascending: false })

    if (error) {
      setError('No se pudieron cargar los turnos. Probá de nuevo.')
      setCargando(false)
      return
    }

    setTurnos(data || [])
    setCargando(false)
  }

  const totalizadorPorUsuario = useMemo(() => {
    const mapa = new Map<string, { cantidadTurnos: number; diferenciaTotal: number }>()
    turnos.forEach(t => {
      if (t.estado !== 'cerrado' || t.diferencia === null) return
      const actual = mapa.get(t.usuario_apertura_id) ?? { cantidadTurnos: 0, diferenciaTotal: 0 }
      actual.cantidadTurnos += 1
      actual.diferenciaTotal += t.diferencia
      mapa.set(t.usuario_apertura_id, actual)
    })
    return Array.from(mapa.entries())
      .map(([usuarioId, valores]) => ({
        usuarioId,
        nombre: mapaUsuarios[usuarioId] ?? 'Usuario',
        ...valores,
      }))
      .sort((a, b) => Math.abs(b.diferenciaTotal) - Math.abs(a.diferenciaTotal))
  }, [turnos, mapaUsuarios])

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
          onClick={buscarTurnos}
          disabled={cargando}
          className="bg-black text-white rounded px-4 py-2 disabled:opacity-50"
        >
          {cargando ? 'Buscando...' : 'Buscar'}
        </button>
      </div>

      {error && (
        <div className="mb-4 text-red-600 bg-red-50 border border-red-200 rounded p-3">{error}</div>
      )}

      {totalizadorPorUsuario.length > 0 && (
        <div className="bg-white rounded-lg border overflow-hidden mb-6">
          <div className="p-4 border-b">
            <h2 className="font-semibold">Totalizador por usuario (diferencias de caja)</h2>
            <p className="text-xs text-gray-500 mt-1">Atribuido a quien abrió el turno.</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left p-3">Usuario</th>
                <th className="text-right p-3">Turnos cerrados</th>
                <th className="text-right p-3">Diferencia acumulada</th>
              </tr>
            </thead>
            <tbody>
              {totalizadorPorUsuario.map(fila => (
                <tr key={fila.usuarioId} className="border-t">
                  <td className="p-3">{fila.nombre}</td>
                  <td className="p-3 text-right">{fila.cantidadTurnos}</td>
                  <td className={`p-3 text-right font-semibold ${fila.diferenciaTotal < 0 ? 'text-red-600' : fila.diferenciaTotal > 0 ? 'text-emerald-600' : ''}`}>
                    {fila.diferenciaTotal > 0 ? '+' : ''}${fila.diferenciaTotal.toLocaleString('es-AR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Historial de turnos ({turnos.length})</h2>
        </div>

        {cargando ? (
          <div className="p-6 text-center text-gray-500">Cargando...</div>
        ) : turnos.length === 0 ? (
          <div className="p-6 text-center text-gray-500">No hay turnos registrados en este período.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left p-3">Apertura</th>
                  <th className="text-left p-3">Usuario</th>
                  <th className="text-left p-3">Duración</th>
                  <th className="text-right p-3">Esperado</th>
                  <th className="text-right p-3">Contado</th>
                  <th className="text-right p-3">Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {turnos.map(t => {
                  const cerradoPorOtro = t.usuario_cierre_id && t.usuario_cierre_id !== t.usuario_apertura_id
                  return (
                    <tr key={t.id} className="border-t">
                      <td className="p-3">
                        {new Date(t.fecha_apertura).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="p-3">
                        {mapaUsuarios[t.usuario_apertura_id] ?? 'Usuario'}
                        {cerradoPorOtro && (
                          <span className="block text-[11px] text-amber-600">
                            Cerrado por {mapaUsuarios[t.usuario_cierre_id!] ?? 'otro usuario'}
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        {t.estado === 'abierto' ? (
                          <span className="text-emerald-600 font-medium">Abierto</span>
                        ) : (
                          duracion(t.fecha_apertura, t.fecha_cierre)
                        )}
                      </td>
                      <td className="p-3 text-right">
                        {t.efectivo_esperado !== null ? `$${t.efectivo_esperado.toLocaleString('es-AR')}` : '—'}
                      </td>
                      <td className="p-3 text-right">
                        {t.efectivo_contado !== null ? `$${t.efectivo_contado.toLocaleString('es-AR')}` : '—'}
                      </td>
                      <td className="p-3 text-right">
                        {t.diferencia !== null ? (
                          <span className={`font-semibold ${t.diferencia < 0 ? 'text-red-600' : t.diferencia > 0 ? 'text-emerald-600' : ''}`}>
                            {t.diferencia > 0 ? '+' : ''}${t.diferencia.toLocaleString('es-AR')}
                          </span>
                        ) : '—'}
                      </td>
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