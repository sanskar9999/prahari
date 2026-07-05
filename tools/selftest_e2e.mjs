// Verify the no-mic STT self-test end to end in real Chrome.
import puppeteer from 'puppeteer-core'

const PORT = process.env.PORT || 5199
const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: 'new',
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
})
const page = await browser.newPage()
page.on('pageerror', (e) => console.log('pageerror:', String(e).slice(0, 180)))

await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle2' })
await page.evaluate(() => {
  [...document.querySelectorAll('.nav-item')].find((b) => b.textContent.includes('Scam Shield'))?.click()
})
await new Promise((r) => setTimeout(r, 700))
await page.evaluate(() => {
  [...document.querySelectorAll('button')].find((b) => b.textContent.includes('self-test'))?.click()
})

const deadline = Date.now() + 150000
let last = null
while (Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 3000))
  last = await page.evaluate(() => ({
    err: document.querySelector('.mic-banner.err')?.textContent || null,
    running: !![...document.querySelectorAll('button')].find((b) => b.textContent.includes('Recognising')),
    transcript: document.querySelector('textarea.transcript')?.value.slice(0, 260) || '',
    verdict: document.querySelector('.verdict h2')?.textContent || null,
    risk: document.querySelector('.gauge-num')?.textContent || null,
  }))
  if (last.err) break
  if (!last.running && last.transcript.length > 50) break
}
console.log(JSON.stringify(last, null, 2))
await browser.close()
