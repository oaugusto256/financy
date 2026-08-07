import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export interface PanelErrorProps {
  message: string;
  onRetry: () => void;
}

/**
 * The error state, scoped to the panel that failed rather than replacing the
 * page. `frontend.md` section 10.
 *
 * role="alert" because the panel it replaces was already on screen: without it
 * the content changes and nothing is announced.
 */
export function PanelError({ message, onRetry }: PanelErrorProps) {
  return (
    <Card
      role="alert"
      className="flex flex-col items-center gap-3 p-8 text-center"
    >
      <p className="text-sm text-gray-600">{message}</p>
      <Button variant="secondary" size="sm" onClick={onRetry}>
        Tentar novamente
      </Button>
    </Card>
  );
}
