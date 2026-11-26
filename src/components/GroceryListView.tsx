import React, { useMemo, useState } from 'react';
import {
  Check,
  PackageCheck,
  Plus,
  Trash2,
  RotateCcw,
  Users,
  Globe,
  Pencil,
  ChevronDown,
  ChevronRight,
  Wallet,
} from 'lucide-react';
import {
  DayPlan,
  GroceryCategory,
  ManualGroceryItem,
  PricingConfig,
  Recipe,
} from '../types/mealPlanner';
import {
  AggregatedGroceryItem,
  formatQuantity,
  generateGroceryList,
  GROCERY_CATEGORY_ORDER,
} from '../utils/groceryUtils';
import {
  CURRENCY_OPTIONS,
  formatCurrency,
  getCurrencyOption,
  roundForCurrencyInput,
} from '../utils/currencyUtils';
import { BubbleButton, BubbleIconButton } from './BubbleControls';
import AnimatedContent from '../../components/AnimatedContent';

interface GroceryListViewProps {
  weeksDates: string[][];
  activeWeekIndex: number;
  daysMap: Record<string, DayPlan>;
  recipesMap: Record<string, Recipe>;
  householdMultiplier: number;
  onChangeMultiplier: (val: number) => void;
  checkedKeys: Set<string>;
  alreadyHaveKeys: Set<string>;
  clearedKeys: Set<string>;
  manualItems: ManualGroceryItem[];
  weeklyBudget: number;
  pricing: PricingConfig;
  onChangeCurrency: (currencyCode: string) => void;
  onChangeRegionalFactor: (factor: number) => void;
  onSetPriceOverride: (itemKey: string, quantity: number, totalLocalPrice: number) => void;
  onClearPriceOverride: (itemKey: string) => void;
  onResetAllPrices: () => void;
  onUpdateManualItemPrice: (manualId: string, newPrice: number) => void;
  onUpdateBudget: (val: number) => void;
  onToggleChecked: (key: string) => void;
  onToggleAlreadyHave: (key: string) => void;
  onClearCompleted: () => void;
  onRestoreAllCleared: () => void;
  onAddManualItem: (item: ManualGroceryItem) => void;
  onRemoveManualItem: (id: string) => void;
}

