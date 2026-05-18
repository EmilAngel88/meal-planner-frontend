<template>
  <v-app>
    <v-app-bar app>
      <v-app-bar-title>🍽️ Meal Planner</v-app-bar-title>
      <v-spacer />
      <template v-if="auth.isAuthed">
        <v-btn to="/recipes" variant="text">Рецепты</v-btn>
        <v-btn to="/products" variant="text">Продукты</v-btn>
        <v-btn to="/menu" variant="text">Меню</v-btn>
        <v-btn to="/shopping-list" variant="text">Покупки</v-btn>
        <v-btn to="/account" variant="text">Кабинет</v-btn>
        <v-divider vertical class="mx-2" />
        <v-menu>
          <template #activator="{ props }">
            <v-btn v-bind="props" variant="text">{{ auth.user?.email }}</v-btn>
          </template>
          <v-list><v-list-item @click="auth.logout()">Выйти</v-list-item></v-list>
        </v-menu>
      </template>
      <template v-else>
        <v-btn to="/login" color="primary" variant="flat">Войти</v-btn>
        <v-btn to="/register" variant="text">Регистрация</v-btn>
      </template>
    </v-app-bar>
    <v-main><v-container class="py-6"><NuxtPage/></v-container></v-main>
    <v-snackbar v-model="ui.show" color="success">{{ ui.message }}</v-snackbar>
  </v-app>
</template>
<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useUiStore } from '~/stores/ui'

const auth = useAuthStore()
const ui = useUiStore()
</script>
