import { createClient } from '@/lib/supabase-server'
import { getUsuarioActual } from '@/lib/get-usuario-actual'
import { redirect, notFound } from 'next/navigation'
import HistorialProductoPanel from './HistorialProductoPanel'

export default async function HistorialProductoPage({
  params,
}: {
  params: { id: string }
}) {
  const { id } = params
  const usuarioActual = await getUsuarioActual()

  if (usuarioActual.rol !== 'admin') {
    redirect('/admin')
  }

  const supabase = await createClient()

  const { data: producto } = await supabase
    .from('productos')
    .select('id, Nombre, Stock, Precio, Foto_url')
    .eq('id', id)
    .eq('Comerciante_id', usuarioActual.comercianteId)
    .maybeSingle()

  if (!producto) notFound()

  const { data: movimientos } = await supabase
    .from('movimientos_stock')
    .select('id, tipo, cantidad, stock_antes, stock_despues, usuario_id, motivo, fecha')
    .eq('producto_id', id)
    .eq('comerciante_id', usuarioActual.comercianteId)
    .order('fecha', { ascending: false })

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

  return (
    <HistorialProductoPanel
      producto={producto}
      movimientos={movimientos ?? []}
      mapaUsuarios={mapaUsuarios}
    />
  )
}