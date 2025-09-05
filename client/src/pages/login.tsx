import { LoginSelector } from "@/components/LoginSelector";

export default function Login() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Sistema de Ventas
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Panel de análisis y gestión de ventas
          </p>
        </div>
        <LoginSelector />
        <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>💡 Cambia entre diferentes usuarios para ver sus paneles específicos</p>
        </div>
      </div>
    </div>
  );
}