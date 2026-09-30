<template>
  <div class="week-page" :class="{ 'week-page--planned': plan }">
    <header class="mp-page-head">
      <div class="mp-page-head__meta">
        <span class="mp-overline">МЕНЮ НА НЕДЕЛЮ</span>
        <h1 v-if="plan" class="mp-page-title">Моя неделя</h1>
        <h1 v-else class="mp-page-title">Меньше планов.<br class="mobile-break" /> Больше вкуса.</h1>
        <p class="mp-page-subtitle">Шесть дней с готовым меню. Один — для спонтанности.</p>
      </div>
      <v-btn v-if="plan" color="primary" size="large" aria-label="Составить новую неделю" :disabled="initialLoading || !!loadError || !profile?.calories" @click="generationOpen = true">
        <MpIcon name="plus" :size="18" class="week-new-icon" /><span class="week-new-label">Новая неделя</span>
      </v-btn>
    </header>
    <BillingNotice ref="billingNotice" />

    <v-alert v-if="loadError" type="error" variant="tonal" class="mb-5">
      {{ loadError }} <v-btn variant="text" @click="load">Повторить</v-btn>
    </v-alert>

    <v-alert v-if="preferenceSaveError && !generationOpen" type="error" variant="tonal" class="mb-5">
      Не удалось сохранить выбор рецептов. {{ preferenceSaveError }}
      <v-btn variant="text" :loading="savingPreferences" @click="retryPreferences">Повторить сохранение</v-btn>
    </v-alert>

    <div v-if="initialLoading" class="week-loading mp-panel" role="status" aria-live="polite">
      <v-progress-circular indeterminate color="primary" :size="28" />
      <span>Открываем ваше меню…</span>
    </div>

    <template v-else-if="plan">
      <section class="week-intro" aria-label="Текущая неделя">
        <div class="week-intro__icon"><MpIcon name="calendar" :size="26" /></div>
        <div class="week-intro__text">
          <span class="mp-overline">ВАША НЕДЕЛЯ</span>
          <h2>{{ planDateRange }}</h2>
          <p>{{ plan.daysCount }} дней с меню · {{ formatMealsCount(planMealCount) }}</p>
        </div>
        <v-btn :to="`/shopping-list?plan=${plan.id}`" class="week-intro__action" color="primary" variant="flat">
          <MpIcon name="bag" :size="18" class="mr-2" /> К списку покупок <MpIcon name="arrow-right" :size="17" class="ml-3" />
        </v-btn>
      </section>

      <div v-if="plan.settings?.warnings?.length" class="mt-5">
        <v-alert type="warning" variant="tonal">
          <div v-for="warning in plan.settings.warnings" :key="warning">{{ warning }}</div>
        </v-alert>
      </div>
      <v-alert v-if="(plan.settings?.generatorVersion || 0) < 5" type="info" variant="tonal" class="mt-5">
        Это меню сохранено ранее. При создании новой недели применятся актуальные правила подбора порций.
      </v-alert>
      <v-alert v-if="!profile?.calories" type="info" variant="tonal" class="mt-5">
        Сохранённое меню доступно. Чтобы составить новое, <NuxtLink to="/account">укажите цель питания</NuxtLink>.
      </v-alert>

      <nav class="week-strip" aria-label="Дни меню">
        <button
          v-for="day in planDays"
          :key="day.index"
          type="button"
          class="week-day"
          :class="{ 'week-day--active': selectedDayIndex === day.index, 'week-day--free': day.free }"
          :aria-pressed="selectedDayIndex === day.index"
          :aria-label="`${day.fullDate}${day.free ? ', свободный день' : ''}`"
          @click="selectedDayIndex = day.index"
        >
          <span class="week-day__name">{{ day.weekday }}</span>
          <strong class="week-day__date mp-num">{{ day.dayOfMonth }}</strong>
          <span class="week-day__meta">{{ day.free ? 'Свободный' : `${Math.round(dayTotals(day).calories)} ккал` }}</span>
          <span class="week-day__dot" aria-hidden="true" />
        </button>
      </nav>

      <div v-if="selectedDay" class="day-layout">
        <section class="day-menu" aria-live="polite">
          <div class="day-heading">
            <div>
              <span class="mp-overline">{{ selectedDay.free ? 'МЕСТО ДЛЯ ВАШИХ ПЛАНОВ' : `ДЕНЬ ${selectedDay.index + 1}` }}</span>
              <h2>{{ selectedDay.fullDate }}</h2>
            </div>
            <span v-if="!selectedDay.free" class="day-heading__count">{{ formatMealsCount(selectedDay.groups.length) }}</span>
          </div>

          <div v-if="selectedDay.free" class="free-day mp-panel">
            <div class="free-day__icon"><MpIcon name="sun" :size="38" /></div>
            <h3>Оставим этот день открытым</h3>
            <p>Любимое кафе, ужин с друзьями или блюдо, которое давно хотелось попробовать. Сегодня выбор за вами.</p>
            <v-btn to="/recipes" variant="outlined" color="primary">Найти вдохновение <MpIcon name="arrow-right" :size="17" class="ml-2" /></v-btn>
          </div>
          <div v-else-if="!selectedDay.groups.length" class="free-day mp-panel">
            <MpIcon name="calendar" :size="32" />
            <h3>На этот день нет блюд</h3>
            <p>Составьте новую неделю, чтобы получить полное меню.</p>
            <v-btn color="primary" :disabled="!profile?.calories" @click="generationOpen = true">Составить меню</v-btn>
          </div>
          <div v-else class="meal-list">
            <article v-for="(group, groupIndex) in selectedDay.groups" :key="group.key" class="meal-card mp-panel">
              <header class="meal-card__head">
                <span class="meal-card__number mp-num">{{ String(groupIndex + 1).padStart(2, '0') }}</span>
                <h3>{{ group.title }}</h3>
                <span class="meal-card__energy mp-num">{{ Math.round(group.items.reduce((sum, item) => sum + item.calories, 0)) }} <span>ккал</span></span>
              </header>
              <div class="meal-card__body">
                <div v-for="item in group.items" :key="item.id" class="dish">
                  <NuxtLink v-if="item.recipeId" class="dish__title" :to="`/recipes/${item.recipeId}`">
                    {{ item.title }} <MpIcon name="chevron-right" :size="18" />
                  </NuxtLink>
                  <h4 v-else class="dish__title">{{ item.title }}</h4>
                  <div class="dish__meta mp-num">
                    <span>{{ item.weight }} г ингредиентов</span>
                    <span>{{ item.calories }} ккал</span>
                    <span class="dish__macros">Б {{ item.protein }} · Ж {{ item.fat }} · У {{ item.carbs }}</span>
                  </div>
                  <details v-if="item.shoppingSnapshot?.length" class="dish-ingredients">
                    <summary>Состав порции <MpIcon name="plus" :size="14" /></summary>
                    <ul>
                      <li v-for="(ingredient, index) in item.shoppingSnapshot" :key="index">
                        <span>{{ ingredient.name }}</span>
                        <span class="mp-num">{{ ingredient.unitType === 'piece' ? `${Math.round(ingredient.quantity * 10) / 10} шт. (${Math.round(ingredient.weight)} г)` : `${Math.round(ingredient.unitType === 'ml' ? ingredient.quantity : ingredient.weight)} ${ingredient.unitType === 'ml' ? 'мл' : 'г'}` }}</span>
                      </li>
                    </ul>
                  </details>
                </div>
              </div>
            </article>
          </div>
        </section>

        <aside class="day-sidebar">
          <section v-if="!selectedDay.free" class="day-balance mp-panel" aria-label="Пищевая ценность дня">
            <div class="day-balance__heading"><MpIcon name="leaf" :size="19" /><h3>Баланс дня</h3></div>
            <div class="energy-total mp-num">{{ Math.round(selectedDayTotals.calories) }} <span>ккал</span></div>
            <p class="energy-goal">из {{ Math.round(plan.targetCalories / Math.max(plan.daysCount, 1)) }} ккал по плану</p>
            <div class="energy-track" role="img" :aria-label="`Калории: ${Math.round(selectedDayTotals.calories)} из ${Math.round(plan.targetCalories / Math.max(plan.daysCount, 1))}`">
              <span :style="{ width: `${dayCaloriePercent}%` }" />
            </div>
            <dl class="nutrient-list">
              <div><dt><span class="nutrient-dot nutrient-dot--protein" />Белки</dt><dd class="mp-num">{{ Math.round(selectedDayTotals.protein) }} <span>г</span></dd></div>
              <div><dt><span class="nutrient-dot nutrient-dot--fat" />Жиры</dt><dd class="mp-num">{{ Math.round(selectedDayTotals.fat) }} <span>г</span></dd></div>
              <div><dt><span class="nutrient-dot nutrient-dot--carbs" />Углеводы</dt><dd class="mp-num">{{ Math.round(selectedDayTotals.carbs) }} <span>г</span></dd></div>
            </dl>
            <details class="balance-detail">
              <summary>Сравнить с целью <MpIcon name="plus" :size="14" /></summary>
              <p>{{ dayDeviation(selectedDay) }}</p>
              <p>«+» — больше цели, «−» — меньше.</p>
            </details>
          </section>

          <section class="week-note">
            <span class="mp-overline">В СРЕДНЕМ ЗА ДЕНЬ</span>
            <strong class="mp-num">{{ averageCalories }} <span>ккал</span></strong>
            <div class="week-note__macros mp-num">Б {{ averageProtein }} · Ж {{ averageFat }} · У {{ averageCarbs }} г</div>
            <div class="week-macro-bar" aria-hidden="true"><span :style="{ width: `${macroBar.protein}%` }" /><span :style="{ width: `${macroBar.fat}%` }" /><span :style="{ width: `${macroBar.carbs}%` }" /></div>
            <p><MpIcon :name="withinTarget ? 'check' : 'sliders'" :size="17" />{{ withinTarget ? 'Каждый день в пределах 10% от цели' : 'В отдельные дни калории отличаются от цели более чем на 10%' }}</p>
            <details class="balance-detail">
              <summary>Итоги {{ plan.daysCount }} дней <MpIcon name="plus" :size="14" /></summary>
              <dl class="week-totals">
                <div><dt>Калории</dt><dd>{{ plan.totalCalories }} / {{ plan.targetCalories }}</dd></div>
                <div><dt>Белки</dt><dd>{{ plan.totalProtein }} / {{ plan.targetProtein }} г</dd></div>
                <div><dt>Жиры</dt><dd>{{ plan.totalFat }} / {{ plan.targetFat }} г</dd></div>
                <div><dt>Углеводы</dt><dd>{{ plan.totalCarbs }} / {{ plan.targetCarbs }} г</dd></div>
              </dl>
            </details>
          </section>
          <NuxtLink class="shopping-next" :to="`/shopping-list?plan=${plan.id}`">
            <span class="shopping-next__icon"><MpIcon name="bag" :size="22" /></span>
            <span><strong>Теперь — за продуктами</strong><small>Список уже собран из вашего меню</small></span>
            <MpIcon name="arrow-right" :size="19" />
          </NuxtLink>
        </aside>
      </div>
    </template>

    <section v-else-if="!loadError" class="week-empty mp-panel">
      <div class="week-empty__art" aria-hidden="true">
        <div class="week-empty__orbit" />
        <div class="week-empty__calendar"><MpIcon name="calendar" :size="50" /></div>
        <span class="week-empty__leaf"><MpIcon name="leaf" :size="24" /></span>
        <span class="week-empty__sun"><MpIcon name="sun" :size="24" /></span>
      </div>
      <span class="mp-overline">ПРИЯТНО, КОГДА ВСЁ ПРОДУМАНО</span>
      <h2>{{ profile?.calories ? 'Что будем есть на этой неделе?' : 'Хорошая неделя начинается с вас' }}</h2>
      <p>{{ profile?.calories ? 'Соберём разнообразные блюда под вашу цель. Рассчитаем порции и сразу подготовим список покупок.' : 'Сначала укажите вашу цель питания. Затем мы подберём блюда, рассчитаем порции и подготовим список покупок.' }}</p>
      <v-btn v-if="profile?.calories" color="primary" size="x-large" @click="generationOpen = true">Составить первую неделю <MpIcon name="arrow-right" :size="18" class="ml-3" /></v-btn>
      <v-btn v-else to="/account" color="primary" size="x-large">Настроить мою цель <MpIcon name="arrow-right" :size="18" class="ml-3" /></v-btn>
      <div class="week-empty__steps"><span><MpIcon name="check" :size="16" /> 6 дней с меню</span><span><MpIcon name="check" :size="16" /> Ваши порции</span><span><MpIcon name="check" :size="16" /> Готовый список покупок</span></div>
    </section>

    <details v-if="history.length && !initialLoading" class="plan-history mp-panel">
      <summary><span><MpIcon name="clock" :size="20" /> Сохранённые недели <small>{{ history.length }}{{ historyHasMore ? '+' : '' }}</small></span><MpIcon name="plus" :size="18" /></summary>
      <div class="history-list">
        <article v-for="item in history" :key="item.id" class="history-entry" :class="{ 'history-entry--active': item.id === plan?.id }">
          <div class="history-entry__date"><strong>{{ formatPlanStart(item) }}</strong><small>Создано {{ new Date(item.createdAt).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) }}</small></div>
          <div class="history-entry__stats"><span>{{ item.daysCount }} дней · {{ Math.round(item.totalCalories / Math.max(item.daysCount, 1)) }} ккал в среднем</span><small>Всего {{ item.totalCalories }} ккал · Б {{ item.totalProtein }} · Ж {{ item.totalFat }} · У {{ item.totalCarbs }} г</small></div>
          <div class="history-entry__actions"><v-btn size="small" :variant="item.id === plan?.id ? 'tonal' : 'outlined'" color="primary" @click="openPlan(item)">{{ item.id === plan?.id ? 'Открыто' : 'Открыть' }}</v-btn><v-btn size="small" variant="text" color="error" @click="removePlan(item)">Удалить</v-btn></div>
        </article>
        <v-alert v-if="historyError" type="error" variant="tonal" class="my-3" role="alert">{{ historyError }}</v-alert>
        <v-btn v-if="historyHasMore" variant="outlined" color="primary" class="my-3" :loading="historyLoading" :disabled="historyLoading" @click="loadMoreHistory">Загрузить более ранние меню</v-btn>
      </div>
    </details>

    <v-dialog v-model="generationOpen" :persistent="loading" max-width="840" scrollable>
      <v-card class="generation-dialog">
        <div class="generation-dialog__head">
          <div><span class="mp-overline">НАСТРОИМ ПОД ВАС</span><h2>Новая неделя</h2><p>Шесть дней с меню и один свободный день.</p></div>
          <v-btn icon variant="text" :disabled="loading" aria-label="Закрыть настройки меню" @click="generationOpen = false"><MpIcon name="close" :size="22" /></v-btn>
        </div>
        <v-card-text class="generation-dialog__body">
          <div class="generation-basics">
            <v-text-field v-model="startDate" label="Первый день" type="date" hide-details :disabled="loading" />
            <div class="generation-target"><span>Ваша цель</span><strong class="mp-num">{{ profile?.calories || 0 }} <small>ккал в день</small></strong><NuxtLink to="/account">Изменить в профиле <MpIcon name="arrow-right" :size="14" /></NuxtLink></div>
          </div>
          <div class="generation-summary"><MpIcon name="leaf" :size="18" /><span>{{ formatMealsCount(meals.length) }} в день · Белки {{ Math.round(nutrientTarget.protein) }} г · Жиры {{ Math.round(nutrientTarget.fat) }} г · Углеводы {{ Math.round(nutrientTarget.carbs) }} г</span></div>
          <v-alert v-if="preferenceSaveError" type="error" variant="tonal" class="mb-4" role="alert">
            Не удалось сохранить выбор рецептов. Меню можно составить после успешного сохранения. {{ preferenceSaveError }}
            <v-btn variant="text" :loading="savingPreferences" :disabled="loading" @click="retryPreferences">Повторить сохранение</v-btn>
          </v-alert>
          <p class="settings-intro">Можно оставить всё как есть или подстроить детали.</p>
          <fieldset :disabled="loading" class="generation-fields">
            <v-form :disabled="loading"><v-expansion-panels class="generation-settings" variant="accordion">
              <v-expansion-panel>
                <v-expansion-panel-title><div class="settings-title"><MpIcon name="sliders" :size="19" /><span>Баланс питания<small>Как рассчитать белки, жиры и углеводы</small></span></div></v-expansion-panel-title>
                <v-expansion-panel-text>
                  <v-select v-model="macroMode" :items="[{ title: 'По весу тела', value: 'weight' }, { title: 'Задать доли калорий', value: 'ratio' }]" label="Способ расчёта" />
                  <v-row v-if="macroMode === 'weight'">
                    <v-col cols="12" sm="6"><v-select v-model="proteinPerKg" :items="[1.75, 2, 2.2]" label="Белки, г на кг веса" /></v-col>
                    <v-col cols="12" sm="6"><v-select v-model="fatPerKg" :items="[0.8, 0.9, 1]" label="Жиры, г на кг веса" /></v-col>
                  </v-row>
                  <v-row v-else>
                    <v-col cols="12" sm="4"><v-text-field :model-value="percentValue(macroRatios.protein)" @update:model-value="macroRatios.protein = ratioValue($event)" label="Доля белков" suffix="%" min="0" max="100" step="1" type="number" /></v-col>
                    <v-col cols="12" sm="4"><v-text-field :model-value="percentValue(macroRatios.fat)" @update:model-value="macroRatios.fat = ratioValue($event)" label="Доля жиров" suffix="%" min="0" max="100" step="1" type="number" /></v-col>
                    <v-col cols="12" sm="4"><v-text-field :model-value="percentValue(macroRatios.carbs)" @update:model-value="macroRatios.carbs = ratioValue($event)" label="Доля углеводов" suffix="%" min="0" max="100" step="1" type="number" /></v-col>
                  </v-row>
                  <p class="settings-help">{{ macroMode === 'weight' ? `Вес из профиля — ${profile?.weight || '—'} кг. Белки и жиры рассчитываем по весу, оставшиеся калории отводим углеводам.` : 'Укажите проценты. Их сумма должна равняться 100%: например, 30% белков, 25% жиров и 45% углеводов.' }}</p>
                  <v-alert v-if="nutrientTarget.carbs < 0" type="error" variant="tonal" class="mt-3">Белки и жиры превышают цель по калориям. Уменьшите значения или измените цель в профиле.</v-alert>
                </v-expansion-panel-text>
              </v-expansion-panel>
              <v-expansion-panel>
                <v-expansion-panel-title><div class="settings-title"><MpIcon name="book" :size="19" /><span>Любимые рецепты<small>{{ selectedRecipesForGeneration.length ? `Личных рецептов для подбора: ${selectedRecipesForGeneration.length}` : 'Добавьте свои блюда или коллекцию' }}</small></span></div></v-expansion-panel-title>
                <v-expansion-panel-text>
                  <p class="settings-help mb-4">Основу меню составят базовые блюда. Добавьте личные рецепты, которые хотите включить в подбор.</p>
                  <v-tabs v-model="recipeTab" color="primary" class="mb-4"><v-tab value="custom">Мои рецепты</v-tab><v-tab value="collections">Коллекции</v-tab></v-tabs>
                  <v-window v-model="recipeTab">
                    <v-window-item value="custom">
                      <div v-if="!(settings?.customRecipes || []).length" class="settings-empty"><MpIcon name="book" :size="25" /><p>Личных рецептов пока нет. Меню можно составить из базовых блюд.</p><NuxtLink to="/recipes">Перейти к рецептам →</NuxtLink></div>
                      <div v-else class="recipe-choices">
                        <div v-for="recipe in settings?.customRecipes || []" :key="recipe.id" class="recipe-choice" :class="{ 'recipe-choice--selected': selectedCustomRecipeIds.includes(recipe.id) }">
                          <v-checkbox :aria-label="`Включить ${recipe.title}`" color="primary" density="compact" hide-details :model-value="selectedCustomRecipeIds.includes(recipe.id)" @update:model-value="setCustomRecipeEnabled(recipe, Boolean($event))" />
                          <div class="recipe-choice__name"><strong>{{ recipe.title }}</strong><span>{{ formatMealTypes(recipe.mealTypes || []) }}</span><small v-if="recipeCollectionNames(recipe.id).length">{{ recipeCollectionNames(recipe.id).join(' · ') }}</small></div>
                          <v-text-field v-model.number="preferenceFor(recipe).maxPerWeek" :aria-label="`Повторов в неделю: ${recipe.title}`" label="До раз в неделю" density="compact" hide-details min="1" max="6" type="number" @update:model-value="scheduleSavePreferences" />
                        </div>
                      </div>
                      <p v-if="settings?.customRecipes.length" class="preference-status" role="status">{{ savingPreferences ? 'Сохраняем выбор…' : preferenceSaveError ? 'Изменения пока не сохранены' : 'Ваш выбор сохраняется автоматически' }}</p>
                    </v-window-item>
                    <v-window-item value="collections">
                      <v-select v-model="selectedCollectionId" clearable :items="settings?.collections || []" item-title="name" item-value="id" label="Добавить коллекцию" />
                      <div v-if="selectedCollection" class="collection-preview"><strong>{{ selectedCollection.name }}</strong><p>{{ selectedCollectionRecipeIds.length }} рецептов</p><div class="collection-preview__recipes"><v-chip v-for="rid in selectedCollectionRecipeIds" :key="rid" size="small" variant="tonal">{{ recipeTitleById(rid) }}</v-chip></div></div>
                      <p v-else class="settings-help">Выберите коллекцию из сохранённых. Создавать и наполнять коллекции можно в <NuxtLink to="/recipes">рецептах</NuxtLink>.</p>
                    </v-window-item>
                  </v-window>
                  <details v-if="selectedRecipesForGeneration.length" class="selected-recipe-summary"><summary>Личные рецепты для подбора · {{ selectedRecipesForGeneration.length }}</summary><ul><li v-for="item in selectedRecipesForGeneration" :key="item.recipe.id"><NuxtLink :to="`/recipes/${item.recipe.id}`">{{ item.recipe.title }}</NuxtLink><span>{{ item.from }}</span></li></ul></details>
                </v-expansion-panel-text>
              </v-expansion-panel>
              <v-expansion-panel>
                <v-expansion-panel-title><div class="settings-title"><MpIcon name="sun" :size="20" /><span>Ритм дня<small>{{ meals.map(meal => meal.title).join(' · ') }}</small></span></div></v-expansion-panel-title>
                <v-expansion-panel-text>
                  <v-btn variant="text" color="primary" class="mb-3" @click="resetMealRhythm">Подобрать ритм под текущую цель</v-btn>
                  <p class="settings-help mb-5">От 1 до 6 приёмов пищи. Укажите, какую часть дня отвести каждому: например, 25% на завтрак. Если сумма отличается от 100%, мы сохраним пропорции и пересчитаем доли.</p>
                  <div v-for="(meal, index) in meals" :key="meal.key" class="meal-setting">
                    <div class="meal-setting__head"><strong>{{ String(index + 1).padStart(2, '0') }} / {{ meal.title }}</strong><div><v-btn size="x-small" variant="text" :disabled="index === 0" :aria-label="`Переместить ${meal.title || 'приём пищи'} выше`" @click="moveMeal(index, -1)">Выше</v-btn><v-btn size="x-small" variant="text" :disabled="index === meals.length - 1" :aria-label="`Переместить ${meal.title || 'приём пищи'} ниже`" @click="moveMeal(index, 1)">Ниже</v-btn><v-btn size="x-small" variant="text" color="error" :disabled="meals.length === 1" :aria-label="`Удалить ${meal.title || 'приём пищи'}`" @click="meals.splice(index, 1)">Удалить</v-btn></div></div>
                    <v-row><v-col cols="12" sm="6"><v-text-field v-model="meal.title" label="Название" hide-details /></v-col><v-col cols="12" sm="6"><v-select v-model="meal.type" :items="mealTypeItems" item-title="title" item-value="value" label="Тип приёма пищи" hide-details /></v-col><v-col cols="12" sm="6"><v-text-field :model-value="percentValue(meal.percent)" @update:model-value="meal.percent = ratioValue($event)" label="Доля дневного рациона" suffix="%" min="1" max="100" step="1" type="number" hide-details /></v-col><v-col cols="12" sm="6"><v-select v-model="meal.maxItems" :items="[{ title: 'Только блюдо', value: 1 }, { title: 'Блюдо + дополнение', value: 2 }]" label="Состав" hide-details /></v-col></v-row>
                  </div>
                  <v-btn variant="outlined" color="primary" :disabled="meals.length >= 6" @click="addMeal"><MpIcon name="plus" :size="16" class="mr-2" /> Добавить приём пищи</v-btn>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels></v-form>
          </fieldset>
          <p class="generation-footnote">Учитываем размер готовой порции и сочетаемость продуктов. Калории распределяем между приёмами пищи; при недоборе покажем отклонение. Пропорции личных рецептов сохранятся.</p>
          <v-alert v-if="loading" type="info" variant="tonal" class="mt-4" role="status">Подбираем блюда и рассчитываем порции. Это может занять немного времени.</v-alert>
        </v-card-text>
        <div class="generation-dialog__actions"><v-btn variant="text" :disabled="loading" @click="generationOpen = false">Отмена</v-btn><v-btn color="primary" size="large" :loading="loading" :disabled="!profile?.calories || !startDate || nutrientTarget.carbs < 0" @click="generate">Составить меню <MpIcon name="arrow-right" :size="18" class="ml-2" /></v-btn></div>
      </v-card>
    </v-dialog>
    <v-dialog v-model="leaveConfirmationOpen" persistent max-width="440">
      <v-card class="pa-6" rounded="xl">
        <h2 class="text-h6 mb-3">Выбор рецептов не сохранён</h2>
        <p class="text-body-2 text-medium-emphasis">Не удалось сохранить изменения. Можно остаться и попробовать снова или уйти без этих изменений.</p>
        <div class="d-flex flex-wrap justify-end ga-2 mt-6">
          <v-btn variant="text" @click="finishLeaveDecision(true)">Уйти без сохранения</v-btn>
          <v-btn color="primary" @click="finishLeaveDecision(false)">Остаться</v-btn>
        </div>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { onBeforeRouteLeave } from 'vue-router'
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useApi, type MealPlan, type MealPlanItem, type MenuSettings, type Profile, type Recipe, type RecipePreference } from '~/composables/useApi'
import { localDate, errorMessage } from '~/utils/storage'
import { relevantPlan } from '~/utils/plans'
import { changedPreferences } from '~/utils/preferences'
import { useUiStore } from '~/stores/ui'

