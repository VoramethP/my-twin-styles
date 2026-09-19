<script setup lang="ts">
// S04 Onboarding checklist (Q20): ① ท่า ② ชิ้น ③ ลองชุดแรก — ข้ามได้ทุกขั้น
const { data: progress } = await useFetch('/api/me/progress')

const steps = computed(() => [
  { key: 'twin', title: '① สร้าง twin', hint: 'ถ่ายรูปเต็มตัว 1–5 ท่า', done: !!progress.value?.hasTwin, to: '/twin/new?from=onboarding', ready: true },
  { key: 'items', title: '② เพิ่มชิ้น 2 ชิ้น', hint: 'เสื้อ 1 · ท่อนล่าง 1', done: !!progress.value?.hasOutfitItems, to: '', ready: false },
  { key: 'try', title: '③ ลองชุดแรก', hint: 'ให้ AI ลองบน twin ของคุณ', done: !!progress.value?.hasLook, to: '', ready: false },
])
const doneCount = computed(() => steps.value.filter(s => s.done).length)
// ปุ่มทึบได้แค่ขั้นแรกที่ยังไม่เสร็จ (ui-decision §3) ที่เหลือเป็น outline
const currentKey = computed(() => steps.value.find(s => !s.done)?.key)

function skip() {
  try { localStorage.setItem('onboarding-skipped', '1') }
  catch { /* private mode — ข้ามได้แค่รอบนี้ ไม่เป็นไร */ }
  navigateTo('/')
}
</script>

<template>
  <main class="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-4 pb-8">
    <header class="flex flex-col gap-3 pt-2">
      <h1 class="text-xl font-bold">
        เริ่มต้นใช้งาน
      </h1>
      <UProgress :model-value="doneCount" :max="3" size="sm" />
      <p class="text-sm text-muted">
        เสร็จแล้ว {{ doneCount }} จาก 3 ขั้น
      </p>
    </header>

    <ol class="flex flex-col gap-3">
      <li v-for="step in steps" :key="step.key">
        <UCard :ui="{ body: 'flex items-center gap-3 p-4 sm:p-4' }">
          <UIcon
            :name="step.done ? 'i-lucide-circle-check' : 'i-lucide-circle'"
            class="size-6 shrink-0"
            :class="step.done ? 'text-success' : 'text-dimmed'"
          />
          <div class="min-w-0 flex-1">
            <p class="font-semibold">
              {{ step.title }}
            </p>
            <p class="text-sm text-muted">
              {{ step.hint }}
            </p>
          </div>
          <UBadge v-if="step.done" label="เสร็จ" color="success" variant="subtle" />
          <UButton
            v-else-if="step.ready"
            :to="step.to"
            label="เริ่ม"
            :variant="step.key === currentKey ? 'solid' : 'outline'"
          />
          <UBadge v-else label="เร็ว ๆ นี้" color="neutral" variant="outline" />
        </UCard>
      </li>
    </ol>

    <UButton label="ข้ามไปก่อน" variant="ghost" color="neutral" block class="mt-auto" @click="skip" />
    <p class="text-center text-xs text-muted">
      ข้ามได้ แต่ต้องมี twin อย่างน้อย 1 ท่าก่อนจึงจะลองชุดได้
    </p>
  </main>
</template>
