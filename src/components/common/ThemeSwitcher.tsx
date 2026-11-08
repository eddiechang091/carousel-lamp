import { Palette } from 'lucide-react';
import { THEME_IDS, type ThemeMode } from '@/lib/themes';
import { useI18n } from '@/i18n';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type Props = {
  value: ThemeMode;
  onChange: (mode: ThemeMode) => void;
};

const MODES: ThemeMode[] = ['auto', ...THEME_IDS];

export default function ThemeSwitcher({ value, onChange }: Props) {
  const { t } = useI18n();
  return (
    <div className="theme-switcher">
      <DropdownMenu>
        <DropdownMenuTrigger aria-label={t('a11y.themePicker')}>
          <Palette className="theme-icon" aria-hidden="true" />
          {t(`theme.${value}`)}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuRadioGroup
            value={value}
            onValueChange={(v) => onChange(v as ThemeMode)}
          >
            {MODES.map((mode) => (
              <DropdownMenuRadioItem key={mode} value={mode}>
                {t(`theme.${mode}`)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
