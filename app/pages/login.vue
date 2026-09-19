<script setup lang="ts">
// S01 เข้าสู่ระบบ — Google หรือ magic link · ครั้งแรก = สมัครให้อัตโนมัติ (ADR-0002)
const supabase = useSupabaseClient()
const toast = useToast()
const email = ref('')
const sending = ref(false)
const redirectTo = computed(() => `${useRuntimeConfig().public.siteUrl}/auth/confirm`)

async function withGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectTo.value } })
  if (error) toast.add({ title: 'เข้าสู่ระบบไม่สำเร็จ', description: error.message, color: 'error' })
}

async function withMagicLink() {
  sending.value = true
  const { error } = await supabase.auth.signInWithOtp({ email: email.value, options: { emailRedirectTo: redirectTo.value } })
  sending.value = false
  if (error) toast.add({ title: 'ส่งลิงก์ไม่สำเร็จ', description: error.message, color: 'error' })
  else toast.add({ title: 'ส่งลิงก์แล้ว', description: 'เปิดอีเมลแล้วกดลิงก์เพื่อเข้าสู่ระบบ', color: 'success' })
}
</script>

<template>
  <main class="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 p-6">
    <div class="text-center">
      <h1 class="text-2xl font-bold">
        my-twin-styles
      </h1>
      <p class="text-muted">
        ลองชุดบนตัวคุณ ก่อนแต่งจริง
      </p>
    </div>
    <UButton label="ดำเนินการต่อด้วย Google" icon="i-simple-icons-google" variant="outline" block @click="withGoogle" />
    <USeparator label="หรือ" />
    <form class="flex flex-col gap-2" @submit.prevent="withMagicLink">
      <UInput v-model="email" type="email" placeholder="อีเมล" required />
      <UButton type="submit" label="ส่งลิงก์เข้าสู่ระบบ" :loading="sending" block />
    </form>
    <p class="text-center text-xs text-muted">
      ครั้งแรก = สมัครให้อัตโนมัติ
    </p>
  </main>
</template>
