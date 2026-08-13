'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import { UsuarioActual } from '@/lib/get-usuario-actual'

type LineaVenta = {
  ventaId: string
  productoId: string | null
  productoNombre: string
  cantidadOriginal: number
  cantidadDisponible: number
  precioUnitario: number
  cantidadADevolver: number
}

type TicketAgrupado = {
  numeroTicket: number
  fecha: string
  total: number
}

type ItemNotaEmitida = {
  nombre: string
  cantidad: number
  precioUnitario: number
  subtotal: number
}

type NotaEmitida = {
  numeroNotaCredito: number
  numeroTicketOriginal: number
  fecha: Date
  motivo: string
  items: ItemNotaEmitida[]
  total: number
}

export default function NotasCreditoPanel({
  usuarioActual,
}: {
  usuarioActual: UsuarioActual
}) {
  const supabase = createClient()

  // --- Modo de búsqueda ---
  const [modoBusqueda, setModoBusqueda] = useState<'ticket' | 'avanzada'>('ticket')
  const [ticketInput, setTicketInput] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [productoQuery, setProductoQuery] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null)
  const [resultadosAvanzada, setResultadosAvanzada] = useState<TicketAgrupado[]>([])

  // --- Ticket cargado ---
  const [ticketCargado, setTicketCargado] = useState<number | null>(null)
  const [lineas, setLineas] = useState<LineaVenta[]>([])
  const [motivo, setMotivo] = useState('')

  // --- Emisión ---
  const [guardando, setGuardando] = useState(false)
  const [errorEmision, setErrorEmision] = useState<string | null>(null)
  const [notaEmitida, setNotaEmitida] = useState<NotaEmitida | null>(null)

  function fmt(n: number) {
    return '$' + Math.round(n).toLocaleString('es-AR')
  }

  function resetBusqueda() {
    setTicketCargado(null)
    setLineas([])
    setMotivo('')
    setErrorBusqueda(null)
    setErrorEmision(null)
    setResultadosAvanzada([])
  }

  // --- Cargar líneas de un ticket + calcular disponible restando notas previas ---
  async function cargarTicket(numero: number) {
    setErrorBusqueda(null)
    setBuscando(true)
    try {
      const { data: ventasData, error: errorVentas } = await supabase
        .from('ventas')
        .select('id, producto_id, cantidad, total, productos(Nombre)')
        .eq('comerciante_id', usuarioActual.comercianteId)
        .eq('numero_ticket', numero)

      if (errorVentas) throw errorVentas
      if (!ventasData || ventasData.length === 0) {
        setErrorBusqueda(`No se encontró el ticket #${numero} en este comercio.`)
        setBuscando(false)
        return
      }

      const ventaIds = ventasData.map((v: any) => v.id)

      const { data: devueltoData, error: errorDevuelto } = await supabase
        .from('notas_credito_detalle')
        .select('venta_id, cantidad')
        .in('venta_id', ventaIds)

      if (errorDevuelto) throw errorDevuelto

      const devueltoPorVenta: Record<string, number> = {}
      ;(devueltoData ?? []).forEach((d: any) => {
        devueltoPorVenta[d.venta_id] = (devueltoPorVenta[d.venta_id] ?? 0) + d.cantidad
      })

      const lineasNuevas: LineaVenta[] = ventasData.map((v: any) => {
        const yaDevuelto = devueltoPorVenta[v.id] ?? 0
        const disponible = v.cantidad - yaDevuelto
        const nombreProducto = Array.isArray(v.productos)
          ? v.productos[0]?.Nombre ?? '(producto eliminado)'
          : v.productos?.Nombre ?? '(producto eliminado)'
        return {
          ventaId: v.id,
          productoId: v.producto_id,
          productoNombre: nombreProducto,
          cantidadOriginal: v.cantidad,
          cantidadDisponible: Math.max(0, disponible),
          precioUnitario: v.cantidad > 0 ? v.total / v.cantidad : 0,
          cantidadADevolver: 0,
        }
      })

      setLineas(lineasNuevas)
      setTicketCargado(numero)
      setResultadosAvanzada([])
    } catch (err: any) {
      setErrorBusqueda(err.message ?? 'Ocurrió un error al buscar el ticket.')
    } finally {
      setBuscando(false)
    }
  }

  async function handleBuscarPorTicket() {
    const numero = parseInt(ticketInput)
    if (isNaN(numero) || numero <= 0) {
      setErrorBusqueda('Ingresá un número de ticket válido.')
      return
    }
    await cargarTicket(numero)
  }

  async function handleBuscarAvanzada() {
    setErrorBusqueda(null)
    setBuscando(true)
    setResultadosAvanzada([])
    try {
      let query = supabase
        .from('ventas')
        .select('numero_ticket, fecha, total, productos!inner(Nombre)')
        .eq('comerciante_id', usuarioActual.comercianteId)
        .order('fecha', { ascending: false })
        .limit(100)

      if (fechaDesde) query = query.gte('fecha', new Date(fechaDesde).toISOString())
      if (fechaHasta) query = query.lte('fecha', new Date(fechaHasta + 'T23:59:59').toISOString())
      if (productoQuery.trim()) query = query.ilike('productos.Nombre', `%${productoQuery.trim()}%`)

      const { data, error } = await query
      if (error) throw error

      const agrupados: Record<number, TicketAgrupado> = {}
      ;(data ?? []).forEach((v: any) => {
        const existente = agrupados[v.numero_ticket]
        if (existente) {
          existente.total += v.total
        } else {
          agrupados[v.numero_ticket] = {
            numeroTicket: v.numero_ticket,
            fecha: v.fecha,
            total: v.total,
          }
        }
      })

      const lista = Object.values(agrupados).sort(
        (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
      )

      if (lista.length === 0) {
        setErrorBusqueda('No se encontraron ventas con esos filtros.')
      }
      setResultadosAvanzada(lista)
    } catch (err: any) {
      setErrorBusqueda(err.message ?? 'Ocurrió un error al buscar.')
    } finally {
      setBuscando(false)
    }
  }

  function actualizarCantidad(ventaId: string, cantidad: number) {
    setLineas(prev =>
      prev.map(l => {
        if (l.ventaId !== ventaId) return l
        const clamped = Math.max(0, Math.min(cantidad, l.cantidadDisponible))
        return { ...l, cantidadADevolver: clamped }
      })
    )
  }

  const lineasSeleccionadas = lineas.filter(l => l.cantidadADevolver > 0)
  const totalNota = lineasSeleccionadas.reduce(
    (acc, l) => acc + l.cantidadADevolver * l.precioUnitario,
    0
  )

  async function handleEmitirNota() {
    setErrorEmision(null)

    if (lineasSeleccionadas.length === 0) {
      setErrorEmision('Seleccioná al menos una línea con cantidad a devolver.')
      return
    }
    if (!motivo.trim()) {
      setErrorEmision('El motivo es obligatorio.')
      return
    }
    for (const l of lineasSeleccionadas) {
      if (l.cantidadADevolver > l.cantidadDisponible) {
        setErrorEmision(`La cantidad a devolver de "${l.productoNombre}" supera lo disponible.`)
        return
      }
    }

    setGuardando(true)
    try {
      const { data: userData } = await supabase.auth.getUser()
      const usuarioId = userData?.user?.id
      if (!usuarioId) throw new Error('No se pudo confirmar el usuario logueado.')

      const { data: numeroNotaCredito, error: errorNumero } = await supabase.rpc(
        'siguiente_numero_nota_credito',
        { p_comerciante_id: usuarioActual.comercianteId }
      )
      if (errorNumero) throw errorNumero

      const { data: cabecera, error: errorCabecera } = await supabase
        .from('notas_credito')
        .insert({
          comerciante_id: usuarioActual.comercianteId,
          numero_ticket_original: ticketCargado,
          numero_nota_credito: numeroNotaCredito,
          motivo: motivo.trim(),
          usuario_id: usuarioId,
          total: totalNota,
        })
        .select()
        .single()

      if (errorCabecera || !cabecera) throw errorCabecera ?? new Error('No se pudo crear la nota de crédito.')

      for (const linea of lineasSeleccionadas) {
        const subtotal = linea.cantidadADevolver * linea.precioUnitario

        const { error: errorDetalle } = await supabase.from('notas_credito_detalle').insert({
          nota_credito_id: cabecera.id,
          venta_id: linea.ventaId,
          producto_id: linea.productoId,
          cantidad: linea.cantidadADevolver,
          precio_unitario: linea.precioUnitario,
          subtotal,
        })
        if (errorDetalle) throw errorDetalle

        if (linea.productoId) {
          const { data: prodActual, error: errorLeerStock } = await supabase
            .from('productos')
            .select('Stock')
            .eq('id', linea.productoId)
            .single()
          if (errorLeerStock) throw errorLeerStock

          const stockAntes = prodActual?.Stock ?? 0
          const stockDespues = stockAntes + linea.cantidadADevolver

          const { error: errorUpdate } = await supabase
            .from('productos')
            .update({ Stock: stockDespues, Activo: true })
            .eq('id', linea.productoId)
          if (errorUpdate) throw errorUpdate

          const { error: errorMovimiento } = await supabase.from('movimientos_stock').insert({
            comerciante_id: usuarioActual.comercianteId,
            producto_id: linea.productoId,
            tipo: 'devolucion',
            cantidad: linea.cantidadADevolver,
            stock_antes: stockAntes,
            stock_despues: stockDespues,
            usuario_id: usuarioId,
            motivo: null,
          })
          if (errorMovimiento) throw errorMovimiento
        }
      }

      setNotaEmitida({
        numeroNotaCredito,
        numeroTicketOriginal: ticketCargado!,
        fecha: new Date(),
        motivo: motivo.trim(),
        items: lineasSeleccionadas.map(l => ({
          nombre: l.productoNombre,
          cantidad: l.cantidadADevolver,
          precioUnitario: l.precioUnitario,
          subtotal: l.cantidadADevolver * l.precioUnitario,
        })),
        total: totalNota,
      })
    } catch (err: any) {
      setErrorEmision(err.message ?? 'Ocurrió un error al emitir la nota de crédito.')
    } finally {
      setGuardando(false)
    }
  }

  function nuevaNota() {
    setNotaEmitida(null)
    setTicketInput('')
    resetBusqueda()
  }

  // --- Pantalla de confirmación / comprobante imprimible ---
  if (notaEmitida) {
    const fechaTexto = notaEmitida.fecha.toLocaleString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })

    return (
      <>
        <style>{`
          @media print {
            body * { visibility: hidden; }
            .ticket-imprimible, .ticket-imprimible * { visibility: visible; }
            .ticket-imprimible {
              position: absolute;
              top: 0;
              left: 0;
              width: 80mm;
            }
            @page {
              size: 80mm auto;
              margin: 0;
            }
          }
        `}</style>

        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--color-background-tertiary)',
          padding: 20,
        }}>
          <div style={{
            background: 'var(--color-background-primary)',
            border: '0.5px solid var(--color-border-tertiary)',
            borderRadius: 'var(--border-radius-lg)',
            padding: '32px 28px',
            maxWidth: 360,
            width: '100%',
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: '#E1F5EE',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h1 style={{ fontSize: 18, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 20, textAlign: 'center' }}>
              Nota de crédito emitida
            </h1>

            <div className="ticket-imprimible" style={{
              fontFamily: 'monospace',
              fontSize: 12,
              color: '#000',
              padding: '12px 4px',
              borderTop: '1px dashed #999',
              borderBottom: '1px dashed #999',
              marginBottom: 20,
            }}>
              <div style={{ textAlign: 'center', fontWeight: 700, marginBottom: 4 }}>
                {usuarioActual.comercianteNombre}
              </div>
              <div style={{ textAlign: 'center', marginBottom: 8 }}>
                NOTA DE CRÉDITO #{notaEmitida.numeroNotaCredito}
                <br />
                Ref. Ticket #{notaEmitida.numeroTicketOriginal}
                <br />
                {fechaTexto}
              </div>
              <div style={{ borderTop: '1px dashed #999', margin: '6px 0' }} />
              {notaEmitida.items.map((item, i) => (
                <div key={i} style={{ marginBottom: 4 }}>
                  <div>{item.nombre}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{item.cantidad} x {fmt(item.precioUnitario)}</span>
                    <span>{fmt(item.subtotal)}</span>
                  </div>
                </div>
              ))}
              <div style={{ borderTop: '1px dashed #999', margin: '6px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 14 }}>
                <span>TOTAL</span>
                <span>{fmt(notaEmitida.total)}</span>
              </div>
              <div style={{ marginTop: 8, fontSize: 11 }}>
                Motivo: {notaEmitida.motivo}
              </div>
              <div style={{ textAlign: 'center', marginTop: 10, fontSize: 10 }}>
                Comprobante interno — no válido como factura
              </div>
            </div>

            <button
              onClick={() => window.print()}
              style={{
                width: '100%', padding: '11px', marginBottom: 10,
                background: 'var(--color-background-secondary)',
                color: 'var(--color-text-primary)',
                border: '0.5px solid var(--color-border-secondary)',
                borderRadius: 'var(--border-radius-md)',
                fontSize: 15, fontWeight: 500, cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
              }}>
              Imprimir comprobante
            </button>
            <button
              onClick={nuevaNota}
              style={{
                width: '100%', padding: '11px', marginBottom: 10,
                background: '#1D9E75', color: '#E1F5EE',
                border: 'none', borderRadius: 'var(--border-radius-md)',
                fontSize: 15, fontWeight: 500, cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
              }}>
              Nueva nota de crédito
            </button>
            <Link
              href="/admin"
              style={{
                display: 'block', textAlign: 'center',
                fontSize: 13, color: 'var(--color-text-tertiary)', textDecoration: 'none',
              }}>
              Volver al panel
            </Link>
          </div>
        </div>
      </>
    )
  }

  // --- Pantalla principal ---
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-gray-900">Notas de crédito</h1>
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
        {!ticketCargado && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => { setModoBusqueda('ticket'); setErrorBusqueda(null); setResultadosAvanzada([]) }}
                className={`text-[11px] rounded-lg px-2 py-1 font-medium ${
                  modoBusqueda === 'ticket' ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                Por número de ticket
              </button>
              <button
                onClick={() => { setModoBusqueda('avanzada'); setErrorBusqueda(null) }}
                className={`text-[11px] rounded-lg px-2 py-1 font-medium ${
                  modoBusqueda === 'avanzada' ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                No sé el ticket — buscar por fecha/producto
              </button>
            </div>

            {modoBusqueda === 'ticket' ? (
              <div className="flex gap-2">
                <input
                  type="number"
                  value={ticketInput}
                  onChange={e => setTicketInput(e.target.value)}
                  placeholder="Número de ticket"
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-500"
                />
                <button
                  onClick={handleBuscarPorTicket}
                  disabled={buscando}
                  className="bg-emerald-500 text-white rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  {buscando ? 'Buscando...' : 'Buscar'}
                </button>
              </div>
            ) : (
              <div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600">Desde</label>
                    <input
                      type="date"
                      value={fechaDesde}
                      onChange={e => setFechaDesde(e.target.value)}
                      className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Hasta</label>
                    <input
                      type="date"
                      value={fechaHasta}
                      onChange={e => setFechaHasta(e.target.value)}
                      className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
                <label className="text-xs font-medium text-gray-600">Producto (opcional)</label>
                <input
                  value={productoQuery}
                  onChange={e => setProductoQuery(e.target.value)}
                  placeholder="Nombre del producto"
                  className="mt-1 mb-3 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-500"
                />
                <button
                  onClick={handleBuscarAvanzada}
                  disabled={buscando}
                  className="w-full bg-emerald-500 text-white rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  {buscando ? 'Buscando...' : 'Buscar ventas'}
                </button>

                {resultadosAvanzada.length > 0 && (
                  <div className="mt-4 flex flex-col gap-2">
                    {resultadosAvanzada.map(r => (
                      <button
                        key={r.numeroTicket}
                        onClick={() => cargarTicket(r.numeroTicket)}
                        className="text-left bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm hover:border-emerald-500"
                      >
                        <div className="flex justify-between">
                          <span className="font-medium">Ticket #{r.numeroTicket}</span>
                          <span>{fmt(r.total)}</span>
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(r.fecha).toLocaleString('es-AR', {
                            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
                          })}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {errorBusqueda && (
              <div className="mt-3 text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">{errorBusqueda}</div>
            )}
          </div>
        )}

        {ticketCargado && (
          <>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-gray-900">Ticket #{ticketCargado}</span>
                <button onClick={resetBusqueda} className="text-xs text-gray-500 underline">
                  Buscar otro ticket
                </button>
              </div>
              <p className="text-xs text-gray-500">Elegí qué líneas y cantidades devolver.</p>
            </div>

            <div className="flex flex-col gap-3">
              {lineas.map(l => (
                <div
                  key={l.ventaId}
                  className={`bg-white rounded-2xl border shadow-sm p-4 ${
                    l.cantidadDisponible === 0 ? 'border-gray-100 opacity-50' : 'border-gray-100'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900">{l.productoNombre}</span>
                    <span className="text-xs text-gray-500">
                      Vendido: {l.cantidadOriginal} · Disponible: {l.cantidadDisponible}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mb-2">
                    Precio unitario: {fmt(l.precioUnitario)}
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-xs font-medium text-gray-600">Cantidad a devolver</label>
                    <input
                      type="number"
                      min={0}
                      max={l.cantidadDisponible}
                      disabled={l.cantidadDisponible === 0}
                      value={l.cantidadADevolver}
                      onChange={e => actualizarCantidad(l.ventaId, parseInt(e.target.value) || 0)}
                      className="w-20 border border-gray-200 rounded-xl px-2 py-1 text-sm outline-none focus:border-emerald-500 disabled:bg-gray-50"
                    />
                    {l.cantidadADevolver > 0 && (
                      <span className="text-xs text-gray-500 ml-auto">
                        Subtotal: {fmt(l.cantidadADevolver * l.precioUnitario)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mt-4">
              <label className="text-xs font-medium text-gray-600">Motivo (obligatorio)</label>
              <textarea
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                placeholder="Ej: cliente devolvió producto con falla"
                rows={2}
                className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-500"
              />
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mt-4 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">Total a acreditar</span>
              <span className="text-lg font-bold text-gray-900">{fmt(totalNota)}</span>
            </div>

            {errorEmision && (
              <div className="mt-3 text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">{errorEmision}</div>
            )}

            <button
              onClick={handleEmitirNota}
              disabled={guardando}
              className="w-full mt-4 bg-emerald-500 text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-50"
            >
              {guardando ? 'Emitiendo...' : 'Emitir nota de crédito'}
            </button>
          </>
        )}
      </main>
    </div>
  )
}