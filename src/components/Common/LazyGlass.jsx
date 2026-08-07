import { lazy, Suspense } from 'react'

const GlassComponent = lazy(() =>
  import('@samasante/liquid-glass').then((mod) => ({ default: mod.Glass }))
)

function FallbackGlass({ children, className = '' }) {
  return (
    <div
      className={className}
      style={{
        background: 'rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(35px) saturate(210%)',
        WebkitBackdropFilter: 'blur(35px) saturate(210%)',
        border: '1px solid rgba(255, 255, 255, 0.16)',
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
