"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

function generarSlug(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export default function RegistroPage() {
  const router = useRouter();
  const supabase = createClient();

  const [form, setForm] = useState({
    nombre_negocio: "",
    nombre_contacto: "",
    whatsapp: "",
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const slug = generarSlug(form.nombre_negocio);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError("");
  };

  const handleSubmit = async () => {
    setError("");

    if (!form.nombre_negocio || !form.nombre_contacto || !form.whatsapp || !form.email || !form.password) {
      setError("Completá todos los campos.");
      return;
    }
    if (form.password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (!form.whatsapp.startsWith("+")) {
      setError("El WhatsApp debe incluir el código de país. Ej: +5492644457243");
      return;
    }

    setLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
      });

      if (authError) throw new Error(authError.message);
      if (!authData.user) throw new Error("No se pudo crear el usuario.");

      const trialHasta = new Date();
      trialHasta.setDate(trialHasta.getDate() + 14);

      const { error: dbError } = await supabase.from("comerciantes").insert({
        nombre: form.nombre_negocio,
        nombre_contacto: form.nombre_contacto,
        whatsapp: form.whatsapp,
        email: form.email,
        slug: slug,
        activo: true,
        plan: "trial",
        trial_hasta: trialHasta.toISOString(),
        onboarding_canal: "web",
        onboarding_completado: true,
        auth_user_id: authData.user.id,
      });

      if (dbError) throw new Error(dbError.message);

      await fetch(process.env.NEXT_PUBLIC_MAKE_WEBHOOK_BIENVENIDA!, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre_contacto: form.nombre_contacto,
          nombre_negocio: form.nombre_negocio,
          whatsapp: form.whatsapp,
        }),
      });

      router.push("/admin");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Ocurrió un error inesperado.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">SmartPOS</h1>
          <p className="text-gray-500 mt-2">Creá tu tienda gratis — 14 días sin límites</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del negocio</label>
            <input name="nombre_negocio" type="text" placeholder="Ej: Ropa Ceci" value={form.nombre_negocio} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            {slug && (
              <p className="text-xs text-gray-400 mt-1">Tu tienda: <span className="text-gray-600 font-medium">smartpos-tienda.vercel.app/{slug}</span></p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tu nombre</label>
            <input name="nombre_contacto" type="text" placeholder="Ej: Cecilia" value={form.nombre_contacto} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
            <input name="whatsapp" type="tel" placeholder="+5492644457243" value={form.whatsapp} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            <p className="text-xs text-gray-400 mt-1">Incluí el código de país. Ej: +549 (Argentina)</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input name="email" type="email" placeholder="tu@email.com" value={form.email} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
            <input name="password" type="password" placeholder="Mínimo 6 caracteres" value={form.password} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</p>
          )}
          <button onClick={handleSubmit} disabled={loading} className="w-full bg-gray-900 text-white rounded-lg py-3 text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? "Creando tu tienda..." : "Crear mi tienda gratis →"}
          </button>
          <p className="text-center text-sm text-gray-400">
            ¿Ya tenés cuenta?{" "}
            <a href="/admin/login" className="text-gray-900 font-medium hover:underline">Iniciá sesión</a>
          </p>
        </div>
        <p className="text-center text-xs text-gray-400 mt-6">Sin tarjeta de crédito. Sin compromisos. Cancelás cuando querés.</p>
      </div>
    </main>
  );
}
