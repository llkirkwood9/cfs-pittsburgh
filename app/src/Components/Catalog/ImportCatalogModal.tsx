import { Pressable, TextInput, View } from "react-native";
import Button from "../Elements/Button";
import Icon from "../Elements/Icon";
import Modal from "../Elements/Modal";
import Text from "../Elements/Text";
import { cx } from "../../Lib/ClassNames";
import { PickTextFile } from "../../Lib/Files";
import { useCatalogImport } from "@shared/Hooks/useCatalogImport";
import {
    CatalogFileSummary,
    CatalogImportConfirmWord,
    CatalogImportModes,
} from "@shared/Lib/CatalogImport";
import type { CatalogImportMode } from "@shared/Models/CatalogFile";

type Props = {
    onClose: () => void;
    /** Called on closing after a restore, so the catalog can reload. */
    onRestored: () => void;
};

/**
 * Restores a catalog file made with Export catalog (system admins only): either bringing matching
 * products in line with the file and adding the rest, or clearing the catalog and rebuilding it
 * from the file. The file is picked from Files, iCloud Drive or wherever it was saved.
 */
const ImportCatalogModal = ({ onClose, onRestored }: Props) => {
    const importer = useCatalogImport(onClose, onRestored);
    const { file, fileName, fileProblem, mode, result, finish } = importer;

    const pick = async () => {
        const picked = await PickTextFile(["application/json", "text/plain", "*/*"]);
        if (picked) importer.readFile(picked.name, picked.text);
    };

    if (result) {
        return (
            <Modal
                title="Catalog restored"
                onClose={finish}
                footer={<Button text="Done" icon="fa-solid fa-check" onClick={finish} />}
            >
                <View className="gap-1">
                    {result.productsRemoved +
                        result.deliveryOptionsRemoved +
                        result.financeOptionsRemoved >
                        0 && (
                        <Text>
                            Cleared {result.productsRemoved} products,{" "}
                            {result.deliveryOptionsRemoved} delivery options and{" "}
                            {result.financeOptionsRemoved} financing options.
                        </Text>
                    )}
                    <Text>
                        Products: {result.productsAdded} added
                        {result.productsUpdated > 0 && `, ${result.productsUpdated} updated`}.
                    </Text>
                    <Text>
                        Delivery options: {result.deliveryOptionsAdded} added
                        {result.deliveryOptionsUpdated > 0 &&
                            `, ${result.deliveryOptionsUpdated} updated`}
                        .
                    </Text>
                    {result.financeOptionsAdded + result.financeOptionsUpdated > 0 && (
                        <Text>
                            Financing options: {result.financeOptionsAdded} added
                            {result.financeOptionsUpdated > 0 &&
                                `, ${result.financeOptionsUpdated} updated`}
                            .
                        </Text>
                    )}
                </View>
                {result.warnings.length > 0 && (
                    <View className="mt-4 rounded-xl bg-amber-50 p-3 dark:bg-amber-950/40">
                        <View className="mb-1 flex-row items-center gap-2">
                            <Icon
                                icon="fa-solid fa-triangle-exclamation"
                                className="text-sm text-amber-900 dark:text-amber-200"
                            />
                            <Text className="flex-1 text-sm font-semibold text-amber-900 dark:text-amber-200">
                                {result.warnings.length === 1
                                    ? "One thing couldn't be brought in:"
                                    : `${result.warnings.length} things couldn't be brought in:`}
                            </Text>
                        </View>
                        {result.warnings.map((w) => (
                            <Text key={w} className="text-sm text-amber-900 dark:text-amber-200">
                                • {w}
                            </Text>
                        ))}
                    </View>
                )}
            </Modal>
        );
    }

    const choice = (value: CatalogImportMode, title: string, text: string) => {
        const selected = mode === value;
        return (
            <Pressable
                key={value}
                onPress={() => importer.setMode(value)}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                className={cx(
                    "flex-row gap-3 rounded-xl border-2 p-3",
                    selected
                        ? value === "replace"
                            ? "border-red-600 bg-red-50 dark:border-red-500 dark:bg-red-950/30"
                            : "border-sky-600 bg-sky-50 dark:border-sky-500 dark:bg-sky-950/30"
                        : "border-zinc-200 dark:border-zinc-700"
                )}
            >
                <Icon
                    icon={selected ? "fa-solid fa-circle-dot" : "fa-regular fa-circle"}
                    className={cx(
                        "mt-0.5 text-lg",
                        selected ? "text-sky-700 dark:text-sky-400" : "text-zinc-400"
                    )}
                />
                <View className="flex-1">
                    <Text className="font-semibold">{title}</Text>
                    <Text className="text-sm text-zinc-600 dark:text-zinc-300">{text}</Text>
                </View>
            </Pressable>
        );
    };

    return (
        <Modal
            title="Restore catalog"
            onClose={onClose}
            footer={
                <>
                    <Button
                        text="Cancel"
                        onClick={onClose}
                        className="bg-zinc-500 dark:bg-zinc-600"
                    />
                    <Button
                        text={mode === "replace" ? "Clear and restore" : "Restore"}
                        icon="fa-solid fa-file-import"
                        onClick={importer.restore}
                        disabled={importer.locked}
                        loading={importer.busy}
                        className={mode === "replace" ? "bg-red-700 dark:bg-red-600" : ""}
                    />
                </>
            }
        >
            <Text className="mb-1 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                Catalog file
            </Text>
            <View className="flex-row flex-wrap items-center gap-3">
                <Button
                    text={file ? "Choose another file" : "Choose a file"}
                    icon="fa-solid fa-folder-open"
                    onClick={pick}
                />
                {fileName ? (
                    <Text
                        className="flex-1 text-sm text-zinc-600 dark:text-zinc-300"
                        numberOfLines={1}
                    >
                        {fileName}
                    </Text>
                ) : null}
            </View>
            {fileProblem && (
                <Text className="mt-2 text-sm font-semibold text-red-700 dark:text-red-400">
                    {fileProblem}
                </Text>
            )}
            {file && (
                <Text className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                    {CatalogFileSummary(file)}
                </Text>
            )}

            <View className="mt-4 gap-2">
                {CatalogImportModes.map((m) => choice(m.mode, m.title, m.text))}
            </View>

            {mode === "replace" && (
                <View className="mt-4 gap-1">
                    <Text className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                        Type{" "}
                        <Text className="text-sm font-bold text-red-700 dark:text-red-400">
                            {CatalogImportConfirmWord}
                        </Text>{" "}
                        to confirm
                    </Text>
                    <TextInput
                        value={importer.typed}
                        onChangeText={importer.setTyped}
                        autoCapitalize="characters"
                        autoCorrect={false}
                        accessibilityLabel={`Type ${CatalogImportConfirmWord} to confirm`}
                        className="min-h-[48px] rounded-xl border border-zinc-300 bg-white px-3 text-base text-zinc-900 focus:border-red-600 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                </View>
            )}
        </Modal>
    );
};

export default ImportCatalogModal;
