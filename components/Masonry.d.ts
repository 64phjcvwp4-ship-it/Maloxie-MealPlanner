import type { CSSProperties, MouseEvent } from 'react';

export interface MasonryItem {
  id: string | number;
  img: string;
  alt?: string;
  title?: string;
  description?: string;
  url?: string;
  width?: number;
  height?: number;
  span?: number;
}

export interface MasonryProps {
  items: MasonryItem[];
  columns?: 'auto' | number;
  columnWidth?: number;
  gap?: number;
  radius?: number;
  animateFrom?: 'bottom' | 'top' | 'left' | 'right' | 'center' | 'random' | 'none';
  stagger?: number;
  duration?: number;
  bounce?: number;
  blurToFocus?: boolean;
  revealOnScroll?: boolean;
  hoverEffect?: 'zoom' | 'lift' | 'tilt' | 'none';
  focusOnHover?: boolean;
  captions?: 'hover' | 'always' | 'none';
  parallax?: number;
  lightbox?: boolean;
  draggable?: boolean;
  onItemClick?: (item: MasonryItem, index: number, event: MouseEvent<HTMLElement>) => void;
  onReorder?: (orderedItems: MasonryItem[]) => void;
  className?: string;
  style?: CSSProperties;
}

declare const Masonry: React.FC<MasonryProps>;
export default Masonry;
