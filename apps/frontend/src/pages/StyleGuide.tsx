import { useState, type ReactNode } from 'react';
import { Mail, Plus, Trash2, Pencil, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { Select } from '@/components/ui/Select';
import { Checkbox } from '@/components/ui/Checkbox';
import { Tag } from '@/components/ui/Tag';
import { TypeIndicator } from '@/components/ui/TypeIndicator';
import { CategoryBadge } from '@/components/ui/CategoryBadge';
import { IconPicker } from '@/components/ui/IconPicker';
import { ColorPicker } from '@/components/ui/ColorPicker';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { Dialog } from '@/components/ui/Dialog';
import { Pagination } from '@/components/ui/Pagination';
import { useToast } from '@/components/ui/useToast';
import { PageShell } from '@/components/layout/PageShell';
import { cn } from '@/lib/cn';
import {
  CATEGORY_COLORS,
  CATEGORY_COLOR_LABELS,
  CATEGORY_COLOR_VALUES,
  CATEGORY_ICON_LABELS,
  CATEGORY_ICON_VALUES,
  type CategoryColor,
  type CategoryIcon,
} from '@/lib/category-tokens';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="mb-6 p-6">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
        {title}
      </h2>
      <div className="flex flex-wrap items-end gap-4">{children}</div>
    </Card>
  );
}

export function StyleGuide() {
  const { showToast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [guideIcon, setGuideIcon] = useState<CategoryIcon>('WALLET');
  const [guideColor, setGuideColor] = useState<CategoryColor>('GREEN');
  const [guideType, setGuideType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');

  return (
    <PageShell
      title="Style Guide"
      subtitle="Todos os primitivos, em todos os estados"
    >
      <Section title="Button">
        <Button>Primário</Button>
        <Button icon={Plus}>Com ícone</Button>
        <Button disabled>Desabilitado</Button>
        <Button loading>Carregando</Button>
        <Button variant="secondary">Secundário</Button>
        <Button variant="secondary" disabled>
          Secundário desabilitado
        </Button>
        <Button size="sm">Pequeno</Button>
        <Button size="sm" variant="secondary">
          Pequeno secundário
        </Button>
      </Section>

      <Section title="Icon Button">
        <IconButton icon={Pencil} label="Editar" />
        <IconButton icon={Trash2} label="Excluir" variant="danger" />
        <IconButton icon={Pencil} label="Editar desabilitado" disabled />
      </Section>

      <Section title="Input">
        <div className="w-64">
          <Input
            label="E-mail"
            placeholder="mail@exemplo.com"
            icon={Mail}
            helperText="Helper"
          />
        </div>
        <div className="w-64">
          <Input
            label="E-mail"
            defaultValue="preenchido@exemplo.com"
            icon={Mail}
          />
        </div>
        <div className="w-64">
          <Input
            label="E-mail"
            defaultValue="errado"
            icon={Mail}
            error="E-mail inválido"
          />
        </div>
        <div className="w-64">
          <Input label="E-mail" defaultValue="bloqueado" icon={Mail} disabled />
        </div>
        <div className="w-64">
          <PasswordInput label="Senha" helperText="Mínimo 8 caracteres" />
        </div>
        <div className="w-64">
          <Select
            label="Tipo"
            placeholder="Selecione"
            options={[
              { value: 'INCOME', label: 'Entrada' },
              { value: 'EXPENSE', label: 'Saída' },
            ]}
          />
        </div>
      </Section>

      <Section title="Checkbox">
        <Checkbox label="Lembrar-me" />
        <Checkbox label="Marcado" defaultChecked />
        <Checkbox label="Desabilitado" disabled />
      </Section>

      <Section title="Tag">
        {CATEGORY_COLOR_VALUES.map((color) => (
          <Tag key={color} color={color}>
            {color}
          </Tag>
        ))}
        <Tag>Sem categoria</Tag>
      </Section>

      <Section title="Category Badge">
        {CATEGORY_ICON_VALUES.map((icon, index) => (
          <CategoryBadge
            key={icon}
            icon={icon}
            color={CATEGORY_COLOR_VALUES[index % CATEGORY_COLOR_VALUES.length]}
          />
        ))}
        <CategoryBadge />
      </Section>

      <Section title="Category Icons">
        <ul
          aria-label="Ícones de categoria"
          className="grid w-full grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8"
        >
          {CATEGORY_ICON_VALUES.map((token) => (
            <li
              key={token}
              className="flex flex-col items-center gap-1.5 text-center"
            >
              <CategoryBadge icon={token} color="GREEN" />
              <code className="text-[11px] text-gray-700">{token}</code>
              <span className="text-[11px] text-gray-500">
                {CATEGORY_ICON_LABELS[token]}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Category Colors">
        <ul
          aria-label="Cores de categoria"
          className="grid w-full grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7"
        >
          {CATEGORY_COLOR_VALUES.map((token) => (
            <li
              key={token}
              className="flex flex-col items-center gap-1.5 text-center"
            >
              <span className="flex gap-1">
                {/* dark, base and light, in the order frontend.md section 3
                    lists them, so the whole family is comparable at once. */}
                <span
                  className={cn(
                    'size-5 rounded-full',
                    CATEGORY_COLORS[token].dark,
                  )}
                />
                <span
                  className={cn(
                    'size-5 rounded-full',
                    CATEGORY_COLORS[token].swatch,
                  )}
                />
                <span
                  className={cn(
                    'size-5 rounded-full',
                    CATEGORY_COLORS[token].bg,
                  )}
                />
              </span>
              <code className="text-[11px] text-gray-700">{token}</code>
              <span className="text-[11px] text-gray-500">
                {CATEGORY_COLOR_LABELS[token]}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Pickers">
        <IconPicker
          legend="Ícone"
          name="style-guide-icon"
          value={guideIcon}
          onChange={setGuideIcon}
        />

        <ColorPicker
          legend="Cor"
          name="style-guide-color"
          value={guideColor}
          onChange={setGuideColor}
        />

        <SegmentedControl
          legend="Tipo"
          name="style-guide-type"
          value={guideType}
          options={[
            { value: 'EXPENSE', label: 'Despesa', tone: 'danger' },
            { value: 'INCOME', label: 'Receita', tone: 'success' },
          ]}
          onChange={setGuideType}
        />
      </Section>

      <Section title="Type Indicator">
        <TypeIndicator type="INCOME" />
        <TypeIndicator type="EXPENSE" />
      </Section>

      <Section title="Avatar">
        <Avatar name="Conta teste" />
        <Avatar name="Conta teste" size="lg" />
      </Section>

      <Section title="Stat Card">
        <div className="w-64">
          <StatCard icon={Wallet} label="Saldo total" value="R$ 12.847,32" />
        </div>
      </Section>

      <Section title="Pagination">
        <Pagination page={page} pageCount={3} onPageChange={setPage} />
      </Section>

      <Section title="Dialog">
        <Button onClick={() => setDialogOpen(true)}>Abrir diálogo</Button>
        <Dialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          title="Nova transação"
          subtitle="Registre sua despesa ou receita"
        >
          <div className="flex flex-col gap-4">
            <Input label="Descrição" placeholder="Ex. Almoço no restaurante" />
            <Button className="w-full">Salvar</Button>
          </div>
        </Dialog>
      </Section>

      <Section title="Toast">
        <Button onClick={() => showToast('Categoria criada com sucesso')}>
          Sucesso
        </Button>
        <Button
          variant="secondary"
          onClick={() => showToast('Não foi possível salvar', 'error')}
        >
          Erro
        </Button>
      </Section>
    </PageShell>
  );
}
