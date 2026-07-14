import { createClient } from '@/lib/supabase-server'
import { getUsuarioActual } from '@/lib/get-usuario-actual'
import AdminPanel from './AdminPanel'

export default async function AdminPage() {
  const usuarioActual = await getUsuarioActual()
  const supabase = await createClient()

  const { data: productos } = await supabase
    .from('productos')
    .select('*')
    .eq('Comerciante_id', usuarioActual.comercianteId)
    .order('Fecha_carga', { ascending: false })

  return (
    <AdminPanel
      usuarioActual={usuarioActual}
      productos={productos || []}
    />
  )
}
