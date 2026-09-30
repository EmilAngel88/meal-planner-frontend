import { quantityForWeight } from './nutrition';
export type ShoppingIngredient = { productId: number; name: string; weight: number; quantity: number; unitType: string };
export function aggregateShopping(snapshots: ShoppingIngredient[][]) {
    const rows = new Map<string, ShoppingIngredient>();
    for (const snapshot of snapshots) {
        for (const ingredient of snapshot) {
            // Keep distinct versions of a product/unit separate; source names are historical snapshots.
            const key = `${ingredient.productId}:${ingredient.name}:${ingredient.unitType}`;
            const row = rows.get(key);
            if (row) { row.weight += ingredient.weight; row.quantity += ingredient.quantity; }
            else rows.set(key, { ...ingredient });
        }
    }
    return [...rows.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru')).map(row => ({ ...row,
        weight: Math.round(row.weight * 10) / 10,
        quantity: row.unitType === 'piece' ? Math.ceil(row.quantity - 1e-8) : Math.round(row.quantity * 10) / 10,
    }));
}
export function productSnapshot(product: { id: number; name: string; unitType: string; unitWeight: number | null; density?: number; brand?: string }, weight: number): ShoppingIngredient {
    return { productId: product.id, name: product.brand ? `${product.name} · ${product.brand}` : product.name, weight, unitType: product.unitType,
        quantity: quantityForWeight(product, weight) };
}