const api = useApi()
const billingNotice = ref<{ refresh: () => Promise<void> } | null>(null)
const ui = useUiStore()
const route = useRoute()
const router = useRouter()
const initialLoading = ref(true)
const loadError = ref('')
const withinTarget = computed(() => !!plan.value && planDays.value.filter(day => !day.free).every(day => Math.abs(dayTotals(day).calories - plan.value!.targetCalories / plan.value!.daysCount) <= plan.value!.targetCalories / plan.value!.daysCount * 0.1))

const profile = ref<Profile | null>(null)
const plan = ref<MealPlan | null>(null)
const history = ref<MealPlan[]>([])
const historyHasMore = ref(false), historyLoading = ref(false), historyError = ref('')
let historyOffset = 0
let planRequest = 0
const settings = ref<MenuSettings | null>(null)
const loading = ref(false)
const savingPreferences = ref(false)
const preferenceSaveError = ref('')
const leaveConfirmationOpen = ref(false)
const recipeTab = ref('custom')
const generationOpen = ref(false)
const selectedDayIndex = ref(0)
// Vuetify v-select may emit string ids depending on items typing, so normalize comparisons.
const selectedCollectionId = ref<number | string | null>(null)
const startDate = ref(localDate())
const selectedCustomRecipeIds = ref<number[]>([])
const preferences = reactive<Record<number, RecipePreference>>({})
const savedPreferences: Record<number, RecipePreference> = {}
let saveTimer: ReturnType<typeof setTimeout> | null = null
let pendingSave = Promise.resolve()
let preferenceRevision = 0
let savedPreferenceRevision = 0
let leaveDecision: Promise<boolean> | null = null
let resolveLeaveDecision: ((leave: boolean) => void) | null = null

