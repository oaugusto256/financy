import { NavLink, Link } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { Avatar } from '@/components/ui/Avatar';

const SECTIONS = [
  { to: '/', label: 'Dashboard' },
  { to: '/transactions', label: 'Transações' },
  { to: '/categories', label: 'Categorias' },
] as const;

export interface TopBarProps {
  userName: string;
}

export function TopBar({ userName }: TopBarProps) {
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="text-lg font-bold text-brand-base">
          Financy
        </Link>

        <nav aria-label="Principal" className="flex items-center gap-6">
          {/* NavLink sets aria-current="page" on the active route by itself.
              The active item is marked with that, not only with green text:
              color alone conveys nothing to a screen reader and nothing to
              someone who cannot distinguish it. */}
          {SECTIONS.map((section) => (
            <NavLink
              key={section.to}
              to={section.to}
              end={section.to === '/'}
              className={({ isActive }) =>
                cn(
                  'text-sm hover:text-brand-base',
                  isActive ? 'font-semibold text-brand-base' : 'text-gray-600',
                )
              }
            >
              {section.label}
            </NavLink>
          ))}
        </nav>

        {/* The name is empty while `me` is in flight, and "Perfil de " with
            nothing after it is not a label. */}
        <Link
          to="/profile"
          aria-label={userName ? `Perfil de ${userName}` : 'Perfil'}
        >
          <Avatar name={userName} />
        </Link>
      </div>
    </header>
  );
}
