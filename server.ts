import dns from 'node:dns/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type Request, type Response } from 'express';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type MealSlotType = 'breakfast' | 'lunch' | 'dinner' | 'snacks';
type DifficultyLevel = 'Easy' | 'Medium' | 'Chef';
type DietaryTag =
  | 'High Protein'
  | 'Low Carb'
  | 'Vegetarian'
  | 'Gluten-Free'
  | 'Dairy-Free'
  | 'Budget'
  | 'Quick'
  | 'Batch Friendly';
type GroceryCategory =
  | 'Produce'
  | 'Meat & Fish'
  | 'Dairy & Eggs'
  | 'Pantry'
  | 'Frozen'
  | 'Spices & Oils'
  | 'Bakery & Grains';

interface ParsedIngredient {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: GroceryCategory;
  estimatedPrice: number;
}

interface ImportedRecipePayload {
  title: string;
  subtitle: string;
  cuisine?: string;
  imageUrl?: string;
  mealTypes: MealSlotType[];
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  difficulty: DifficultyLevel;
  servings: number;
  dietaryTags: DietaryTag[];
  macrosPerServing: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  ingredients: ParsedIngredient[];
  instructions: string[];
  sourceUrl: string;
  usedFallbackMeta: boolean;
}

const MAX_URL_LENGTH = 2048;
const MAX_REDIRECTS = 3;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10_000;

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'ip6-localhost',
  'ip6-loopback',
  'metadata',
  'metadata.google.internal',
  'metadata.goog',
]);

function isPrivateOrReservedIpv4(ip: string): boolean {
  const parts = ip.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b, c] = parts;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local / cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 0 && c === 0) return true; // 192.0.0.0/24
  if (a === 192 && b === 0 && c === 2) return true; // 192.0.2.0/24 TEST-NET-1
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15
  if (a === 198 && b === 51 && c === 100) return true; // 198.51.100.0/24 TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return true; // 203.0.113.0/24 TEST-NET-3
  if (a >= 224) return true; // Multicast & reserved 224.0.0.0/4+
  return false;
}

function expandIpv6Hextets(ip: string): number[] | null {
  const withoutZone = ip.split('%')[0].toLowerCase();
  const v4Match = withoutZone.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
  let normalized = withoutZone;
  if (v4Match) {
    const v4Parts = v4Match[2].split('.').map(Number);
    if (v4Parts.length !== 4 || v4Parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
      return null;
    }
    const hi = ((v4Parts[0] << 8) | v4Parts[1]).toString(16);
    const lo = ((v4Parts[2] << 8) | v4Parts[3]).toString(16);
    normalized = `${v4Match[1]}${hi}:${lo}`;
  }

  const sides = normalized.split('::');
  if (sides.length > 2) return null;

  const left = sides[0] ? sides[0].split(':').filter(Boolean) : [];
  const right = sides.length === 2 && sides[1] ? sides[1].split(':').filter(Boolean) : [];
  const missing = 8 - (left.length + right.length);
  if ((sides.length === 1 && missing !== 0) || (sides.length === 2 && missing < 1)) {
    return null;
  }

  const groups = [
    ...left,
    ...Array.from({ length: sides.length === 2 ? missing : 0 }, () => '0'),
    ...right,
  ];
  if (groups.length !== 8) return null;

  const nums: number[] = [];
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/i.test(g)) return null;
    nums.push(parseInt(g, 16));
  }
  return nums;
}

function isPrivateOrReservedIpv6(ip: string): boolean {
  const hextets = expandIpv6Hextets(ip);
  if (!hextets) return true;

  const isUnspecified = hextets.every((h) => h === 0);
  if (isUnspecified) return true; // ::

  const isLoopback = hextets.slice(0, 7).every((h) => h === 0) && hextets[7] === 1;
  if (isLoopback) return true; // ::1

  // ::ffff:0:0/96 (IPv4-mapped) or ::0:0:x:y (IPv4-compatible)
  const isV4Mapped =
    hextets[0] === 0 &&
    hextets[1] === 0 &&
    hextets[2] === 0 &&
    hextets[3] === 0 &&
    hextets[4] === 0 &&
    (hextets[5] === 0xffff || hextets[5] === 0);
  if (isV4Mapped) {
    const a = (hextets[6] >> 8) & 0xff;
    const b = hextets[6] & 0xff;
    const c = (hextets[7] >> 8) & 0xff;
    const d = hextets[7] & 0xff;
    return isPrivateOrReservedIpv4(`${a}.${b}.${c}.${d}`);
  }

  const firstByte = (hextets[0] >> 8) & 0xff;
  if ((firstByte & 0xfe) === 0xfc) return true; // fc00::/7 Unique local
  if (hextets[0] >= 0xfe80 && hextets[0] <= 0xfebf) return true; // fe80::/10 Link-local
  if (firstByte === 0xff) return true; // ff00::/8 Multicast
  return false;
}

