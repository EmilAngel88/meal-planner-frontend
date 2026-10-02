import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { defineEventHandler, getRequestHeader, getRequestURL, sendStream, setResponseHeaders, setResponseStatus, createError } from 'h3'
import { tutorialByteRange } from '../utils/tutorial-range'

let videoPath: string | undefined
async function findVideo() {
  if (videoPath) return videoPath
  const folders = process.env.NODE_ENV === 'production'
    ? ['.output/public', 'apps/frontend/.output/public']
    : ['public', 'apps/frontend/public']
  for (const folder of folders) {
    const candidate = resolve(folder, 'tutorial-assets/ration-tutorial-ru.mp4')
    if (await stat(candidate).then(file => file.isFile()).catch(() => false)) return (videoPath = candidate)
  }
  throw createError({ statusCode: 503, statusMessage: 'Tutorial video unavailable' })
}

export default defineEventHandler(async event => {
  if (getRequestURL(event).pathname !== '/tutorial-video.mp4') return
  if (event.method !== 'GET' && event.method !== 'HEAD') {
    setResponseHeaders(event, { Allow: 'GET, HEAD' })
    throw createError({ statusCode: 405 })
  }
  const path = await findVideo()
  const file = await stat(path)
  const etag = `"${file.size.toString(16)}-${Math.trunc(file.mtimeMs).toString(16)}"`
  setResponseHeaders(event, { 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=0, must-revalidate', ETag: etag, 'Last-Modified': file.mtime.toUTCString() })
  if (getRequestHeader(event, 'if-none-match') === etag) { setResponseStatus(event, 304); return '' }
  const ifRange = getRequestHeader(event, 'if-range')
  const rangeHeader = event.method === 'HEAD' || (ifRange && ifRange !== etag && ifRange !== file.mtime.toUTCString()) ? undefined : getRequestHeader(event, 'range')
  const range = tutorialByteRange(rangeHeader, file.size)
  if (!range) {
    setResponseStatus(event, 416)
    setResponseHeaders(event, { 'Content-Range': `bytes */${file.size}`, 'Content-Length': '0' })
    return ''
  }
  setResponseHeaders(event, { 'Content-Length': String(range.end - range.start + 1) })
  if (rangeHeader) { setResponseStatus(event, 206); setResponseHeaders(event, { 'Content-Range': `bytes ${range.start}-${range.end}/${file.size}` }) }
  if (event.method === 'HEAD') return ''
  return sendStream(event, createReadStream(path, range))
})
