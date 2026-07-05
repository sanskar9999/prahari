// In-browser currency-note classifier: MobileNet v2 embeddings + k-NN
// (Teachable-Machine approach). Training-corpus embeddings are PRECOMPUTED
// offline with the identical model (tools/embed_notes.mjs), so startup is
// instant; only the uploaded photo runs a live MobileNet forward pass here.
import * as tf from '@tensorflow/tfjs'
import * as mobilenet from '@tensorflow-models/mobilenet'
import * as knnClassifier from '@tensorflow-models/knn-classifier'

let statePromise = null

// SwiftShader/llvmpipe (software WebGL) makes tfjs shader compilation block the
// main thread for minutes — fall back to the CPU backend there. A single
// MobileNet forward pass on CPU is 1–2 s, fine for one photo at a time.
async function pickBackend() {
  try {
    const gl = document.createElement('canvas').getContext('webgl2') ||
      document.createElement('canvas').getContext('webgl')
    const dbg = gl?.getExtension('WEBGL_debug_renderer_info')
    const renderer = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : ''
    if (!gl || /swiftshader|llvmpipe|software|basic render/i.test(renderer)) {
      console.debug('[noteClassifier] software GL detected — using CPU backend')
      await tf.setBackend('cpu')
    }
  } catch { /* default backend */ }
  await tf.ready()
  console.debug('[noteClassifier] tf backend:', tf.getBackend())
}

export function loadClassifier(onProgress) {
  if (!statePromise) {
    statePromise = (async () => {
      onProgress?.(0, 1)
      await pickBackend()
      const [net, embeddings] = await Promise.all([
        mobilenet.load({ version: 2, alpha: 0.5 }),
        fetch(`${import.meta.env.BASE_URL}ficn/embeddings.json`).then((r) => {
          if (!r.ok) throw new Error('embeddings.json missing — run tools/embed_notes.mjs')
          return r.json()
        }),
      ])
      const knn = knnClassifier.create()       // genuine vs fake
      const knnDenom = knnClassifier.create()  // denomination (genuine samples only)
      embeddings.forEach((e, i) => {
        const t = tf.tensor2d([e.vec])
        knn.addExample(t, e.label)
        if (e.label === 'genuine' && e.denom !== 'unknown') knnDenom.addExample(t.clone(), e.denom)
        t.dispose()
        onProgress?.(i + 1, embeddings.length)
      })
      return { net, knn, knnDenom, count: embeddings.length }
    })()
    statePromise.catch(() => { statePromise = null })
  }
  return statePromise
}

export async function classifyNote(canvasOrImg) {
  const { net, knn, knnDenom } = await loadClassifier()
  const act = tf.tidy(() => net.infer(tf.browser.fromPixels(canvasOrImg), true))
  const res = await knn.predictClass(act, 7)
  let denom = null
  if (res.label === 'genuine' && knnDenom.getNumClasses() > 0) {
    denom = (await knnDenom.predictClass(act, 5)).label
  }
  act.dispose()
  return { label: res.label, confidences: res.confidences, denom }
}
