import { createClient } from '@/lib/supabase-server'
import { getUsuarioActual } from '@/lib/get-usuario-actual'
import { redirect } from 'next/navigation'
import ConteoPanel from './ConteoPanel'

export default async function ConteoPage() {
  const usuarioActual = await getUsuarioActual()

  if (usuarioActual.rol !== 'admin') {
    redirect('/admin')
  }

  const supabase = await createClient()
  const { data: productos } = await supabase
    .from('productos')
    .select('*')
    .eq('Comerciante_id', usuarioActual.comercianteId)
    .eq('Activo', true)
    .order('Nombre', { ascending: true })

  return (
    <ConteoPanel
      usuarioActual={usuarioActual}
      productos={productos ?? []}
    />
  )
}