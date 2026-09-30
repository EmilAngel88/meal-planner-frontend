<template>
  <div v-if="status?.enabled" class="billing-notice" :class="{ 'billing-notice--empty': status.remaining === 0 }" role="status">
    <span>{{ status.name }} · Осталось {{ status.remaining }} созданий меню{{ status.plan === 'trial' ? ' на пробный период' : ' в этом месяце' }}<small v-if="status.remaining === 0">Сохранённые меню и покупки доступны.</small></span><NuxtLink to="/billing">{{ status.remaining === 0 ? 'Посмотреть варианты →' : 'Мой тариф →' }}</NuxtLink>
  </div>
  <p v-else-if="failed" class="billing-notice">Не удалось проверить остаток меню. <NuxtLink to="/billing">Проверить тариф →</NuxtLink></p>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useApi } from '~/composables/useApi'
import type { BillingStatus } from '~/utils/billing'
const api = useApi(), status = ref<BillingStatus | null>(null), failed = ref(false)
async function refresh() { try { status.value = await api.getBilling(); failed.value = false } catch { failed.value = true } }
defineExpose({ refresh })
onMounted(refresh)
</script>
<style scoped>
.billing-notice{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 18px;border:1px solid var(--border-subtle);border-radius:14px;background:var(--surface-card);margin-bottom:20px;font-size:.85rem}.billing-notice a{font-weight:600;color:var(--basil-500);white-space:nowrap}.billing-notice small{display:block;margin-top:5px}.billing-notice--empty{background:var(--color-honey-soft)}@media(max-width:600px){.billing-notice{flex-wrap:wrap}}
</style>
