import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import POSPanel from './POSPanel'

export default async function POSPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  const { data: comerciante } = await supabase
    .from('comerciantes')
    .select('id, nombre')
    .eq('auth_user_id', user.id)
    .single()

  if (!comerciante) redirect('/admin/login')

  const { data: productos } = await supabase
    .from('productos')
    .select('id, Nombre, Precio, Stock, Foto_url, Activo')
    .eq('Comerciante_id', comerciante.id)
    .eq('Activo', true)
    .order('Nombre')

  return (
    <POSPanel
      productos={productos || []}
      comercianteNombre={comerciante.nombre}
    />
  )
}