<template>
  <div class="tutorial-page">
    <header class="mp-page-head">
      <div class="mp-page-head__meta"><span class="mp-overline">{{ stamp(Math.round(tutorial.duration)) }} · {{ tutorial.chapters.length }} глав</span><h1 class="mp-page-title">Меню. Покупки. Готовка.</h1><p class="mp-page-subtitle">От первой цели до готового плана. Посмотрите руководство целиком или выберите нужный шаг.</p></div>
      <v-btn to="/menu" color="primary" variant="tonal">К моей неделе</v-btn>
    </header>
    <div class="tutorial-layout">
      <section aria-label="Обучающее видео" class="tutorial-player">
        <video ref="video" controls playsinline preload="metadata" poster="/tutorial-assets/poster.png" @timeupdate="updateTime" @loadedmetadata="onReady" @error="mediaError = true">
          <source :src="videoUrl" type="video/mp4">
          <track kind="subtitles" src="/tutorial-assets/ration-tutorial-ru.vtt" srclang="ru" label="Русский" default>
          Ваш браузер не поддерживает видео. Скачайте его по ссылке ниже.
        </video>
        <p v-if="mediaError" role="alert" class="tutorial-error">Не удалось загрузить видео. Обновите страницу или попробуйте скачать файл.</p>
        <div class="tutorial-actions"><button type="button" :aria-pressed="subtitles" @click="toggleSubtitles">Субтитры: {{ subtitles ? 'вкл.' : 'выкл.' }}</button><a href="/tutorial-video.mp4" download="ration-tutorial-ru.mp4">Скачать видео</a></div>
        <p class="tutorial-note">В примерах — демонстрационные данные. Озвучка — предоставленная автором запись.</p>
      </section>
      <nav class="tutorial-chapters" aria-label="Главы обучения">
        <h2>Внутри видео</h2>
        <button v-for="(chapter, index) in tutorial.chapters" :key="chapter.id" type="button" :class="{ active: activeChapter === index }" :aria-current="activeChapter === index ? 'step' : undefined" @click="seek(chapter.start)"><span class="tutorial-number">{{ String(index + 1).padStart(2, '0') }}</span><span>{{ chapter.title }}</span><time>{{ stamp(chapter.start) }}</time></button>
      </nav>
    </div>
    <details class="tutorial-transcript"><summary>Текст видео</summary><p v-for="chapter in tutorial.chapters" :key="chapter.id"><button type="button" :aria-label="`Перейти: ${chapter.title}`" @click="seek(chapter.start)">{{ stamp(chapter.start) }}</button> {{ chapter.voiceover }}</p></details>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import tutorial from '~/data/tutorial.json'

const videoUrl = '/tutorial-video.mp4'
const video = ref<HTMLVideoElement | null>(null)
const currentTime = ref(0)
const subtitles = ref(true)
const mediaError = ref(false)
let pendingSeek: number | null = null
let tracks: TextTrackList | undefined
const stamp = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
const activeChapter = computed(() => Math.max(0, tutorial.chapters.findLastIndex(chapter => chapter.start <= currentTime.value)))
const updateTime = () => { currentTime.value = video.value?.currentTime || 0 }
const syncSubtitles = () => { subtitles.value = tracks?.[0]?.mode === 'showing' }
const toggleSubtitles = () => {
  subtitles.value = !subtitles.value
  if (video.value?.textTracks[0]) video.value.textTracks[0].mode = subtitles.value ? 'showing' : 'disabled'
}
const seek = (seconds: number) => {
  const player = video.value
  if (!player) return
  if (player.readyState === 0) pendingSeek = seconds
  else player.currentTime = seconds
  void player.play().catch(() => { /* Native controls remain available if autoplay is blocked. */ })
}
const onReady = () => {
  if (pendingSeek !== null) { const target = pendingSeek; pendingSeek = null; seek(target) }
}
onMounted(() => {
  tracks = video.value?.textTracks
  tracks?.addEventListener('change', syncSubtitles)
})
onBeforeUnmount(() => { tracks?.removeEventListener('change', syncSubtitles) })
</script>

<style scoped>
.tutorial-page { max-width: 1450px; margin: 0 auto; }
.tutorial-layout { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 28px; align-items: start; }
.tutorial-player { min-width: 0; position: sticky; top: 24px; }
video { width: 100%; display: block; aspect-ratio: 16 / 9; background: #f7f7ef; border-radius: 16px; box-shadow: 0 10px 30px #264b3f12; }
.tutorial-actions { display: flex; flex-wrap: wrap; gap: 12px; margin: 18px 0 12px; }
.tutorial-actions button, .tutorial-actions a { min-height: 44px; padding: 10px 15px; border: 1px solid var(--border-subtle); border-radius: 10px; color: var(--color-primary); font-size: 13px; text-decoration: none; }
.tutorial-note { color: var(--text-secondary); font-size: 12px; line-height: 1.7; }
.tutorial-chapters h2 { font: 400 25px var(--font-display); margin-bottom: 18px; }
.tutorial-chapters > button { width: 100%; display: grid; grid-template-columns: 22px minmax(0, 1fr) 36px; gap: 8px; padding: 13px 9px; border-top: 1px solid var(--border-subtle); text-align: left; font-size: 13px; color: var(--text-strong); }
.tutorial-chapters > button.active { background: #e6ebd9; border-radius: 8px; }
.tutorial-number, time { font-size: 11px; color: var(--text-secondary); font-variant-numeric: tabular-nums; }
button { cursor: pointer; }
button:focus-visible, a:focus-visible, summary:focus-visible { outline: 3px solid var(--color-primary); outline-offset: 3px; }
.tutorial-transcript { margin-top: 32px; padding-top: 24px; border-top: 1px solid var(--border-subtle); }
.tutorial-transcript summary { cursor: pointer; font: 400 25px var(--font-display); }
.tutorial-transcript p { max-width: 920px; margin-top: 18px; line-height: 1.8; color: var(--text-secondary); }
.tutorial-transcript button { padding: 3px 8px; border-radius: 6px; background: #e6ebd9; color: var(--color-primary); font-size: 12px; }
.tutorial-error { margin-top: 16px; color: #a33f25; }
@media (max-width: 1100px) { .tutorial-layout { grid-template-columns: 1fr; } .tutorial-player { position: static; } .tutorial-chapters { display: grid; grid-template-columns: 1fr 1fr; column-gap: 20px; } .tutorial-chapters h2 { grid-column: 1 / -1; } }
@media (max-width: 600px) { .tutorial-chapters { grid-template-columns: 1fr; } .tutorial-layout { gap: 24px; } }
</style>
