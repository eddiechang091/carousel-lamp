import { Languages } from 'lucide-react';
import { SUPPORTED_LOCALES, type Locale, useI18n } from '@/i18n';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  return (
    <div className="lang-switcher">
      <DropdownMenu>
        <DropdownMenuTrigger aria-label={t('lang.label')}>
          <Languages className="lang-icon" aria-hidden="true" />
          {t(`lang.${locale}`)}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuRadioGroup
            value={locale}
            onValueChange={(v) => setLocale(v as Locale)}
          >
            {SUPPORTED_LOCALES.map((loc) => (
              <DropdownMenuRadioItem key={loc} value={loc}>
                {t(`lang.${loc}`)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
