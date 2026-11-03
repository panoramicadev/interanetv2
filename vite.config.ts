import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { execSync } from "child_process";

let commitHash = 'unknown';
let commitDate = 'unknown';

try {
  commitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).toString().trim();
  commitDate = execSync('git log -1 --format="%cd" --date=format:"%d/%m/%y %H:%M"', { encoding: 'utf-8' }).toString().trim();
} catch (e) {
  // Not a git repository, use defaults
}

export default defineConfig({
  define: {
    __COMMIT_HASH__: JSON.stringify(commitHash),
    __COMMIT_DATE__: JSON.stringify(commitDate),
  },
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Función (no objeto): con el objeto, Rollup metía react-dom y el helper de
        // carga dentro de vendor-pdf/vendor-radix, y cualquier página pública terminaba
        // descargando el PDF entero. Así cada librería cae solo en su chunk.
        manualChunks(id: string) {
          // El helper de import() dinámico lo usan todos: va con react, no en el chunk que toque
          if (id.includes('vite/preload-helper') || id.includes('commonjsHelpers')) return 'vendor-react';
          if (!id.includes('node_modules')) return;
          const es = (pkgs: string[]) => pkgs.some((p) => id.includes(`/node_modules/${p}/`));
          // Base que usa toda página (incluida la tienda): si no se fija acá, Rollup la mete
          // en el chunk de gráficos (clsx lo usa recharts) y la tienda descarga los gráficos.
          if (es(['react', 'react-dom', 'scheduler', 'clsx', 'tailwind-merge', 'class-variance-authority'])) return 'vendor-react';
          if (es(['recharts', 'chart.js', 'react-chartjs-2'])) return 'vendor-charts';
          if (es(['jspdf', 'jspdf-autotable', '@react-pdf'])) return 'vendor-pdf';
          // Radix, lucide-react, date-fns, zod y framer-motion quedan sueltos: así cada página trae
          // solo los íconos y funciones que usa (forzarlos juntos sumaba ~80 KB a la tienda).
        },
      },
    },
  },
  optimizeDeps: {
    // Pre-bundle heavy deps so Vite doesn't re-transform them on every page load
    include: [
      'react', 'react-dom',
      '@tanstack/react-query',
      'wouter',
      'lucide-react',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-tabs',
      '@radix-ui/react-select',
      '@radix-ui/react-popover',
      '@radix-ui/react-toast',
      '@radix-ui/react-tooltip',
      '@radix-ui/react-accordion',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-switch',
      '@radix-ui/react-scroll-area',
      'date-fns',
      'zod',
      'framer-motion',
      'recharts',
    ],
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
    // Pre-warm the most visited pages so they load instantly
    warmup: {
      clientFiles: [
        './src/pages/tienda.tsx',
        './src/pages/dashboard.tsx',
        './src/App.tsx',
        './src/hooks/useAuth.ts',
        './src/contexts/CartContext.tsx',
      ],
    },
  },
});
