<script setup lang="ts">
import { MAX_POSES, POSE_BLOCKS, POSE_WARNINGS, type PoseBlock, type PoseMetrics, type PoseWarning } from '#shared/pose'

// S02 ถ่ายท่า + S03 ผลเช็กรูปท่า
// ใช้กล้องของระบบผ่าน <input capture> แทนกล้องสดใน wireframe: ได้รูปความละเอียดเต็มและใช้ได้ทุกเครื่อง
// จึงแสดงกรอบ guide ก่อนเปิดกล้องแทนการซ้อนบนภาพสด
const route = useRoute()
const supabase = useSupabaseClient()
const user = useSupabaseUser()
const toast = useToast()
const fromOnboarding = route.query.from === 'onboarding'
const doneTo = fromOnboarding ? '/onboarding' : '/'

type Phase = 'guide' | 'checking' | 'result' | 'saved'
const phase = ref<Phase>('guide')
const fileInput = ref<HTMLInputElement>()
const previewUrl = ref<string>()
const uploadedPath = ref<string>()
const metrics = ref<PoseMetrics>()
const blocks = ref<PoseBlock[]>([])
const warnings = ref<PoseWarning[]>([])
const total = ref(0)
const saving = ref(false)

function pick(camera: boolean) {
  if (!fileInput.value) return
  // capture เปิดกล้องหลังบนมือถือ · ไม่ใส่ = ให้เลือกจากคลังรูป
  if (camera) fileInput.value.setAttribute('capture', 'environment')
  else fileInput.value.removeAttribute('capture')
  fileInput.value.click()
}

async function onFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  ;(e.target as HTMLInputElement).value = ''
  if (!file || !user.value) return
  phase.value = 'checking'
  try {
    const img = await preparePoseImage(file)
    previewUrl.value = img.previewUrl
    metrics.value = img.metrics
    // path = <user_id>/… — storage RLS ให้เขียนได้เฉพาะโฟลเดอร์ตัวเอง (ADR-0003)
    const path = `${user.value.sub}/${crypto.randomUUID()}.jpg`
    const { error } = await supabase.storage.from('poses').upload(path, img.blob, { contentType: 'image/jpeg' })
    if (error) throw error
    uploadedPath.value = path
    await submit(false)
  }
  catch (err) {
    phase.value = 'guide'
    toast.add({ title: 'อัปโหลดรูปไม่สำเร็จ', description: (err as Error).message, color: 'error' })
  }
}

async function submit(acceptWarnings: boolean) {
  if (!uploadedPath.value || !metrics.value) return
  saving.value = true
  try {
    const res = await $fetch('/api/poses', {
      method: 'POST',
      body: { storagePath: uploadedPath.value, ...metrics.value, acceptWarnings },
    })
    blocks.value = res.blocks
    warnings.value = res.warnings
    if (res.saved) {
      total.value = res.total
      phase.value = 'saved'
    }
    else {
      phase.value = 'result'
    }
  }
  catch (err) {
    const e = err as { data?: { message?: string }, message: string }
    toast.add({ title: 'บันทึกท่าไม่สำเร็จ', description: e.data?.message ?? e.message, color: 'error' })
    phase.value = 'result'
  }
  finally {
    saving.value = false
  }
}

// ถ่ายใหม่ = ลบไฟล์ที่ไม่ใช้ทิ้งทันที ไม่ให้รูปตัวผู้ใช้ค้างใน storage
async function retake() {
  if (uploadedPath.value && phase.value !== 'saved') {
    await supabase.storage.from('poses').remove([uploadedPath.value])
  }
  reset()
}

function reset() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = uploadedPath.value = metrics.value = undefined
  blocks.value = []
  warnings.value = []
  phase.value = 'guide'
}

onBeforeUnmount(() => { if (previewUrl.value) URL.revokeObjectURL(previewUrl.value) })
</script>

