import { Pressable, TextInput, View } from "react-native";
import BundlePickerModal from "./BundlePickerModal";
import CopyFromTerritory from "./CopyFromTerritory";
import OptionsEditor from "./OptionsEditor";
import SaleEditor from "./SaleEditor";
import Button from "../Elements/Button";
import Checkbox from "../Elements/Checkbox";
import Grid, { Cell } from "../Elements/Grid";
import Icon from "../Elements/Icon";
import IconButton from "../Elements/IconButton";
import Modal from "../Elements/Modal";
import SelectField from "../Elements/SelectField";
import Text from "../Elements/Text";
import TextField from "../Elements/TextField";
import { cx } from "../../Lib/ClassNames";
import { useProductDraft } from "@shared/Hooks/useProductDraft";
import { SaleOffText } from "@shared/Lib/CatalogDrafts";
import { CleanDiscount } from "@shared/Lib/Pricing";
import type { DeliveryOption } from "@shared/Models/DeliveryOption";
import type { Category } from "@shared/Models/Category";
import type { Product, StatColumn } from "@shared/Models/Product";
import { StatColumnNames } from "@shared/Lib/Catalog";
import type { Territory } from "@shared/Models/Territory";
import { Limits } from "@shared/Lib/Limits";

type Props = {
    product: Product;
    catalog: Product[];
    /** The product's territory's categories. */
    categories: Category[];
    deliveryOptions: DeliveryOption[];
    onSave: (product: Product) => Promise<void>;
    onClose: () => void;
    /** For a new item: the user's other territories, whose catalogs it can be copied from instead. */
    copySources?: Territory[];
    /** A product was copied in from another territory's catalog. */
    onCopied?: (product: Product) => void;
};

const heading = "text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400";

/**
 * Full product editor: name, brand, category, every priced size/configuration row, and which
 * delivery services are offered with what price. This is what makes delivery types differ from
 * one mattress to the next. Each territory has its own catalog, so an item only includes and
 * offers things from its own territory's. Someone with more than one territory can start a new
 * item as a copy of one from another territory's catalog.
 */
