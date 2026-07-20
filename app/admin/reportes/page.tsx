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
    .select('id, Nombre, Stock, Categoria, Activo')
    .eq('Comerciante_id', usuarioActual.comercianteId)

  return (
    <ReportesPanel
      usuarioActual={usuarioActual}
      productosIniciales={productos || []}
    />
  )
}