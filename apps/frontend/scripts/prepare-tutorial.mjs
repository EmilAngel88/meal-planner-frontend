import { copyFile, mkdir } from 'node:fs/promises'

const source = new URL('../../../docs/tutorial/', import.meta.url)
const destination = new URL('../public/tutorial-assets/', import.meta.url)
await mkdir(destination, { recursive: true })
for (const name of ['ration-tutorial-ru.mp4', 'ration-tutorial-ru.vtt', 'poster.png']) {
  await copyFile(new URL(name, source), new URL(name, destination))
}