const macroMode = ref<'weight' | 'ratio'>('weight')
const proteinPerKg = ref(1.75)
const fatPerKg = ref(0.9)
const nutrientTarget = computed(() => {
  const calories = profile.value?.calories || 0
  const weight = profile.value?.weight || 0
  if (macroMode.value === 'ratio') return { protein: calories * macroRatios.protein / 4, fat: calories * macroRatios.fat / 9, carbs: calories * macroRatios.carbs / 4 }
  const protein = Math.round(weight * proteinPerKg.value * 10) / 10
  const fat = Math.round(weight * fatPerKg.value * 10) / 10
  return { protein, fat, carbs: (calories - protein * 4 - fat * 9) / 4 }
})
const macroRatios = reactive({ protein: 0.3, fat: 0.25, carbs: 0.45 })
const percentValue = (ratio: number) => Number.isFinite(ratio) ? Math.round(ratio * 10000) / 100 : ''
const ratioValue = (value: unknown) => value === '' || value === null ? NaN : Number(value) / 100
const meals = reactive([
  { key: 'breakfast', type: 'breakfast', title: 'Завтрак', percent: 0.25, maxItems: 2 },
  { key: 'lunch', type: 'lunch', title: 'Обед', percent: 0.35, maxItems: 2 },
  { key: 'snack', type: 'snack', title: 'Перекус', percent: 0.1, maxItems: 2 },
  { key: 'dinner', type: 'dinner', title: 'Ужин', percent: 0.3, maxItems: 2 }
])
const resetMealRhythm = () => {
  if (settings.value?.defaultMeals.length) meals.splice(0, meals.length, ...settings.value.defaultMeals.map((meal, index) => ({ ...meal, key: `recommended-${index}` })))
}
const mealTypeItems = [
  { value: 'breakfast', title: 'Завтрак' },
  { value: 'lunch', title: 'Обед' },
  { value: 'dinner', title: 'Ужин' },
  { value: 'snack', title: 'Перекус' },
  { value: 'any', title: 'Любой' }
]
let nextMealKey = 0
const addMeal = () => {
  if (meals.length >= 6) return
  meals.push({ key: `added-${++nextMealKey}`, type: 'snack', title: `Перекус ${meals.filter(meal => meal.type === 'snack').length + 1}`, percent: 0.1, maxItems: 2 })
}
const moveMeal = (index: number, direction: number) => {
  const destination = index + direction
  if (destination < 0 || destination >= meals.length) return
  const [meal] = meals.splice(index, 1)
  meals.splice(destination, 0, meal)
}

