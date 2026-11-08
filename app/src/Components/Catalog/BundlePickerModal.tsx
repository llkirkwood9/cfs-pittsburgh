import { Pressable, ScrollView, View } from "react-native";
import Button from "../Elements/Button";
import Checkbox from "../Elements/Checkbox";
import Grid from "../Elements/Grid";
import Modal from "../Elements/Modal";
import Stepper from "../Elements/Stepper";
import TabButton from "../Elements/TabButton";
import Text from "../Elements/Text";
import TextField from "../Elements/TextField";
import { cx } from "../../Lib/ClassNames";
import { useProductBundlePicker } from "@shared/Hooks/useProductBundlePicker";
import { CategoryShortNames, VariantLabel } from "@shared/Lib/Catalog";
import type { BundlePick } from "@shared/Lib/ProductDraft";
import type { Product } from "@shared/Models/Product";

type Props = {
    catalog: Product[];
    excludeProductId?: number;
    size?: string;
    configuration?: string | null;
    onPick: (pick: BundlePick) => void;
    onClose: () => void;
};

/**
 * Picks an existing catalog item to include in a bundle - for example the IMC61 base that comes
 * with an Agility 3000 set. Bases are shown first because that is the usual case. By default the
 * pick is repeated on every other size of the same configuration, matched by size, so setting up
 * a mattress's four IMC61 sizes is one choice rather than four.
 */
const BundlePickerModal = ({
    catalog,
    excludeProductId,
    size,
    configuration,
    onPick,
    onClose,
}: Props) => {
    const picker = useProductBundlePicker(catalog, excludeProductId, size, onPick, onClose);
    const { product, variantId, filtered } = picker;

    return (
        <Modal
            title={product ? `Include ${product.name}` : "Include an item in this bundle"}
            onClose={onClose}
            wide
            footer={
                product ? (
                    <>
                        <Button
                            text="Back"
                            icon="fa-solid fa-arrow-left"
                            onClick={picker.unchoose}
                            className="bg-zinc-500 dark:bg-zinc-600"
                        />
                        <Button
                            text="Include"
                            icon="fa-solid fa-plus"
                            onClick={picker.add}
                            className="bg-green-700 dark:bg-green-600"
                        />
                    </>
                ) : undefined
            }
        >
            {!product ? (
                <>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        className="mb-3"
                        contentContainerClassName="gap-2 pb-1"
                    >
                        {picker.categories.map((c) => (
                            <TabButton
                                key={c}
                                text={CategoryShortNames[c]}
                                active={picker.tab === c}
                                onClick={() => picker.setTab(c)}
                            />
                        ))}
                    </ScrollView>
                    <TextField
                        label="Search"
                        value={picker.search}
                        onChange={picker.setSearch}
                        placeholder="Name or brand"
                        autoCapitalize="none"
                        className="mb-3"
                    />
                    {filtered.length === 0 ? (
                        <Text className="py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                            Nothing here to include.
                        </Text>
                    ) : (
                        <Grid columns={{ base: 1, sm: 2 }} gap={8}>
                            {filtered.map((p) => (
                                <Pressable
                                    key={p.id}
                                    onPress={() => picker.choose(p)}
                                    accessibilityRole="button"
                                    className="min-h-[60px] justify-center rounded-xl bg-zinc-100 px-4 py-2 active:bg-zinc-200 dark:bg-zinc-700 dark:active:bg-zinc-600"
                                >
                                    <Text className="font-semibold">{p.name}</Text>
                                    <Text className="text-xs text-zinc-500 dark:text-zinc-400">
                                        {p.brand} · {p.variants?.length} size
                                        {p.variants?.length === 1 ? "" : "s"}
                                    </Text>
                                </Pressable>
                            ))}
                        </Grid>
                    )}
                </>
            ) : (
                <View className="gap-4">
                    <View>
                        <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                            Size
                        </Text>
                        <View className="flex-row flex-wrap gap-2">
                            {(product.variants ?? []).map((v) => {
                                const selected = v.id === variantId;
                                return (
                                    <Pressable
                                        key={v.id}
                                        onPress={() => picker.setVariantId(v.id ?? null)}
                                        accessibilityRole="radio"
                                        accessibilityState={{ checked: selected }}
                                        className={cx(
                                            "min-h-[48px] justify-center rounded-xl px-4",
                                            selected
                                                ? "bg-sky-700 dark:bg-sky-600"
                                                : "bg-zinc-100 active:bg-zinc-200 dark:bg-zinc-700 dark:active:bg-zinc-600"
                                        )}
                                    >
                                        <Text
                                            className={cx(
                                                "text-sm font-semibold",
                                                selected
                                                    ? "text-white"
                                                    : "text-zinc-800 dark:text-zinc-100"
                                            )}
                                        >
                                            {VariantLabel(v)}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                    </View>

                    <View className="flex-row flex-wrap items-end gap-4">
                        <Stepper
                            label="Quantity per bundle"
                            value={picker.quantity}
                            onChange={picker.setQuantity}
                            min={1}
                            max={20}
                        />
                        <Checkbox
                            label={`Also include it on every other size${
                                configuration ? ` of "${configuration}"` : ""
                            }, matching sizes`}
                            checked={picker.matchSizes}
                            onChange={picker.setMatchSizes}
                            className="min-w-[240px] flex-1"
                        />
                    </View>
                </View>
            )}
        </Modal>
    );
};

export default BundlePickerModal;