function isPrivateOrReservedIp(ip: string): boolean {
  const version = net.isIP(ip);
  if (version === 4) return isPrivateOrReservedIpv4(ip);
  if (version === 6) return isPrivateOrReservedIpv6(ip);
  return true;
}

async function assertPublicUrl(parsed: URL): Promise<void> {
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only public http:// and https:// recipe links are supported.');
  }
  if (parsed.username || parsed.password) {
    throw new Error('Recipe links cannot contain embedded login credentials.');
  }

  const rawHost = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!rawHost) {
    throw new Error('Invalid recipe link host.');
  }
  if (
    BLOCKED_HOSTNAMES.has(rawHost) ||
    rawHost.endsWith('.localhost') ||
    rawHost.endsWith('.local') ||
    rawHost.endsWith('.internal')
  ) {
    throw new Error('Private or local network addresses cannot be imported.');
  }

  if (net.isIP(rawHost)) {
    if (isPrivateOrReservedIp(rawHost)) {
      throw new Error('Private or local IP addresses cannot be imported.');
    }
    return;
  }

  const records = await dns.lookup(rawHost, { all: true }).catch(() => []);
  if (records.length === 0) {
    throw new Error('Could not resolve that recipe website address.');
  }
  for (const record of records) {
    if (isPrivateOrReservedIp(record.address)) {
      throw new Error('That domain points to a private network and cannot be imported.');
    }
  }
}

async function readResponseWithLimit(response: globalThis.Response): Promise<string> {
  const contentLengthHeader = response.headers.get('content-length');
  if (contentLengthHeader) {
    const declaredLength = Number(contentLengthHeader);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
      throw new Error('That recipe page is too large to import (over 2 MB).');
    }
  }

  const reader = response.body?.getReader();
  if (!reader) {
    const text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > MAX_RESPONSE_BYTES) {
      throw new Error('That recipe page is too large to import (over 2 MB).');
    }
    return text;
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      totalBytes += value.byteLength;
      if (totalBytes > MAX_RESPONSE_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new Error('That recipe page exceeded the 2 MB download limit.');
      }
      chunks.push(value);
    }
  }

  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(combined);
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]);

async function readBinaryWithLimit(response: globalThis.Response, maxBytes: number): Promise<Buffer> {
  const contentLengthHeader = response.headers.get('content-length');
  if (contentLengthHeader) {
    const declaredLength = Number(contentLengthHeader);
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
      throw new Error('Image exceeds maximum allowed size.');
    }
  }

  const reader = response.body?.getReader();
  if (!reader) {
    const arr = new Uint8Array(await response.arrayBuffer());
    if (arr.byteLength > maxBytes) {
      throw new Error('Image exceeds maximum allowed size.');
    }
    return Buffer.from(arr);
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new Error('Image exceeds maximum allowed size.');
      }
      chunks.push(value);
    }
  }

  const combined = Buffer.allocUnsafe(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return combined;
}

async function safeFetchRecipeImage(startUrl: string): Promise<{ buffer: Buffer; contentType: string }> {
  let currentUrl = new URL(startUrl);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    await assertPublicUrl(currentUrl);

    const response = await fetch(currentUrl.toString(), {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; MaloxieRecipeImporter/1.0; +https://maloxie.app)',
        Accept: 'image/avif,image/webp,image/png,image/jpeg,*/*;q=0.8',
      },
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      await response.body?.cancel().catch(() => undefined);
      if (!location || hop === MAX_REDIRECTS) {
        throw new Error('Image redirect limit exceeded.');
      }
      currentUrl = new URL(location, currentUrl);
      continue;
    }

    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      throw new Error(`Could not load image (HTTP ${response.status}).`);
    }

    const rawContentType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!ALLOWED_IMAGE_TYPES.has(rawContentType)) {
      await response.body?.cancel().catch(() => undefined);
      throw new Error('Remote URL is not a supported raster image.');
    }

    const buffer = await readBinaryWithLimit(response, MAX_IMAGE_BYTES);
    return {
      buffer,
      contentType: rawContentType === 'image/jpg' ? 'image/jpeg' : rawContentType,
    };
  }

  throw new Error('Image redirect limit exceeded.');
}

