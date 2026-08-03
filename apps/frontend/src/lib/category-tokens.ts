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
  { bg: string; text: string; icon: string; swatch: string; dark: string }
> = {
  GREEN: {
    bg: 'bg-green-light',
    text: 'text-green-dark',
    icon: 'text-green-base',
    swatch: 'bg-green-base',
    dark: 'bg-green-dark',
  },
  BLUE: {
    bg: 'bg-blue-light',
    text: 'text-blue-dark',
    icon: 'text-blue-base',
    swatch: 'bg-blue-base',
    dark: 'bg-blue-dark',
  },
  PURPLE: {
    bg: 'bg-purple-light',
    text: 'text-purple-dark',
    icon: 'text-purple-base',
    swatch: 'bg-purple-base',
    dark: 'bg-purple-dark',
  },
  PINK: {
    bg: 'bg-pink-light',
    text: 'text-pink-dark',
    icon: 'text-pink-base',
    swatch: 'bg-pink-base',
    dark: 'bg-pink-dark',
  },
  RED: {
    bg: 'bg-red-light',
    text: 'text-red-dark',
    icon: 'text-red-base',
    swatch: 'bg-red-base',
    dark: 'bg-red-dark',
  },
  ORANGE: {
    bg: 'bg-orange-light',
    text: 'text-orange-dark',
    icon: 'text-orange-base',
    swatch: 'bg-orange-base',
    dark: 'bg-orange-dark',
  },
  YELLOW: {
    bg: 'bg-yellow-light',
    text: 'text-yellow-dark',
    icon: 'text-yellow-base',
    swatch: 'bg-yellow-base',
    dark: 'bg-yellow-dark',
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

/**
 * The Portuguese name of each token. Two jobs: it is the accessible name of
 * the option in the category dialog's icon picker, and it is what makes the
 * Style Guide gallery checkable against the design — a glyph with no name
 * beside it cannot be confirmed or rejected.
 */
export const CATEGORY_ICON_LABELS: Record<CategoryIcon, string> = {
  BRIEFCASE: 'Maleta',
  BUS: 'Ônibus',
  HEART_PULSE: 'Saúde',
  PIGGY_BANK: 'Cofrinho',
  SHOPPING_CART: 'Carrinho de compras',
  TICKET: 'Ingresso',
  GIFT: 'Presente',
  UTENSILS: 'Restaurante',
  BIKE: 'Bicicleta',
  HOME: 'Casa',
  HAND_COINS: 'Moedas',
  BOOK_OPEN: 'Livro',
  STORE: 'Loja',
  WALLET: 'Carteira',
  CREDIT_CARD: 'Cartão de crédito',
  RECEIPT: 'Recibo',
};

export const CATEGORY_COLOR_LABELS: Record<CategoryColor, string> = {
  GREEN: 'Verde',
  BLUE: 'Azul',
  PURPLE: 'Roxo',
  PINK: 'Rosa',
  RED: 'Vermelho',
  ORANGE: 'Laranja',
  YELLOW: 'Amarelo',
};
