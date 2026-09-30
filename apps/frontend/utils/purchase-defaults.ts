export type Supply = 'pantry' | 'fresh' | 'freezer'

// Editable shopping assumptions, not store offers or guaranteed shelf lives.
export function purchaseDefaults(name: string, unitType: string) {
  const n = name.toLocaleLowerCase('ru').split(' · ')[0]
  let packSize = unitType === 'piece' ? 1 : unitType === 'ml' ? 1000 : 500
  let byWeight = false
  let supply: Supply = 'fresh'
  let keepDays = 2
  let aisle = 'Другие продукты'
  if (/яйц/.test(n)) { packSize = 10; keepDays = 7; aisle = 'Молочное и яйца' }
  else if (/творог|йогурт|^сыр(?: |$)|сметана|молоко|кефир|ряженка|масло сливочное/.test(n)) {
    packSize = /творог/.test(n) ? 200 : /йогурт/.test(n) ? 150 : /сыр/.test(n) ? 200 : /сметана/.test(n) ? 300 : /сливочное/.test(n) ? 180 : unitType === 'ml' ? 1000 : 500
    aisle = 'Молочное и яйца'
  } else if (/говядин|курин|индейк|лосос|треск|минтай|кревет/.test(n)) {
    supply = 'freezer'; keepDays = 1; aisle = 'Мясо и рыба'; packSize = 500
  } else if (/консерв|томаты протёртые/.test(n)) {
    supply = 'pantry'; aisle = 'Бакалея'; packSize = /тунец/.test(n) ? 130 : /томаты/.test(n) ? 500 : 240
  } else if (/рис|гречк|макарон|булгур|кускус|киноа|пшено|перлов|хлопья|мука|чечевица|нут сухой|сахар/.test(n)) {
    supply = 'pantry'; aisle = 'Бакалея'; packSize = /мука|сахар/.test(n) ? 1000 : /макарон/.test(n) ? 450 : 500
  } else if (/масло|орех|миндаль|семена|паста арахис|арахисовая/.test(n)) {
    supply = 'pantry'; aisle = 'Бакалея'; packSize = /масло/.test(n) ? (unitType === 'ml' ? 500 : 450) : /паста/.test(n) ? 300 : 200
  } else if (/хлеб|заморож/.test(n)) {
    supply = 'freezer'; keepDays = /заморож/.test(n) ? 1 : 2; aisle = /хлеб/.test(n) ? 'Хлеб' : 'Заморозка'; packSize = 400
  } else if (/картоф|лук|морковь|капуст|перец|кабачок|брокколи|шпинат|шампиньон|св[её]кл|тыква|огурец|помидор|салат/.test(n)) {
    aisle = 'Овощи и зелень'; keepDays = 3; byWeight = true; packSize = 1000
  } else if (/банан|яблок|апельсин|груша|киви|клубник|голубик/.test(n)) {
    aisle = 'Фрукты и ягоды'; keepDays = 3
    packSize = unitType === 'piece' ? 1 : /клубник|голубик/.test(n) ? 250 : 1000
    byWeight = unitType !== 'piece' && !/клубник|голубик/.test(n)
  } else if (/тофу/.test(n)) { aisle = 'Молочное и альтернативы'; packSize = 200 }
  else if (/вода|сок/.test(n)) { aisle = 'Напитки'; packSize = 1000; supply = 'pantry' }
  else { byWeight = unitType === 'gram'; packSize = unitType === 'piece' ? 1 : 1000 }
  // Juice must not be mistaken for whole fruit by the fruit-name matcher.
  if (/^сок|^вода/.test(n)) { aisle = 'Напитки'; packSize = 1000; supply = 'pantry'; byWeight = false }
  const sealed = /творог|йогурт|^сыр(?: |$)|сметана|молоко|кефир|ряженка|сливочное|тофу/.test(n)
  const afterOpening = /консерв|томаты протёртые|^сок/.test(n) ? 2 : null
  return { packSize, byWeight, supply, keepDays, aisle, sealed, afterOpening }
}
