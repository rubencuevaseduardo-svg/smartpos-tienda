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
  comerciante_id: string
  nombre: string
  precio: number
  stock: number
  foto_url: string
  descripcion_ia: string
  activo: boolean
  fecha_carga: string
}
