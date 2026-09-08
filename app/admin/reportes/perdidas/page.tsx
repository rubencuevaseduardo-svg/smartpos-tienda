import { createClient } from '@/lib/supabase-server'
import { getUsuarioActual } from '@/lib/get-usuario-actual'
import { redirect } from 'next/navigation'
import PanelPerdidasPanel from './PanelPerdidasPanel'

export default async function PerdidasPage() {
  const usuarioActual = await getUsuarioActual()

  if (usuarioActual.rol !== 'admin') {
    redirect('/admin')
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('panel_perdidas', {
    p_comerciante_id: usuarioActual.comercianteId,
  })

  if (error) {
    return (
      <div className="max-w-5xl mx-auto p-4 sm:p-6">
        <h1 className="text-2xl font-bold mb-4">Panel de Pérdidas</h1>
        <div className="text-red-600 bg-red-50 border border-red-200 rounded p-3">
          No se pudo cargar el panel de pérdidas. Probá de nuevo más tarde.
        </div>
      </div>
    )
  }

  return <PanelPerdidasPanel data={data} />
}
