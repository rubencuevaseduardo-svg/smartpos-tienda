import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Comerciante = {
  id: string
  nombre: string
  whatsapp: string
  slug: string
  activo: boolean
}

export type Producto = {
  id: string
  Comerciante_id: string
  Nombre: string
  Precio: number
  Stock: number
  Foto_url: string
  'Descripción_ia': string
  Activo: boolean
  Fecha_carga: string
}
