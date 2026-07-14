import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'

export type UsuarioActual = {
  comercianteId: string
  comercianteNombre: string
  rol: 'admin' | 'vendedor'
  nombre: string
  userId: string
}

/**
 * Determina quién está logueado y con qué rol.
 * - Si es el dueño original del comercio (auth_user_id en `comerciantes`), rol = 'admin'.
 * - Si es un usuario creado en la tabla `usuarios`, usa el rol asignado ahí.
 * Redirige a /admin/login si no hay sesión o el usuario no está vinculado a ningún comercio.
 */
export async function getUsuarioActual(): Promise<UsuarioActual> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/admin/login')

  // Caso A: dueño original del comercio
  const { data: comercioPropio } = await supabase
    .from('comerciantes')
    .select('id, nombre')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (comercioPropio) {
    return {
      comercianteId: comercioPropio.id,
      comercianteNombre: comercioPropio.nombre,
      rol: 'admin',
      nombre: comercioPropio.nombre,
      userId: user.id,
    }
  }

  // Caso B: usuario (vendedor o admin adicional) creado en la tabla `usuarios`
  const { data: usuario } = await supabase
    .from('usuarios')
    .select('comerciante_id, rol, nombre, activo, comerciantes(nombre)')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!usuario || !usuario.activo) {
    redirect('/admin/login')
  }

  const comercianteNombre = Array.isArray(usuario.comerciantes)
    ? (usuario.comerciantes[0] as any)?.nombre ?? ''
    : (usuario.comerciantes as any)?.nombre ?? ''

  return {
    comercianteId: usuario.comerciante_id,
    comercianteNombre,
    rol: usuario.rol as 'admin' | 'vendedor',
    nombre: usuario.nombre,
    userId: user.id,
  }
}