import { useEffect, useRef } from 'react'

const COLS = 64
const ROWS = 26

function hash(i: number, j: number): number {
  const seed = Math.sin(i * 127.1 + j * 311.7) * 43758.5453
  return seed - Math.floor(seed)
}

function noise(x: number, y: number): number {
  const i = Math.floor(x)
  const j = Math.floor(y)
  let fx = x - i
  let fy = y - j
  fx = fx * fx * (3 - 2 * fx)
  fy = fy * fy * (3 - 2 * fy)
  const top = hash(i, j) * (1 - fx) + hash(i + 1, j) * fx
  const bottom = hash(i, j + 1) * (1 - fx) + hash(i + 1, j + 1) * fx
  return top * (1 - fy) + bottom * fy
}

function color(t: number): string {
  const cool = [47, 107, 79]
  const warm = [226, 176, 64]
  const hot = [200, 66, 27]
  const pair = t < 0.5 ? [cool, warm, t / 0.5] : [warm, hot, (t - 0.5) / 0.5]
  const [from, to, k] = pair as [number[], number[], number]
  const rgb = from.map((channel, index) => Math.round(channel + (to[index] - channel) * k))
  return `rgb(${rgb.join(',')})`
}

export function RiskMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const probeRef = useRef<HTMLParagraphElement>(null)
  const cells = useRef<number[][]>([])

  useEffect(() => {
    const node = canvasRef.current
    if (!node) return
    const canvas: HTMLCanvasElement = node
    const context = canvas.getContext('2d')
    if (!context) return
    const field: number[][] = []
    for (let row = 0; row < ROWS; row += 1) {
      field[row] = []
      for (let col = 0; col < COLS; col += 1) {
        const mixed = noise(col / 9, row / 7) * 0.65 + noise(col / 3, row / 3) * 0.35
        field[row][col] = Math.min(1, Math.max(0, (mixed - 0.25) * 1.7))
      }
    }
    cells.current = field

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let frame = 0

    function paint(time: number) {
      if (!context) return
      const cellWidth = canvas.width / COLS
      const cellHeight = canvas.height / ROWS
      for (let row = 0; row < ROWS; row += 1) {
        for (let col = 0; col < COLS; col += 1) {
          const base = field[row][col]
          const breathe = reduced ? 0 : Math.sin(time / 900 + col * 0.15) * 0.045 * base
          const flicker = reduced ? 0 : Math.sin(time / 280 + row * 0.7 + col) * 0.03 * base
          const value = Math.min(1, Math.max(0, base + breathe + flicker))
          context.fillStyle = color(value)
          context.fillRect(col * cellWidth, row * cellHeight, cellWidth - 1, cellHeight - 1)
        }
      }
      if (!reduced) frame = window.requestAnimationFrame(paint)
    }

    frame = window.requestAnimationFrame(paint)

    function onMove(event: MouseEvent) {
      const bounds = canvas.getBoundingClientRect()
      const col = Math.floor(((event.clientX - bounds.left) / bounds.width) * COLS)
      const row = Math.floor(((event.clientY - bounds.top) / bounds.height) * ROWS)
      const value = cells.current[row]?.[col]
      if (probeRef.current && value !== undefined) {
        probeRef.current.textContent = `Pixel (${row}, ${col}) — fire_risk simulé : ${value.toFixed(2)}`
      }
    }

    function onLeave() {
      if (probeRef.current) {
        probeRef.current.textContent = 'Carte illustrative (valeurs simulées) — survolez-la pour lire un pixel.'
      }
    }

    canvas.addEventListener('mousemove', onMove)
    canvas.addEventListener('mouseleave', onLeave)
    return () => {
      window.cancelAnimationFrame(frame)
      canvas.removeEventListener('mousemove', onMove)
      canvas.removeEventListener('mouseleave', onLeave)
    }
  }, [])

  return (
    <div>
      <div className="map-frame">
        <canvas
          ref={canvasRef}
          width={1040}
          height={420}
          className="block h-auto w-full cursor-crosshair"
          aria-label="Carte illustrative de risque d'incendie"
        />
        <span className="map-scan" aria-hidden="true" />
      </div>
      <p ref={probeRef} className="mt-2 min-h-6 text-sm text-muted">
        Carte illustrative (valeurs simulées) — survolez-la pour lire un pixel.
      </p>
    </div>
  )
}
