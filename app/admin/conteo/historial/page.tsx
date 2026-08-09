import { createClient } from '@/lib/supabase-server'
import { getUsuarioActual } from '@/lib/get-usuario-actual'
import { redirect } from 'next/navigation'
import HistorialConteoPanel from './HistorialConteoPanel'

export default async function HistorialConteoPage() {
  const usuarioActual = await getUsuarioActual()

  if (usuarioActual.rol !== 'admin') {
    redirect('/admin')
  }

  const supabase = await createClient()

  const { data: conteos } = await supabase
    .from('conteos_fisicos')
    .select('*')
    .eq('comerciante_id', usuarioActual.comercianteId)
    .order('fecha', { ascending: false })

  const conteoIds = (conteos ?? []).map(c => c.id)

  const { data: detalles } = conteoIds.length
    ? await supabase
        .from('conteo_detalle')
        .select('*, productos(Nombre)')
        .in('conteo_id', conteoIds)
    : { data: [] }

  // Mapa auth_user_id -> nombre, para mostrar quién hizo cada conteo
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
    <HistorialConteoPanel
      conteos={conteos ?? []}
      detalles={detalles ?? []}
      mapaUsuarios={mapaUsuarios}
    />
  )
}