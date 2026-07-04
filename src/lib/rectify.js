// Auto crop & rotate: snap a photographed currency note into a precise
// 640x280 landscape box. Pure-JS implementation of the same pipeline as
// tools/prepare_notes.py (OTSU threshold -> largest blob -> min-area rect ->
// perspective warp) — no OpenCV/WASM dependency, runs in milliseconds, offline.

export const NOTE_W = 640
export const NOTE_H = 280
const WORK_MAX = 480 // detection resolution

// ---------- small numeric helpers ----------

function otsuThreshold(hist, total) {
  let sum = 0
  for (let i = 0; i < 256; i++) sum += i * hist[i]
  let sumB = 0, wB = 0, best = 127, maxVar = -1
  for (let t = 0; t < 256; t++) {
    wB += hist[t]
    if (wB === 0) continue
    const wF = total - wB
    if (wF === 0) break
    sumB += t * hist[t]
    const mB = sumB / wB
    const mF = (sum - sumB) / wF
    const v = wB * wF * (mB - mF) * (mB - mF)
    if (v > maxVar) { maxVar = v; best = t }
  }
  return best
}

// two-pass box blur on a 0/1 mask (approximate morphological close/open)
function boxBlurMask(mask, w, h, r) {
  const tmp = new Float32Array(w * h)
  const out = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    let acc = 0
    for (let x = -r; x <= r; x++) acc += mask[y * w + Math.min(w - 1, Math.max(0, x))]
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = acc / (2 * r + 1)
      const xAdd = Math.min(w - 1, x + r + 1)
      const xSub = Math.max(0, x - r)
      acc += mask[y * w + xAdd] - mask[y * w + xSub]
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x]
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / (2 * r + 1)
      const yAdd = Math.min(h - 1, y + r + 1)
      const ySub = Math.max(0, y - r)
      acc += tmp[yAdd * w + x] - tmp[ySub * w + x]
    }
  }
  return out
}

function largestComponent(mask, w, h) {
  const labels = new Int32Array(w * h).fill(-1)
  const stack = new Int32Array(w * h)
  let bestSize = 0, bestId = -1, id = 0
  const sizes = []
  for (let s = 0; s < w * h; s++) {
    if (!mask[s] || labels[s] !== -1) continue
    let top = 0, size = 0
    stack[top++] = s
    labels[s] = id
    while (top > 0) {
      const p = stack[--top]
      size++
      const px = p % w, py = (p / w) | 0
      if (px > 0 && mask[p - 1] && labels[p - 1] === -1) { labels[p - 1] = id; stack[top++] = p - 1 }
      if (px < w - 1 && mask[p + 1] && labels[p + 1] === -1) { labels[p + 1] = id; stack[top++] = p + 1 }
      if (py > 0 && mask[p - w] && labels[p - w] === -1) { labels[p - w] = id; stack[top++] = p - w }
      if (py < h - 1 && mask[p + w] && labels[p + w] === -1) { labels[p + w] = id; stack[top++] = p + w }
    }
    sizes[id] = size
    if (size > bestSize) { bestSize = size; bestId = id }
    id++
  }
  if (bestId === -1) return { points: [], size: 0 }
  const points = []
  for (let p = 0; p < w * h; p++) {
    if (labels[p] === bestId) {
      const px = p % w, py = (p / w) | 0
      // keep only boundary-ish pixels (sparse) to keep the hull cheap
      if (px === 0 || py === 0 || px === w - 1 || py === h - 1 ||
        labels[p - 1] !== bestId || labels[p + 1] !== bestId ||
        labels[p - w] !== bestId || labels[p + w] !== bestId) {
        points.push([px, py])
      }
    }
  }
  return { points, size: bestSize }
}

function convexHull(points) {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const lower = []
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop()
    lower.push(p)
  }
  const upper = []
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i]
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop()
    upper.push(p)
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1))
}