async function safeFetchRecipePage(startUrl: string): Promise<{ html: string; finalUrl: string }> {
  let currentUrl = new URL(startUrl);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    await assertPublicUrl(currentUrl);

    const response = await fetch(currentUrl.toString(), {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; MaloxieRecipeImporter/1.0; +https://maloxie.app)',
        Accept: 'text/html,application/xhtml+xml,application/ld+json,application/json;q=0.9',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      await response.body?.cancel().catch(() => undefined);
      if (!location) {
        throw new Error('Recipe site returned an empty redirect.');
      }
      if (hop === MAX_REDIRECTS) {
        throw new Error('Recipe link redirected too many times.');
      }
      currentUrl = new URL(location, currentUrl);
      continue;
    }

    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      throw new Error(`Could not load that recipe page (HTTP ${response.status}).`);
    }

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (
      contentType &&
      !contentType.includes('text/html') &&
      !contentType.includes('application/xhtml+xml') &&
      !contentType.includes('application/ld+json') &&
      !contentType.includes('application/json') &&
      !contentType.includes('text/plain')
    ) {
      await response.body?.cancel().catch(() => undefined);
      throw new Error('That link does not point to a readable web recipe page.');
    }

    const html = await readResponseWithLimit(response);
    return { html, finalUrl: currentUrl.toString() };
  }

  throw new Error('Recipe link redirected too many times.');
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  deg: '°',
  ndash: '–',
  mdash: '—',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  hellip: '…',
  frac12: '½',
  frac13: '⅓',
  frac23: '⅔',
  frac14: '¼',
  frac34: '¾',
  frac18: '⅛',
  frac38: '⅜',
  frac58: '⅝',
  frac78: '⅞',
};

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&#(\d+);/g, (_m, dec) => {
      const code = Number(dec);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : '';
    })
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : '';
    })
    .replace(/&([a-z0-9]+);/gi, (match, name) => NAMED_ENTITIES[name.toLowerCase()] ?? match);
}

function cleanPlainText(value: unknown, maxLen = 400): string {
  if (typeof value !== 'string') return '';
  const stripped = value.replace(/<[^>]*>/g, ' ');
  const decoded = decodeHtmlEntities(stripped);
  return decoded.replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

function validatePublicImageUrl(raw: unknown, baseUrl: string): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith('data:') || trimmed.startsWith('javascript:')) {
    return undefined;
  }
  try {
    const resolved = new URL(trimmed, baseUrl);
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') {
      return undefined;
    }
    return resolved.toString();
  } catch {
    return undefined;
  }
}

function extractImageFromSchema(imageField: unknown, baseUrl: string): string | undefined {
  if (!imageField) return undefined;
  if (typeof imageField === 'string') return validatePublicImageUrl(imageField, baseUrl);
  if (Array.isArray(imageField)) {
    for (const item of imageField) {
      const url = extractImageFromSchema(item, baseUrl);
      if (url) return url;
    }
    return undefined;
  }
  if (typeof imageField === 'object') {
    const obj = imageField as Record<string, unknown>;
    return (
      validatePublicImageUrl(obj.url, baseUrl) ||
      validatePublicImageUrl(obj.contentUrl, baseUrl)
    );
  }
  return undefined;
}

function parseIsoDurationMinutes(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return Math.round(value);
  }
  if (typeof value !== 'string') return 0;
  const trimmed = value.trim();
  const isoMatch = trimmed.match(
    /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i
  );
  if (isoMatch) {
    const days = Number(isoMatch[1] || 0);
    const hours = Number(isoMatch[2] || 0);
    const mins = Number(isoMatch[3] || 0);
    const secs = Number(isoMatch[4] || 0);
    return Math.max(0, Math.round(days * 1440 + hours * 60 + mins + secs / 60));
  }
  const numericMatch = trimmed.match(/(\d+)\s*(min|m|hour|hr|h)/i);
  if (numericMatch) {
    const val = Number(numericMatch[1]);
    return /^h/i.test(numericMatch[2]) ? val * 60 : val;
  }
  return 0;
}

