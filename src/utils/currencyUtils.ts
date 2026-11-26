import type { GroceryCategory, Ingredient, PricingConfig } from '../types/mealPlanner';

export interface CurrencyOption {
  code: string;
  symbol: string;
  regionLabel: string;
  exchangeRate: number; // Units of local currency per 1 USD
  defaultRegionalFactor: number; // Suggested local grocery price index vs US baseline
  decimals: number;
  budgetStep: number;
}

export const CURRENCY_OPTIONS: CurrencyOption[] = [
  {
    code: 'USD',
    symbol: '$',
    regionLabel: 'United States',
    exchangeRate: 1,
    defaultRegionalFactor: 1,
    decimals: 2,
    budgetStep: 5,
  },
  {
    code: 'GBP',
    symbol: '£',
    regionLabel: 'United Kingdom',
    exchangeRate: 0.79,
    defaultRegionalFactor: 0.92,
    decimals: 2,
    budgetStep: 5,
  },
  {
    code: 'EUR',
    symbol: '€',
    regionLabel: 'Europe (Eurozone)',
    exchangeRate: 0.92,
    defaultRegionalFactor: 0.95,
    decimals: 2,
    budgetStep: 5,
  },
  {
    code: 'CAD',
    symbol: 'CA$',
    regionLabel: 'Canada',
    exchangeRate: 1.39,
    defaultRegionalFactor: 1.02,
    decimals: 2,
    budgetStep: 5,
  },
  {
    code: 'AUD',
    symbol: 'A$',
    regionLabel: 'Australia',
    exchangeRate: 1.54,
    defaultRegionalFactor: 1.05,
    decimals: 2,
    budgetStep: 5,
  },
  {
    code: 'NGN',
    symbol: '₦',
    regionLabel: 'Nigeria',
    exchangeRate: 1620,
    defaultRegionalFactor: 0.42,
    decimals: 0,
    budgetStep: 1000,
  },
  {
    code: 'GHS',
    symbol: '₵',
    regionLabel: 'Ghana',
    exchangeRate: 15.8,
    defaultRegionalFactor: 0.45,
    decimals: 2,
    budgetStep: 25,
  },
  {
    code: 'KES',
    symbol: 'KSh ',
    regionLabel: 'Kenya',
    exchangeRate: 129,
    defaultRegionalFactor: 0.45,
    decimals: 0,
    budgetStep: 250,
  },
  {
    code: 'ZAR',
    symbol: 'R',
    regionLabel: 'South Africa',
    exchangeRate: 18.2,
    defaultRegionalFactor: 0.62,
    decimals: 2,
    budgetStep: 50,
  },
  {
    code: 'INR',
    symbol: '₹',
    regionLabel: 'India',
    exchangeRate: 84.5,
    defaultRegionalFactor: 0.38,
    decimals: 0,
    budgetStep: 200,
  },
  {
    code: 'JPY',
    symbol: '¥',
    regionLabel: 'Japan',
    exchangeRate: 154,
    defaultRegionalFactor: 0.85,
    decimals: 0,
    budgetStep: 500,
  },
  {
    code: 'SGD',
    symbol: 'S$',
    regionLabel: 'Singapore',
    exchangeRate: 1.34,
    defaultRegionalFactor: 1.08,
    decimals: 2,
    budgetStep: 5,
  },
  {
    code: 'AED',
    symbol: 'AED ',
    regionLabel: 'United Arab Emirates',
    exchangeRate: 3.67,
    defaultRegionalFactor: 1.05,
    decimals: 2,
    budgetStep: 20,
  },
  {
    code: 'CHF',
    symbol: 'CHF ',
    regionLabel: 'Switzerland',
    exchangeRate: 0.88,
    defaultRegionalFactor: 1.45,
    decimals: 2,
    budgetStep: 5,
  },
  {
    code: 'SEK',
    symbol: 'kr ',
    regionLabel: 'Sweden',
    exchangeRate: 10.9,
    defaultRegionalFactor: 1.05,
    decimals: 0,
    budgetStep: 50,
  },
  {
    code: 'MXN',
    symbol: 'MX$',
    regionLabel: 'Mexico',
    exchangeRate: 20.3,
    defaultRegionalFactor: 0.55,
    decimals: 2,
    budgetStep: 50,
  },
  {
    code: 'BRL',
    symbol: 'R$',
    regionLabel: 'Brazil',
    exchangeRate: 5.8,
    defaultRegionalFactor: 0.52,
    decimals: 2,
    budgetStep: 25,
  },
];

export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  currencyCode: 'USD',
  regionalPriceFactor: 1,
  priceOverrides: {},
};

export function getCurrencyOption(code?: string): CurrencyOption {
  const upper = (code || 'USD').toUpperCase();
  return CURRENCY_OPTIONS.find((c) => c.code === upper) || CURRENCY_OPTIONS[0];
}

export function getIngredientPriceKey(
  category: GroceryCategory,
  name: string,
  unit: string
): string {
  return `${category}::${name.trim().toLowerCase()}::${unit.trim().toLowerCase()}`;
}

export function convertBaseUsdToLocal(
  usdAmount: number,
  pricing: PricingConfig = DEFAULT_PRICING_CONFIG
): number {
  const curr = getCurrencyOption(pricing.currencyCode);
  const factor = Math.max(0.1, Math.min(5, pricing.regionalPriceFactor || 1));
  return usdAmount * curr.exchangeRate * factor;
}

export function convertLocalToBaseUsd(
  localAmount: number,
  pricing: PricingConfig = DEFAULT_PRICING_CONFIG
): number {
  const curr = getCurrencyOption(pricing.currencyCode);
  const factor = Math.max(0.1, Math.min(5, pricing.regionalPriceFactor || 1));
  const denom = Math.max(0.0001, curr.exchangeRate * factor);
  return localAmount / denom;
}

export function getIngredientLocalPrice(
  ing: Pick<Ingredient, 'category' | 'name' | 'unit' | 'quantity' | 'estimatedPrice'>,
  scale: number,
  pricing: PricingConfig = DEFAULT_PRICING_CONFIG
): { key: string; price: number; isCustom: boolean } {
  const key = getIngredientPriceKey(ing.category, ing.name, ing.unit);
  const overrideUnitPrice = pricing.priceOverrides?.[key];
  if (typeof overrideUnitPrice === 'number' && Number.isFinite(overrideUnitPrice) && overrideUnitPrice >= 0) {
    return {
      key,
      price: ing.quantity * scale * overrideUnitPrice,
      isCustom: true,
    };
  }
  return {
    key,
    price: convertBaseUsdToLocal(ing.estimatedPrice * scale, pricing),
    isCustom: false,
  };
}

export function formatCurrency(
  amount: number,
  currencyCode = 'USD',
  options?: { compact?: boolean }
): string {
  const curr = getCurrencyOption(currencyCode);
  const safe = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  const decimals = options?.compact ? 0 : curr.decimals;

  const formattedNum = safe.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return `${curr.symbol}${formattedNum}`;
}

export function roundForCurrencyInput(amount: number, currencyCode = 'USD'): number {
  const curr = getCurrencyOption(currencyCode);
  const mult = Math.pow(10, curr.decimals);
  return Math.round(Math.max(0, amount) * mult) / mult;
}
