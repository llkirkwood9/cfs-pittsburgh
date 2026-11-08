import { useMemo } from "react";
import { View } from "react-native";
import Button from "../Elements/Button";
import Icon from "../Elements/Icon";
import SelectField from "../Elements/SelectField";
import Text from "../Elements/Text";
import { useProductCopy } from "@shared/Hooks/useProductCopy";
import type { Product } from "@shared/Models/Product";
import type { Territory } from "@shared/Models/Territory";

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
    const copier = useProductCopy(onCopied);
    const { territoryId, productId } = copier;

    const options = useMemo(
        () =>
            copier.products.map((p) => ({
                value: p.id ?? null,
                label: `${p.brand ? `${p.brand} ` : ""}${p.name ?? ""}`,
                hint: `${p.category ?? ""}${p.isActive === false ? " � archived" : ""}`,
            })),
        [copier.products]
    );

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
                onChange={copier.pickTerritory}
            />
            <SelectField<number | null>
                label="Item"
                value={productId}
                placeholder={copier.itemPrompt}
                options={options}
                onChange={copier.setProductId}
                disabled={territoryId == null || copier.loading}
            />
            <Button
                text="Copy"
                icon="fa-solid fa-copy"
                onClick={copier.copy}
                loading={copier.copying}
                disabled={productId == null}
            />
        </View>
    );
};

export default CopyFromTerritory;
