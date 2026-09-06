import { createClient } from '@/lib/supabase-server'
import { getUsuarioActual } from '@/lib/get-usuario-actual'
import { notFound } from 'next/navigation'
import VentaDetallePanel from './VentaDetallePanel'

export default async function VentaDetallePage({
  params,
}: {
  params: Promise<{ numero_ticket: string }>
}) {
  const { numero_ticket } = await params
  const numeroTicket = parseInt(numero_ticket, 10)
  const usuarioActual = await getUsuarioActual()
  const supabase = await createClient()

  if (isNaN(numeroTicket)) notFound()

  const { data: lineas } = await supabase
    .from('ventas')
    .select(
      'id, producto_id, cantidad, total, canal, metodo_pago, turno_id, fecha, estado, motivo_anulacion, anulado_por, anulado_en, descuento_tipo, descuento_valor, descuento_monto_aplicado'
    )
    .eq('numero_ticket', numeroTicket)
    .eq('comerciante_id', usuarioActual.comercianteId)
    .order('total', { ascending: false })

  if (!lineas || lineas.length === 0) notFound()

  const productoIds = Array.from(new Set(lineas.map((l) => l.producto_id)))
  const { data: productos } = await supabase
    .from('productos')
    .select('id, Nombre')
    .in('id', productoIds)

  const mapaProductos: Record<string, string> = {}
  for (const p of productos ?? []) mapaProductos[p.id] = p.Nombre

  // Vendedor que hizo la venta, inferido desde el kardex vía numero_ticket
  const { data: movimientoVenta } = await supabase
    .from('movimientos_stock')
    .select('usuario_id')
    .eq('numero_ticket', numeroTicket)
    .eq('comerciante_id', usuarioActual.comercianteId)
    .in('tipo', ['venta_pos', 'venta_whatsapp'])
    .limit(1)
    .maybeSingle()

  const vendedorId = movimientoVenta?.usuario_id ?? null

  const { data: comercianteInfo } = await supabase
    .from('comerciantes')
    .select('auth_user_id, nombre')
    .eq('id', usuarioActual.comercianteId)
    .maybeSingle()

  const { data: usuarios } = await supabase
    .from('usuarios')
    .select('auth_user_id, nombre')
    .eq('comerciante_id', usuarioActual.comercianteId)

  const mapaUsuarios: Record<string, string> = {}
  if (comercianteInfo) mapaUsuarios[comercianteInfo.auth_user_id] = comercianteInfo.nombre
  for (const u of usuarios ?? []) {
    if (u.auth_user_id) mapaUsuarios[u.auth_user_id] = u.nombre
  }

  const primeraLinea = lineas[0]
  let turnoAbierto = false
  if (primeraLinea.turno_id) {
    const { data: turno } = await supabase
      .from('turnos')
      .select('estado')
      .eq('id', primeraLinea.turno_id)
      .maybeSingle()
    turnoAbierto = turno?.estado === 'abierto'
  }

  const esAdmin = usuarioActual.rol === 'admin'
  const yaAnulada = lineas.some((l) => l.estado === 'anulada')
  const esDueño = vendedorId !== null && vendedorId === usuarioActual.userId
  const puedeAnular = !yaAnulada && turnoAbierto && (esAdmin || esDueño)

  return (
    <VentaDetallePanel
      numeroTicket={numeroTicket}
      lineas={lineas.map((l) => ({ ...l, nombreProducto: mapaProductos[l.producto_id] ?? 'Producto' }))}
      vendedorNombre={vendedorId ? mapaUsuarios[vendedorId] ?? 'Usuario' : 'Desconocido'}
      mapaUsuarios={mapaUsuarios}
      comercianteId={usuarioActual.comercianteId}
      usuarioId={usuarioActual.userId}
      esAdmin={esAdmin}
      puedeAnular={puedeAnular}
      turnoAbierto={turnoAbierto}
    />
  )
}
