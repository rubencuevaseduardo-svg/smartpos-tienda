'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase-browser'
import Image from 'next/image'
import { UsuarioActual } from '@/lib/get-usuario-actual'

type Producto = {
  id: string
  Nombre: string
  Precio: number
  Stock: number
  Foto_url: string | null
  Activo: boolean
}

type Turno = {
  id: string
  comerciante_id: string
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

type CartItem = Producto & { qty: number }
type ItemVendido = {
  nombre: string
  qty: number
  precio: number
  subtotal: number
}
type MetodoPago = 'efectivo' | 'tarjeta' | 'transferencia'

type InfoTicket = {
  numeroTicket: number | null
  fecha: Date
  items: ItemVendido[]
  total: number
}

export default function POSPanel({
  productos,
  usuarioActual,
  turnoInicial,
}: {
  productos: Producto[]
  usuarioActual: UsuarioActual
  turnoInicial: Turno | null
}) {
  const esAdmin = usuarioActual.rol === 'admin'
  const supabase = createClient()

  // --- Estado de turno ---
  const [turno, setTurno] = useState<Turno | null>(turnoInicial)
  const [efectivoInicialInput, setEfectivoInicialInput] = useState('')
  const [abriendoTurno, setAbriendoTurno] = useState(false)
  const [errorTurno, setErrorTurno] = useState<string | null>(null)

  const [modalCierreAbierto, setModalCierreAbierto] = useState(false)
  const [calculandoCierre, setCalculandoCierre] = useState(false)
  const [efectivoEsperadoCalc, setEfectivoEsperadoCalc] = useState<number | null>(null)
  const [efectivoContadoInput, setEfectivoContadoInput] = useState('')
  const [cerrandoTurno, setCerrandoTurno] = useState(false)
  const [errorCierre, setErrorCierre] = useState<string | null>(null)

  // --- Estado del POS ---
  const [cart, setCart] = useState<Record<string, CartItem>>({})
  const [stocks, setStocks] = useState<Record<string, number>>(
    Object.fromEntries(productos.map((p) => [p.id, p.Stock]))
  )
  const [busqueda, setBusqueda] = useState('')
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('efectivo')
  const [estado, setEstado] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [ventaInfo, setVentaInfo] = useState<InfoTicket>({
    numeroTicket: null,
    fecha: new Date(),
    items: [],
    total: 0,
  })

  const productosFiltrados = useMemo(
    () =>
      productos.filter((p) =>
        (p.Nombre ?? '').toLowerCase().includes(busqueda.toLowerCase())
      ),
    [productos, busqueda]
  )

  const cartItems = Object.values(cart)
  const totalItems = cartItems.reduce((s, i) => s + i.qty, 0)
  const totalPrecio = cartItems.reduce((s, i) => s + i.Precio * i.qty, 0)

  function fmt(n: number) {
    return '$' + Math.round(n).toLocaleString('es-AR')
  }

  // --- Abrir turno ---
  async function handleAbrirTurno() {
    setErrorTurno(null)
    const efectivoInicial = parseFloat(efectivoInicialInput)
    if (isNaN(efectivoInicial) || efectivoInicial < 0) {
      setErrorTurno('Ingresá un monto de fondo inicial válido.')
      return
    }

    setAbriendoTurno(true)
    try {
      const { data: userData } = await supabase.auth.getUser()
      const usuarioId = userData?.user?.id
      if (!usuarioId) throw new Error('No se pudo confirmar el usuario logueado.')

      const { data, error } = await supabase
        .from('turnos')
        .insert({
          comerciante_id: usuarioActual.comercianteId,
          usuario_apertura_id: usuarioId,
          efectivo_inicial: efectivoInicial,
          estado: 'abierto',
        })
        .select()
        .single()

      if (error) {
        // El índice único parcial rechaza si ya hay un turno abierto (carrera entre pestañas/usuarios)
        if (error.code === '23505') {
          throw new Error('Ya hay un turno abierto para este comercio. Recargá la página.')
        }
        throw error
      }

      setTurno(data as Turno)
      setEfectivoInicialInput('')
    } catch (err: any) {
      setErrorTurno(err.message ?? 'No se pudo abrir el turno.')
    } finally {
      setAbriendoTurno(false)
    }
  }

  // --- Abrir modal de cierre + calcular efectivo esperado ---
  async function abrirModalCierre() {
    if (!turno) return
    setModalCierreAbierto(true)
    setErrorCierre(null)
    setEfectivoContadoInput('')
    setCalculandoCierre(true)

    const { data, error } = await supabase
      .from('ventas')
      .select('total')
      .eq('turno_id', turno.id)
      .eq('metodo_pago', 'efectivo')

    if (error) {
      setErrorCierre('No se pudo calcular el efectivo esperado. Probá de nuevo.')
      setCalculandoCierre(false)
      return
    }

    const totalVentasEfectivo = (data ?? []).reduce((acc, v) => acc + (v.total ?? 0), 0)
    setEfectivoEsperadoCalc(turno.efectivo_inicial + totalVentasEfectivo)
    setCalculandoCierre(false)
  }

  function cerrarModalCierre() {
    setModalCierreAbierto(false)
    setEfectivoEsperadoCalc(null)
    setEfectivoContadoInput('')
    setErrorCierre(null)
  }

  async function handleCerrarTurno() {
    if (!turno || efectivoEsperadoCalc === null) return
    setErrorCierre(null)

    const efectivoContado = parseFloat(efectivoContadoInput)
    if (isNaN(efectivoContado) || efectivoContado < 0) {
      setErrorCierre('Ingresá el efectivo contado.')
      return
    }

    setCerrandoTurno(true)
    try {
      const { data: userData } = await supabase.auth.getUser()
      const usuarioId = userData?.user?.id
      if (!usuarioId) throw new Error('No se pudo confirmar el usuario logueado.')

      const diferencia = efectivoContado - efectivoEsperadoCalc

      const { error } = await supabase
        .from('turnos')
        .update({
          estado: 'cerrado',
          fecha_cierre: new Date().toISOString(),
          usuario_cierre_id: usuarioId,
          efectivo_esperado: efectivoEsperadoCalc,
          efectivo_contado: efectivoContado,
          diferencia,
        })
        .eq('id', turno.id)

      if (error) throw error

      setTurno(null)
      cerrarModalCierre()
    } catch (err: any) {
      setErrorCierre(err.message ?? 'No se pudo cerrar el turno.')
    } finally {
      setCerrandoTurno(false)
    }
  }

  // --- Carrito ---
  function agregarAlCarrito(p: Producto) {
    if (stocks[p.id] === 0) return
    setCart((prev) => {
      const actual = prev[p.id]
      if (actual && actual.qty >= stocks[p.id]) return prev
      return {
        ...prev,
        [p.id]: actual ? { ...actual, qty: actual.qty + 1 } : { ...p, qty: 1 },
      }
    })
  }

  function cambiarCantidad(id: string, delta: number) {
    setCart((prev) => {
      const item = prev[id]
      if (!item) return prev
      const nuevaQty = item.qty + delta
      if (nuevaQty <= 0) {
        const next = { ...prev }
        delete next[id]
        return next
      }
      if (nuevaQty > stocks[id]) return prev
      return { ...prev, [id]: { ...item, qty: nuevaQty } }
    })
  }

  function quitarItem(id: string) {
    setCart((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  async function registrarVenta() {
    if (cartItems.length === 0 || !turno) return
    setEstado('loading')

    try {
      const { data: numeroTicket, error: errorTicket } = await supabase.rpc(
        'siguiente_numero_ticket',
        { p_comerciante_id: usuarioActual.comercianteId }
      )
      if (errorTicket) throw errorTicket

      const { data: userData } = await supabase.auth.getUser()
      const usuarioId = userData?.user?.id ?? null

      const movimientosParaInsertar: Record<string, unknown>[] = []

      for (const item of cartItems) {
        const stockAntes = stocks[item.id]
        const nuevoStock = stockAntes - item.qty
        const update: Record<string, unknown> = { Stock: nuevoStock }
        if (nuevoStock <= 0) update.Activo = false

        const { error } = await supabase
          .from('productos')
          .update(update)
          .eq('id', item.id)

        if (error) throw error

        movimientosParaInsertar.push({
          comerciante_id: usuarioActual.comercianteId,
          producto_id: item.id,
          tipo: 'venta_pos',
          cantidad: -item.qty,
          stock_antes: stockAntes,
          stock_despues: nuevoStock,
          usuario_id: usuarioId,
        })
      }

      const { error: errorMovimientos } = await supabase
        .from('movimientos_stock')
        .insert(movimientosParaInsertar)

      if (errorMovimientos) throw errorMovimientos

      const ventasParaInsertar = cartItems.map((item) => ({
        comerciante_id: usuarioActual.comercianteId,
        producto_id: item.id,
        cantidad: item.qty,
        total: item.Precio * item.qty,
        canal: 'pos',
        numero_ticket: numeroTicket,
        metodo_pago: metodoPago,
        turno_id: turno.id,
      }))

      const { error: errorVentas } = await supabase
        .from('ventas')
        .insert(ventasParaInsertar)

      if (errorVentas) throw errorVentas

      const nuevosStocks = { ...stocks }
      cartItems.forEach((item) => {
        nuevosStocks[item.id] = Math.max(0, stocks[item.id] - item.qty)
      })
      setStocks(nuevosStocks)

      const agotados = cartItems
        .filter((item) => nuevosStocks[item.id] <= 0)
        .map((item) => item.Nombre)

      if (agotados.length > 0) {
        const webhookUrl = 'https://hook.us2.make.com/fmmme3k7ifb0ycnv8woakw8q2bztqvv8'
        if (webhookUrl) {
          fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productos_agotados: agotados }),
          }).catch(() => {})
        }
      }

      setVentaInfo({
        numeroTicket,
        fecha: new Date(),
        items: cartItems.map((item) => ({
          nombre: item.Nombre,
          qty: item.qty,
          precio: item.Precio,
          subtotal: item.Precio * item.qty,
        })),
        total: totalPrecio,
      })
      setEstado('done')
    } catch {
      setEstado('error')
    }
  }

  function nuevaVenta() {
    setCart({})
    setMetodoPago('efectivo')
    setEstado('idle')
  }

  // --- Pantalla bloqueante: no hay turno abierto ---
  if (!turno) {
    return (
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
          <h1 style={{ fontSize: 18, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 6, textAlign: 'center' }}>
            Abrir turno
          </h1>
          <p style={{ fontSize: 13, color: 'var(--color-text-tertiary)', marginBottom: 20, textAlign: 'center' }}>
            {usuarioActual.comercianteNombre} · {usuarioActual.nombre}
            <br />
            Necesitás abrir un turno antes de poder vender.
          </p>

          <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)' }}>
            Fondo inicial (efectivo en caja)
          </label>
          <input
            type="number"
            min={0}
            value={efectivoInicialInput}
            onChange={(e) => setEfectivoInicialInput(e.target.value)}
            placeholder="0"
            style={{
              width: '100%', marginTop: 6, marginBottom: 12,
              padding: '10px 12px',
              border: '0.5px solid var(--color-border-secondary)',
              borderRadius: 'var(--border-radius-md)',
              fontSize: 14, fontFamily: 'var(--font-sans)',
              color: 'var(--color-text-primary)',
              outline: 'none',
            }}
          />

          {errorTurno