function parseServings(yieldField: unknown): number {
  const candidates = Array.isArray(yieldField) ? yieldField : [yieldField];
  for (const item of candidates) {
    if (typeof item === 'number' && Number.isFinite(item) && item > 0) {
      return Math.max(1, Math.min(12, Math.round(item)));
    }
    if (typeof item === 'string') {
      const m = item.match(/\d+/);
      if (m) {
        const num = Number(m[0]);
        if (Number.isFinite(num) && num > 0) {
          return Math.max(1, Math.min(12, Math.round(num)));
        }
      }
    }
  }
  return 2;
}

function parseMacroNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return Math.round(value);
  }
  if (typeof value === 'string') {
    const m = value.match(/(\d+(?:\.\d+)?)/);
    if (m) return Math.max(0, Math.round(Number(m[1])));
  }
  return 0;
}

const UNICODE_FRACTIONS: Record<string, number> = {
  '½': 0.5,
  '⅓': 0.33,
  '⅔': 0.67,
  '¼': 0.25,
  '¾': 0.75,
  '⅕': 0.2,
  '⅖': 0.4,
  '⅗': 0.6,
  '⅘': 0.8,
  '⅙': 0.17,
  '⅚': 0.83,
  '⅛': 0.125,
  '⅜': 0.375,
  '⅝': 0.625,
  '⅞': 0.875,
};

function parseLeadingQuantity(tokens: string[]): { quantity: number; restIndex: number } {
  if (tokens.length === 0) return { quantity: 1, restIndex: 0 };

  let total = 0;
  let idx = 0;

  const parseToken = (tok: string): number | null => {
    const clean = tok.replace(/[(),]/g, '');
    if (UNICODE_FRACTIONS[clean] !== undefined) return UNICODE_FRACTIONS[clean];
    const mixedUnicode = clean.match(/^(\d+)([½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])$/);
    if (mixedUnicode) {
      return Number(mixedUnicode[1]) + (UNICODE_FRACTIONS[mixedUnicode[2]] || 0);
    }
    const fracMatch = clean.match(/^(\d+)\/(\d+)$/);
    if (fracMatch) {
      const den = Number(fracMatch[2]);
      return den > 0 ? Number(fracMatch[1]) / den : null;
    }
    const rangeMatch = clean.match(/^(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)$/);
    if (rangeMatch) {
      return Number(rangeMatch[1]);
    }
    if (/^\d+(?:\.\d+)?$/.test(clean)) {
      return Number(clean);
    }
    return null;
  };

  const first = parseToken(tokens[0]);
  if (first === null) return { quantity: 1, restIndex: 0 };
  total = first;
  idx = 1;

  if (tokens.length > 1) {
    const second = parseToken(tokens[1]);
    if (second !== null && second > 0 && second < 1) {
      total += second;
      idx = 2;
    }
  }

  return { quantity: Math.max(0.1, Math.round(total * 100) / 100), restIndex: idx };
}

const UNIT_ALIASES: Record<string, string> = {
  g: 'g',
  gram: 'g',
  grams: 'g',
  kg: 'kg',
  kilogram: 'kg',
  kilograms: 'kg',
  oz: 'oz',
  ounce: 'oz',
  ounces: 'oz',
  lb: 'lb',
  lbs: 'lb',
  pound: 'lb',
  pounds: 'lb',
  ml: 'ml',
  milliliter: 'ml',
  milliliters: 'ml',
  l: 'L',
  liter: 'L',
  liters: 'L',
  tsp: 'tsp',
  teaspoon: 'tsp',
  teaspoons: 'tsp',
  tbsp: 'tbsp',
  tbs: 'tbsp',
  tablespoon: 'tbsp',
  tablespoons: 'tbsp',
  cup: 'cup',
  cups: 'cups',
  clove: 'cloves',
  cloves: 'cloves',
  slice: 'slices',
  slices: 'slices',
  can: 'can',
  cans: 'cans',
  bunch: 'bunch',
  bunches: 'bunch',
  pinch: 'pinch',
  sprig: 'sprig',
  sprigs: 'sprigs',
  piece: 'piece',
  pieces: 'pieces',
  fillet: 'fillet',
  fillets: 'fillets',
  head: 'head',
  heads: 'heads',
  stalk: 'stalks',
  stalks: 'stalks',
  package: 'pkg',
  packages: 'pkg',
  pkg: 'pkg',
  bag: 'bag',
  bags: 'bag',
  jar: 'jar',
  jars: 'jar',
};

