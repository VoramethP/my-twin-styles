import type { PoseMetrics } from '#shared/pose'

const MAX_LONG_SIDE = 2048 // ย่อก่อนอัปโหลด — ใหญ่กว่านี้ไม่ช่วย AI แต่ช้าและเปลือง storage

// อ่านรูปที่ถ่าย/เลือก → ย่อเป็น JPEG + วัดขนาดและความสว่าง (เช็กที่ไม่ต้องใช้ AI — shared/pose.ts)
export async function preparePoseImage(file: File): Promise<{ blob: Blob, metrics: PoseMetrics, previewUrl: string }> {
  const bitmap = await createImageBitmap(file)
  const metrics: PoseMetrics = { width: bitmap.width, height: bitmap.height, brightness: measureBrightness(bitmap) }
  const scale = Math.min(1, MAX_LONG_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('แปลงรูปไม่สำเร็จ'))), 'image/jpeg', 0.9))
  return { blob, metrics, previewUrl: URL.createObjectURL(blob) }
}

function measureBrightness(bitmap: ImageBitmap) {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(bitmap, 0, 0, size, size)
  const { data } = ctx.getImageData(0, 0, size, size)
  let sum = 0
  for (let i = 0; i < data.length; i += 4) sum += 0.2126 * data[i]! + 0.7152 * data[i + 1]! + 0.0722 * data[i + 2]!
  return sum / (size * size) / 255
}
