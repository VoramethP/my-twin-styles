<script setup lang="ts">
// ปลายทางหลังล็อกอิน (@nuxtjs/supabase callback) — มี user แล้วพาไปหน้าแรก
const user = useSupabaseUser()
watch(user, (u) => { if (u) navigateTo('/') }, { immediate: true })
</script>

<template>
  <main class="flex min-h-dvh items-center justify-center p-6 text-muted">
    กำลังเข้าสู่ระบบ…
  </main>
</template>
