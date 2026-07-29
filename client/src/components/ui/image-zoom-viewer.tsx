import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, RotateCw, Move, Home } from "lucide-react";

interface ImageZoomViewerProps {
  src: string;
  alt?: string;
  className?: string;
}

// Route external URLs through server proxy to avoid CORS
// Also rewrites old Supabase domains to the current one
const OLD_SUPABASE_HOSTS = [
  'madsymjqjzvuyvmuoyej.supabase.co',
];

export function getProxiedUrl(url: string): string {
  if (!url) return url;
  // Relative URLs are internal — no proxy needed
  if (url.startsWith('/') || url.startsWith('blob:') || url.startsWith('data:')) return url;
  
  // Rewrite old Supabase domains to the current one
  let fixedUrl = url;
  for (const oldHost of OLD_SUPABASE_HOSTS) {
    if (fixedUrl.includes(oldHost)) {
      fixedUrl = fixedUrl.replace(oldHost, 'xyqnvkievatlsqestjuf.supabase.co');
    }
  }
  
  // External URLs (Supabase, S3, etc.) → proxy through the server
  try {
    const parsed = new URL(fixedUrl);
    if (['http:', 'https:'].includes(parsed.protocol)) {
      return `/api/proxy-file?url=${encodeURIComponent(fixedUrl)}`;
    }
  } catch { /* not a valid URL, return as-is */ }
  return fixedUrl;
}
export function ImageZoomViewer({ src, alt = "Image", className = "" }: ImageZoomViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [imageSrc, setImageSrc] = useState(() => getProxiedUrl(src));
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // When src changes, reset state and clean up blob URLs
  useEffect(() => {
    const proxied = getProxiedUrl(src);
    setImageSrc(proxied);
    setIsLoading(true);
    setHasError(false);
    return () => {
      if (imageSrc.startsWith('blob:')) {
        URL.revokeObjectURL(imageSrc);
      }
    };
  }, [src]);

  // If the direct <img> load fails, try fetch as blob
  const handleImageError = useCallback(async () => {
    // If we already tried proxy, try raw fetch as last resort
    if (imageSrc !== src && !imageSrc.startsWith('blob:')) {
      try {
        const response = await fetch(imageSrc, { credentials: 'include' });
        if (response.ok) {
          const blob = await response.blob();
          const blobUrl = URL.createObjectURL(blob);
          setImageSrc(blobUrl);
          return;
        }
      } catch (e) {
        console.warn('[ImageZoomViewer] Proxy blob fallback also failed:', e);
      }
    }
    // Try direct URL as last fallback
    if (imageSrc !== src && !imageSrc.startsWith('blob:')) {
      try {
        const response = await fetch(src, { mode: 'cors', credentials: 'omit' });
        if (response.ok) {
          const blob = await response.blob();
          const blobUrl = URL.createObjectURL(blob);
          setImageSrc(blobUrl);
          return;
        }
      } catch (e) {
        console.warn('[ImageZoomViewer] Direct blob fallback also failed:', e);
      }
    }
    setHasError(true);
    setIsLoading(false);
  }, [src, imageSrc]);

  const MIN_SCALE = 1;
  const MAX_SCALE = 4;
  const SCALE_STEP = 0.5;

  const handleZoomIn = useCallback(() => {
    setScale(prev => Math.min(prev + SCALE_STEP, MAX_SCALE));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale(prev => {
      const newScale = Math.max(prev - SCALE_STEP, MIN_SCALE);
      if (newScale === MIN_SCALE) {
        setPosition({ x: 0, y: 0 });
      }
      return newScale;
    });
  }, []);

  const handleReset = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setRotation(0);
  }, []);

  const handleRotate = useCallback(() => {
    setRotation(prev => (prev + 90) % 360);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    }
  }, [scale, position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || scale <= 1) return;
    
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    
    const container = containerRef.current;
    if (container) {
      const rect = container.getBoundingClientRect();
      const maxOffset = (rect.width * (scale - 1)) / 2;
      const maxOffsetY = (rect.height * (scale - 1)) / 2;
      
      setPosition({
        x: Math.max(-maxOffset, Math.min(maxOffset, newX)),
        y: Math.max(-maxOffsetY, Math.min(maxOffsetY, newY)),
      });
    }
  }, [isDragging, dragStart, scale]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (scale > 1 && e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y,
      });
    }
  }, [scale, position]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging || scale <= 1 || e.touches.length !== 1) return;
    
    const newX = e.touches[0].clientX - dragStart.x;
    const newY = e.touches[0].clientY - dragStart.y;
    
    const container = containerRef.current;
    if (container) {
      const rect = container.getBoundingClientRect();
      const maxOffset = (rect.width * (scale - 1)) / 2;
      const maxOffsetY = (rect.height * (scale - 1)) / 2;
      
      setPosition({
        x: Math.max(-maxOffset, Math.min(maxOffset, newX)),
        y: Math.max(-maxOffsetY, Math.min(maxOffsetY, newY)),
      });
    }
  }, [isDragging, dragStart, scale]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    const handleGlobalMouseUp = () => setIsDragging(false);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('touchend', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('touchend', handleGlobalMouseUp);
    };
  }, []);

  return (
    <div className={`space-y-2 ${className}`}>
      <div 
        ref={containerRef}
        className="relative overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800 select-none flex items-center justify-center"
        style={{ minHeight: '200px', maxHeight: '65vh' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {isLoading && !hasError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {hasError ? (
          <div className="flex flex-col items-center gap-2 text-gray-500">
            <p className="text-sm">No se pudo cargar la imagen</p>
            <a href={src} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-sm underline">
              Abrir en nueva pestaña
            </a>
          </div>
        ) : (
          <img
            src={imageSrc}
            alt={alt}
            draggable={false}
            className="max-w-full max-h-[65vh] object-contain transition-transform duration-150"
            style={{
              transform: `rotate(${rotation}deg) scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
              cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
              display: isLoading ? 'none' : 'block',
            }}
            onLoad={() => setIsLoading(false)}
            onError={handleImageError}
            data-testid="img-zoom-viewer"
          />
        )}
        
        {scale > 1 && (
          <div className="absolute top-2 right-2 bg-black/50 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
            <Move className="h-3 w-3" />
            Arrastra para mover
          </div>
        )}
      </div>
      
      <div className="flex items-center justify-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={handleZoomOut}
          disabled={scale <= MIN_SCALE}
          data-testid="button-zoom-out"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        
        <span className="text-sm font-medium min-w-[60px] text-center">
          {Math.round(scale * 100)}%
        </span>
        
        <Button
          size="sm"
          variant="outline"
          onClick={handleZoomIn}
          disabled={scale >= MAX_SCALE}
          data-testid="button-zoom-in"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        
        <Button
          size="sm"
          variant="outline"
          onClick={handleRotate}
          title="Rotar imagen 90°"
          data-testid="button-rotate"
        >
          <RotateCw className="h-4 w-4" />
        </Button>
        
        <Button
          size="sm"
          variant="ghost"
          onClick={handleReset}
          disabled={scale === 1 && position.x === 0 && position.y === 0 && rotation === 0}
          title="Restablecer vista"
          data-testid="button-zoom-reset"
        >
          <Home className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
