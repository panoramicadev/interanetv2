import loadingIcon from "@assets/loading-icon.png";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeClasses = {
  sm: "w-8 h-8",
  md: "w-12 h-12",
  lg: "w-16 h-16",
  xl: "w-24 h-24"
};

export function LoadingSpinner({ size = "md", className = "" }: LoadingSpinnerProps) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <img
        src={loadingIcon}
        alt="Cargando..."
        className={`${sizeClasses[size]} animate-spin`}
        style={{ animationDuration: "1s" }}
      />
    </div>
  );
}

interface LoadingOverlayProps {
  message?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

export function LoadingOverlay({ message = "Procesando...", size = "lg" }: LoadingOverlayProps) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center">
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-2xl flex flex-col items-center gap-4">
        <LoadingSpinner size={size} />
        {message && (
          <p className="text-lg font-medium text-gray-900 dark:text-white">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
