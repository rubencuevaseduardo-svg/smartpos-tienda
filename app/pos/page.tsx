import { createClient } from '@/lib/supabase-server'
import { getUsuarioActual } from '@/lib/get-usuario-actual'
import POSPanel from './POSPanel'

export default async function POSPage() {
  const usuarioActual = await getUsuarioActual()
  const supabase = await createClient()

  const { data: productos } = await supabase
    .from('productos')
    .select('id, Nombre, Precio, Stock, Foto_url, Activo')
    .eq('Comerciante_id', usuarioActual.comercianteId)
    .eq('Activo', true)
    .order('Nombre')

  return (
    <POSPanel
      productos={productos || []}
      usuarioActual={usuarioActual}
    />
  )
}
