import { supabase, Comerciante, Producto } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import Image from 'next/image'

interface PageProps {
  params: Promise<{ slug: string }>
}

async function getComerciante(slug: string): Promise<Comerciante | null> {
  const { data, error } = await supabase
    .from('comerciantes')
    .select('*')
    .eq('slug', slug)
    .eq('activo', true)
    .single()
  if (error || !data) return null
  return data
}

async function getProductos(comercianteId: string): Promise<Producto[]> {
  const { data, error } = await supabase
    .from('productos')
    .select('*')
    .eq('Comerciante_id', comercianteId)
    .eq('Activo', true)
    .order('Fecha_carga', { ascending: false })
  if (error || !data) return []
  return data
}

function formatPrecio(precio: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
  }).format(precio)
}

function buildWhatsAppUrl(whatsapp: string, producto: Producto): string {
  const numero = whatsapp.replace(/\D/g, '')
  const mensaje = encodeURIComponent(
    `Hola! Vi tu tienda online y me interesa el producto: *${producto.Nombre}* (${formatPrecio(producto.Precio)}). ¿Tenés disponibilidad?`
  )
  return `https://wa.me/${numero}?text=${mensaje}`
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params
  const comerciante = await getComerciante(slug)
  if (!comerciante) return { title: 'Tienda no encontrada' }
  return {
    title: `${comerciante.nombre} — Tienda Online`,
    description: `Catálogo de productos de ${comerciante.nombre}. Consultá por WhatsApp.`,
  }
}

export default async function TiendaPage({ params }: PageProps) {
  const { slug } = await params
  const comerciante = await getComerciante(slug)
  if (!comerciante) notFound()

  const productos = await getProductos(comerciante.id)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
            {comerciante.nombre.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="font-bold text-gray-900 text-lg leading-tight">
              {comerciante.nombre}
            </h1>
            <p className="text-xs text-gray-500">Catálogo online</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 py-6">
        {productos.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-5xl mb-4">📦</p>
            <p className="text-lg font-medium">Este comerciante aún no tiene productos cargados.</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-4">
              {productos.length} {productos.length === 1 ? 'producto' : 'productos'} disponibles
            </p>
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {productos.map((producto) => (
                <ProductoCard
                  key={producto.id}
                  producto={producto}
                  whatsapp={comerciante.whatsapp}
                />
              ))}
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-8 text-xs text-gray-400 mt-8">
        Tienda creada con{' '}
        <span className="font-semibold text-emerald-600">SmartPOS</span>
      </footer>
    </div>
  )
}

function ProductoCard({
  producto,
  whatsapp,
}: {
  producto: Producto
  whatsapp: string
}) {
  const whatsappUrl = buildWhatsAppUrl(whatsapp, producto)
  const sinStock = producto.Stock === 0

  return (
    <div className={`bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 flex flex-col ${sinStock ? 'opacity-60' : ''}`}>
      {/* Imagen */}
      <div className="relative aspect-square bg-gray-100">
        {producto.Foto_url ? (
          <Image
            src={producto.Foto_url}
            alt={producto.Nombre}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 50vw, 300px"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 text-4xl">
            📷
          </div>
        )}
        {sinStock && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="bg-white text-gray-700 text-xs font-semibold px-2 py-1 rounded-full">
              Sin stock
            </span>
          </div>
        )}
        {producto.Stock > 0 && producto.Stock <= 3 && (
          <div className="absolute top-2 right-2">
            <span className="bg-amber-400 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              ¡Últimas {producto.Stock}!
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col flex-1 gap-2">
        <div>
          <h2 className="font-semibold text-gray-900 text-sm leading-tight line-clamp-2">
            {producto.Nombre}
          </h2>
          {producto['Descripción_ia'] && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
              {producto['Descripción_ia']}
            </p>
          )}
        </div>

        <div className="mt-auto">
          <p className="text-emerald-600 font-bold text-base">
            {formatPrecio(producto.Precio)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {producto.Stock > 0
              ? `Stock: ${producto.Stock} unid.`
              : 'Sin stock'}
          </p>
        </div>

        
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`mt-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold transition-colors ${
            sinStock
              ? 'bg-gray-100 text-gray-400 pointer-events-none'
              : 'bg-emerald-500 text-white active:bg-emerald-600'
          }`}
        >
          <WhatsAppIcon />
          Consultar
        </a>
      </div>
    </div>
  )
}

function WhatsAppIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.554 4.118 1.526 5.845L.057 23.882l6.197-1.624A11.933 11.933 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.932a9.931 9.931 0 01-5.051-1.378l-.361-.214-3.738.98.997-3.648-.235-.374A9.913 9.913 0 012.07 12C2.07 6.533 6.533 2.07 12 2.07c5.467 0 9.93 4.463 9.93 9.93 0 5.467-4.463 9.932-9.93 9.932z" />
    </svg>
  )
}
