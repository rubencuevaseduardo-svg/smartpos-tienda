import { createClient } from '@/lib/supabase-server'
import { getUsuarioActual } from '@/lib/get-usuario-actual'
import { redirect } from 'next/navigation'
import ReportesPanel from './ReportesPanel'

export default async function ReportesPage() {
  const usuarioActual = await getUsuarioActual()

  if (usuarioActual.rol !== 'admin') {
    redirect('/admin')
  }

  const supabase = await createClient()
  const { data: productos } = await supabase
    .from('productos')
    .select('id, Nombre, Stock, Categoria, Activo, Precio, costo_actual')
    .eq('Comerciante_id', usuarioActual.comercianteId)

  // Mapa usuario_id -> nombre, para mostrar quién hizo cada ajuste/movimiento
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
    <ReportesPanel
      usuarioActual={usuarioActual}
      productosIniciales={productos || []}
      mapaUsuarios={mapaUsuarios}
    />
  )
}
