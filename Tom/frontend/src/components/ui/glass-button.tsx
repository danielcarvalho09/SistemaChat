import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

const glassButtonVariants = cva(
  "relative inline-flex items-center justify-center cursor-pointer gap-2 whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 outline-none",
  {
    variants: {
      variant: {
        default: "text-white",
        destructive: "text-red-400",
        outline: "text-white",
        ghost: "text-white",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 text-xs px-3",
        lg: "h-10 px-6",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

interface GlassButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof glassButtonVariants> {
  asChild?: boolean;
}

export const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ className, variant, size, asChild = false, children, ...props }, ref) => {
    return (
      <>
        {/* Hidden SVG Filter */}
        <svg className='hidden'>
          <defs>
            <filter
              id='glass-blur-button'
              x='0'
              y='0'
              width='100%'
              height='100%'
              filterUnits='objectBoundingBox'
            >
              <feTurbulence
                type='fractalNoise'
                baseFrequency='0.003 0.007'
                numOctaves='1'
                result='turbulence'
              />
              <feDisplacementMap
                in='SourceGraphic'
                in2='turbulence'
                scale='200'
                xChannelSelector='R'
                yChannelSelector='G'
              />
            </filter>
          </defs>
        </svg>

        <motion.button
          ref={ref}
          className={cn(
            "relative overflow-hidden rounded-lg",
            glassButtonVariants({ variant, size, className })
          )}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          {...props}
        >
          {/* Bend Layer (Backdrop blur with distortion) */}
          <div
            className="absolute inset-0 backdrop-blur-sm z-0"
            style={{
              filter: 'url(#glass-blur-button)',
            }}
          />

          {/* Face Layer (Main shadow and glow) */}
          <div
            className='absolute inset-0 z-10'
            style={{
              boxShadow: '0 4px 4px rgba(0, 0, 0, 0.15), 0 0 12px rgba(0, 0, 0, 0.08), 0 0 24px rgba(255, 255, 255, 0.1)',
            }}
          />

          {/* Edge Layer (Inner highlights) */}
          <div
            className='absolute inset-0 z-20 rounded-lg'
            style={{
              boxShadow: 'inset 2px 2px 2px 0 rgba(255, 255, 255, 0.35), inset -2px -2px 2px 0 rgba(255, 255, 255, 0.35)',
            }}
          />

          {/* Background */}
          <div className="absolute inset-0 bg-white/10 z-5" />

          {/* Content */}
          <div className="relative z-30 flex items-center justify-center gap-2">
            {children}
          </div>
        </motion.button>
      </>
    );
  }
);

GlassButton.displayName = "GlassButton";
