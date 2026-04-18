/**
 * CustomColorButton — Self-contained trigger button + CustomColorRequestModal.
 * Drop-in anywhere (tienda header, cotizador header, etc.) and it manages its own open state.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Palette, Sparkles } from 'lucide-react';
import CustomColorRequestModal from './CustomColorRequestModal';

interface Props {
  /** Visual variant: "full" for larger labeled buttons, "compact" for header slots */
  variant?: 'full' | 'compact' | 'icon';
  /** Extra className for outer button */
  className?: string;
}

export default function CustomColorButton({ variant = 'compact', className = '' }: Props) {
  const [open, setOpen] = useState(false);

  const baseAnim = {
    initial: { scale: 0.96, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    whileHover: { scale: 1.03 },
    whileTap: { scale: 0.97 },
    transition: { type: 'spring' as const, stiffness: 300, damping: 22 },
  };

  if (variant === 'icon') {
    return (
      <>
        <motion.button
          {...baseAnim}
          onClick={() => setOpen(true)}
          aria-label="Cotizar color personalizado"
          title="Cotizar color personalizado"
          className={`relative group w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-500 via-pink-500 to-orange-500 flex items-center justify-center shadow-lg shadow-pink-500/25 hover:shadow-pink-500/40 transition-shadow ${className}`}
        >
          <Palette className="w-4 h-4 text-white" />
          <motion.span
            animate={{ scale: [1, 1.25, 1], opacity: [0.8, 1, 0.8] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-amber-400 flex items-center justify-center"
          >
            <Sparkles className="w-2 h-2 text-white" />
          </motion.span>
        </motion.button>
        <CustomColorRequestModal open={open} onClose={() => setOpen(false)} />
      </>
    );
  }

  if (variant === 'compact') {
    return (
      <>
        <motion.button
          {...baseAnim}
          onClick={() => setOpen(true)}
          className={`relative group inline-flex items-center gap-2 px-3 md:px-4 py-2 md:py-2.5 rounded-xl font-semibold text-xs md:text-sm text-white overflow-hidden shadow-md shadow-pink-500/20 hover:shadow-pink-500/40 transition-shadow ${className}`}
          style={{
            background:
              'linear-gradient(120deg, #D946EF 0%, #EC4899 45%, #F97316 100%)',
          }}
        >
          {/* Shine sweep */}
          <motion.span
            aria-hidden
            className="absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-white/0 via-white/40 to-white/0 skew-x-[-20deg]"
            animate={{ x: ['0%', '400%'] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1.2 }}
          />
          <motion.span
            animate={{ rotate: [0, 15, -8, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="relative flex"
          >
            <Palette className="w-4 h-4" />
          </motion.span>
          <span className="relative hidden sm:inline">Color Personalizado</span>
          <span className="relative sm:hidden">Color</span>
          <motion.span
            animate={{ scale: [1, 1.2, 1], opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="relative"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-200" />
          </motion.span>
        </motion.button>
        <CustomColorRequestModal open={open} onClose={() => setOpen(false)} />
      </>
    );
  }

  // Full — larger with subtitle
  return (
    <>
      <motion.button
        {...baseAnim}
        onClick={() => setOpen(true)}
        className={`relative group flex items-center gap-3 px-5 py-3 rounded-2xl text-white overflow-hidden shadow-xl shadow-pink-500/25 ${className}`}
        style={{
          background:
            'linear-gradient(120deg, #D946EF 0%, #EC4899 45%, #F97316 100%)',
        }}
      >
        <motion.span
          aria-hidden
          className="absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-white/0 via-white/50 to-white/0 skew-x-[-20deg]"
          animate={{ x: ['0%', '400%'] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1.5 }}
        />
        <motion.div
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className="relative w-10 h-10 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center shadow-inner"
        >
          <Palette className="w-5 h-5" />
        </motion.div>
        <div className="relative text-left">
          <p className="text-sm font-bold leading-tight">¿Necesitas un color único?</p>
          <p className="text-[11px] opacity-90 font-medium">
            Cotiza tu color personalizado
          </p>
        </div>
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="relative ml-2"
        >
          <Sparkles className="w-5 h-5 text-amber-200" />
        </motion.div>
      </motion.button>
      <CustomColorRequestModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
