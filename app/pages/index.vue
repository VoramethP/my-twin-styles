<script setup lang="ts">
// S05 Lookbook — ยังเป็น empty state ชั่วคราว · ผู้ใช้ใหม่ที่ยังไม่ข้าม onboarding ถูกพาไป S04 (Q20)
const { data: progress } = await useFetch('/api/me/progress')

onMounted(() => {
  let skipped = false
  try { skipped = localStorage.getItem('onboarding-skipped') === '1' }
  catch { /* อ่านไม่ได้ = ถือว่ายังไม่ข้าม */ }
  if (progress.value && !progress.value.hasLook && !skipped) navigateTo('/onboarding')
})
</script>

<template>
  <main class="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
    <h1 class="text-xl font-bold">
      ลุคของฉัน
    </h1>
    <p class="text-muted">
      ยังไม่มีลุค — เลือกชิ้นแล้วให้ AI ลองบน twin ของคุณ
    </p>
    <UButton v-if="!progress?.hasTwin" to="/twin/new" label="สร้าง twin ก่อน" />
    <UButton v-else label="ลองชุดแรกของคุณ" disabled />
  </main>
</template>
