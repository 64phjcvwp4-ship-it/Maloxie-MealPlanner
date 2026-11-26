import React, { useState } from 'react';
import { Utensils } from 'lucide-react';
import { MealSlotType } from '../types/mealPlanner';

interface RecipeImageProps {
  src?: string;
  alt: string;
  mealTypes?: MealSlotType[];
  className?: string;
}

const SLOT_BG: Record<MealSlotType, string> = {
  breakfast: 'from-[#F1F5F9] to-[#E2E8F0] text-[#475569]',
  lunch: 'from-[#F0FDF4] to-[#DCFCE7] text-[#166534]',
  dinner: 'from-[#F8FAFC] to-[#E5E7EB] text-[#374151]',
  snacks: 'from-[#FEFCE8] to-[#FEF3C7] text-[#92400E]',
};

export const RecipeImage: React.FC<RecipeImageProps> = ({
  src,
  alt,
  mealTypes = ['dinner'],
  className = 'w-full h-44',
}) => {
  const [failed, setFailed] = useState(false);
  const primarySlot = mealTypes[0] || 'dinner';
  const palette = SLOT_BG[primarySlot];

  if (!src || failed) {
    return (
      <div
        className={`relative overflow-hidden bg-gradient-to-br ${palette} flex flex-col items-center justify-center p-4 select-none ${className}`}
        aria-label={alt}
      >
        <div className="w-10 h-10 rounded-full bg-white/70 border border-black/5 flex items-center justify-center mb-2">
          <Utensils className="w-4 h-4 opacity-75" />
        </div>
        <span className="text-xs font-medium text-center line-clamp-2 opacity-80 max-w-[180px]">
          {alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  );
};
