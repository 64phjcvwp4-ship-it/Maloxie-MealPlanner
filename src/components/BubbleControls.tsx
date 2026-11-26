import React from 'react';
import {
  SoapBubbleButton,
  SoapBubbleIconButton,
  type SoapBubbleButtonProps,
  type SoapBubbleIconButtonProps,
} from '../../components/soap-bubble';

export type BubbleVariant = 'default' | 'primary' | 'dark' | 'sage' | 'danger';
export type BubbleSize = 'xs' | 'sm' | 'md' | 'lg';

interface BubbleButtonProps extends Omit<SoapBubbleButtonProps, 'size'> {
  variant?: BubbleVariant;
  size?: BubbleSize;
}

const VARIANT_CONFIG: Record<
  BubbleVariant,
  { tint: string; opacity: number; color: string; extraClass: string }
> = {
  primary: {
    tint: 'rgb(21 128 61)',
    opacity: 0.92,
    color: '#ffffff',
    extraClass: 'text-white',
  },
  dark: {
    tint: 'rgb(17 24 39)',
    opacity: 0.9,
    color: '#ffffff',
    extraClass: 'text-white',
  },
  sage: {
    tint: 'rgb(220 252 231)',
    opacity: 0.88,
    color: '#14532D',
    extraClass: 'text-[#14532D]',
  },
  danger: {
    tint: 'rgb(254 226 226)',
    opacity: 0.88,
    color: '#B91C1C',
    extraClass: 'text-[#B91C1C]',
  },
  default: {
    tint: 'rgb(255 255 255)',
    opacity: 0.82,
    color: '#111827',
    extraClass: 'text-[#111827]',
  },
};

const SIZE_STYLES: Record<BubbleSize, React.CSSProperties> = {
  xs: { minHeight: 26, padding: '0 9px', fontSize: 11 },
  sm: { minHeight: 30, padding: '0 12px', fontSize: 12 },
  md: { minHeight: 36, padding: '0 14px', fontSize: 12 },
  lg: { minHeight: 40, padding: '0 18px', fontSize: 13 },
};

export const BubbleButton: React.FC<BubbleButtonProps> = ({
  variant = 'default',
  size = 'md',
  radius = 10,
  className = '',
  style,
  tint,
  opacity,
  ...props
}) => {
  const cfg = VARIANT_CONFIG[variant];
  const sizeStyle = SIZE_STYLES[size];

  return (
    <SoapBubbleButton
      radius={radius}
      tint={tint ?? cfg.tint}
      opacity={opacity ?? cfg.opacity}
      className={`whitespace-nowrap shrink-0 font-medium ${cfg.extraClass} ${className}`.trim()}
      style={{
        ...sizeStyle,
        color: cfg.color,
        ...style,
      }}
      {...props}
    />
  );
};

interface BubbleIconButtonProps extends SoapBubbleIconButtonProps {
  variant?: BubbleVariant;
  iconSize?: 'sm' | 'md';
}

export const BubbleIconButton: React.FC<BubbleIconButtonProps> = ({
  variant = 'default',
  iconSize = 'md',
  radius = 9999,
  className = '',
  style,
  tint,
  opacity,
  ...props
}) => {
  const cfg = VARIANT_CONFIG[variant];
  const dims = iconSize === 'sm' ? 28 : 34;

  return (
    <SoapBubbleIconButton
      radius={radius}
      tint={tint ?? cfg.tint}
      opacity={opacity ?? cfg.opacity}
      className={`shrink-0 ${cfg.extraClass} ${className}`.trim()}
      style={{
        width: dims,
        height: dims,
        minHeight: dims,
        padding: 0,
        fontSize: 13,
        color: cfg.color,
        ...style,
      }}
      {...props}
    />
  );
};