function minAreaRect(hull) {
  let best = null
  for (let i = 0; i < hull.length; i++) {
    const p1 = hull[i], p2 = hull[(i + 1) % hull.length]
    const ex = p2[0] - p1[0], ey = p2[1] - p1[1]
    const len = Math.hypot(ex, ey)
    if (len < 1e-6) continue
    const ux = ex / len, uy = ey / len          // edge direction
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity
    for (const [x, y] of hull) {
      const u = x * ux + y * uy
      const v = -x * uy + y * ux
      if (u < minU) minU = u; if (u > maxU) maxU = u
      if (v < minV) minV = v; if (v > maxV) maxV = v
    }
    const area = (maxU - minU) * (maxV - minV)
    if (!best || area < best.area) best = { area, ux, uy, minU, maxU, minV, maxV }
  }
  if (!best) return null
  const { ux, uy, minU, maxU, minV, maxV } = best
  const corner = (u, v) => [u * ux - v * uy, u * uy + v * ux]
  return [corner(minU, minV), corner(maxU, minV), corner(maxU, maxV), corner(minU, maxV)]
}

function orderCorners(pts) {
  const bySum = [...pts].sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]))
  const byDiff = [...pts].sort((a, b) => (a[1] - a[0]) - (b[1] - b[0]))
  return [bySum[0], byDiff[0], bySum[3], byDiff[3]] // tl, tr, br, bl
}

// homography mapping dst->src (solve 8x8 via Gaussian elimination)
function homography(src, dst) {
  const A = [], b = []
  for (let i = 0; i < 4; i++) {
    const [x, y] = dst[i]      // from (output space)
    const [X, Y] = src[i]      // to (input space)
    A.push([x, y, 1, 0, 0, 0, -x * X, -y * X]); b.push(X)
    A.push([0, 0, 0, x, y, 1, -x * Y, -y * Y]); b.push(Y)
  }
  const n = 8
  for (let col = 0; col < n; col++) {
    let piv = col
    for (let r = col + 1; r < n; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r
    ;[A[col], A[piv]] = [A[piv], A[col]]; [b[col], b[piv]] = [b[piv], b[col]]
    if (Math.abs(A[col][col]) < 1e-10) return null
    for (let r = col + 1; r < n; r++) {
      const f = A[r][col] / A[col][col]
      for (let c = col; c < n; c++) A[r][c] -= f * A[col][c]
      b[r] -= f * b[col]
    }
  }
  const hv = new Array(n)
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r]
    for (let c = r + 1; c < n; c++) s -= A[r][c] * hv[c]
    hv[r] = s / A[r][r]
  }
  return [...hv, 1] // h11..h33
}

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1])

// ---------- main ----------

/**
 * @param {HTMLImageElement|HTMLCanvasElement} src
 * @returns {Promise<{canvas: HTMLCanvasElement, method: 'warp'|'fallback', quad: {x,y}[]|null, workCanvas: HTMLCanvasElement}>}
 */
