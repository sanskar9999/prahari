// Precompute MobileNet v2 embeddings for the FICN training corpus (Node, offline step).
// Same model + version the browser loads, so embeddings are drop-in compatible.
// Output: public/ficn/embeddings.json  [{label, denom, source, file, vec: number[]}]
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import jpeg from 'jpeg-js'
import * as tf from '@tensorflow/tfjs'
import * as mobilenet from '@tensorflow-models/mobilenet'

const HERE = dirname(fileURLToPath(import.meta.url))
const FICN = join(HERE, '..', 'public', 'ficn')

const manifest = JSON.parse(readFileSync(join(FICN, 'manifest.json'), 'utf-8'))
console.log(`Embedding ${manifest.length} images (MobileNet v2 a=0.5, tfjs-CPU)…`)

const net = await mobilenet.load({ version: 2, alpha: 0.5 })

const out = []
let i = 0
for (const item of manifest) {
  const buf = readFileSync(join(FICN, item.file))
  const { data, width, height } = jpeg.decode(buf, { useTArray: true, formatAsRGBA: false })
  const act = tf.tidy(() => {
    const img = tf.tensor3d(data, [height, width, 3], 'int32')
    return net.infer(img, true)
  })
  const vec = Array.from(await act.data()).map((v) => Math.round(v * 1e5) / 1e5)
  act.dispose()
  out.push({ label: item.label, denom: item.denom, source: item.source, file: item.file, vec })
  if (++i % 20 === 0) console.log(`  ${i}/${manifest.length}`)
}

writeFileSync(join(FICN, 'embeddings.json'), JSON.stringify(out))
console.log(`Wrote embeddings.json (${out.length} vectors × ${out[0].vec.length} dims)`)
