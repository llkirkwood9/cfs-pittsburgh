import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import Button from "../Elements/Button";
import Icon from "../Elements/Icon";
import SelectField from "../Elements/SelectField";
import Text from "../Elements/Text";
import { Toast } from "../../Lib/Toast";
import type { Product } from "../../Models/Product";
import type { Territory } from "../../Models/Territory";
import { CopyProduct, GetProducts } from "../../Services/ProductServices";

type Props = {
    /** The other territories whose catalogs an item can be copied from. */
    territories: Territory[];
    /** The copy was made, in the territory in view. */
    onCopied: (product: Product) => void;
};

/**
 * At the top of a new product: start from an item in another territory's catalog instead of
 * filling everything in. The copy brings its sizes, prices, sales, selections, notes and warranty;
 * delivery options are matched by name (and added when this territory has none of that name),
 * and bundled items this territory doesn't sell are left out. Stock isn't copied.
 */
const CopyFromTerritory = ({ territories, onCopied }: Props) => {
    const [territoryId, setTerritoryId] = useState<number | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [productId, setProductId] = useState<number | null>(null);
    const [copying, setCopying] = useState<boolean>(false);

    useEffect(() => {
        if (territoryId == null) return;
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            const found = await GetProducts(true, territoryId);
            if (cancelled) return;
            setProducts(found);
            setLoading(false);
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [territoryId]);

    const options = useMemo(
        () =>
            [...products]
                .sort(
                    (a, b) =>
                        (a.category ?? "").localeCompare(b.category ?? "") ||
                        (a.name ?? "").localeCompare(b.name ?? "")
                )
                .map((p) => ({
                    value: p.id ?? null,
                    label: `${p.brand ? `${p.brand} ` : ""}${p.name ?? ""}`,
                    hint: `${p.category ?? ""}${p.isActive === false ? " · archived" : ""}`,
                })),
        [products]
    );

    const handleCopy = async () => {
        if (productId == null) return Toast.Warning("Pick the item to copy.");
        setCopying(true);
        const result = await CopyProduct(productId);
        setCopying(false);
        if (!result?.product) return;

        Toast.Success(`${result.product.name} copied into this catalog.`);
        for (const note of result.notes ?? []) Toast.Info(note);
        onCopied(result.product);
    };

    return (
        <View className="gap-2 rounded-xl border border-dashed border-sky-300 bg-sky-50 p-3 dark:border-sky-800 dark:bg-sky-950/30">
            <View className="flex-row items-center gap-2">
                <Icon icon="fa-solid fa-copy" className="text-sm text-sky-900 dark:text-sky-200" />
                <Text className="text-sm font-semibold text-sky-900 dark:text-sky-200">
                    Copy an item from another territory
                </Text>
            </View>
            <SelectField<number | null>
                label="Territory"
                value={territoryId}
                placeholder="Pick a territory..."
                options={territories.map((t) => ({ value: t.id ?? null, label: t.name ?? "" }))}
                onChange={(id) => {
                    setTerritoryId(id);
                    setProductId(null);
                    setProducts([]);
                }}
            />
            <SelectField<number | null>
                label="Item"
                value={productId}
                placeholder={loading ? "Loading..." : territoryId == null ? "Pick a territory first" : "Pick an item..."}
                options={options}
                onChange={setProductId}
                disabled={territoryId == null || loading}
            />
            <Button
                text="Copy"
                icon="fa-solid fa-copy"
                onClick={handleCopy}
                loading={copying}
                disabled={productId == null}
            />
        </View>
    );
};

export default CopyFromTerritory;