export async function rectifyNote(src) {
  const srcW = src.naturalWidth || src.width
  const srcH = src.naturalHeight || src.height
  const scale = Math.min(1, WORK_MAX / Math.max(srcW, srcH))
  const w = Math.max(2, Math.round(srcW * scale))
  const h = Math.max(2, Math.round(srcH * scale))

  const work = document.createElement('canvas')
  work.width = w; work.height = h
  const wctx = work.getContext('2d', { willReadFrequently: true })
  wctx.drawImage(src, 0, 0, w, h)
  const { data } = wctx.getImageData(0, 0, w, h)

  // grayscale + histogram
  const gray = new Uint8Array(w * h)
  const hist = new Uint32Array(256)
  for (let i = 0; i < w * h; i++) {
    const g = (data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114) | 0
    gray[i] = g
    hist[g]++
  }
  const T = otsuThreshold(hist, w * h)

  // binary mask (note assumed brighter than surface), then approximate close+open
  let mask = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) mask[i] = gray[i] > T ? 1 : 0
  const blurred = boxBlurMask(mask, w, h, 4)
  const closed = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) closed[i] = blurred[i] > 0.35 ? 1 : 0

  const { points, size } = largestComponent(closed, w, h)
  let quad = null
  if (size >= 0.10 * w * h && points.length >= 4) {
    const hull = convexHull(points)
    const rect = hull.length >= 3 ? minAreaRect(hull) : null
    if (rect) {
      let [tl, tr, br, bl] = orderCorners(rect)
      let width = (dist(tl, tr) + dist(bl, br)) / 2
      let height = (dist(tl, bl) + dist(tr, br)) / 2
      if (height > width) { [tl, tr, br, bl] = [tr, br, bl, tl]; [width, height] = [height, width] } // portrait -> landscape
      // sanity gate: Indian notes are ~2.2:1 — a blob with a very different
      // aspect is a mis-detection (e.g. a bright sub-region of a pre-cropped
      // note); prefer the full-frame fallback in that case
      const aspect = width / Math.max(1, height)
      if (aspect >= 1.7 && aspect <= 3.0) quad = [tl, tr, br, bl]
    }
  }

  const out = document.createElement('canvas')
  out.width = NOTE_W; out.height = NOTE_H
  const octx = out.getContext('2d')

  if (quad) {
    // warp at full source resolution: scale quad back up
    const q = quad.map(([x, y]) => [x / scale, y / scale])
    const Hm = homography(q, [[0, 0], [NOTE_W - 1, 0], [NOTE_W - 1, NOTE_H - 1], [0, NOTE_H - 1]])
    if (Hm) {
      // read source pixels (capped at 1600px for speed)
      const sScale = Math.min(1, 1600 / Math.max(srcW, srcH))
      const sw = Math.round(srcW * sScale), sh = Math.round(srcH * sScale)
      const sc = document.createElement('canvas')
      sc.width = sw; sc.height = sh
      const sctx = sc.getContext('2d', { willReadFrequently: true })
      sctx.drawImage(src, 0, 0, sw, sh)
      const sdata = sctx.getImageData(0, 0, sw, sh).data
      const odata = octx.createImageData(NOTE_W, NOTE_H)
      const [h11, h12, h13, h21, h22, h23, h31, h32] = Hm
      for (let y = 0; y < NOTE_H; y++) {
        for (let x = 0; x < NOTE_W; x++) {
          const d = h31 * x + h32 * y + 1
          let sx = ((h11 * x + h12 * y + h13) / d) * sScale
          let sy = ((h21 * x + h22 * y + h23) / d) * sScale
          sx = Math.min(sw - 1, Math.max(0, sx))
          sy = Math.min(sh - 1, Math.max(0, sy))
          const x0 = sx | 0, y0 = sy | 0
          const x1 = Math.min(sw - 1, x0 + 1), y1 = Math.min(sh - 1, y0 + 1)
          const fx = sx - x0, fy = sy - y0
          const o = (y * NOTE_W + x) * 4
          for (let c = 0; c < 3; c++) {
            const v00 = sdata[(y0 * sw + x0) * 4 + c], v01 = sdata[(y0 * sw + x1) * 4 + c]
            const v10 = sdata[(y1 * sw + x0) * 4 + c], v11 = sdata[(y1 * sw + x1) * 4 + c]
            odata.data[o + c] = (v00 * (1 - fx) + v01 * fx) * (1 - fy) + (v10 * (1 - fx) + v11 * fx) * fy
          }
          odata.data[o + 3] = 255
        }
      }
      octx.putImageData(odata, 0, 0)
      return {
        canvas: out, method: 'warp',
        quad: quad.map(([x, y]) => ({ x, y })), // work-canvas coords for overlay
        workCanvas: work,
      }
    }
  }

  // fallback: rotate portrait to landscape, centre-crop to note aspect
  if (srcH > srcW) {
    const rot = document.createElement('canvas')
    rot.width = srcH; rot.height = srcW
    const rctx = rot.getContext('2d')
    rctx.translate(srcH / 2, srcW / 2)
    rctx.rotate(Math.PI / 2)
    rctx.drawImage(src, -srcW / 2, -srcH / 2)
    const ch = Math.min(rot.height, rot.width * NOTE_H / NOTE_W)
    const cw = ch * NOTE_W / NOTE_H
    octx.drawImage(rot, (rot.width - cw) / 2, (rot.height - ch) / 2, cw, ch, 0, 0, NOTE_W, NOTE_H)
  } else {
    const ch = Math.min(srcH, srcW * NOTE_H / NOTE_W)
    const cw = ch * NOTE_W / NOTE_H
    octx.drawImage(src, (srcW - cw) / 2, (srcH - ch) / 2, cw, ch, 0, 0, NOTE_W, NOTE_H)
  }
  return { canvas: out, method: 'fallback', quad: null, workCanvas: work }
}
