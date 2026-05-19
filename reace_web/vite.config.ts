import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

const securityHeaders = {
  "Content-Security-Policy": "default-src 'self' data: blob: http: https: ws: wss: 'unsafe-inline' 'unsafe-eval'; frame-ancestors 'none';",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
};

function getNodeModulePackageName(id: string) {
  const normalized = id.replace(/\\/g, '/');
  const [, modulePath] = normalized.split('/node_modules/');
  if (!modulePath) return null;

  const [first, second] = modulePath.split('/');
  if (!first) return null;
  return first.startsWith('@') && second ? `${first}/${second}` : first;
}

function getUniverEngineRenderDataChunk(id: string) {
  const marker = '/@univerjs/engine-render/lib/es/';
  const [, renderModulePath] = id.split(marker);
  if (!renderModulePath || renderModulePath === 'index.js' || !renderModulePath.endsWith('.js')) {
    return null;
  }

  const fileName = renderModulePath.split('/').pop() ?? '';
  const firstLetter = fileName[0]?.toLowerCase();

  if (!firstLetter || firstLetter < 'a' || firstLetter > 'z') {
    return 'univer-render-data-misc';
  }
  if (firstLetter <= 'c') return 'univer-render-data-a-c';
  if (firstLetter <= 'g') return 'univer-render-data-d-g';
  if (firstLetter <= 'l') return 'univer-render-data-h-l';
  if (firstLetter <= 'n') return 'univer-render-data-m-n';
  if (firstLetter <= 'r') return 'univer-render-data-o-r';
  return 'univer-render-data-s-z';
}

export default defineConfig({
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    chunkSizeWarningLimit: 5000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalized = id.replace(/\\/g, '/');
          if (id.includes('vite/preload-helper')) {
            return 'vite-helper';
          }
          if (!normalized.includes('/node_modules/')) return;

          const packageName = getNodeModulePackageName(normalized);
          if (!packageName) return;

          if (normalized.includes('/@univerjs/preset-sheets-core/') && normalized.includes('/locales/')) {
            return 'univer-locales';
          }
          if (packageName === '@univerjs/preset-sheets-core') {
            return 'univer-sheets-core';
          }
          if (packageName === '@univerjs/presets') {
            return 'univer-presets';
          }
          if (
            packageName === '@univerjs/engine-render' &&
            normalized.includes('/lib/es/') &&
            normalized.endsWith('.js')
          ) {
            const renderDataChunk = getUniverEngineRenderDataChunk(normalized);
            if (renderDataChunk) return renderDataChunk;
          }
          if (packageName === '@univerjs/engine-formula') {
            return 'univer-engine-formula';
          }
          if (packageName === '@univerjs/design') {
            return 'univer-design';
          }
          if (packageName === '@univerjs/ui') {
            return 'univer-ui-core';
          }
          if (packageName === '@univerjs/docs-ui') {
            return 'univer-docs-ui';
          }
          if (packageName === '@univerjs/sheets-ui') {
            return 'univer-sheets-ui';
          }
          if (packageName === '@univerjs/sheets-formula-ui' || packageName === '@univerjs/sheets-numfmt-ui') {
            return 'univer-sheets-feature-ui';
          }
          if (
            packageName === '@univerjs/sheets' ||
            packageName === '@univerjs/sheets-formula' ||
            packageName === '@univerjs/sheets-numfmt'
          ) {
            return 'univer-sheets';
          }
          if (packageName === '@univerjs/core') {
            return 'univer-core';
          }
          if (packageName === '@univerjs/engine-render') {
            return 'univer-render-core';
          }
          if (packageName === '@univerjs/docs') {
            return 'univer-docs-core';
          }
          if (packageName === '@univerjs/network' || packageName === '@univerjs/rpc') {
            return 'univer-network';
          }
          if (packageName === 'rxjs') {
            return 'rxjs-vendor';
          }
          if (packageName === 'react-router' || packageName === 'react-dom' || packageName === 'react') {
            return 'react-vendor';
          }
          if (packageName === 'motion' || packageName === 'framer-motion') {
            return 'motion-vendor';
          }
          if (packageName === 'recharts') {
            return 'chart-vendor';
          }
          if (packageName === 'react-dnd' || packageName === 'react-dnd-html5-backend') {
            return 'dnd-vendor';
          }
          if (packageName === 'lucide-react') {
            return 'icon-vendor';
          }
          if (packageName === 'sonner') {
            return 'toast-vendor';
          }
          if (
            packageName.startsWith('@radix-ui/') ||
            packageName === 'vaul'
          ) {
            return 'radix-vendor';
          }
          if (
            packageName.startsWith('@mui/') ||
            packageName.startsWith('@emotion/')
          ) {
            return 'mui-vendor';
          }
          if (
            packageName === 'class-variance-authority' ||
            packageName === 'clsx' ||
            packageName === 'tailwind-merge'
          ) {
            return 'ui-vendor';
          }
        },
      },
    },
  },
  server: {
    headers: securityHeaders,
  },
  preview: {
    headers: securityHeaders,
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
