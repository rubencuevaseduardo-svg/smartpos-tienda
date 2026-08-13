import { getUsuarioActual } from '@/lib/get-usuario-actual'
import NotasCreditoPanel from './NotasCreditoPanel'

export default async function NotasCreditoPage() {
  const usuarioActual = await getUsuarioActual()
  // Admin y vendedor pueden emitir notas de crédito — sin restricción de rol acá
  return <NotasCreditoPanel usuarioActual={usuarioActual} />
}