import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase-server'
import { createClient as createAdminSupabase } from '@supabase/supabase-js'
 
export async function POST(request: NextRequest) {
  try {
    const { nombre, email, password } = await request.json()
 
    if (!nombre || !email || !password) {
      return NextResponse.json(
        { error: 'Faltan datos: nombre, email y contraseña son obligatorios' },
        { status: 400 }
      )
    }
 
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 6 caracteres' },
        { status: 400 }
      )
    }
 
    // 1. Verificar quién está logueado (cliente normal, respeta sesión via cookies)
    const supabase = await createServerSupabase()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
 
    if (userError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }
 
    // 2. Confirmar que quien llama es admin de un comercio
    let comercianteId: string | null = null
 
    // Caso A: es el dueño original (auth_user_id en comerciantes)
    const { data: comercioPropio } = await supabase
      .from('comerciantes')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle()
 
    if (comercioPropio) {
      comercianteId = comercioPropio.id
    } else {
      // Caso B: es un usuario con rol admin dentro de la tabla usuarios
      const { data: usuarioAdmin } = await supabase
        .from('usuarios')
        .select('comerciante_id, rol, activo')
        .eq('auth_user_id', user.id)
        .eq('rol', 'admin')
        .eq('activo', true)
        .maybeSingle()
 
      if (usuarioAdmin) {
        comercianteId = usuarioAdmin.comerciante_id
      }
    }
 
    if (!comercianteId) {
      return NextResponse.json(
        { error: 'No tenés permisos de administrador para crear usuarios' },
        { status: 403 }
      )
    }
 
    // 3. Crear el usuario en Auth + insertar en tabla usuarios (con service_role key)
    const supabaseAdmin = createAdminSupabase(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
 
    const { data: nuevoAuthUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
 
    if (createError || !nuevoAuthUser.user) {
      return NextResponse.json(
        { error: createError?.message || 'No se pudo crear el usuario' },
        { status: 400 }
      )
    }
 
    const { error: insertError } = await supabaseAdmin
      .from('usuarios')
      .insert({
        comerciante_id: comercianteId,
        auth_user_id: nuevoAuthUser.user.id,
        nombre,
        email,
        rol: 'vendedor',
        activo: true,
      })
 
    if (insertError) {
      // Rollback: si falla el insert, borramos el usuario de Auth para no dejar huérfanos
      await supabaseAdmin.auth.admin.deleteUser(nuevoAuthUser.user.id)
      return NextResponse.json(
        { error: 'No se pudo guardar el usuario: ' + insertError.message },
        { status: 400 }
      )
    }
 
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Error en crear-vendedor:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}