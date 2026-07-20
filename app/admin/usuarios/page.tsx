import { createClient } from '@/lib/supabase-server'
import { getUsuarioActual } from '@/lib/get-usuario-actual'
import { redirect } from 'next/navigation'
import UsuariosPanel from './UsuariosPanel'

export default async function UsuariosPage() {
  const usuarioActual = await getUsuarioActual()

  // Solo el admin puede gestionar usuarios
  if (usuarioActual.rol !== 'admin') {
    redirect('/admin')
  }

  const supabase = await createClient()

  const { data: usuarios } = await supabase
    .from('usuarios')
    .select('id, nombre, email, rol, activo, creado_en')
    .eq('comerciante_id', usuarioActual.comercianteId)
    .order('creado_en', { ascending: false })

  return (
    <UsuariosPanel
      usuarioActual={usuarioActual}
      usuariosIniciales={usuarios || []}
    />
  )
}
