import { createVuetify } from 'vuetify'
import { ru } from 'vuetify/locale'
import { VAlert, VApp, VAutocomplete, VBtn, VBtnToggle, VCard, VCardActions, VCardText, VCardTitle, VCheckbox, VChip, VCol, VDialog, VDivider, VExpansionPanel, VExpansionPanelText, VExpansionPanelTitle, VExpansionPanels, VForm, VIcon, VList, VListItem, VListItemSubtitle, VListItemTitle, VMenu, VPagination, VProgressCircular, VProgressLinear, VRow, VSelect, VSheet, VSnackbar, VSpacer, VSwitch, VTab, VTable, VTabs, VTextField, VTextarea, VWindow, VWindowItem, VSvgIcon } from 'vuetify/components'
import { h } from 'vue'
import { aliases } from 'vuetify/iconsets/mdi-svg'
import { mdiAccount, mdiBarley, mdiCalendarCheck, mdiCartOutline, mdiCheck, mdiFire, mdiFoodApple, mdiFoodDrumstick, mdiLogout, mdiMagnify, mdiSilverwareForkKnife, mdiWater } from '@mdi/js'
const paths: Record<string, string> = { 'mdi-account': mdiAccount, 'mdi-barley': mdiBarley, 'mdi-calendar-check': mdiCalendarCheck, 'mdi-cart-outline': mdiCartOutline, 'mdi-check': mdiCheck, 'mdi-fire': mdiFire, 'mdi-food-apple': mdiFoodApple, 'mdi-food-drumstick': mdiFoodDrumstick, 'mdi-logout': mdiLogout, 'mdi-magnify': mdiMagnify, 'mdi-silverware-fork-knife': mdiSilverwareForkKnife, 'mdi-water': mdiWater }
import * as directives from 'vuetify/directives'

export default defineNuxtPlugin((nuxtApp) => {
  const vuetify = createVuetify({
    locale: { locale: 'ru', messages: { ru } },
    components: { VAlert, VApp, VAutocomplete, VBtn, VBtnToggle, VCard, VCardActions, VCardText, VCardTitle, VCheckbox, VChip, VCol, VDialog, VDivider, VExpansionPanel, VExpansionPanelText, VExpansionPanelTitle, VExpansionPanels, VForm, VIcon, VList, VListItem, VListItemSubtitle, VListItemTitle, VMenu, VPagination, VProgressCircular, VProgressLinear, VRow, VSelect, VSheet, VSnackbar, VSpacer, VSwitch, VTab, VTable, VTabs, VTextField, VTextarea, VWindow, VWindowItem },
    icons: { defaultSet: 'mdi', aliases, sets: { mdi: { component: props => h(VSvgIcon, { ...props, icon: typeof props.icon === 'string' ? paths[props.icon] || props.icon : props.icon }) } } },
    directives,
    theme: {
      defaultTheme: 'mealPlanner',
      themes: {
        mealPlanner: {
          dark: false,
          colors: {
            primary: '#264B3F',
            secondary: '#A34E2C',
            accent: '#A34E2C',
            surface: '#FFFFFF',
            background: '#F7F7EF',
            'surface-variant': '#EEF0E7',
            error: '#AF3F35',
            warning: '#886020',
            success: '#264B3F',
            info: '#376B79',
            'on-surface': '#283C32'
          },
          variables: { 'medium-emphasis-opacity': 0.85 }
        }
      }
    },
    defaults: {
      global: {
        ripple: false
      },
      VCard: {
        flat: true
      },
      VBtn: {
        rounded: 'lg'
      },
      VTextField: {
        variant: 'outlined',
        density: 'comfortable',
        color: 'primary',
        persistentPlaceholder: true
      },
      VTextarea: {
        variant: 'outlined',
        density: 'comfortable',
        color: 'primary',
        persistentPlaceholder: true
      },
      VSelect: {
        variant: 'outlined',
        density: 'comfortable',
        color: 'primary'
      },
      VAutocomplete: {
        variant: 'outlined',
        density: 'comfortable',
        color: 'primary',
        persistentPlaceholder: true
      },
      VAlert: {
        border: 'start'
      }
    }
  })

  nuxtApp.vueApp.use(vuetify)
})
