// End-to-end Live Mic verification in real Chrome:
// a REAL scam robocall WAV is piped in as a fake microphone, Vosk transcribes
// it offline in-browser, and the scam classifier must react — no human needed.
// Usage: node tools/mic_e2e_test.mjs   (dev server must be running on :5199 or pass PORT)
import puppeteer from 'puppeteer-core'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const WAV = join(HERE, '..', 'public', 'audio', 'real', 'case1.wav')
const PORT = process.env.PORT || 5199

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: 'new',
  args: [
    '--no-sandbox',
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    `--use-file-for-fake-audio-capture=${WAV}`,
    '--autoplay-policy=no-user-gesture-required',
  ],
})
const page = await browser.newPage()
page.on('console', (msg) => {
  if (/micStt|error/i.test(msg.text())) console.log(`${msg.type()}: ${msg.text().slice(0, 180)}`)
})

await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle2' })

// open Scam Shield
await page.evaluate(() => {
  [...document.querySelectorAll('.nav-item')].find((b) => b.textContent.includes('Scam Shield'))?.click()
})
await new Promise((r) => setTimeout(r, 800))

// press Live Mic
await page.evaluate(() => {
  [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Live Mic'))?.click()
})

// wait for transcript + risk to appear (model load + recognition)
const deadline = Date.now() + 150000
let last = null
while (Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 3000))
  last = await page.evaluate(() => ({
    banner: document.querySelector('.mic-banner')?.textContent.slice(0, 80) || null,
    err: document.querySelector('.mic-banner.err')?.textContent || null,
    transcript: document.querySelector('textarea.transcript')?.value.slice(0, 300) || '',
    verdict: document.querySelector('.verdict h2')?.textContent || null,
    risk: document.querySelector('.gauge-num')?.textContent || null,
  }))
  if (last.err) { console.log('ERROR:', last.err); break }
  // wait for the full call to be spoken: exit on elevated verdict or long transcript
  if (last.verdict && !/LOW RISK/.test(last.verdict)) break
  if (last.transcript.length > 400) break
}
console.log('---- RESULT ----')
console.log(JSON.stringify(last, null, 2))
await browser.close()
