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
  Categoria: string | null
  costo_actual: number | null
}

export type Compra = {
  id: string
  comerciante_id: string
  proveedor: string | null
  fecha: string
  total: number
  usuario_id: string
}

export type CompraDetalle = {
  id: string
  compra_id: string
  producto_id: string | null
  cantidad: number
  costo_unitario: number
  subtotal: number
}
export type NotaCredito = {
  id: string
  comerciante_id: string
  numero_ticket_original: number
  numero_nota_credito: number
  motivo: string
  usuario_id: string
  total: number
  fecha: string
}

export type NotaCreditoDetalle = {
  id: string
  nota_credito_id: string
  venta_id: string | null
  producto_id: string | null
  cantidad: number
  precio_unitario: number
  subtotal: number
}