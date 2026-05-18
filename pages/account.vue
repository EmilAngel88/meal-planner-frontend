<template>
    <div>
        <h1 class="text-h5 mb-4">Личный кабинет — цели питания</h1>

        <!-- Спиннер пока профиль не загружен -->
        <div v-if="!profile" class="text-center py-6">
            <v-progress-circular indeterminate color="primary" />
        </div>

        <!-- Форма появляется только если профиль загружен -->
        <v-form v-else ref="form" class="mb-6">
            <v-row>
                <v-col cols="12" sm="6" md="3">
                    <v-text-field
                        v-model.number="profile.age"
                        label="Возраст"
                        type="number"
                        :rules="[v => !!v || 'Укажите возраст']"
                    />
                </v-col>
                <v-col cols="12" sm="6" md="3">
                    <v-select
                        v-model="profile.gender"
                        :items="sexes"
                        label="Пол"
                        :rules="[v => !!v || 'Укажите пол']"
                    />
                </v-col>
                <v-col cols="12" sm="6" md="3">
                    <v-text-field
                        v-model.number="profile.height"
                        label="Рост (см)"
                        type="number"
                        :rules="[v => !!v || 'Укажите рост']"
                    />
                </v-col>
                <v-col cols="12" sm="6" md="3">
                    <v-text-field
                        v-model.number="profile.weight"
                        label="Вес (кг)"
                        type="number"
                        :rules="[v => !!v || 'Укажите вес']"
                    />
                </v-col>
                <v-col cols="12" sm="6" md="4">
                    <v-select
                        v-model="profile.activity"
                        :items="activities"
                        label="Активность"
                        :rules="[v => !!v || 'Укажите активность']"
                    />
                </v-col>
                <v-col cols="12" sm="6" md="4">
                    <v-select
                        v-model="profile.goal"
                        :items="goals"
                        label="Цель"
                        :rules="[v => !!v || 'Укажите цель']"
                    />
                </v-col>
                <v-col cols="12" sm="6" md="4">
                    <v-text-field
                        v-model.number="profile.calories"
                        label="Калории (ккал/д)"
                        type="number"
                    />
                </v-col>
            </v-row>

            <div class="d-flex gap-2 mt-4">
                <v-btn color="primary" @click="calculate">Рассчитать</v-btn>
                <v-btn color="secondary" @click="preset">Пресет</v-btn>
                <v-btn color="success" @click="manual">Ручной ввод</v-btn>
            </div>
        </v-form>

        <h2 class="text-h6 mb-2">Журнал веса</h2>

        <v-row class="mb-2">
            <v-col cols="6">
                <v-text-field v-model="date" label="Дата" type="date" />
            </v-col>
            <v-col cols="6">
                <v-text-field v-model.number="weight" label="Вес (кг)" type="number" />
            </v-col>
        </v-row>
        <v-btn @click="add" class="mb-4">Добавить запись</v-btn>

        <div v-if="!logs.length" class="text-medium-emphasis mb-4">
            Журнал пуст
        </div>

        <div v-else>

            <v-table>
                <thead>
                <tr><th>Дата</th><th>Вес</th><th></th></tr>
                </thead>
                <tbody>
                <tr v-for="l in logs" :key="l.id">
                    <td>{{ new Date(l.date).toLocaleDateString() }}</td>
                    <td>{{ l.weight }}</td>
                    <td>
                        <v-btn size="small" variant="text" @click="remove(l.id)">
                            Удалить
                        </v-btn>
                    </td>
                </tr>
                </tbody>
            </v-table>
        </div>
    </div>
</template>

<script setup lang="ts">
import { useProfileStore } from '~/stores/profile'
import { useUiStore } from '~/stores/ui'
import { storeToRefs } from 'pinia'

const store = useProfileStore()
const ui = useUiStore()
const { profile, logs } = storeToRefs(store)

const sexes = ['male','female']
const activities = ['low','light','medium','high','extreme']
const goals = ['loss','maintain','gain']

const form = ref()
const date = ref<string>(new Date().toISOString().slice(0,10))
const weight = ref<number | null>(null)

onMounted(async () => {
    await store.fetch()
    await store.fetchLogs()
})

const validate = async () => {
    return await form.value?.validate() ?? false
}

const calculate = async () => {
    if (!(await validate())) return
    await store.calculate()
    ui.notify('Профиль обновлён (расчёт)')
}

const preset = async () => {
    if (!(await validate())) return
    await store.preset()
    ui.notify('Профиль обновлён (пресет)')
}

const manual = async () => {
    if (!(await validate())) return
    await store.manual()
    ui.notify('Профиль обновлён (ручной ввод)')
}

const add = async () => {
    if (weight.value) {
        await store.addLog(date.value, weight.value)
        ui.notify('Запись добавлена')
    }
}

const remove = async (id: number) => {
    await store.deleteLog(id)
    ui.notify('Запись удалена')
}
</script>
