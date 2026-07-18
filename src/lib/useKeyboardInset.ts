import { useEffect, useState } from 'react'

/**
 * Height (px) of the on-screen keyboard overlapping the layout viewport.
 * 0 when closed, when visualViewport is unsupported, or when the platform
 * already resizes the layout viewport for the keyboard (Android with
 * interactive-widget=resizes-content). iOS instead shrinks only the visual
 * viewport and scrolls the page up under the keyboard; we undo that scroll
 * so bottom-anchored sheets can compensate with a plain bottom offset.
 */
export function useKeyboardInset(enabled: boolean): number {
  const [inset, setInset] = useState(0)

  useEffect(() => {
    if (!enabled) return
    const vv = window.visualViewport
    if (!vv) return

    const update = () => {
      if (vv.offsetTop > 0) window.scrollTo(0, 0)
      const overlap = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      // below ~100px it's browser chrome (URL bar), not a keyboard
      setInset(overlap < 100 ? 0 : Math.round(overlap))
    }

    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      setInset(0)
    }
  }, [enabled])

  return inset
}
