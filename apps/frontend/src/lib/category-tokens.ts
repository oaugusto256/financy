import {
  BookOpen,
  Bike,
  Briefcase,
  Bus,
  CreditCard,
  Gift,
  HandCoins,
  HeartPulse,
  House,
  PiggyBank,
  Receipt,
  ShoppingCart,
  Store,
  Ticket,
  Utensils,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

export type CategoryColor =
  'GREEN' | 'BLUE' | 'PURPLE' | 'PINK' | 'RED' | 'ORANGE' | 'YELLOW';

export type CategoryIcon =
  | 'BRIEFCASE'
  | 'BUS'
  | 'HEART_PULSE'
  | 'PIGGY_BANK'
  | 'SHOPPING_CART'
  | 'TICKET'
  | 'GIFT'
  | 'UTENSILS'
  | 'BIKE'
  | 'HOME'
  | 'HAND_COINS'
  | 'BOOK_OPEN'
  | 'STORE'
  | 'WALLET'
  | 'CREDIT_CARD'
  | 'RECEIPT';

/**
 * Tag background and text, plus the icon color for a category badge.
 *
 * Class names are spelled out rather than built by interpolation. Tailwind
 * scans source text for whole class names, so `bg-${color}-light` compiles to
 * nothing at all.
 */
export const CATEGORY_COLORS: Record<
  CategoryColor,
  { bg: string; text: string; icon: string }
> = {
  GREEN: {
    bg: 'bg-green-light',
    text: 'text-green-dark',
    icon: 'text-green-base',
  },
  BLUE: { bg: 'bg-blue-light', text: 'text-blue-dark', icon: 'text-blue-base' },
  PURPLE: {
    bg: 'bg-purple-light',
    text: 'text-purple-dark',
    icon: 'text-purple-base',
  },
  PINK: { bg: 'bg-pink-light', text: 'text-pink-dark', icon: 'text-pink-base' },
  RED: { bg: 'bg-red-light', text: 'text-red-dark', icon: 'text-red-base' },
  ORANGE: {
    bg: 'bg-orange-light',
    text: 'text-orange-dark',
    icon: 'text-orange-base',
  },
  YELLOW: {
    bg: 'bg-yellow-light',
    text: 'text-yellow-dark',
    icon: 'text-yellow-base',
  },
};

export const CATEGORY_ICONS: Record<CategoryIcon, LucideIcon> = {
  BRIEFCASE: Briefcase,
  BUS: Bus,
  HEART_PULSE: HeartPulse,
  PIGGY_BANK: PiggyBank,
  SHOPPING_CART: ShoppingCart,
  TICKET: Ticket,
  GIFT: Gift,
  UTENSILS: Utensils,
  BIKE: Bike,
  HOME: House,
  HAND_COINS: HandCoins,
  BOOK_OPEN: BookOpen,
  STORE: Store,
  WALLET: Wallet,
  CREDIT_CARD: CreditCard,
  RECEIPT: Receipt,
};

export const CATEGORY_COLOR_VALUES = Object.keys(
  CATEGORY_COLORS,
) as CategoryColor[];

export const CATEGORY_ICON_VALUES = Object.keys(
  CATEGORY_ICONS,
) as CategoryIcon[];
