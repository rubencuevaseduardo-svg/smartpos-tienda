import { createClient } from '@/lib/supabase-server'
import { getUsuarioActual } from '@/lib/get-usuario-actual'
import { redirect } from 'next/navigation'
import ComprasPanel from './ComprasPanel'

export default async function ComprasPage() {
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
    <ComprasPanel
      usuarioActual={usuarioActual}
      productosIniciales={productos ?? []}
    />
  )
}