function inferIngredientCategory(name: string): { category: GroceryCategory; price: number } {
  const n = name.toLowerCase();
  if (
    /\b(chicken|turkey|beef|steak|pork|salmon|tuna|cod|shrimp|prawn|fish|lamb|bacon|sausage|duck|tilapia|halibut|crab|tofu|tempeh)\b/.test(
      n
    )
  ) {
    return { category: 'Meat & Fish', price: 4.5 };
  }
  if (
    /\b(milk|cream|yogurt|butter|cheese|parmesan|mozzarella|feta|cheddar|ricotta|egg|eggs|sour cream|kefir|ghee)\b/.test(
      n
    )
  ) {
    return { category: 'Dairy & Eggs', price: 2.25 };
  }
  if (/\b(frozen|edamame|ice)\b/.test(n)) {
    return { category: 'Frozen', price: 2.0 };
  }
  if (
    /\b(bread|tortilla|bagel|bun|roll|pita|naan|rice|quinoa|pasta|spaghetti|noodle|oat|oats|flour|couscous|farro|barley|granola)\b/.test(
      n
    )
  ) {
    return { category: 'Bakery & Grains', price: 1.75 };
  }
  if (
    /\b(oil|olive oil|sesame oil|vinegar|salt|pepper|paprika|cumin|oregano|thyme|rosemary|cinnamon|turmeric|chili|garlic powder|onion powder|spice|ginger powder|curry|nutmeg|cayenne|vanilla)\b/.test(
      n
    )
  ) {
    return { category: 'Spices & Oils', price: 0.65 };
  }
  if (
    /\b(tomato|onion|garlic|spinach|kale|broccoli|carrot|pepper|bell pepper|cucumber|lettuce|avocado|lemon|lime|apple|banana|berry|berries|mushroom|zucchini|potato|sweet potato|celery|cilantro|parsley|basil|scallion|green onion|ginger|corn|cabbage|cauliflower|asparagus|eggplant|squash)\b/.test(
      n
    )
  ) {
    return { category: 'Produce', price: 1.6 };
  }
  return { category: 'Pantry', price: 1.5 };
}

function parseIngredientLine(rawLine: string, idx: number): ParsedIngredient | null {
  const cleaned = cleanPlainText(rawLine, 180)
    .replace(/^[-•*]\s*/, '')
    .trim();
  if (!cleaned) return null;

  const tokens = cleaned.split(/\s+/);
  const { quantity, restIndex } = parseLeadingQuantity(tokens);
  let cursor = restIndex;

  let unit = 'whole';
  if (cursor < tokens.length) {
    const candidate = tokens[cursor].toLowerCase().replace(/[.,;:]+$/, '');
    if (UNIT_ALIASES[candidate]) {
      unit = UNIT_ALIASES[candidate];
      cursor += 1;
    }
  }

  let name = tokens.slice(cursor).join(' ').trim();
  if (!name) {
    name = cleaned;
  }
  // Strip trailing prep notes after commas only if very long
  if (name.length > 72 && name.includes(',')) {
    name = name.split(',')[0].trim();
  }

  const { category, price } = inferIngredientCategory(name);

  return {
    id: `imported-${Date.now()}-${idx}`,
    name: name.charAt(0).toUpperCase() + name.slice(1),
    quantity,
    unit,
    category,
    estimatedPrice: price,
  };
}

