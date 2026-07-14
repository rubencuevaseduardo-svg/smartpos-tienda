'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase-browser'
import Image from 'next/image'

type Producto = {
  id: string
  Nombre: string
  Precio: number
  Stock: number
  Foto_url: string | null
  Activo: boolean
}

type CartItem = Producto & { qty: number }

export default function POSPanel({
  productos,
  comercianteNombre,
}: {
  productos: Producto[]
  comercianteNombre: string
}) {
  const [cart, setCart] = useState<Record<string, CartItem>>({})
  const [stocks, setStocks] = useState<Record<string, number>>(
    Object.fromEntries(productos.map((p) => [p.id, p.Stock]))
  )
  const [busqueda, setBusqueda] = useState('')
  const [estado, setEstado] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [ventaInfo, setVentaInfo] = useState({ items: 0, total: 0 })

  const supabase = createClient()

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
    if (cartItems.length === 0) return
    setEstado('loading')

    try {
      for (const item of cartItems) {
        const nuevoStock = stocks[item.id] - item.qty
        const update: Record<string, unknown> = { Stock: nuevoStock }
        if (nuevoStock <= 0) update.Activo = false

        const { error } = await supabase
          .from('productos')
          .update(update)
          .eq('id', item.id)

        if (error) throw error
      }

      // Actualizar stocks locales
      const nuevosStocks = { ...stocks }
      cartItems.forEach((item) => {
        nuevosStocks[item.id] = Math.max(0, stocks[item.id] - item.qty)
      })
      setStocks(nuevosStocks)

      // Notificar a Make si hay productos agotados
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

      setVentaInfo({ items: totalItems, total: totalPrecio })
      setEstado('done')
    } catch {
      setEstado('error')
    }
  }

  function nuevaVenta() {
    setCart({})
    setEstado('idle')
  }

  function fmt(n: number) {
    return '$' + Math.round(n).toLocaleString('es-AR')
  }

  // Pantalla de confirmación
  if (estado === 'done') {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-background-tertiary)',
      }}>
        <div style={{
          background: 'var(--color-background-primary)',
          border: '0.5px solid var(--color-border-tertiary)',
          borderRadius: 'var(--border-radius-lg)',
          padding: '48px 40px',
          textAlign: 'center',
          maxWidth: 360,
          width: '100%',
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: '#E1F5EE',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 8 }}>
            Venta registrada
          </h1>
          <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
            {ventaInfo.items} {ventaInfo.items === 1 ? 'ítem' : 'ítems'} · {fmt(ventaInfo.total)}
          </p>
          <p style={{ fontSize: 13, color: 'var(--color-text-tertiary)', marginBottom: 32 }}>
            Stock actualizado en Supabase
          </p>
          <button
            onClick={nuevaVenta}
            style={{
              width: '100%', padding: '11px',
              background: '#1D9E75', color: '#E1F5EE',
              border: 'none', borderRadius: 'var(--border-radius-md)',
              fontSize: 15, fontWeight: 500, cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
            }}>
            Nueva venta
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--color-background-tertiary)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Navbar */}
      <div style={{
        background: 'var(--color-background-primary)',
        borderBottom: '0.5px solid var(--color-border-tertiary)',
        padding: '0 20px',
        height: 52,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>
            SmartPOS
          </span>
          <span style={{ fontSize: 13, color: 'var(--color-text-tertiary)' }}>·</span>
          <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{comercianteNombre}</span>
        </div>
        <a
          href="/admin"
          style={{ fontSize: 13, color: 'var(--color-text-tertiary)', textDecoration: 'none' }}>
          Panel admin →
        </a>
      </div>

      {/* Contenido principal */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '1fr 320px',
        gap: 0,
        maxHeight: 'calc(100vh - 52px)',
      }}>
        {/* Panel izquierdo — catálogo */}
        <div style={{ padding: 20, overflowY: 'auto' }}>
          {/* Búsqueda */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--color-background-primary)',
            border: '0.5px solid var(--color-border-tertiary)',
            borderRadius: 'var(--border-radius-md)',
            padding: '8px 12px',
            marginBottom: 16,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              placeholder="Buscar producto..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={{
                border: 'none', background: 'transparent', outline: 'none',
                fontSize: 14, color: 'var(--color-text-primary)',
                fontFamily: 'var(--font-sans)', width: '100%',
              }}
            />
          </div>

          {/* Grilla de productos */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: 12,
          }}>
            {productosFiltrados.map((p) => {
              const stockActual = stocks[p.id]
              const enCarrito = cart[p.id]?.qty ?? 0
              const sinStock = stockActual === 0
              return (
                <div
                  key={p.id}
                  onClick={() => agregarAlCarrito(p)}
                  style={{
                    background: 'var(--color-background-primary)',
                    border: enCarrito > 0
                      ? '0.5px solid #1D9E75'
                      : '0.5px solid var(--color-border-tertiary)',
                    borderRadius: 'var(--border-radius-lg)',
                    overflow: 'hidden',
                    cursor: sinStock ? 'not-allowed' : 'pointer',
                    opacity: sinStock ? 0.45 : 1,
                    position: 'relative',
                  }}>
                  {/* Imagen */}
                  <div style={{
                    width: '100%', aspectRatio: '1',
                    background: 'var(--color-background-secondary)',
                    position: 'relative',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {p.Foto_url ? (
                      <Image
                        src={p.Foto_url}
                        alt={p.Nombre}
                        fill
                        style={{ objectFit: 'cover' }}
                        sizes="140px"
                      />
                    ) : (
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                        <polyline points="21 15 16 10 5 21"/>
                      </svg>
                    )}
                    {enCarrito > 0 && (
                      <div style={{
                        position: 'absolute', top: 6, right: 6,
                        background: '#1D9E75', color: '#E1F5EE',
                        fontSize: 11, fontWeight: 500,
                        borderRadius: '999px',
                        width: 20, height: 20,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {enCarrito}
                      </div>
                    )}
                  </div>
                  {/* Info */}
                  <div style={{ padding: '8px 10px 10px' }}>
                    <div style={{
                      fontSize: 12, fontWeight: 500,
                      color: 'var(--color-text-primary)',
                      lineHeight: 1.3, marginBottom: 4,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {p.Nombre}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#1D9E75' }}>
                      {fmt(p.Precio)}
                    </div>
                    <div style={{
                      fontSize: 11, marginTop: 2,
                      color: sinStock ? '#E24B4A' : stockActual <= 3 ? '#BA7517' : 'var(--color-text-tertiary)',
                    }}>
                      {sinStock ? 'Sin stock' : stockActual <= 3 ? `¡Últimas ${stockActual}!` : `${stockActual} en stock`}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {productosFiltrados.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-text-tertiary)', fontSize: 14 }}>
              No se encontraron productos
            </div>
          )}
        </div>

        {/* Panel derecho — carrito */}
        <div style={{
          background: 'var(--color-background-primary)',
          borderLeft: '0.5px solid var(--color-border-tertiary)',
          display: 'flex', flexDirection: 'column',
          overflowY: 'auto',
        }}>
          <div style={{
            padding: '14px 16px 10px',
            borderBottom: '0.5px solid var(--color-border-tertiary)',
            flexShrink: 0,
          }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Venta actual
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
              {totalItems} {totalItems === 1 ? 'ítem' : 'ítems'}
            </div>
          </div>

          {/* Items del carrito */}
          <div style={{ flex: 1, padding: '10px 16px', overflowY: 'auto' }}>
            {cartItems.length === 0 ? (
              <div style={{
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                height: '100%', gap: 8,
                color: 'var(--color-text-tertiary)', padding: '40px 0',
              }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                </svg>
                <span style={{ fontSize: 13 }}>Tocá un producto para agregar</span>
              </div>
            ) : (
              cartItems.map((item) => (
                <div key={item.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 0',
                  borderBottom: '0.5px solid var(--color-border-tertiary)',
                }}>
                  <div style={{ flex: 1, fontSize: 13, color: 'var(--color-text-primary)', lineHeight: 1.3 }}>
                    {item.Nombre}
                  </div>
                  {/* Qty control */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      onClick={() => cambiarCantidad(item.id, -1)}
                      style={{
                        width: 24, height: 24,
                        border: '0.5px solid var(--color-border-secondary)',
                        borderRadius: 'var(--border-radius-md)',
                        background: 'var(--color-background-secondary)',
                        cursor: 'pointer', fontSize: 16,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--color-text-primary)',
                        fontFamily: 'var(--font-sans)',
                      }}>
                      −
                    </button>
                    <span style={{ fontSize: 13, fontWeight: 500, minWidth: 16, textAlign: 'center', color: 'var(--color-text-primary)' }}>
                      {item.qty}
                    </span>
                    <button
                      onClick={() => cambiarCantidad(item.id, 1)}
                      style={{
                        width: 24, height: 24,
                        border: '0.5px solid var(--color-border-secondary)',
                        borderRadius: 'var(--border-radius-md)',
                        background: 'var(--color-background-secondary)',
                        cursor: 'pointer', fontSize: 16,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--color-text-primary)',
                        fontFamily: 'var(--font-sans)',
                      }}>
                      +
                    </button>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', minWidth: 70, textAlign: 'right' }}>
                    {fmt(item.Precio * item.qty)}
                  </div>
                  <button
                    onClick={() => quitarItem(item.id)}
                    style={{
                      width: 24, height: 24, border: 'none',
                      background: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--color-text-tertiary)', borderRadius: 'var(--border-radius-md)',
                    }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Footer carrito */}
          <div style={{
            padding: '14px 16px',
            borderTop: '0.5px solid var(--color-border-tertiary)',
            flexShrink: 0,
          }}>
            {estado === 'error' && (
              <div style={{ fontSize: 13, color: '#E24B4A', marginBottom: 10 }}>
                Error al guardar. Intentá de nuevo.
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
              <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Total</span>
              <span style={{ fontSize: 22, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                {fmt(totalPrecio)}
              </span>
            </div>
            <button
              onClick={registrarVenta}
              disabled={cartItems.length === 0 || estado === 'loading'}
              style={{
                width: '100%', padding: 11,
                background: cartItems.length === 0 ? 'var(--color-background-secondary)' : '#1D9E75',
                color: cartItems.length === 0 ? 'var(--color-text-tertiary)' : '#E1F5EE',
                border: 'none', borderRadius: 'var(--border-radius-md)',
                fontSize: 15, fontWeight: 500,
                cursor: cartItems.length === 0 ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-sans)',
              }}>
              {estado === 'loading' ? 'Guardando...' : 'Registrar venta'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
