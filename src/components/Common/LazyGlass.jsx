import { lazy, Suspense } from 'react'

const GlassComponent = lazy(() =>
  import('@samasante/liquid-glass').then((mod) => ({ default: mod.Glass }))
)

function FallbackGlass({ children, className = '' }) {
  return (
    <div
      className={className}
      style={{
        background: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '24px',
      }}
    >
      {children}
    </div>
  )
}

export default function LazyGlass({ children, className, radius, optics }) {
  return (
    <Suspense fallback={<FallbackGlass className={className}>{children}</FallbackGlass>}>
      <GlassComponent className={className} radius={radius} optics={optics}>
        {children}
      </GlassComponent>
    </Suspense>
  )
}