<template>
  <main class="mx-auto flex min-h-dvh max-w-md flex-col gap-4 p-4 pb-8">
    <header class="flex items-center gap-2">
      <UButton :to="doneTo" icon="i-lucide-x" variant="ghost" color="neutral" aria-label="ปิด" />
      <h1 class="text-lg font-bold">
        {{ phase === 'result' ? 'ตรวจรูป' : 'ถ่ายท่า' }}
      </h1>
    </header>

    <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="onFile">

    <!-- S02: guide ก่อนเปิดกล้อง -->
    <template v-if="phase === 'guide'">
      <div class="relative flex aspect-[3/4] items-center justify-center overflow-hidden rounded-2xl bg-elevated">
        <div class="flex h-4/5 flex-col items-center gap-2" aria-hidden="true">
          <div class="size-14 rounded-full border-2 border-dashed border-muted" />
          <div class="w-28 flex-1 rounded-3xl border-2 border-dashed border-muted" />
        </div>
        <p class="absolute bottom-3 text-sm text-muted">
          วางตัวให้อยู่ในกรอบ
        </p>
      </div>
      <ul class="flex flex-col gap-1 text-sm text-muted">
        <li>• ยืนตรง เห็นเต็มตัวตั้งแต่หัวถึงเท้า</li>
        <li>• พื้นหลังเรียบ แสงพอ มีแค่คุณคนเดียวในรูป</li>
        <li>• ใส่ชุดพอดีตัว จะได้สัดส่วนที่ถูกต้อง</li>
      </ul>
      <div class="mt-auto flex flex-col gap-3">
        <UButton label="เปิดกล้อง" icon="i-lucide-camera" size="lg" block @click="pick(true)" />
        <UButton label="เลือกจากคลังรูป" icon="i-lucide-image" variant="outline" size="lg" block @click="pick(false)" />
        <p class="text-center text-xs text-muted">
          🔒 รูปท่าเห็นได้เฉพาะคุณ · มีได้ไม่เกิน {{ MAX_POSES }} ท่า
        </p>
      </div>
    </template>

    <!-- กำลังอัปโหลด/ตรวจ: skeleton รูปทรงเดียวกับผลที่จะมา (ui-decision §4) -->
    <template v-else-if="phase === 'checking'">
      <USkeleton class="mx-auto aspect-[3/4] w-1/2 rounded-xl" />
      <USkeleton class="h-12 w-full" />
      <p class="text-center text-sm text-muted">
        กำลังตรวจรูป…
      </p>
    </template>

    <!-- S03: ผลเช็ก -->
    <template v-else-if="phase === 'result'">
      <img :src="previewUrl" alt="รูปที่ถ่าย" class="mx-auto aspect-[3/4] w-1/2 rounded-xl object-cover">
      <div class="flex flex-col gap-2">
        <UAlert v-for="b in blocks" :key="b" :title="POSE_BLOCKS[b]" color="error" variant="subtle" icon="i-lucide-circle-x" />
        <UAlert v-for="w in warnings" :key="w" :title="POSE_WARNINGS[w]" color="warning" variant="subtle" icon="i-lucide-triangle-alert" />
      </div>
      <div class="mt-auto flex flex-col gap-3">
        <template v-if="blocks.length">
          <UButton label="ถ่ายใหม่" size="lg" block @click="retake" />
        </template>
        <template v-else>
          <UButton label="ใช้รูปนี้" size="lg" block :loading="saving" @click="submit(true)" />
          <UButton label="ถ่ายใหม่" variant="outline" size="lg" block :disabled="saving" @click="retake" />
        </template>
      </div>
    </template>

    <!-- บันทึกแล้ว -->
    <template v-else>
      <img :src="previewUrl" alt="ท่าที่บันทึก" class="mx-auto aspect-[3/4] w-1/2 rounded-xl object-cover">
      <UAlert :title="`บันทึกท่าแล้ว (${total}/${MAX_POSES})`" color="success" variant="subtle" icon="i-lucide-circle-check" />
      <div class="mt-auto flex flex-col gap-3">
        <UButton :to="doneTo" label="ถัดไป" size="lg" block />
        <UButton v-if="total < MAX_POSES" label="เพิ่มท่าอีก" variant="outline" size="lg" block @click="reset" />
      </div>
    </template>
  </main>
</template>
