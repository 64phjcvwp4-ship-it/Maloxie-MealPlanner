import React from 'react';
import {
  SoapBubbleButton,
  SoapBubbleIconButton,
  type SoapBubbleButtonProps,
  type SoapBubbleIconButtonProps,
} from '../../components/soap-bubble';

export type BubbleVariant = 'default' | 'primary' | 'dark' | 'sage' | 'terracotta' | 'danger';
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
    tint: 'rgb(217 208 203)',
    opacity: 0.94,
    color: '#25241E',
    extraClass: 'text-[#25241E]',
  },
  dark: {
    tint: 'rgb(144 139 111)',
    opacity: 0.92,
    color: '#FAF8F6',
    extraClass: 'text-[#FAF8F6]',
  },
  sage: {
    tint: 'rgb(106 103 84)',
    opacity: 0.92,
    color: '#FAF8F6',
    extraClass: 'text-[#FAF8F6]',
  },
  terracotta: {
    tint: 'rgb(184 107 75)',
    opacity: 0.92,
    color: '#FAF8F6',
    extraClass: 'text-[#FAF8F6]',
  },
  danger: {
    tint: 'rgb(140 48 40)',
    opacity: 0.85,
    color: '#FEE2E2',
    extraClass: 'text-[#FEE2E2]',
  },
  default: {
    tint: 'rgb(48 46 39)',
    opacity: 0.76,
    color: '#E8E2DC',
    extraClass: 'text-[#E8E2DC]',
  },
};

const SIZE_STYLES: Record<BubbleSize, React.CSSProperties> = {
  xs: { minHeight: 26, padding: '0 12px', fontSize: 11 },
  sm: { minHeight: 30, padding: '0 14px', fontSize: 12 },
  md: { minHeight: 36, padding: '0 18px', fontSize: 12 },
  lg: { minHeight: 40, padding: '0 22px', fontSize: 13 },
};

export const BubbleButton: React.FC<BubbleButtonProps> = ({
  variant = 'default',
  size = 'md',
  radius = 9999,
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