const hydratePreferences = () => {
  const allRecipes = [...(settings.value?.baseRecipes || []), ...(settings.value?.customRecipes || [])]
  const existing = new Map((settings.value?.preferences || []).map(pref => [pref.recipeId, pref]))
  for (const recipe of allRecipes) {
    preferences[recipe.id] = {
      recipeId: recipe.id,
      enabled: existing.get(recipe.id)?.enabled ?? true,
      includeInGeneration: existing.get(recipe.id)?.includeInGeneration ?? false,
      maxPerWeek: existing.get(recipe.id)?.maxPerWeek ?? (recipe.isBase ? 4 : 3)
    }
    savedPreferences[recipe.id] = { ...preferences[recipe.id] }
  }
  selectedCustomRecipeIds.value = (settings.value?.customRecipes || [])
    .filter(recipe => preferences[recipe.id]?.includeInGeneration)
    .map(recipe => recipe.id)
}

const preferenceFor = (recipe: Recipe) => {
  if (!preferences[recipe.id]) {
    preferences[recipe.id] = {
      recipeId: recipe.id,
      enabled: true,
      includeInGeneration: false,
      maxPerWeek: recipe.isBase ? 4 : 3
    }
  }
  return preferences[recipe.id]
}

const setCustomRecipeEnabled = (recipe: Recipe, enabled: boolean) => {
  const current = new Set(selectedCustomRecipeIds.value)
  if (enabled) current.add(recipe.id)
  else current.delete(recipe.id)
  selectedCustomRecipeIds.value = Array.from(current)
  preferenceFor(recipe).includeInGeneration = enabled
  scheduleSavePreferences()
}

const savePreferences = () => {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
  for (const recipe of settings.value?.customRecipes || []) {
    preferenceFor(recipe).includeInGeneration = selectedCustomRecipeIds.value.includes(recipe.id)
  }
  const snapshot = (settings.value?.customRecipes || []).map(recipe => ({ ...preferenceFor(recipe) }))
  const revision = preferenceRevision
  savingPreferences.value = true
  const request = pendingSave.catch(() => undefined).then(async () => {
    try {
      const changes = changedPreferences(snapshot, savedPreferences)
      if (changes.length) {
        await api.saveMenuPreferences(changes)
        for (const preference of changes) savedPreferences[preference.recipeId] = { ...preference }
      }
      savedPreferenceRevision = Math.max(savedPreferenceRevision, revision)
      if (revision === preferenceRevision) preferenceSaveError.value = ''
    } catch (error) {
      if (revision === preferenceRevision) preferenceSaveError.value = errorMessage(error)
      throw error
    }
  })
  pendingSave = request
  return request.finally(() => { if (pendingSave === request) savingPreferences.value = false })
}

const retryPreferences = () => { void savePreferences().catch(() => undefined) }
const scheduleSavePreferences = () => {
  preferenceRevision += 1
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(retryPreferences, 400)
}
const confirmUnsavedLeave = () => {
  if (!leaveDecision) {
    leaveDecision = new Promise<boolean>(resolve => { resolveLeaveDecision = resolve })
    leaveConfirmationOpen.value = true
  }
  return leaveDecision
}
const finishLeaveDecision = (leave: boolean) => {
  leaveConfirmationOpen.value = false
  resolveLeaveDecision?.(leave)
  resolveLeaveDecision = null
  leaveDecision = null
}

const planDays = computed(() => {
  const current = plan.value
  if (!current) return []
  return Array.from({ length: Math.max(7, current.daysCount) }, (_, index) => {
    const date = new Date(`${(current.startDate || current.createdAt).slice(0, 10)}T12:00:00`)
    date.setDate(date.getDate() + index)
    const groups = new Map<string, { key: string; title: string; items: MealPlanItem[] }>()
    for (const item of current.items.filter(item => item.dayIndex === index)) {
      const key = item.mealTitle ? String(item.mealIndex) : item.mealType
      const group = groups.get(key) || { key, title: item.mealTitle || current.settings?.meals?.find(meal => meal.type === item.mealType)?.title || mealTypeItems.find(meal => meal.value === item.mealType)?.title || item.mealType, items: [] }
      group.items.push(item)
      groups.set(key, group)
    }
    return {
      index,
      date,
      title: `День ${index + 1}`,
      subtitle: date.toLocaleDateString('ru-RU'),
      weekday: date.toLocaleDateString('ru-RU', { weekday: 'short' }),
      dayOfMonth: date.getDate(),
      fullDate: date.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }),
      free: index >= current.daysCount,
      groups: [...groups.values()]
    }
  })
})

