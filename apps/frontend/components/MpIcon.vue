<template><svg :width="size" :height="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="mp-icon"><path :d="paths[name] || paths.leaf" /></svg></template>
<script setup lang="ts">
withDefaults(defineProps<{ name: string; size?: number }>(), { size: 20 })
const paths: Record<string, string> = {
  home: 'M3 10.5 12 3l9 7.5M5 9v11h5v-6h4v6h5V9',
  calendar: 'M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2M8 14h2m4 0h2m-8 4h2',
  book: 'M12 5c-3-2-6-2-10-1v16c4-1 7-1 10 1 3-2 6-2 10-1V4c-4-1-7-1-10 1Zm0 0v16M5 8h3m-3 4h3m8-4h3m-3 4h3',
  bag: 'M5 7h14l2 14H3L5 7Zm3 1V6a4 4 0 0 1 8 0v2',
  message: 'M21 11.5a8.5 8.5 0 0 1-8.5 8.5H8l-5 2 1.5-5A8.5 8.5 0 1 1 21 11.5ZM8 9h8m-8 4h5',
  inbox: 'M5 3h14l3 11v6H2v-6L5 3Zm-3 11h6l2 3h4l2-3h6',
  leaf: 'M20 3c1 10-2 16-9 16a7 7 0 0 1-7-7C4 5 12 3 20 3ZM4 21 16 8M9 16v-5m0 5h5',
  target: 'M21 12a9 9 0 1 1-9-9m5 9a5 5 0 1 1-5-5m0 5 9-9m-5 0h5v5',
  grid: 'M3 3h7v7H3V3Zm11 0h7v7h-7V3ZM3 14h7v7H3v-7Zm11 0h7v7h-7v-7Z',
  'arrow-right': 'M4 12h16m-6-6 6 6-6 6', 'arrow-left': 'M20 12H4m6-6-6 6 6 6', 'chevron-right': 'm9 5 7 7-7 7',
  plus: 'M12 5v14M5 12h14', check: 'm5 12 4 4L19 6', close: 'm6 6 12 12M18 6 6 18',
  settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm-2-5h4l1 3 3 1 3 2v4l-3 2-1 3-2 3h-4l-2-3-3-1-3-2v-4l3-2 1-3 3-1Z',
  logout: 'M9 4H4v16h5m5-13 5 5-5 5m-6-5h12', search: 'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm5 12 6 6',
  sun: 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0-5v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v5l3 2', download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
  sliders: 'M4 7h9m4 0h3M4 17h3m4 0h9M13 4v6M7 14v6'
}
</script>