const EditProductForm = ({
    product,
    catalog,
    categories,
    deliveryOptions,
    onSave,
    onClose,
    copySources = [],
    onCopied,
}: Props) => {
    const form = useProductDraft(product, categories, onSave, onClose);
    const { draft, change, setVariant, bundlingIndex } = form;

    return (
        <Modal
            title={product.id ? "Edit product" : "New product"}
            onClose={onClose}
            wide
            footer={
                <>
                    <Button
                        text="Cancel"
                        onClick={onClose}
                        className="bg-zinc-500 dark:bg-zinc-600"
                    />
                    <Button
                        text="Save"
                        icon="fa-solid fa-check"
                        onClick={form.save}
                        loading={form.saving}
                    />
                </>
            }
        >
            <View className="gap-5">
                {!product.id && copySources.length > 0 && onCopied && (
                    <CopyFromTerritory territories={copySources} onCopied={onCopied} />
                )}
                <Grid columns={{ base: 1, sm: 2 }}>
                    <TextField
                        label="Name"
                        value={draft.name}
                        onChange={(value) => change({ name: value })}
                        maxLength={Limits.productName}
                        autoCapitalize="words"
                    />
                    <TextField
                        label="Brand"
                        value={draft.brand}
                        onChange={(value) => change({ brand: value })}
                        maxLength={Limits.brand}
                        autoCapitalize="words"
                    />
                    <SelectField
                        label="Category"
                        value={draft.category}
                        options={form.categoryNames.map((c) => ({ value: c, label: c }))}
                        onChange={(value) => change({ category: value })}
                    />
                    <SelectField<StatColumn>
                        label="Counts on the stat sheet as"
                        value={draft.statColumn}
                        options={(Object.keys(StatColumnNames) as StatColumn[]).map((c) => ({
                            value: c,
                            label: StatColumnNames[c],
                        }))}
                        onChange={(value) => change({ statColumn: value })}
                    />
                    <View className="flex-1 justify-end">
                        <Checkbox
                            label="Offered on the floor"
                            checked={draft.isActive}
                            onChange={(value) => change({ isActive: value })}
                        />
                    </View>
                    <Cell span={{ base: 1, sm: 2 }}>
                        <Checkbox
                            label="Track inventory"
                            checked={draft.trackInventory}
                            onChange={(value) => change({ trackInventory: value })}
                        />
                    </Cell>
                    {/* Decides whether the customer initials the warranty statement. */}
                    <View className="flex-1 justify-end">
                        <Checkbox
                            label="Has a manufacturer warranty"
                            checked={form.hasWarranty}
                            onChange={(value) => change({ warrantyChoice: value })}
                        />
                    </View>
                    <TextField
                        label="Warranty length"
                        value={draft.warrantyLength}
                        onChange={(value) => change({ warrantyLength: value })}
                        maxLength={Limits.warrantyLength}
                        placeholder="ex. 10 years"
                        disabled={!form.hasWarranty}
                    />
                    <Cell span={{ base: 1, sm: 2 }}>
                        <TextField
                            label="Notes shown to the rep"
                            value={draft.notes}
                            onChange={(value) => change({ notes: value })}
                            maxLength={Limits.productNotes}
                            placeholder="ex. Sale, warranty info"
                        />
                    </Cell>
                    <Cell span={{ base: 1, sm: 2 }}>
                        <SaleEditor
                            label="Sale on every size"
                            draft={draft.sale}
                            onChange={(value) => change({ sale: value })}
                        />
                    </Cell>
                </Grid>

                <View>
                    <View className="mb-2 flex-row items-center justify-between">
                        <Text className={heading}>Sizes & pricing</Text>
                        <Button
                            text="Add size"
                            icon="fa-solid fa-plus"
                            onClick={form.addVariant}
                            className="min-h-[40px] px-3 text-sm"
                        />
                    </View>

                    <Text className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
                        Leave a price blank for Inquire.
                    </Text>

                    <View className="gap-2">
                        {draft.variants.map((variant, index) => (
                            <View
                                key={variant.id ?? `new-${index}`}
                                className="gap-3 rounded-xl bg-zinc-100 p-3 dark:bg-zinc-700"
                            >
                                <View className="flex-row flex-wrap items-end gap-2">
                                    <TextField
                                        label="Size"
                                        value={variant.size ?? ""}
                                        onChange={(value) => setVariant(index, { size: value })}
                                        maxLength={Limits.size}
                                        autoCapitalize="words"
                                        className="min-w-[110px] flex-[3]"
                                    />
                                    <TextField
                                        label="Configuration"
                                        value={variant.configuration ?? ""}
                                        onChange={(value) =>
                                            setVariant(index, { configuration: value })
                                        }
                                        maxLength={Limits.configuration}
                                        placeholder="Mattress Only"
                                        autoCapitalize="words"
                                        className="min-w-[160px] flex-[5]"
                                    />
                                    <TextField
                                        label="Price"
                                        value={variant.priceText}
                                        onChange={(value) =>
                                            setVariant(index, { priceText: value })
                                        }
                                        inputMode="decimal"
                                        placeholder="Inquire"
                                        className="min-w-[100px] flex-[3]"
                                    />
                                    <IconButton
                                        icon="fa-solid fa-trash"
                                        label="Remove size"
                                        onPress={() => form.removeVariant(index)}
                                        danger
                                        className="h-12 w-12 rounded-xl"
                                    />
                                </View>

                                <TextField
                                    label="Note for the rep"
                                    value={variant.notes ?? ""}
                                    onChange={(value) => setVariant(index, { notes: value })}
                                    maxLength={Limits.sizeNotes}
                                    placeholder="ex. Not compressed"
                                />

                                <SaleEditor
                                    label="Sale for this size"
                                    draft={variant.sale}
                                    onChange={(next) => setVariant(index, { sale: next })}
                                    allowFollow
                                    followLabel={form.itemSaleLabel}
                                />

                                {draft.trackInventory && (
                                    <Checkbox
                                        label="Count in inventory"
                                        checked={!variant.excludeFromInventory}
                                        onChange={(checked) =>
                                            setVariant(index, { excludeFromInventory: !checked })
                                        }
                                        className="bg-white dark:bg-zinc-800"
                                    />
                                )}

                                <View className="flex-row flex-wrap items-center gap-2">
                                    <Text className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                        Bundle
                                    </Text>
                                    {(variant.components ?? []).map((c) => (
                                        <View
                                            key={c.componentVariantId}
                                            className="min-h-[36px] flex-row items-center gap-1 rounded-lg bg-violet-100 pl-3 dark:bg-violet-900/50"
                                        >
                                            <Text className="text-sm font-medium text-violet-900 dark:text-violet-200">
                                                {(c.quantity ?? 1) > 1 && `${c.quantity} x `}
                                                {c.productName}
                                                {c.size ? ` - ${c.size}` : ""}
                                            </Text>
                                            <Pressable
                                                onPress={() =>
                                                    form.removeComponent(
                                                        index,
                                                        c.componentVariantId
                                                    )
                                                }
                                                accessibilityRole="button"
                                                accessibilityLabel={`Remove ${c.productName} from the bundle`}
                                                className="h-9 w-9 items-center justify-center rounded-lg active:bg-violet-200 dark:active:bg-violet-800"
                                            >
                                                <Icon
                                                    icon="fa-solid fa-xmark"
                                                    className="text-violet-900 dark:text-violet-200"
                                                />
                                            </Pressable>
                                        </View>
                                    ))}
                                    <Button
                                        text="Include item"
                                        icon="fa-solid fa-link"
                                        onClick={() => form.setBundlingIndex(index)}
                                        className="min-h-[36px] bg-violet-700 px-3 text-sm dark:bg-violet-600"
                                    />
                                </View>
                            </View>
                        ))}
                    </View>
                </View>

                <OptionsEditor
                    options={draft.options}
                    onChange={(value) => change({ options: value })}
                    trackInventory={draft.trackInventory}
                />

                <View>
                    <Text className={cx(heading, "mb-2")}>Delivery options for this product</Text>
                    <View className="gap-2">
                        {deliveryOptions.length === 0 && (
                            <Text className="text-sm text-zinc-500 dark:text-zinc-400">
                                This territory has no delivery options yet.
                            </Text>
                        )}
                        {deliveryOptions.map((option) => {
                            const selected = draft.delivery.find(
                                (d) => d.deliveryOptionId === option.id
                            );
                            const off = CleanDiscount(
                                option.saleDiscountPercent,
                                option.saleDiscountAmount
                            );

                            return (
                                <View
                                    key={option.id}
                                    className="gap-3 rounded-xl bg-zinc-100 p-3 dark:bg-zinc-700"
                                >
                                    <View className="flex-row flex-wrap items-center gap-3">
                                        <Pressable
                                            onPress={() => form.toggleDelivery(option)}
                                            accessibilityRole="checkbox"
                                            accessibilityState={{ checked: Boolean(selected) }}
                                            className="min-h-[44px] min-w-[160px] flex-1 flex-row items-center gap-3"
                                        >
                                            <Icon
                                                icon={
                                                    selected
                                                        ? "fa-solid fa-square-check"
                                                        : "fa-regular fa-square"
                                                }
                                                className={cx(
                                                    "text-xl",
                                                    selected
                                                        ? "text-sky-700 dark:text-sky-400"
                                                        : "text-zinc-400"
                                                )}
                                            />
                                            <Text className="flex-1 text-sm font-medium">
                                                {option.name}
                                            </Text>
                                        </Pressable>

                                        {selected && option.id ? (
                                            <>
                                                <TextInput
                                                    value={form.overrideText(option.id)}
                                                    onChangeText={(value) =>
                                                        option.id &&
                                                        form.setDeliveryOverride(option.id, value)
                                                    }
                                                    keyboardType="decimal-pad"
                                                    inputMode="decimal"
                                                    placeholder={`Default ${option.price ?? 0}`}
                                                    placeholderTextColor="#a1a1aa"
                                                    accessibilityLabel={`${option.name} price for this product`}
                                                    className="min-h-[44px] w-32 rounded-lg border border-zinc-300 bg-white px-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                                                />
                                                <Pressable
                                                    onPress={() =>
                                                        option.id &&
                                                        form.setDefaultDelivery(option.id)
                                                    }
                                                    accessibilityRole="radio"
                                                    accessibilityState={{
                                                        checked: selected.isDefault ?? false,
                                                    }}
                                                    className="min-h-[44px] flex-row items-center gap-2"
                                                >
                                                    <Icon
                                                        icon={
                                                            selected.isDefault
                                                                ? "fa-solid fa-circle-dot"
                                                                : "fa-regular fa-circle"
                                                        }
                                                        className={cx(
                                                            "text-base",
                                                            selected.isDefault
                                                                ? "text-sky-700 dark:text-sky-400"
                                                                : "text-zinc-400"
                                                        )}
                                                    />
                                                    <Text className="text-xs">Default</Text>
                                                </Pressable>
                                            </>
                                        ) : null}
                                    </View>

                                    {selected && (
                                        <SaleEditor
                                            draft={form.deliverySale(option.id)}
                                            onChange={(sale) =>
                                                form.setDeliverySale(option.id, sale)
                                            }
                                            allowFollow
                                            followName="Same as option"
                                            followLabel={SaleOffText(off)}
                                            label={`${option.name} sale`}
                                        />
                                    )}
                                </View>
                            );
                        })}
                    </View>
                </View>
            </View>

            {bundlingIndex !== null && (
                <BundlePickerModal
                    catalog={catalog}
                    excludeProductId={product.id}
                    size={draft.variants[bundlingIndex]?.size}
                    configuration={draft.variants[bundlingIndex]?.configuration}
                    onPick={(pick) => form.applyBundlePick(bundlingIndex, pick)}
                    onClose={() => form.setBundlingIndex(null)}
                />
            )}
        </Modal>
    );
};

export default EditProductForm;
