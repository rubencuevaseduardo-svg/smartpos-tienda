import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import AdminPanel from './AdminPanel'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/admin/login')

  const { data: comerciante } = await supabase
    .from('comerciantes')
    .select('*')
    .eq('auth_user_id', user.id)
    .single()

  if (!comerciante) redirect('/admin/login')

  const { data: productos } = await supabase
    .from('productos')
    .select('*')
    .eq('Comerciante_id', comerciante.id)
    .order('Fecha_carga', { ascending: false })

  return <AdminPanel comerciante={comerciante} productos={productos || []} />
}