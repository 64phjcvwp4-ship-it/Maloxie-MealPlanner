import { Recipe } from '../types/mealPlanner';
import { MEAL_SLOT_LABELS } from './groceryUtils';

const SLOT_PALETTE: Record<
  string,
  { bg1: string; bg2: string; accent: string; ink: string; subtle: string }
> = {
  breakfast: {
    bg1: '#F7F4F1',
    bg2: '#E3DAD4',
    accent: '#6A6754',
    ink: '#2E2D24',
    subtle: '#4A483A',
  },
  lunch: {
    bg1: '#F2F0E9',
    bg2: '#DAD6C2',
    accent: '#6A6754',
    ink: '#2E2D24',
    subtle: '#575442',
  },
  dinner: {
    bg1: '#ECE8E4',
    bg2: '#D9D0CB',
    accent: '#4A483A',
    ink: '#2E2D24',
    subtle: '#6A6754',
  },
  snacks: {
    bg1: '#F7ECE6',
    bg2: '#E7D1C6',
    accent: '#B86B4B',
    ink: '#2E2D24',
    subtle: '#9E5236',
  },
};

const escapeXml = (str: string): string =>
  str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const wrapTitle = (title: string, maxChars = 24): string[] => {
  const words = title.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    if ((current + ' ' + w).trim().length <= maxChars) {
      current = (current + ' ' + w).trim();
    } else {
      if (current) lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
};

export function getRecipeCarouselSrc(recipe: Recipe): string {
  if (recipe.imageUrl) return recipe.imageUrl;

  const slot = recipe.mealTypes[0] || 'dinner';
  const pal = SLOT_PALETTE[slot] || SLOT_PALETTE.dinner;
  const totalTime = recipe.prepTimeMinutes + recipe.cookTimeMinutes;
  const slotLabel = recipe.mealTypes.map((m) => MEAL_SLOT_LABELS[m]).join(' / ').toUpperCase();
  const titleLines = wrapTitle(recipe.title);
  const tagsLine = recipe.dietaryTags.slice(0, 3).join(' · ') || 'Kitchen Classic';

  const titleSvg = titleLines
    .map(
      (line, idx) =>
        `<text x="48" y="${210 + idx * 42}" font-family="Georgia, 'Times New Roman', serif" font-size="34" font-weight="700" fill="${pal.ink}">${escapeXml(line)}</text>`
    )
    .join('');

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${pal.bg1}" />
      <stop offset="100%" stop-color="${pal.bg2}" />
    </linearGradient>
  </defs>
  <rect width="640" height="480" fill="url(#g)" />
  <circle cx="525" cy="115" r="130" fill="${pal.accent}" fill-opacity="0.07" />
  <circle cx="525" cy="115" r="78" fill="none" stroke="${pal.accent}" stroke-opacity="0.22" stroke-width="1.5" />
  <circle cx="525" cy="115" r="48" fill="none" stroke="${pal.accent}" stroke-opacity="0.16" stroke-width="1" stroke-dasharray="4 4" />
  <rect x="32" y="32" width="576" height="416" rx="18" fill="none" stroke="${pal.accent}" stroke-opacity="0.14" stroke-width="1.5" />

  <text x="48" y="84" font-family="ui-monospace, Menlo, monospace" font-size="14" font-weight="600" letter-spacing="2.2" fill="${pal.accent}">${escapeXml(slotLabel)}</text>
  <text x="48" y="110" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="500" fill="${pal.subtle}" fill-opacity="0.85">${escapeXml(tagsLine)}</text>

  ${titleSvg}

  <line x1="48" y1="364" x2="592" y2="364" stroke="${pal.accent}" stroke-opacity="0.15" stroke-width="1" />

  <text x="48" y="400" font-family="ui-monospace, Menlo, monospace" font-size="20" font-weight="700" fill="${pal.ink}">${recipe.macrosPerServing.calories} kcal</text>
  <text x="190" y="400" font-family="ui-monospace, Menlo, monospace" font-size="18" font-weight="600" fill="${pal.accent}">${recipe.macrosPerServing.protein}g protein</text>
  <text x="360" y="400" font-family="ui-monospace, Menlo, monospace" font-size="16" font-weight="500" fill="${pal.subtle}">${totalTime} min · ${escapeXml(recipe.difficulty)}</text>
</svg>`.trim();

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