export const GroceryListView: React.FC<GroceryListViewProps> = ({
  weeksDates,
  activeWeekIndex,
  daysMap,
  recipesMap,
  householdMultiplier,
  onChangeMultiplier,
  checkedKeys,
  alreadyHaveKeys,
  clearedKeys,
  manualItems,
  weeklyBudget,
  pricing,
  onChangeCurrency,
  onChangeRegionalFactor,
  onSetPriceOverride,
  onClearPriceOverride,
  onResetAllPrices,
  onUpdateManualItemPrice,
  onUpdateBudget,
  onToggleChecked,
  onToggleAlreadyHave,
  onClearCompleted,
  onRestoreAllCleared,
  onAddManualItem,
  onRemoveManualItem,
}) => {
  const [scope, setScope] = useState<'week' | 'twoWeeks' | 'all'>('week');
  const [categoryFilter, setCategoryFilter] = useState<'All' | GroceryCategory>('All');
  const [pantryExpanded, setPantryExpanded] = useState(true);
  const [bulkEditPrices, setBulkEditPrices] = useState(false);
  const [editingItemKey, setEditingItemKey] = useState<string | null>(null);
  const [draftPrices, setDraftPrices] = useState<Record<string, string>>({});

  const activeCurrency = useMemo(
    () => getCurrencyOption(pricing.currencyCode),
    [pricing.currencyCode]
  );

  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState(1);
  const [newItemUnit, setNewItemUnit] = useState('whole');
  const [newItemCat, setNewItemCat] = useState<GroceryCategory>('Produce');
  const [newItemPrice, setNewItemPrice] = useState(() =>
    roundForCurrencyInput(2.5 * activeCurrency.exchangeRate * pricing.regionalPriceFactor, activeCurrency.code)
  );

  const customOverrideCount = Object.keys(pricing.priceOverrides || {}).length;

  const scopedDates = useMemo(() => {
    if (scope === 'week') return weeksDates[activeWeekIndex] || weeksDates[0] || [];
    if (scope === 'twoWeeks') return weeksDates.slice(0, 2).flat();
    return weeksDates.flat();
  }, [scope, weeksDates, activeWeekIndex]);

  const allGenerated = useMemo(
    () =>
      generateGroceryList(
        scopedDates,
        daysMap,
        recipesMap,
        householdMultiplier,
        manualItems,
        pricing
      ),
    [scopedDates, daysMap, recipesMap, householdMultiplier, manualItems, pricing]
  );

  const visibleItems = useMemo(
    () => allGenerated.filter((item) => !clearedKeys.has(item.key)),
    [allGenerated, clearedKeys]
  );

  const alreadyHaveItems = useMemo(
    () => visibleItems.filter((item) => alreadyHaveKeys.has(item.key)),
    [visibleItems, alreadyHaveKeys]
  );

  const toBuyItems = useMemo(() => {
    return visibleItems.filter((item) => {
      if (alreadyHaveKeys.has(item.key)) return false;
      if (categoryFilter !== 'All' && item.category !== categoryFilter) return false;
      return true;
    });
  }, [visibleItems, alreadyHaveKeys, categoryFilter]);

  const groupedToBuy = useMemo(() => {
    const groups = new Map<GroceryCategory, AggregatedGroceryItem[]>();
    for (const cat of GROCERY_CATEGORY_ORDER) {
      groups.set(cat, []);
    }
    for (const item of toBuyItems) {
      groups.get(item.category)?.push(item);
    }
    return Array.from(groups.entries()).filter(([, items]) => items.length > 0);
  }, [toBuyItems]);

  const allToBuyUnfiltered = useMemo(
    () => visibleItems.filter((i) => !alreadyHaveKeys.has(i.key)),
    [visibleItems, alreadyHaveKeys]
  );

  const checkedCount = useMemo(
    () => allToBuyUnfiltered.filter((i) => checkedKeys.has(i.key)).length,
    [allToBuyUnfiltered, checkedKeys]
  );

  const toSpendCost = useMemo(
    () => allToBuyUnfiltered.reduce((sum, i) => sum + i.estimatedPrice, 0),
    [allToBuyUnfiltered]
  );

  const pantrySavedCost = useMemo(
    () => alreadyHaveItems.reduce((sum, i) => sum + i.estimatedPrice, 0),
    [alreadyHaveItems]
  );

  const scopeWeeksCount =
    scope === 'week' ? 1 : scope === 'twoWeeks' ? Math.min(2, weeksDates.length) : weeksDates.length;
  const scopedBudget = weeklyBudget * scopeWeeksCount;
  const budgetPct = Math.min(100, Math.round((toSpendCost / Math.max(1, scopedBudget)) * 100));
  const overBudget = toSpendCost > scopedBudget;

  const startEditingPrice = (item: AggregatedGroceryItem) => {
    setEditingItemKey(item.key);
    setDraftPrices((prev) => ({
      ...prev,
      [item.key]: String(roundForCurrencyInput(item.estimatedPrice, pricing.currencyCode)),
    }));
  };

  const commitItemPrice = (item: AggregatedGroceryItem) => {
    const raw = draftPrices[item.key];
    if (raw === undefined) {
      setEditingItemKey(null);
      return;
    }
    const parsed = Number(raw);
    if (!Number.isNaN(parsed) && Number.isFinite(parsed) && parsed >= 0) {
      if (item.isManual && item.manualId) {
        onUpdateManualItemPrice(item.manualId, parsed);
      } else {
        onSetPriceOverride(item.key, item.quantity, parsed);
      }
    }
    setEditingItemKey(null);
  };

  const handleAddManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;
    onAddManualItem({
      id: `man-${Date.now()}`,
      name: newItemName.trim(),
      quantity: Math.max(0.25, newItemQty),
      unit: newItemUnit.trim() || 'whole',
      category: newItemCat,
      estimatedPrice: Math.max(0, newItemPrice),
    });
    setNewItemName('');
  };

  const priceStep = activeCurrency.decimals === 0 ? 50 : 0.25;

  return (
    <div className="space-y-6">
      {/* Top Controls & Budget Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 bg-[#FAF8F6]/88 maloxie-peach-block rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[#2E2D24]">
                Auto-Generated Grocery List
              </h2>
              <p className="text-xs text-[#6A6754] mt-0.5">
                Quantities scale automatically from your planned meals. Click any food price to match what you pay locally.
              </p>
            </div>

            <div className="flex items-center gap-1.5 p-1 bg-[#EAE4E0]/75 rounded-full">
              {(
                [
                  { id: 'week', label: `Week ${activeWeekIndex + 1}` },
                  { id: 'twoWeeks', label: 'Weeks 1–2' },
                  { id: 'all', label: `All ${weeksDates.length} Weeks` },
                ] as const
              ).map((s) => (
                <BubbleButton
                  key={s.id}
                  variant={scope === s.id ? 'dark' : 'default'}
                  size="sm"
                  onClick={() => setScope(s.id)}
                >
                  {s.label}
                </BubbleButton>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-[#D9D0CB] flex flex-wrap items-center justify-between gap-4">
            {/* Household Servings Multiplier */}
            <div className="flex items-center gap-2.5 text-xs">
              <span className="inline-flex items-center gap-1.5 text-[#4A483A] font-medium">
                <Users className="w-3.5 h-3.5 text-[#6A6754]" />
                Quantity Scale:
              </span>
              <div className="flex items-center gap-1 p-1 bg-[#EAE4E0]/75 rounded-full">
                {[1, 2, 3, 4].map((mult) => (
                  <BubbleButton
                    key={mult}
                    variant={householdMultiplier === mult ? 'dark' : 'default'}
                    size="xs"
                    onClick={() => onChangeMultiplier(mult)}
                    className="font-mono"
                  >
                    {mult}x
                  </BubbleButton>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <BubbleButton
                variant={bulkEditPrices ? 'terracotta' : 'sage'}
                size="sm"
                onClick={() => setBulkEditPrices((v) => !v)}
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>{bulkEditPrices ? 'Done Editing Prices' : 'Edit Food Prices'}</span>
              </BubbleButton>

              <BubbleButton
                variant="default"
                size="sm"
                disabled={checkedCount === 0}
                onClick={onClearCompleted}
                className="disabled:opacity-40"
              >
                <Trash2 className="w-3.5 h-3.5 text-[#6A6754]" />
                <span>Clear Completed ({checkedCount})</span>
              </BubbleButton>

              {clearedKeys.size > 0 && (
                <BubbleButton
                  variant="sage"
                  size="sm"
                  onClick={onRestoreAllCleared}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore Cleared</span>
                </BubbleButton>
              )}
            </div>
          </div>

          {/* Regional Currency & Market Cost Calibration */}
          <div className="pt-3 border-t border-[#D9D0CB] flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex flex-wrap items-center gap-2.5">
              <label
                htmlFor="maloxie-currency-select"
                className="inline-flex items-center gap-1.5 font-medium text-[#4A483A]"
              >
                <Globe className="w-3.5 h-3.5 text-[#6A6754]" />
                <span>Location &amp; Currency:</span>
              </label>
              <select
                id="maloxie-currency-select"
                value={activeCurrency.code}
                onChange={(e) => {
                  const nextCode = e.target.value;
                  const nextCurr = getCurrencyOption(nextCode);
                  setNewItemPrice(
                    roundForCurrencyInput(
                      2.5 * nextCurr.exchangeRate * nextCurr.defaultRegionalFactor,
                      nextCurr.code
                    )
                  );
                  setDraftPrices({});
                  setEditingItemKey(null);
                  onChangeCurrency(nextCode);
                }}
                className="px-2.5 py-1.5 text-xs font-medium bg-[#FAF8F6] text-[#2E2D24] border border-[#D9D0CB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6A6754]"
              >
                {CURRENCY_OPTIONS.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} ({c.symbol.trim()}) · {c.regionLabel}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label
                htmlFor="regional-price-index"
                className="text-[#4A483A] font-medium whitespace-nowrap"
              >
                Local Price Level:
              </label>
              <input
                id="regional-price-index"
                type="range"
                min={0.25}
                max={2.5}
                step={0.05}
                value={pricing.regionalPriceFactor}
                onChange={(e) => onChangeRegionalFactor(Number(e.target.value))}
                className="w-28 accent-[#6A6754] cursor-pointer"
              />
              <span className="font-mono tabular-nums font-semibold text-[#2E2D24] w-11 text-right">
                {pricing.regionalPriceFactor.toFixed(2)}x
              </span>

              {customOverrideCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setDraftPrices({});
                    setEditingItemKey(null);
                    onResetAllPrices();
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[#B86B4B] hover:text-[#8E4C32] hover:underline"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset {customOverrideCount} custom</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Shopping Budget Card */}
        <div className="lg:col-span-4 bg-[#FAF8F6]/88 maloxie-peach-block rounded-xl p-5 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#6A6754] flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5" />
              Shopping Budget ({scopeWeeksCount} wk)
            </span>
            <div className="flex items-center gap-1 text-xs">
              <span className="text-[#6A6754]">
                Cap:{' '}
                <span className="font-mono font-semibold text-[#14532D]">
                  {activeCurrency.symbol.trim()}
                </span>
              </span>
              <input
                type="number"
                min={0}
                step={activeCurrency.budgetStep}
                value={weeklyBudget}
                onChange={(e) => onUpdateBudget(Math.max(0, Number(e.target.value)))}
                aria-label="Weekly budget target"
                className="w-20 px-1.5 py-0.5 text-xs font-mono font-semibold border border-[#D9D0CB] rounded bg-[#F3EFEC] text-[#14532D] focus:outline-none focus:ring-2 focus:ring-[#14532D]"
              />
              <span className="text-[#6A6754]">/wk</span>
            </div>
          </div>

          <div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-mono text-2xl font-semibold tabular-nums text-[#14532D]">
                {formatCurrency(toSpendCost, pricing.currencyCode)}
              </span>
              <span
                className={`text-xs font-medium text-right ${
                  overBudget ? 'text-[#B43C2E]' : 'text-[#14532D]'
                }`}
              >
                {overBudget ? (
                  <>
                    <span className="font-mono font-semibold text-[#B43C2E]">
                      {formatCurrency(toSpendCost - scopedBudget, pricing.currencyCode)}
                    </span>{' '}
                    over budget
                  </>
                ) : (
                  <>
                    <span className="font-mono font-semibold">
                      {formatCurrency(scopedBudget - toSpendCost, pricing.currencyCode)}
                    </span>{' '}
                    under budget
                  </>
                )}
              </span>
            </div>
            <div className="w-full h-2 bg-[#EAE4E0] rounded-full overflow-hidden mt-2">
              <div
                className={`h-full transition-all ${
                  overBudget ? 'bg-[#B43C2E]' : 'bg-[#6A6754]'
                }`}
                style={{ width: `${budgetPct}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-[#6A6754] pt-1 font-mono tabular-nums">
            <span>
              Picked: {checkedCount}/{allToBuyUnfiltered.length} items
            </span>
            <span>
              Pantry saved:{' '}
              <span className="font-semibold text-[#14532D]">
                {formatCurrency(pantrySavedCost, pricing.currencyCode)}
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Category Filter Strip + Add Custom Item */}
      <div className="bg-[#FAF8F6]/88 maloxie-peach-block rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {(['All', ...GROCERY_CATEGORY_ORDER] as const).map((cat) => (
            <BubbleButton
              key={cat}
              variant={categoryFilter === cat ? 'dark' : 'default'}
              size="sm"
              onClick={() => setCategoryFilter(cat)}
            >
              {cat}
            </BubbleButton>
          ))}
        </div>

        <form
          onSubmit={handleAddManual}
          className="pt-3 border-t border-[#D9D0CB] grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
        >
          <input
            type="text"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder="Add extra item (e.g. Espresso beans, Cooking oil)..."
            className="sm:col-span-4 px-3 py-2 text-xs bg-[#FAF8F6] text-[#2E2D24] placeholder:text-[#908B6F] border border-[#D9D0CB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6A6754]"
          />
          <input
            type="number"
            step="0.25"
            min="0.25"
            value={newItemQty}
            onChange={(e) => setNewItemQty(Number(e.target.value))}
            aria-label="Quantity"
            className="sm:col-span-1 px-2.5 py-2 text-xs font-mono bg-[#FAF8F6] text-[#2E2D24] border border-[#D9D0CB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6A6754]"
          />
          <input
            type="text"
            value={newItemUnit}
            onChange={(e) => setNewItemUnit(e.target.value)}
            placeholder="unit"
            aria-label="Unit"
            className="sm:col-span-1 px-2.5 py-2 text-xs bg-[#FAF8F6] text-[#2E2D24] placeholder:text-[#908B6F] border border-[#D9D0CB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6A6754]"
          />
          <select
            value={newItemCat}
            onChange={(e) => setNewItemCat(e.target.value as GroceryCategory)}
            aria-label="Category"
            className="sm:col-span-2 px-2.5 py-2 text-xs border border-[#D9D0CB] rounded-lg bg-[#FAF8F6] text-[#2E2D24] focus:outline-none focus:ring-2 focus:ring-[#6A6754]"
          >
            {GROCERY_CATEGORY_ORDER.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <div className="sm:col-span-2 relative flex items-center">
            <span className="absolute left-2.5 text-xs font-mono text-[#6A6754] pointer-events-none">
              {activeCurrency.symbol.trim()}
            </span>
            <input
              type="number"
              min="0"
              step={priceStep}
              value={newItemPrice}
              onChange={(e) => setNewItemPrice(Math.max(0, Number(e.target.value)))}
              aria-label={`Price in ${activeCurrency.code}`}
              className="w-full pl-8 pr-2.5 py-2 text-xs font-mono bg-[#FAF8F6] text-[#2E2D24] border border-[#D9D0CB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6A6754]"
            />
          </div>
          <BubbleButton
            type="submit"
            variant="primary"
            size="md"
            className="sm:col-span-2 w-full justify-center"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Item</span>
          </BubbleButton>
        </form>
      </div>

      {/* Main Grocery List + Already Have Pantry Split */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-8">
          {groupedToBuy.length === 0 ? (
            <div className="bg-[#FAF8F6]/88 maloxie-peach-block rounded-xl p-12 text-center space-y-2">
              <p className="text-sm font-medium text-[#2E2D24]">
                No items left to shop for in this view.
              </p>
              <p className="text-xs text-[#6A6754]">
                Assign meals on the Calendar or restore cleared items above.
              </p>
            </div>
          ) : (
            <AnimatedContent
              distance={20}
              direction="vertical"
              duration={0.35}
              ease="power3.out"
              blur={0}
              stagger={0.03}
              trigger="mount"
              className="space-y-4"
            >
              {groupedToBuy.map(([category, items]) => (
                <section
                  key={category}
                  className="bg-[#FAF8F6]/88 maloxie-peach-block rounded-xl overflow-hidden"
                >
                  <div className="px-5 py-3 border-b border-[#D9D0CB]/80 bg-[#F3EFEC]/70 flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-[#2E2D24]">{category}</h3>
                    <span className="font-mono text-xs tabular-nums text-[#6A6754]">
                      {items.length} item{items.length !== 1 ? 's' : ''} ·{' '}
                      <span className="font-semibold text-[#14532D]">
                        {formatCurrency(
                          items.reduce((s, i) => s + i.estimatedPrice, 0),
                          pricing.currencyCode
                        )}
                      </span>
                    </span>
                  </div>

                  <ul className="divide-y divide-[#D9D0CB]">
                    {items.map((item) => {
                      const isChecked = checkedKeys.has(item.key);
                      const isRowEditing = bulkEditPrices || editingItemKey === item.key;
                      const currentDraft =
                        draftPrices[item.key] ??
                        String(
                          roundForCurrencyInput(item.estimatedPrice, pricing.currencyCode)
                        );

                      return (
                        <li
                          key={item.key}
                          className={`px-5 py-3 flex items-center justify-between gap-4 transition-colors ${
                            isChecked ? 'bg-[#F3EFEC]/70' : 'hover:bg-[#F3EFEC]'
                          }`}
                        >
                          <div className="flex items-center gap-3.5 min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={() => onToggleChecked(item.key)}
                              aria-label={`Mark ${item.name} as purchased`}
                              className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                                isChecked
                                  ? 'bg-[#6A6754] border-[#6A6754] text-[#FAF8F6]'
                                  : 'bg-[#FAF8F6] border-[#908B6F] hover:border-[#6A6754]'
                              }`}
                            >
                              {isChecked && <Check className="w-3.5 h-3.5" />}
                            </button>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className={`text-sm font-medium truncate ${
                                    isChecked
                                      ? 'line-through text-[#908B6F]'
                                      : 'text-[#2E2D24]'
                                  }`}
                                >
                                  {item.name}
                                </span>
                                {item.isCustomPrice && !item.isManual && (
                                  <span className="text-[10px] font-medium text-[#9E5236] shrink-0">
                                    · Local price
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-[#6A6754] truncate">
                                For: {item.recipeSources.slice(0, 3).join(', ')}
                                {item.recipeSources.length > 3
                                  ? ` +${item.recipeSources.length - 3} more`
                                  : ''}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2.5 shrink-0">
                            <div className="text-right font-mono tabular-nums">
                              <div
                                className={`text-xs font-medium ${
                                  isChecked ? 'text-[#908B6F]' : 'text-[#2E2D24]'
                                }`}
                              >
                                {formatQuantity(item.quantity)} {item.unit}
                              </div>

                              {isRowEditing ? (
                                <div className="mt-1 flex items-center justify-end gap-1">
                                  <span className="text-[11px] text-[#6A6754]">
                                    {activeCurrency.symbol.trim()}
                                  </span>
                                  <input
                                    type="number"
                                    min={0}
                                    step={priceStep}
                                    value={currentDraft}
                                    onChange={(e) =>
                                      setDraftPrices((prev) => ({
                                        ...prev,
                                        [item.key]: e.target.value,
                                      }))
                                    }
                                    onBlur={() => {
                                      if (bulkEditPrices) {
                                        commitItemPrice(item);
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        commitItemPrice(item);
                                      } else if (e.key === 'Escape') {
                                        setEditingItemKey(null);
                                      }
                                    }}
                                    aria-label={`Local price for ${item.name}`}
                                    className="w-20 px-1.5 py-0.5 text-[11px] font-semibold bg-[#FAF8F6] text-[#14532D] border border-[#908B6F] rounded focus:outline-none focus:ring-2 focus:ring-[#6A6754]"
                                  />
                                  {!bulkEditPrices && (
                                    <button
                                      type="button"
                                      onClick={() => commitItemPrice(item)}
                                      aria-label={`Save price for ${item.name}`}
                                      className="p-1 rounded bg-[#6A6754] text-[#FAF8F6] hover:bg-[#4A483A]"
                                    >
                                      <Check className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => startEditingPrice(item)}
                                  title="Click to edit local price"
                                  className="group/price inline-flex items-center gap-1 text-[11px] font-semibold text-[#14532D] hover:text-[#2E2D24] transition-colors"
                                >
                                  <span>
                                    {formatCurrency(item.estimatedPrice, pricing.currencyCode)}
                                  </span>
                                  <Pencil className="w-2.5 h-2.5 opacity-45 group-hover/price:opacity-100" />
                                </button>
                              )}
                            </div>

                            {item.isCustomPrice && !item.isManual && (
                              <button
                                type="button"
                                onClick={() => {
                                  setDraftPrices((prev) => {
                                    const next = { ...prev };
                                    delete next[item.key];
                                    return next;
                                  });
                                  onClearPriceOverride(item.key);
                                }}
                                title="Reset to regional default price"
                                aria-label={`Reset price for ${item.name}`}
                                className="p-1 rounded-full text-[#908B6F] hover:text-[#2E2D24] hover:bg-[#EAE4E0]"
                              >
                                <RotateCcw className="w-3 h-3" />
                              </button>
                            )}

                            <BubbleButton
                              variant="sage"
                              size="xs"
                              onClick={() => onToggleAlreadyHave(item.key)}
                              title="Move to Already Have pantry section"
                            >
                              Have it
                            </BubbleButton>

                            {item.isManual && item.manualId && (
                              <BubbleIconButton
                                variant="danger"
                                iconSize="sm"
                                onClick={() => onRemoveManualItem(item.manualId!)}
                                aria-label="Delete custom item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </BubbleIconButton>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </AnimatedContent>
          )}
        </div>

        {/* Already Have (Pantry) Section */}
        <aside className="xl:col-span-4 bg-[#FAF8F6]/88 maloxie-peach-block rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setPantryExpanded((e) => !e)}
            className="w-full px-5 py-3.5 border-b border-[#D9D0CB]/80 bg-[#F3EFEC]/70 flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-2">
              <PackageCheck className="w-4 h-4 text-[#6A6754]" />
              <span className="text-xs font-semibold text-[#2E2D24]">
                Already Have ({alreadyHaveItems.length})
              </span>
            </div>
            {pantryExpanded ? (
              <ChevronDown className="w-4 h-4 text-[#6A6754]" />
            ) : (
              <ChevronRight className="w-4 h-4 text-[#6A6754]" />
            )}
          </button>

          {pantryExpanded && (
            <div className="divide-y divide-[#D9D0CB]">
              {alreadyHaveItems.length === 0 ? (
                <div className="p-6 text-xs text-[#6A6754] text-center leading-relaxed">
                  Click <span className="font-medium text-[#2E2D24]">Have it</span> on pantry
                  staples like olive oil, spices, or rice to exclude them from your shopping
                  cart and subtract their cost.
                </div>
              ) : (
                alreadyHaveItems.map((item) => (
                  <div
                    key={item.key}
                    className="px-5 py-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-[#4A483A] truncate">
                        {item.name}
                      </div>
                      <div className="text-[11px] font-mono tabular-nums text-[#6A6754]">
                        {formatQuantity(item.quantity)} {item.unit} · saves{' '}
                        <span className="font-semibold text-[#14532D]">
                          {formatCurrency(item.estimatedPrice, pricing.currencyCode)}
                        </span>
                      </div>
                    </div>
                    <BubbleButton
                      variant="default"
                      size="xs"
                      onClick={() => onToggleAlreadyHave(item.key)}
                    >
                      Need it
                    </BubbleButton>
                  </div>
                ))
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};