const selectedDay = computed(() => planDays.value.find(day => day.index === selectedDayIndex.value) || planDays.value[0])
const planMealCount = computed(() => planDays.value.reduce((sum, day) => sum + day.groups.length, 0))
const planDateRange = computed(() => {
  const days = planDays.value
  if (!days.length) return ''
  const first = days[0].date
  const last = days[days.length - 1].date
  const sameMonth = first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear()
  const start = first.toLocaleDateString('ru-RU', sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'long' })
  return `${start} — ${last.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}`
})
const formatPlanStart = (item: MealPlan) => new Date(`${(item.startDate || item.createdAt).slice(0, 10)}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
const selectCurrentDay = () => {
  const requestedDay = typeof route.query.day === 'string' ? Number(route.query.day) : NaN
  if (Number.isInteger(requestedDay) && planDays.value.length) {
    selectedDayIndex.value = Math.max(0, Math.min(requestedDay, planDays.value.length - 1))
    return
  }
  const today = new Date()
  const day = planDays.value.find(item => item.date.toDateString() === today.toDateString())
  selectedDayIndex.value = day?.index ?? 0
}

const dayTotals = (day: { groups: Array<{ items: MealPlanItem[] }> }) => {
  return day.groups.reduce((acc, group) => {
    for (const item of group.items) {
      acc.calories += item.calories || 0
      acc.protein += item.protein || 0
      acc.fat += item.fat || 0
      acc.carbs += item.carbs || 0
    }
    return acc
  }, { calories: 0, protein: 0, fat: 0, carbs: 0 })
}
const selectedDayTotals = computed(() => selectedDay.value ? dayTotals(selectedDay.value) : { calories: 0, protein: 0, fat: 0, carbs: 0 })
const dayCaloriePercent = computed(() => {
  const target = plan.value ? plan.value.targetCalories / Math.max(plan.value.daysCount, 1) : 0
  return target > 0 ? Math.min(100, Math.max(0, selectedDayTotals.value.calories / target * 100)) : 0
})
const dayDeviation = (day: { groups: Array<{ items: MealPlanItem[] }> }) => {
  if (!plan.value) return ''
  const total = dayTotals(day)
  const difference = (actual: number, target: number) => {
    const value = Math.round(actual - target / plan.value!.daysCount)
    return value > 0 ? `+${value}` : value < 0 ? `−${Math.abs(value)}` : '0'
  }
  return `${difference(total.calories, plan.value.targetCalories)} ккал · Б ${difference(total.protein, plan.value.targetProtein)} г · Ж ${difference(total.fat, plan.value.targetFat)} г · У ${difference(total.carbs, plan.value.targetCarbs)} г`
}
const formatMealTypes = (types: string[]) => {
  if (!types.length) return 'Любой'
  return types.map(type => mealTypeItems.find(item => item.value === type)?.title || type).join(', ')
}
const formatMealsCount = (count: number) => {
  const last = count % 10
  const form = count % 100 >= 11 && count % 100 <= 14 ? 'приёмов' : last === 1 ? 'приём' : last >= 2 && last <= 4 ? 'приёма' : 'приёмов'
  return `${count} ${form} пищи`
}
const recipeTitleById = (id: number) => {
  const all = [...(settings.value?.customRecipes || []), ...(settings.value?.baseRecipes || [])]
  return all.find(r => r.id === id)?.title || `#${id}`
}

const recipeCollectionsMap = computed(() => {
  const map = new Map<number, string[]>()
  for (const collection of settings.value?.collections || []) {
    for (const item of collection.items || []) {
      const list = map.get(item.recipeId) || []
      list.push(collection.name)
      map.set(item.recipeId, list)
    }
  }
  for (const [key, value] of map.entries()) {
    map.set(key, Array.from(new Set(value)).sort((a, b) => a.localeCompare(b)))
  }
  return map
})

const recipeCollectionNames = (recipeId: number) => recipeCollectionsMap.value.get(recipeId) || []

const selectedCollection = computed(() => {
  if (selectedCollectionId.value === null || selectedCollectionId.value === undefined || selectedCollectionId.value === '') return null
  const id = Number(selectedCollectionId.value)
  if (!Number.isFinite(id)) return null
  return (settings.value?.collections || []).find(c => c.id === id) || null
})

const selectedCollectionRecipeIds = computed(() => {
  return selectedCollection.value?.items?.map(item => Number(item.recipeId)).filter(n => Number.isFinite(n)) || []
})

const selectedRecipesForGeneration = computed(() => {
  const customRecipes = settings.value?.customRecipes || []
  const selectedByUser = new Set(selectedCustomRecipeIds.value)
  const selectedFromCollection = new Set(selectedCollectionRecipeIds.value)

  const result: Array<{ recipe: Recipe; from?: string }> = []
  for (const recipe of customRecipes) {
    const inUser = selectedByUser.has(recipe.id)
    const inCol = selectedFromCollection.has(recipe.id)
    if (!inUser && !inCol) continue

    let from: string | undefined
    if (inUser && inCol) from = "Выбрано + коллекция"
    else if (inUser) from = "Выбрано вручную"
    else from = "Из коллекции"

    result.push({ recipe, from })
  }

  return result.sort((a, b) => a.recipe.title.localeCompare(b.recipe.title))
})

const averageCalories = computed(() => plan.value ? Math.round(plan.value.totalCalories / Math.max(plan.value.daysCount, 1)) : 0)
const averageProtein = computed(() => plan.value ? Math.round(plan.value.totalProtein / Math.max(plan.value.daysCount, 1)) : 0)
const averageFat = computed(() => plan.value ? Math.round(plan.value.totalFat / Math.max(plan.value.daysCount, 1)) : 0)
const averageCarbs = computed(() => plan.value ? Math.round(plan.value.totalCarbs / Math.max(plan.value.daysCount, 1)) : 0)
const macroBar = computed(() => {
  const total = averageProtein.value * 4 + averageFat.value * 9 + averageCarbs.value * 4
  if (!total) return { protein: 33.33, fat: 33.33, carbs: 33.34 }
  return {
    protein: averageProtein.value * 4 / total * 100,
    fat: averageFat.value * 9 / total * 100,
    carbs: averageCarbs.value * 4 / total * 100
  }
})

const restorePlanSettings = (item: MealPlan | null) => {
  // Legacy plans retain their snapshots, but regeneration starts with the new method.
  if (!item?.settings || (item.settings.generatorVersion || 0) < 2) return
  const saved = item.settings
  macroMode.value = saved.macroMode === 'ratio' ? 'ratio' : 'weight'
  proteinPerKg.value = saved.proteinPerKg ?? 1.75
  fatPerKg.value = saved.fatPerKg ?? 0.9
  if (saved.macroRatios) Object.assign(macroRatios, saved.macroRatios)
  if (saved.meals?.length) meals.splice(0, meals.length, ...saved.meals.map((meal, index) => ({ ...meal, key: `meal-${index}`, maxItems: Math.min(2, meal.maxItems) })))
  selectedCollectionId.value = settings.value?.collections.some(collection => collection.id === saved.collectionId) ? saved.collectionId! : null
}
const openPlan = async (item: MealPlan) => {
  planRequest += 1
  loadError.value = ''
  plan.value = item
  restorePlanSettings(item)
  selectCurrentDay()
  await router.replace({ query: { plan: String(item.id) } })
}
const removePlan = async (item: MealPlan) => {
  if (!confirm('Удалить это сохранённое меню?')) return
  try {
    await api.deleteMealPlan(item.id)
    if (history.value.some(plan => plan.id === item.id)) historyOffset = Math.max(0, historyOffset - 1)
    history.value = history.value.filter(plan => plan.id !== item.id)
    if (plan.value?.id === item.id) {
      plan.value = relevantPlan(history.value)
      restorePlanSettings(plan.value)
      selectCurrentDay()
      await router.replace({ query: plan.value ? { plan: String(plan.value.id) } : {} })
    }
    ui.notify('Меню удалено')
  } catch (error) { ui.error(error) }
}
const openRequestedGeneration = async () => {
  if (route.query.new !== '1') return
  if (profile.value?.calories) generationOpen.value = true
  const query = { ...route.query }
  delete query.new
  await router.replace({ query })
}
const load = async () => {
  initialLoading.value = true
  loadError.value = ''
  try {
    const [p, h, s] = await Promise.all([api.getProfile(), api.getMealPlans(), api.getMenuSettings()])
    profile.value = p; history.value = h; settings.value = s
    historyOffset = h.length; historyHasMore.value = h.length === 20; historyError.value = ''
    meals.splice(0, meals.length, ...s.defaultMeals.map((meal, index) => ({ ...meal, key: `meal-${index}`, maxItems: Math.min(2, meal.maxItems) })))
    const selectedId = Number(route.query.plan)
    plan.value = selectedId ? history.value.find(item => item.id === selectedId) || await api.getMealPlan(selectedId) : relevantPlan(h)
    restorePlanSettings(plan.value)
    selectCurrentDay()
    hydratePreferences()
    await openRequestedGeneration()
  } catch (error) { loadError.value = errorMessage(error) }
  finally { initialLoading.value = false }
}

