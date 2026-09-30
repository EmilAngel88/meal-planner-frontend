<template>
  <v-app class="mp-app">
    <a class="mp-skip-link" href="#main-content">Перейти к содержимому</a>
    <div class="mp-shell" :class="{ 'mp-shell--public': !auth.isAuthed }">
      <aside v-if="auth.isAuthed" class="mp-sidebar">
        <NuxtLink class="mp-brand" to="/" aria-label="Рацион — обзор">
          <span class="mp-brand-mark"><MpIcon name="leaf" :size="25" /></span>
          <span>рацион<span class="mp-brand-caption">Еда. В вашем ритме.</span></span>
        </NuxtLink>
        <span class="mp-sidebar-label">Каждый день</span>
        <nav class="mp-nav" aria-label="Основная навигация">
          <NuxtLink v-for="item in navItems" :key="item.to" :to="item.to" class="mp-nav__item" :class="{ 'mp-nav__item--active': isActive(item.to) }" :aria-current="isActive(item.to) ? 'page' : undefined">
            <MpIcon :name="item.icon" :size="21" /><span>{{ item.label }}</span><span v-if="isActive(item.to)" class="mp-nav__dot" />
          </NuxtLink>
        </nav>
        <div class="mp-sidebar-secondary">
          <span class="mp-sidebar-label">Для вас</span>
          <NuxtLink v-for="item in secondaryItems" :key="item.to" :to="item.to" class="mp-nav__item" :class="{ 'mp-nav__item--active': isActive(item.to) }" :aria-current="isActive(item.to) ? 'page' : undefined"><MpIcon :name="item.icon" :size="21" /><span>{{ item.label }}</span></NuxtLink>
        </div>
        <div class="mp-sidebar-note"><span class="mp-sidebar-note__mark">6 + 1</span><p>План на шесть дней.<br>Один день — для спонтанности.</p></div>
        <div class="mp-sidebar-account">
          <NuxtLink to="/account" class="mp-user-link"><span class="mp-avatar">{{ userInitials }}</span><span class="mp-user-info"><strong>Ваше пространство</strong><small>{{ auth.user?.email || 'Личный аккаунт' }}</small></span></NuxtLink>
          <button class="mp-icon-button" type="button" aria-label="Выйти из аккаунта" title="Выйти" @click="auth.logout()"><MpIcon name="logout" :size="19" /></button>
        </div>
      </aside>
      <div class="mp-workspace">
        <header class="mp-topbar">
          <NuxtLink class="mp-mobile-brand" to="/"><MpIcon name="leaf" :size="23" /><span>рацион</span></NuxtLink>
          <span v-if="auth.isAuthed" class="mp-breadcrumb">Ваше пространство <span>/</span> <strong>{{ currentSection }}</strong></span>
          <span v-else class="mp-public-tagline">Чуть меньше забот о еде</span>
          <span class="mp-topbar-date">{{ dateLabel }}</span>
          <button v-if="auth.isAuthed" type="button" class="mp-feedback-trigger" aria-label="Написать отзыв" title="Написать отзыв" @click="openFeedback"><MpIcon name="message" :size="20" /><span>Написать отзыв</span></button>
          <NuxtLink v-if="auth.isAuthed" to="/account" class="mp-mobile-account" aria-label="Моя цель и аккаунт"><span class="mp-avatar">{{ userInitials }}</span></NuxtLink>
        </header>
        <main id="main-content" class="mp-app-main" tabindex="-1"><NuxtPage :page-key="pageRoute => `${auth.sessionRevision}:${pageRoute.path}`" /></main>
        <footer class="mp-footer"><span>рацион</span><span>Хорошая неделя начинается с простого плана.</span></footer>
      </div>
      <nav v-if="auth.isAuthed" class="mp-mobile-nav" aria-label="Основная навигация на телефоне">
        <NuxtLink v-for="item in navItems" :key="item.to" :to="item.to" :class="{ 'is-active': isActive(item.to) }" :aria-current="isActive(item.to) ? 'page' : undefined"><MpIcon :name="item.icon" :size="22" /><span>{{ item.mobileLabel || item.label }}</span></NuxtLink>
      </nav>
    </div>
    <FeedbackDialog v-if="auth.isAuthed" :key="auth.sessionRevision" v-model="feedbackComposer.open" :page-path="feedbackComposer.pagePath" :device-type="feedbackComposer.deviceType" @sent="feedbackRevision += 1" />
    <v-snackbar v-model="ui.show" :color="ui.color" :timeout="6000" location="top">{{ ui.message }}<template #actions><v-btn variant="text" @click="ui.show = false">Закрыть</v-btn></template></v-snackbar>
  </v-app>
</template>
<script setup lang="ts">
import { computed, watch } from 'vue'
import { useState } from '#imports'
import { useAuthStore } from '~/stores/auth'
import { useUiStore } from '~/stores/ui'
import { useFeedbackComposer } from '~/composables/useFeedbackComposer'
const auth = useAuthStore()
const ui = useUiStore()
const route = useRoute()
const { state: feedbackComposer, openFeedback } = useFeedbackComposer()
const feedbackRevision = useState('feedback:revision', () => 0)
watch(() => auth.sessionRevision, () => {
  feedbackComposer.value = { open: false, pagePath: null, deviceType: null }
  feedbackRevision.value = 0
}, { flush: 'sync' })
const navItems = [
  { to: '/', label: 'Обзор', mobileLabel: 'Обзор', icon: 'home' },
  { to: '/menu', label: 'Моя неделя', mobileLabel: 'Неделя', icon: 'calendar' },
  { to: '/recipes', label: 'Рецепты', mobileLabel: 'Рецепты', icon: 'book' },
  { to: '/products', label: 'Продукты', mobileLabel: 'Продукты', icon: 'grid' },
  { to: '/shopping-list', label: 'Покупки', mobileLabel: 'Покупки', icon: 'bag' }
]
const secondaryItems = computed(() => [
  { to: '/account', label: 'Моя цель', icon: 'target' },
  { to: '/billing', label: 'Тариф и оплата', icon: 'leaf' },
  ...(auth.canManageBilling ? [{ to: '/billing/admin', label: 'Монетизация', icon: 'sliders' }] : []),
  { to: '/feedback', label: 'Мои обращения', icon: 'message' },
  ...(auth.canManageFeedback ? [{ to: '/feedback/admin', label: 'Входящие отзывы', icon: 'inbox' }] : [])
])
const isActive = (path: string) => path === '/' || path === '/feedback' || path === '/billing' ? route.path === path : route.path.startsWith(path)
const currentSection = computed(() => [...navItems, ...secondaryItems.value].sort((a, b) => b.to.length - a.to.length).find(item => isActive(item.to))?.label || (route.path === '/login' ? 'Вход' : route.path === '/register' ? 'Регистрация' : 'Рацион'))
useHead(() => ({ title: `${currentSection.value} — Рацион` }))
const userInitials = computed(() => (auth.user?.email || 'Я').slice(0, 1).toUpperCase())
const dateLabel = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', weekday: 'short' }).format(new Date())
</script>
