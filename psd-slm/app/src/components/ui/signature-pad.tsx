'use client'

import { useRef, useEffect, useCallback } from 'react'
import SignaturePad from 'signature_pad'

interface SignaturePadComponentProps {
  onSignatureChange: (dataUrl: string | null) => void
  label?: string
}

export function SignaturePadComponent({ onSignatureChange, label }: SignaturePadComponentProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const padRef = useRef<SignaturePad | null>(null)
  const lastWidthRef = useRef<number>(0)

  const resizeCanvas = useCallback((force?: boolean) => {
    const canvas = canvasRef.current
    if (!canvas || !padRef.current) return

    const rect = canvas.getBoundingClientRect()

    // Skip resize if width hasn't changed — avoids clearing on mobile
    // scroll (address bar show/hide only changes height)
    if (!force && lastWidthRef.current === rect.width) return
    lastWidthRef.current = rect.width

    // Save existing stroke data before resize
    const pad = padRef.current
    const hadSignature = !pad.isEmpty()
    const strokeData = hadSignature ? pad.toData() : null

    const ratio = Math.max(window.devicePixelRatio || 1, 1)
    canvas.width = rect.width * ratio
    canvas.height = rect.height * ratio
    const ctx = canvas.getContext('2d')
    if (ctx) ctx.scale(ratio, ratio)

    pad.clear()

    // Restore strokes after resize
    if (strokeData) {
      pad.fromData(strokeData)
      onSignatureChange(pad.toDataURL('image/png'))
    } else {
      onSignatureChange(null)
    }
  }, [onSignatureChange])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const pad = new SignaturePad(canvas, {
      backgroundColor: 'rgb(255, 255, 255)',
      penColor: 'rgb(30, 41, 59)',
    })

    pad.addEventListener('endStroke', () => {
      if (pad.isEmpty()) {
        onSignatureChange(null)
      } else {
        onSignatureChange(pad.toDataURL('image/png'))
      }
    })

    padRef.current = pad
    resizeCanvas(true)

    const handleResize = () => resizeCanvas()
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      pad.off()
    }
  }, [resizeCanvas, onSignatureChange])

  const handleClear = () => {
    padRef.current?.clear()
    onSignatureChange(null)
  }

  return (
    <div>
      <div className="relative rounded-lg border-2 border-dashed border-slate-200 bg-white">
        <canvas
          ref={canvasRef}
          className="w-full cursor-crosshair touch-none"
          style={{ height: 160 }}
        />
        <div className="pointer-events-none absolute bottom-3 left-4 right-4 border-b border-slate-200" />
        <span className="pointer-events-none absolute bottom-4 left-4 text-[10px] text-slate-300 uppercase tracking-wider">
          {label || 'Sign here'}
        </span>
      </div>
      <div className="flex justify-end mt-1.5">
        <button
          type="button"
          onClick={handleClear}
          className="rounded px-2 py-1 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
        >
          Clear
        </button>
      </div>
    </div>
  )
}