function extractInstructions(raw: unknown): string[] {
  const steps: string[] = [];

  const pushStep = (val: unknown) => {
    const text = cleanPlainText(val, 600);
    if (text && text.length > 2) {
      steps.push(text.replace(/^\d+[.)]\s*/, '').trim());
    }
  };

  const walk = (node: unknown) => {
    if (!node) return;
    if (typeof node === 'string') {
      const splitLines = node
        .split(/\r?\n+/)
        .map((line) => line.trim())
        .filter(Boolean);
      if (splitLines.length > 1) {
        for (const line of splitLines) pushStep(line);
      } else {
        pushStep(node);
      }
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (typeof node === 'object') {
      const obj = node as Record<string, unknown>;
      if (typeof obj.text === 'string') {
        pushStep(obj.text);
      } else if (typeof obj.name === 'string' && !obj.itemListElement) {
        pushStep(obj.name);
      }
      if (obj.itemListElement) {
        walk(obj.itemListElement);
      }
    }
  };

  walk(raw);
  return steps.slice(0, 25);
}

function isRecipeType(typeField: unknown): boolean {
  if (typeof typeField === 'string') {
    return typeField.toLowerCase() === 'recipe' || typeField.toLowerCase().endsWith('/recipe');
  }
  if (Array.isArray(typeField)) {
    return typeField.some((entry) => isRecipeType(entry));
  }
  return false;
}

function findRecipeJsonLd(node: unknown): Record<string, unknown> | null {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const match = findRecipeJsonLd(item);
      if (match) return match;
    }
    return null;
  }

  const obj = node as Record<string, unknown>;
  if (isRecipeType(obj['@type'])) {
    return obj;
  }
  if (obj['@graph']) {
    const graphMatch = findRecipeJsonLd(obj['@graph']);
    if (graphMatch) return graphMatch;
  }
  if (obj.mainEntity) {
    const entityMatch = findRecipeJsonLd(obj.mainEntity);
    if (entityMatch) return entityMatch;
  }
  return null;
}

