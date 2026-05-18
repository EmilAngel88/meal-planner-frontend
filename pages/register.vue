<template>
  <v-row justify="center">
    <v-col cols="12" sm="8" md="6" lg="4">
      <v-card>
        <v-card-title>Регистрация</v-card-title>
        <v-card-text>
          <v-form @submit.prevent="submit">
            <v-text-field v-model="email" label="Email" type="email" required />
            <v-text-field v-model="password" label="Пароль" type="password" required />
            <v-btn :loading="loading" color="primary" type="submit" block class="mt-2">Создать</v-btn>
            <v-btn to="/login" variant="text" block class="mt-2">У меня уже есть аккаунт</v-btn>
          </v-form>
        </v-card-text>
      </v-card>
    </v-col>
  </v-row>
</template>
<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useUiStore } from '~/stores/ui'
const auth = useAuthStore()
const ui = useUiStore()
const email = ref(''); const password = ref(''); const loading = ref(false)
const submit = async () => { loading.value = true; try { await auth.register(email.value, password.value); ui.notify('Аккаунт создан'); await navigateTo('/account') } finally { loading.value = false } }
</script>