const loadMoreHistory = async () => {
  if (historyLoading.value) return
  historyLoading.value = true; historyError.value = ''
  try {
    const items = await api.getMealPlans(historyOffset)
    historyOffset += items.length; historyHasMore.value = items.length === 20
    const existing = new Set(history.value.map(item => item.id))
    history.value.push(...items.filter(item => !existing.has(item.id)))
  } catch (error) { historyError.value = errorMessage(error) }
  finally { historyLoading.value = false }
}
const syncRequestedPlan = async () => {
  if (initialLoading.value) return
  const id = Number(route.query.plan)
  const version = ++planRequest
  if (id === plan.value?.id) return
  try {
    const requested = id ? history.value.find(item => item.id === id) || await api.getMealPlan(id) : relevantPlan(history.value)
    if (version !== planRequest) return
    plan.value = requested; restorePlanSettings(requested); selectCurrentDay(); loadError.value = ''
  } catch (error) { if (version === planRequest) loadError.value = errorMessage(error) }
}
const generate = async () => {
  if (loading.value) return
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate.value) || !Number.isFinite(new Date(`${startDate.value}T12:00:00`).getTime())) {
    ui.notify('Укажите дату начала недели', 'error'); return
  }
  if (macroMode.value === 'ratio' && (Object.values(macroRatios).some(value => !Number.isFinite(value) || value < 0 || value > 1) || Math.abs(macroRatios.protein + macroRatios.fat + macroRatios.carbs - 1) > 0.001)) {
    ui.notify('Сумма долей белков, жиров и углеводов должна быть 100%', 'error'); return
  }
  if (nutrientTarget.value.carbs < 0) { ui.notify('Для выбранных белков и жиров недостаточно калорий', 'error'); return }
  if (meals.some(meal => !meal.title.trim() || !Number.isFinite(meal.percent) || meal.percent <= 0 || meal.percent > 1 || !Number.isInteger(meal.maxItems) || meal.maxItems < 1 || meal.maxItems > 2)) {
    ui.notify('Укажите название, долю от 1 до 100% и состав для каждого приёма пищи', 'error'); return
  }
  if (!profile.value?.calories) {
    ui.notify('Сначала создайте цель по калориям')
    return
  }

  loading.value = true
  try {
    await savePreferences()
    const generated = await api.generateMenu({
      daysCount: 6,
      startDate: startDate.value,
      collectionId: selectedCollectionId.value ? Number(selectedCollectionId.value) : null,
      macroMode: macroMode.value,
      proteinPerKg: proteinPerKg.value,
      fatPerKg: fatPerKg.value,
      ...(macroMode.value === 'ratio' ? { macroRatios } : {}),
      meals: meals.map(({ type, title, percent, maxItems }) => ({ type, title, percent, maxItems })),
      scoreWeights: { protein: 1.5, calories: 5, fat: 1, carbs: 1 }
    })
    plan.value = generated
    historyOffset += 1
    history.value = [generated, ...history.value.filter(item => item.id !== generated.id)]
    selectedDayIndex.value = 0
    generationOpen.value = false
    void billingNotice.value?.refresh()
    ui.notify('Ваша неделя готова')
    await router.replace({ query: { plan: String(generated.id) } }).catch(() => {
      ui.notify('Неделя готова. Не удалось обновить ссылку на меню.', 'warning')
    })
  } catch (error) {
    if (preferenceSaveError.value) ui.notify('Меню не создано: не удалось сохранить выбор рецептов. Повторите сохранение.', 'error')
    else ui.error(error)
    void billingNotice.value?.refresh()
  } finally {
    loading.value = false
  }
}

watch(() => route.query.plan, syncRequestedPlan)
watch(() => route.query.day, () => { if (!initialLoading.value) selectCurrentDay() })
watch(() => route.query.new, () => {
  if (!initialLoading.value && settings.value) void openRequestedGeneration().catch(ui.error)
})
onMounted(load)
onBeforeUnmount(() => {
  if (saveTimer) clearTimeout(saveTimer)
  if (leaveDecision) finishLeaveDecision(false)
})
onBeforeRouteLeave(async to => {
  if (to.path === '/login') return
  if (loading.value) { ui.notify('Дождитесь составления меню'); return false }
  try {
    if (saveTimer || preferenceRevision > savedPreferenceRevision || preferenceSaveError.value) await savePreferences()
    else await pendingSave
  } catch {
    return confirmUnsavedLeave()
  }
})
</script>