function readMetaTag(html: string, keys: string[]): string {
  const metaRegex = /<meta\s+[^>]*>/gi;
  const tags = html.match(metaRegex) || [];
  for (const tag of tags) {
    const attrMap: Record<string, string> = {};
    const attrRegex = /([a-zA-Z:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
    let m: RegExpExecArray | null;
    while ((m = attrRegex.exec(tag)) !== null) {
      attrMap[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
    }
    const idKey = (attrMap.property || attrMap.name || '').toLowerCase();
    if (keys.includes(idKey) && attrMap.content) {
      return cleanPlainText(attrMap.content, 300);
    }
  }
  return '';
}

function inferMealTypes(
  categoriesText: string,
  title: string
): MealSlotType[] {
  const combined = `${categoriesText} ${title}`.toLowerCase();
  const slots: MealSlotType[] = [];
  if (/\b(breakfast|brunch|oat|oatmeal|pancake|waffle|smoothie|granola|omelet|omelette|toast)\b/.test(combined)) {
    slots.push('breakfast');
  }
  if (/\b(lunch|salad|sandwich|wrap|bowl|soup|bento)\b/.test(combined)) {
    slots.push('lunch');
  }
  if (/\b(snack|appetizer|dip|bar|bite|trail mix|yogurt|smoothie)\b/.test(combined)) {
    slots.push('snacks');
  }
  if (/\b(dinner|entree|main|supper|roast|pasta|curry|stir-fry|skillet|bake|stew)\b/.test(combined)) {
    slots.push('dinner');
  }
  if (slots.length === 0) {
    slots.push('dinner', 'lunch');
  }
  return Array.from(new Set(slots));
}

function inferDietaryTags(
  textBlob: string,
  ingredients: ParsedIngredient[],
  macros: { calories: number; protein: number; carbs: number },
  totalTimeMinutes: number
): DietaryTag[] {
  const tags: DietaryTag[] = [];
  const lower = textBlob.toLowerCase();
  const hasMeatOrFish = ingredients.some((i) => i.category === 'Meat & Fish');
  const hasDairy = ingredients.some(
    (i) => i.category === 'Dairy & Eggs' && !/\begg/i.test(i.name)
  );

  if (macros.protein >= 25 || /\bhigh[- ]protein\b/.test(lower)) tags.push('High Protein');
  if ((macros.carbs > 0 && macros.carbs <= 25) || /\b(low[- ]carb|keto)\b/.test(lower)) {
    tags.push('Low Carb');
  }
  if (!hasMeatOrFish || /\b(vegetarian|vegan)\b/.test(lower)) tags.push('Vegetarian');
  if (/\bgluten[- ]free\b/.test(lower)) tags.push('Gluten-Free');
  if (!hasDairy || /\b(dairy[- ]free|vegan)\b/.test(lower)) tags.push('Dairy-Free');
  if (totalTimeMinutes > 0 && totalTimeMinutes <= 25) tags.push('Quick');
  if (tags.length === 0) tags.push('Batch Friendly');
  return tags.slice(0, 4);
}

function extractRecipeFromHtml(html: string, sourceUrl: string): ImportedRecipePayload | null {
  let recipeNode: Record<string, unknown> | null = null;

  const trimmedHtml = html.trim();
  if (trimmedHtml.startsWith('{') || trimmedHtml.startsWith('[')) {
    try {
      recipeNode = findRecipeJsonLd(JSON.parse(trimmedHtml));
    } catch {
      // Ignore raw JSON parse failure
    }
  }

  if (!recipeNode) {
    const ldJsonRegex =
      /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let match: RegExpExecArray | null;
    while ((match = ldJsonRegex.exec(html)) !== null) {
      const rawJson = match[1]?.trim();
      if (!rawJson) continue;
      try {
        const parsed = JSON.parse(rawJson);
        const found = findRecipeJsonLd(parsed);
        if (found) {
          recipeNode = found;
          break;
        }
      } catch {
        // Continue checking other JSON-LD blocks
      }
    }
  }

  const ogTitle = readMetaTag(html, ['og:title', 'twitter:title']);
  const ogDesc = readMetaTag(html, ['og:description', 'description', 'twitter:description']);
  const ogImage = validatePublicImageUrl(
    readMetaTag(html, ['og:image', 'twitter:image']),
    sourceUrl
  );
  const htmlTitleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const pageTitle = htmlTitleMatch ? cleanPlainText(htmlTitleMatch[1], 180) : '';

  if (recipeNode) {
    const title = cleanPlainText(recipeNode.name, 140) || ogTitle || pageTitle;
    if (!title) return null;

    const subtitle =
      cleanPlainText(recipeNode.description, 220) ||
      ogDesc ||
      'Imported recipe from the web';

    const cuisineRaw = Array.isArray(recipeNode.recipeCuisine)
      ? recipeNode.recipeCuisine[0]
      : recipeNode.recipeCuisine;
    const cuisine = cleanPlainText(cuisineRaw, 48) || undefined;

    const imageUrl = extractImageFromSchema(recipeNode.image, sourceUrl) || ogImage;

    let prepTimeMinutes = parseIsoDurationMinutes(recipeNode.prepTime);
    let cookTimeMinutes = parseIsoDurationMinutes(recipeNode.cookTime);
    const totalTimeMinutes = parseIsoDurationMinutes(recipeNode.totalTime);
    if (prepTimeMinutes === 0 && cookTimeMinutes === 0 && totalTimeMinutes > 0) {
      prepTimeMinutes = Math.max(5, Math.round(totalTimeMinutes * 0.35));
      cookTimeMinutes = Math.max(0, totalTimeMinutes - prepTimeMinutes);
    }
    if (prepTimeMinutes === 0 && cookTimeMinutes === 0) {
      prepTimeMinutes = 10;
      cookTimeMinutes = 20;
    }

    const servings = parseServings(recipeNode.recipeYield);

    const nutrition =
      recipeNode.nutrition && typeof recipeNode.nutrition === 'object'
        ? (recipeNode.nutrition as Record<string, unknown>)
        : {};
    const macrosPerServing = {
      calories: parseMacroNumber(nutrition.calories) || 450,
      protein: parseMacroNumber(nutrition.proteinContent) || 24,
      carbs: parseMacroNumber(nutrition.carbohydrateContent) || 42,
      fat: parseMacroNumber(nutrition.fatContent) || 16,
    };

    const rawIngredients = Array.isArray(recipeNode.recipeIngredient)
      ? recipeNode.recipeIngredient
      : Array.isArray(recipeNode.ingredients)
        ? recipeNode.ingredients
        : [];

    const ingredients: ParsedIngredient[] = rawIngredients
      .map((line, idx) => (typeof line === 'string' ? parseIngredientLine(line, idx) : null))
      .filter((item): item is ParsedIngredient => item !== null)
      .slice(0, 40);

    const instructions = extractInstructions(recipeNode.recipeInstructions);

    const categoryText = [
      Array.isArray(recipeNode.recipeCategory)
        ? recipeNode.recipeCategory.join(' ')
        : String(recipeNode.recipeCategory || ''),
      Array.isArray(recipeNode.keywords)
        ? recipeNode.keywords.join(' ')
        : String(recipeNode.keywords || ''),
    ].join(' ');

    const mealTypes = inferMealTypes(categoryText, title);
    const dietaryTags = inferDietaryTags(
      `${categoryText} ${subtitle}`,
      ingredients,
      macrosPerServing,
      prepTimeMinutes + cookTimeMinutes
    );

    const stepCount = instructions.length;
    const difficulty: DifficultyLevel =
      prepTimeMinutes + cookTimeMinutes <= 25 && stepCount <= 5
        ? 'Easy'
        : stepCount >= 9 || prepTimeMinutes + cookTimeMinutes >= 60
          ? 'Chef'
          : 'Medium';

    return {
      title,
      subtitle,
      cuisine,
      imageUrl,
      mealTypes,
      prepTimeMinutes,
      cookTimeMinutes,
      difficulty,
      servings,
      dietaryTags,
      macrosPerServing,
      ingredients,
      instructions:
        instructions.length > 0
          ? instructions
          : ['Prepare ingredients as listed.', 'Cook according to your preferred method and serve warm.'],
      sourceUrl,
      usedFallbackMeta: false,
    };
  }

  // Fallback to OpenGraph/page metadata when structured Recipe JSON-LD is absent
  const fallbackTitle = (ogTitle || pageTitle).replace(/\s*[|–—-]\s*[^|–—-]{2,40}$/, '').trim();
  if (!fallbackTitle) return null;

  return {
    title: fallbackTitle.slice(0, 140),
    subtitle: ogDesc || 'Imported web recipe link — review ingredients and steps before saving.',
    imageUrl: ogImage,
    mealTypes: inferMealTypes('', fallbackTitle),
    prepTimeMinutes: 15,
    cookTimeMinutes: 20,
    difficulty: 'Medium',
    servings: 2,
    dietaryTags: ['Batch Friendly'],
    macrosPerServing: { calories: 450, protein: 25, carbs: 45, fat: 16 },
    ingredients: [],
    instructions: [
      'Review and add ingredients from the recipe page.',
      'Follow cooking steps and adjust seasonings to taste.',
    ],
    sourceUrl,
    usedFallbackMeta: true,
  };
}

async function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));

  app.post('/api/import-recipe', async (req: Request, res: Response) => {
    const rawUrl = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
    if (!rawUrl || rawUrl.length > MAX_URL_LENGTH) {
      res.status(400).json({ error: 'Please paste a valid web recipe link.' });
      return;
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(rawUrl);
    } catch {
      res.status(400).json({
        error: 'That link does not look like a full web address (include https://).',
      });
      return;
    }

    try {
      const { html, finalUrl } = await safeFetchRecipePage(parsedUrl.toString());
      const recipe = extractRecipeFromHtml(html, finalUrl);
      if (!recipe) {
        res.status(422).json({
          error:
            'Could not detect recipe details on that page. Try another recipe page or enter the meal manually.',
        });
        return;
      }
      res.json({ recipe });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to import recipe from that link.';
      const status =
        message.includes('cannot be imported') ||
        message.includes('http://') ||
        message.includes('credentials') ||
        message.includes('resolve')
          ? 400
          : 502;
      res.status(status).json({ error: message });
    }
  });

  app.get('/api/recipe-image', async (req: Request, res: Response) => {
    const rawUrl = typeof req.query.url === 'string' ? req.query.url.trim() : '';
    if (!rawUrl || rawUrl.length > MAX_URL_LENGTH) {
      res.status(400).end();
      return;
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(rawUrl);
    } catch {
      res.status(400).end();
      return;
    }

    try {
      const { buffer, contentType } = await safeFetchRecipeImage(parsedUrl.toString());
      res.setHeader('Content-Type', contentType);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.send(buffer);
    } catch {
      res.status(404).end();
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Maloxie server listening on http://0.0.0.0:${port}`);
  });
}

createApp();
