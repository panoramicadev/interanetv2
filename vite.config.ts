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
        manualChunks: {
          // Split heavy vendor libraries into separate cacheable chunks
          'vendor-react': ['react', 'react-dom'],
          'vendor-charts': ['recharts', 'chart.js', 'react-chartjs-2'],
          'vendor-radix': [
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
          ],
          'vendor-pdf': ['jspdf', 'jspdf-autotable', '@react-pdf/renderer'],
          'vendor-utils': ['date-fns', 'zod', 'framer-motion', 'lucide-react'],
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