<style scoped>
.week-page { --week-ink: #264b3f; --week-muted: var(--text-secondary); --week-line: #e6e9de; }
.week-page .mp-page-head { align-items: center; }
.mobile-break { display: none; }
.week-new-icon { margin-right: 8px; }
.week-loading { min-height: 350px; display: flex; align-items: center; justify-content: center; gap: 16px; color: var(--week-muted); }
.week-intro { display: flex; align-items: center; gap: 19px; padding: 28px 32px; border: 1px solid #e1e6d2; border-radius: 22px; background: #ecf0df; }
.week-intro__icon { width: 58px; height: 58px; display: grid; place-items: center; flex-shrink: 0; border-radius: 18px; background: #dde6c5; color: var(--week-ink); }
.week-intro__text { flex: 1; }
.week-intro .mp-overline { color: var(--text-secondary); font-size: 12px; letter-spacing: .16em; }
.week-intro h2 { font: 27px/1.3 Georgia, serif; color: var(--week-ink); margin: 4px 0 5px; }
.week-intro p { font-size: 12px; color: var(--text-secondary); margin: 0; }
.week-intro__action { flex-shrink: 0; }
.week-strip { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 9px; margin: 28px 0 37px; }
.week-day { display: flex; flex-direction: column; align-items: center; min-height: 122px; padding: 14px 5px 10px; border: 1px solid var(--week-line); border-radius: 16px; background: #fff; color: var(--week-muted); transition: border-color .16s, background-color .16s, transform .16s; cursor: pointer; }
.week-day:hover { border-color: #b7c79a; transform: translateY(-2px); }
.week-day:focus-visible { outline: 3px solid #aac17b; outline-offset: 3px; }
.week-day--active { color: #fff; background: var(--week-ink); border-color: var(--week-ink); box-shadow: 0 6px 14px #264b3f14; }
.week-day--free:not(.week-day--active) { background: transparent; border-style: dashed; }
.week-day__name { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; }
.week-day__date { font-size: 29px; font-weight: 500; line-height: 1.5; color: #334738; }
.week-day--active .week-day__date { color: #fff; }
.week-day__meta { font-size: 12px; white-space: nowrap; }
.week-day--active .week-day__meta, .week-day--active .week-day__name { color: #dbe5d3; }
.week-day__dot { width: 4px; height: 4px; margin-top: 8px; border-radius: 100%; background: transparent; }
.week-day--active .week-day__dot { background: #dce8ad; }
.day-layout { display: grid; grid-template-columns: minmax(0, 1fr) 284px; gap: 28px; align-items: start; }
.day-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 22px; }
.day-heading .mp-overline { font-size: 12px; }
.day-heading h2 { font: 26px/1.4 Georgia, serif; color: var(--week-ink); margin-top: 4px; }
.day-heading h2::first-letter { text-transform: uppercase; }
.day-heading__count { font-size: 11px; color: var(--week-muted); white-space: nowrap; }
.meal-list { display: grid; gap: 16px; }
.meal-card { border-radius: 18px; overflow: hidden; }
.meal-card__head { display: flex; align-items: center; gap: 12px; padding: 16px 23px; border-bottom: 1px solid #edf0e8; }
.meal-card__number { width: 27px; height: 27px; display: grid; place-items: center; border-radius: 8px; background: #f0f3e8; color: var(--text-secondary); font-size: 11px; }
.meal-card__head h3 { color: #58704e; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: .07em; flex: 1; }
.meal-card__energy { color: #3b513e; font-size: 13px; font-weight: 600; }
.meal-card__energy span { color: var(--text-secondary); font-size: 12px; font-weight: 400; }
.meal-card__body { padding: 2px 23px; }
.dish { padding: 20px 0; }
.dish + .dish { border-top: 1px solid #eef0e8; }
.dish__title { display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #2d3d30; text-decoration: none; font-size: 17px; line-height: 1.45; font-weight: 550; }
a.dish__title:hover { color: var(--text-secondary); }
.dish__title :deep(svg) { flex-shrink: 0; color: var(--text-secondary); }
.dish__meta { display: flex; flex-wrap: wrap; gap: 5px 14px; color: var(--text-secondary); font-size: 11px; margin-top: 9px; }
.dish-ingredients { margin-top: 13px; }
.dish-ingredients summary, .balance-detail summary { list-style: none; display: inline-flex; align-items: center; gap: 8px; cursor: pointer; color: var(--text-secondary); font-size: 11px; }
.dish-ingredients summary::-webkit-details-marker, .balance-detail summary::-webkit-details-marker, .plan-history > summary::-webkit-details-marker { display: none; }
.dish-ingredients[open] summary :deep(svg), .balance-detail[open] summary :deep(svg), .plan-history[open] > summary > :deep(svg) { transform: rotate(45deg); }
.dish-ingredients ul { list-style: none; padding: 10px 12px; margin-top: 10px; border-radius: 9px; background: #f7f8f2; }
.dish-ingredients li { display: flex; justify-content: space-between; gap: 18px; padding: 5px 0; font-size: 11px; color: var(--text-secondary); }
.dish-ingredients li > span:last-child { text-align: right; flex-shrink: 0; }
.day-sidebar { display: flex; flex-direction: column; gap: 18px; padding-top: 0; }
.day-balance { border-radius: 18px; padding: 24px; }
.day-balance__heading { display: flex; align-items: center; gap: 9px; color: var(--text-secondary); }
.day-balance__heading h3 { font-size: 13px; font-weight: 600; }
.energy-total { font-size: 39px; font-weight: 500; color: var(--week-ink); line-height: 1.2; margin-top: 26px; }
.energy-total > span { font-size: 12px; color: var(--text-secondary); font-weight: 400; }
.energy-goal { font-size: 11px; color: var(--text-secondary); margin-top: 5px; }
.energy-track { height: 5px; border-radius: 5px; background: #eef1e6; overflow: hidden; margin: 17px 0 22px; }
.energy-track > span { display: block; height: 100%; border-radius: inherit; background: #9cae75; }
.nutrient-list { display: grid; gap: 15px; }
.nutrient-list > div { display: flex; align-items: center; justify-content: space-between; }
.nutrient-list dt { display: flex; align-items: center; gap: 10px; font-size: 12px; color: var(--text-secondary); }
.nutrient-list dd { font-size: 16px; color: #354f3e; font-weight: 550; }
.nutrient-list dd span { font-size: 12px; color: var(--text-secondary); font-weight: 400; }
.nutrient-dot { width: 7px; height: 7px; border-radius: 50%; }
.nutrient-dot--protein { background: #779575; }.nutrient-dot--fat { background: #d8bf88; }.nutrient-dot--carbs { background: #b8c9a0; }
.balance-detail { border-top: 1px solid #e8ecdf; margin-top: 20px; padding-top: 13px; }
.balance-detail p { font-size: 12px; color: var(--text-secondary); margin: 9px 0 0; line-height: 1.7; }
.week-note { padding: 21px 23px; border: 1px solid #e5e9d9; border-radius: 17px; background: #f0f3e7; }
.week-note > .mp-overline { font-size: 12px; color: var(--text-secondary); letter-spacing: .12em; }
.week-note > strong { display: block; font-size: 25px; font-weight: 500; margin-top: 7px; color: #49613d; }
.week-note > strong span { font-size: 11px; font-weight: 400; color: var(--text-secondary); }
.week-note__macros { font-size: 12px; color: var(--text-secondary); margin-top: 6px; }
.week-macro-bar { display: flex; height: 4px; border-radius: 5px; overflow: hidden; margin: 16px 0; gap: 3px; }
.week-macro-bar span:nth-child(1) { background: #779575; }.week-macro-bar span:nth-child(2) { background: #d8bf88; }.week-macro-bar span:nth-child(3) { background: #b8c9a0; }
.week-note > p { display: flex; align-items: flex-start; gap: 7px; font-size: 12px; line-height: 1.6; color: var(--text-secondary); margin: 0; }
.week-note > p :deep(svg) { flex-shrink: 0; }
.week-totals { display: grid; gap: 9px; margin-top: 15px; font-size: 12px; color: var(--text-secondary); }
.week-totals div { display: flex; justify-content: space-between; gap: 10px; }
.week-totals dd { text-align: right; font-variant-numeric: tabular-nums; }
.shopping-next { display: flex; align-items: center; gap: 12px; padding: 19px 0; color: var(--week-ink); text-decoration: none; }
.shopping-next__icon { flex-shrink: 0; display: grid; place-items: center; width: 37px; height: 40px; border-radius: 11px; background: #e8eedb; }
.shopping-next > span:nth-child(2) { flex: 1; }
.shopping-next strong { font-size: 11px; font-weight: 600; display: block; }
.shopping-next small { font-size: 12px; color: var(--text-secondary); display: block; margin-top: 4px; line-height: 1.5; }
.free-day { min-height: 350px; padding: 49px 38px; text-align: center; display: flex; flex-direction: column; align-items: center; }
.free-day__icon { width: 78px; height: 78px; border-radius: 100%; background: #f1edda; color: var(--text-secondary); display: grid; place-items: center; }
.free-day h3 { font: 27px/1.35 Georgia, serif; color: var(--week-ink); margin: 22px 0 12px; }
.free-day p { max-width: 360px; color: var(--text-secondary); font-size: 13px; line-height: 1.85; margin-bottom: 25px; }
.week-empty { padding: 52px 25px 45px; display: flex; flex-direction: column; align-items: center; text-align: center; border-radius: 24px; }
.week-empty__art { width: 200px; height: 158px; position: relative; margin-bottom: 18px; }
.week-empty__orbit { position: absolute; width: 150px; height: 150px; border-radius: 50%; background: #f0f3e6; left: 25px; top: 0; }
.week-empty__calendar { position: absolute; top: 31px; left: 52px; width: 97px; height: 99px; border-radius: 23px; display: grid; place-items: center; color: var(--week-ink); background: #dce8ad; transform: rotate(-7deg); }
.week-empty__leaf, .week-empty__sun { position: absolute; width: 46px; height: 46px; border-radius: 50%; display: grid; place-items: center; }
.week-empty__leaf { top: 93px; right: 11px; color: var(--text-secondary); background: #e4ecd8; transform: rotate(13deg); }
.week-empty__sun { top: 3px; left: 14px; color: var(--text-secondary); background: #f3ecd7; }
.week-empty > .mp-overline { font-size: 12px; }
.week-empty h2 { font: 34px/1.35 Georgia, serif; color: var(--week-ink); max-width: 530px; margin: 15px 0; }
.week-empty > p { font-size: 14px; line-height: 1.85; max-width: 460px; color: var(--text-secondary); margin-bottom: 28px; }
.week-empty__steps { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px 26px; margin-top: 35px; font-size: 11px; color: var(--text-secondary); }
.week-empty__steps span { display: flex; align-items: center; gap: 7px; }
.plan-history { margin-top: 36px; border-radius: 18px; }
.plan-history > summary { display: flex; align-items: center; justify-content: space-between; padding: 23px 26px; color: #486144; cursor: pointer; list-style: none; }
.plan-history > summary > span { display: flex; align-items: center; gap: 12px; font-size: 13px; font-weight: 550; }
.plan-history > summary small { color: var(--text-secondary); font-size: 12px; border-radius: 20px; background: #f0f3e8; padding: 3px 8px; }
.history-list { padding: 0 26px 12px; }
.history-entry { display: flex; align-items: center; gap: 18px; padding: 20px 0; border-top: 1px solid var(--week-line); }
.history-entry__date { flex: 1; }
.history-entry strong { display: block; font-weight: 550; font-size: 13px; color: #3d533a; }
.history-entry small { display: block; font-size: 12px; color: var(--text-secondary); margin-top: 5px; }
.history-entry__stats { font-size: 11px; color: var(--text-secondary); }
.history-entry__actions { display: flex; gap: 5px; }
.history-entry--active strong::before { content: ''; display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #92a96d; margin-right: 7px; vertical-align: middle; }
.generation-dialog { border-radius: 24px !important; }
.generation-dialog__head { display: flex; justify-content: space-between; gap: 15px; padding: 28px 30px 22px; border-bottom: 1px solid #e9eddf; flex-shrink: 0; }
.generation-dialog__head h2 { font: 30px/1.4 Georgia, serif; color: #264b3f; margin-top: 5px; }
.generation-dialog__head p { font-size: 12px; color: var(--text-secondary); margin: 6px 0 0; }
.generation-dialog__head .mp-overline { font-size: 12px; }
.generation-dialog__body { padding: 27px 30px !important; }
.generation-basics { display: grid; grid-template-columns: 1fr 1fr; align-items: center; gap: 28px; }
.generation-target { border-left: 1px solid #e4e9da; padding-left: 27px; }
.generation-target > span { font-size: 12px; color: var(--text-secondary); display: block; }
.generation-target strong { font-size: 24px; color: #264b3f; display: block; margin: 3px 0; font-weight: 500; }
.generation-target small { font-size: 11px; font-weight: 400; color: var(--text-secondary); }
.generation-target a { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; text-decoration: none; color: var(--text-secondary); }
.generation-summary { display: flex; align-items: flex-start; gap: 9px; padding: 16px; border-radius: 12px; background: #f0f4e5; color: var(--text-secondary); font-size: 11px; line-height: 1.75; margin: 24px 0; }
.generation-summary :deep(svg) { flex-shrink: 0; }
.settings-intro { font-size: 12px; color: var(--text-secondary); margin: 0 0 17px; }
.generation-fields { min-width: 0; border: 0; padding: 0; }
.generation-settings { border: 1px solid #e4e9da; border-radius: 15px; overflow: hidden; }
.generation-settings :deep(.v-expansion-panel-title) { min-height: 80px; padding: 15px 20px; }
.generation-settings :deep(.v-expansion-panel-text__wrapper) { padding: 8px 20px 22px; }
.generation-settings :deep(.v-expansion-panel) { box-shadow: none; }
.settings-title { display: flex; align-items: flex-start; gap: 14px; color: var(--text-secondary); padding-right: 12px; }
.settings-title > span { font-size: 13px; font-weight: 550; line-height: 1.5; }
.settings-title small { display: block; font-size: 12px; line-height: 1.6; color: var(--text-secondary); font-weight: 400; margin-top: 3px; }
.settings-help { color: var(--text-secondary); font-size: 12px; line-height: 1.8; }
.settings-empty { text-align: center; background: #f7f8f2; padding: 26px; border-radius: 12px; color: var(--text-secondary); font-size: 12px; line-height: 1.8; }
.settings-empty p { margin: 12px 0; }
.settings-empty a { color: var(--text-secondary); }
.recipe-choices { display: grid; gap: 8px; }
.recipe-choice { display: grid; grid-template-columns: 36px minmax(0, 1fr) 132px; align-items: center; gap: 9px; padding: 11px; border: 1px solid #e7ecdf; border-radius: 11px; }
.recipe-choice--selected { border-color: #c5d4ab; background: #f6f8ef; }
.recipe-choice__name strong { display: block; font-size: 12px; font-weight: 550; color: #425a3b; line-height: 1.5; }
.recipe-choice__name span, .recipe-choice__name small { display: block; margin-top: 3px; color: var(--text-secondary); font-size: 12px; }
.recipe-choice :deep(.v-field__input) { font-size: 12px; }
.recipe-choice :deep(.v-field-label) { font-size: 12px; }
.preference-status { text-align: right; margin: 12px 0; font-size: 12px; color: var(--text-secondary); }
.collection-preview { padding: 20px; background: #f5f7ed; border-radius: 12px; color: var(--text-secondary); font-size: 13px; }
.collection-preview > p { font-size: 11px; margin: 6px 0 14px; color: var(--text-secondary); }
.collection-preview__recipes { display: flex; flex-wrap: wrap; gap: 7px; }
.selected-recipe-summary { margin-top: 22px; font-size: 11px; color: var(--text-secondary); }
.selected-recipe-summary summary { cursor: pointer; }
.selected-recipe-summary ul { padding: 12px 0 0; list-style: none; }
.selected-recipe-summary li { display: flex; justify-content: space-between; gap: 12px; margin-top: 9px; }
.selected-recipe-summary a { color: var(--text-secondary); }
.selected-recipe-summary span { color: var(--text-secondary); font-size: 12px; }
.meal-setting { border: 1px solid #e4ead9; border-radius: 12px; padding: 16px; margin-bottom: 16px; }
.meal-setting__head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin: 0 0 15px; }
.meal-setting__head strong { font-size: 12px; color: var(--text-secondary); font-weight: 550; }
.generation-footnote { font-size: 12px; line-height: 1.8; color: var(--text-secondary); margin: 20px 0 0; }
.generation-dialog__actions { padding: 18px 30px; border-top: 1px solid #e7ecdf; display: flex; justify-content: flex-end; gap: 12px; flex-shrink: 0; }
@media (min-width: 1450px) { .day-layout { grid-template-columns: minmax(0, 1fr) 310px; gap: 35px; }.meal-card__body { padding: 4px 28px; }.meal-card__head { padding: 18px 28px; }.dish { padding: 23px 0; } }
@media (max-width: 1120px) { .day-layout { grid-template-columns: minmax(0, 1fr) 250px; gap: 20px; }.week-intro { padding: 24px; }.week-intro h2 { font-size: 23px; }.week-intro__action { font-size: 11px; }.day-heading { flex-wrap: wrap; gap: 6px; }.day-heading h2 { font-size: 23px; }.day-balance { padding: 20px; }.history-entry { flex-wrap: wrap; }.history-entry__stats { flex: 1; }.history-entry__actions { margin-left: auto; } }
@media (max-width: 800px) { .week-intro { flex-wrap: wrap; gap: 15px; }.week-intro__action { margin-left: 73px; }.week-intro__text { flex-basis: calc(100% - 80px); }.day-layout { grid-template-columns: minmax(0, 1fr); }.day-sidebar { display: grid; grid-template-columns: 1fr 1fr; align-items: start; gap: 16px; }.shopping-next { grid-column: 1 / -1; padding: 14px 3px; }.day-balance { grid-row: span 2; }.week-note { min-height: 217px; }.day-sidebar:has(> .week-note:first-child) { display: block; }.week-strip { margin-bottom: 28px; }.week-day__meta { font-size: 12px; }.day-heading__count { margin-left: auto; } }
@media (max-width: 540px) { .week-page .mp-page-head { align-items: flex-start; }.week-page .mp-page-head > .v-btn { width: 100%; }.mobile-break { display: block; }.week-intro { padding: 21px; border-radius: 18px; }.week-intro__icon { width: 43px; height: 46px; border-radius: 13px; }.week-intro__text { flex-basis: calc(100% - 64px); }.week-intro h2 { font-size: 21px; }.week-intro__action { margin-left: 0; width: 100%; margin-top: 3px; }.week-strip { gap: 5px; margin-top: 22px; }.week-day { min-height: 98px; border-radius: 12px; padding-top: 12px; }.week-day__date { font-size: 23px; }.week-day__name { font-size: 12px; }.week-day__meta { font-size: 12px; }.week-day__dot { margin-top: 6px; }.day-heading h2 { font-size: 23px; }.day-heading__count { font-size: 12px; }.meal-card__head { padding: 14px 17px; }.meal-card__body { padding: 0 17px; }.dish__title { font-size: 15px; }.dish__meta { font-size: 12px; gap: 6px 12px; }.dish__macros { flex-basis: 100%; }.day-sidebar { gap: 12px; }.day-balance, .week-note { padding: 18px 15px; }.day-balance__heading h3 { font-size: 12px; }.day-balance__heading { gap: 6px; }.energy-total { font-size: 30px; margin-top: 20px; }.energy-goal { font-size: 12px; }.nutrient-list dt { font-size: 11px; gap: 6px; }.week-note__macros { line-height: 1.8; }.week-note > .mp-overline { font-size: 12px; }.week-note > strong { font-size: 24px; }.week-note .balance-detail summary { font-size: 12px; }.week-totals div { flex-direction: column; gap: 3px; }.week-totals dd { text-align: left; }.week-empty { padding: 35px 21px; }.week-empty h2 { font-size: 28px; }.week-empty > p { font-size: 13px; }.week-empty > .v-btn { font-size: 12px; }.week-empty__steps { font-size: 12px; gap: 10px 15px; }.plan-history > summary { padding: 20px; }.history-list { padding: 0 20px 9px; }.history-entry__date, .history-entry__stats { flex: 1 1 100%; }.history-entry { gap: 10px; }.history-entry__actions { margin: 3px 0 0; }.free-day { padding: 36px 23px; }.free-day h3 { font-size: 26px; }.generation-dialog__head { padding: 23px 20px 19px; }.generation-dialog__body { padding: 22px 17px !important; }.generation-basics { grid-template-columns: 1fr; gap: 20px; }.generation-target { padding: 0; border-left: 0; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }.generation-target strong { font-size: 22px; }.generation-target a { flex-basis: 100%; }.generation-summary { padding: 13px; font-size: 12px; margin: 22px 0; }.generation-settings :deep(.v-expansion-panel-title) { padding: 15px 14px; }.generation-settings :deep(.v-expansion-panel-text__wrapper) { padding: 7px 12px 19px; }.settings-title { gap: 9px; }.recipe-choice { grid-template-columns: 32px minmax(0, 1fr); }.recipe-choice > .v-text-field { grid-column: 2; max-width: 155px; margin-top: 6px; }.meal-setting { padding: 12px; }.meal-setting__head { flex-wrap: wrap; }.meal-setting__head > div { margin-left: -9px; }.generation-dialog__actions { padding: 16px; justify-content: space-between; gap: 8px; }.generation-dialog__actions > .v-btn { font-size: 11px; }.selected-recipe-summary li { flex-direction: column; gap: 2px; } }
@media (max-width: 540px) {
  .week-page--planned .mp-page-head { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 12px; margin-bottom: 18px; }
  .week-page--planned .mp-page-head__meta { gap: 6px; }
  .week-page--planned .mp-page-title { font-size: 30px; line-height: 1.15; }
  .week-page--planned .mp-page-head .mp-overline { font-size: 12px; letter-spacing: .12em; }
  .week-page--planned .mp-page-subtitle { font-size: 11px; line-height: 1.55; }
  .week-page--planned .mp-page-head > .v-btn { width: auto; height: 44px; padding: 0 12px; font-size: 11px; }
  .week-page--planned .week-intro { padding: 16px; gap: 12px; border-radius: 16px; }
  .week-page--planned .week-intro__icon { display: none; }
  .week-page--planned .week-intro__text { flex-basis: 100%; }
  .week-page--planned .week-intro .mp-overline { display: none; }
  .week-page--planned .week-intro h2 { margin: 0 0 5px; font-size: 22px; }
  .week-page--planned .week-intro p { font-size: 11px; }
  .week-page--planned .week-intro__action { height: 44px; margin-top: 0; }
  .week-page--planned .week-strip { margin: 16px 0 22px; }
  .week-page--planned .week-day { min-height: 87px; padding: 9px 3px 7px; }
  .week-page--planned .week-day__date { line-height: 1.4; }
  .week-page--planned .week-day__dot { margin-top: 5px; }
  .week-page--planned .day-heading { margin-bottom: 15px; }
}
@media (max-width: 360px) {
  .week-page--planned .week-new-label { display: none; }
  .week-page--planned .week-new-icon { margin-right: 0; }
  .week-page--planned .mp-page-head > .v-btn { min-width: 44px; padding: 0; }
}
/* Seven dates stay visible on a phone. Daily nutrition is shown below for the selected day. */
@media (max-width: 540px) {
  .week-page .week-day__meta { display: none; }
  .week-page .week-day { min-height: 78px; }
  .week-page .week-day--free .week-day__name { color: var(--color-accent); }
}
@media (prefers-reduced-motion: reduce) { .week-day { transition: none; }.week-day:hover { transform: none; } }
</style>
