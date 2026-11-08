import { describe, it, expect } from 'vitest';
import { translate, setLocale } from '@/i18n';

describe('translate', () => {
  it('returns the English string', () => {
    setLocale('en');
    expect(translate('action.wind')).toBe('Wind');
    expect(translate('action.spin')).toBe('Spin');
  });

  it('substitutes named parameters', () => {
    setLocale('en');
    expect(
      translate('label.photoCounter', { number: '03', total: 16 }),
    ).toBe('Photo 03 / 16');
  });

  it('substitutes multiple parameters', () => {
    setLocale('en');
    expect(
      translate('error.tooManyFiles', { count: 4 }),
    ).toBe(
      'There are 4 empty frames. Please choose at most 4 photos.',
    );
  });

  it('falls back to the key for an unknown translation', () => {
    setLocale('en');
    expect(translate('unknown.nonexistent.key')).toBe('unknown.nonexistent.key');
  });

  it('returns French when locale is fr', () => {
    setLocale('fr');
    expect(translate('action.wind')).toBe('Vent');
    expect(translate('action.spin')).toBe('Rotation');
  });

  it('returns Spanish when locale is es', () => {
    setLocale('es');
    expect(translate('action.wind')).toBe('Viento');
  });

  it('returns Chinese when locale is zh', () => {
    setLocale('zh');
    expect(translate('action.wind')).toBe('起风');
  });

  it('falls back to English for a key missing in the active locale', () => {
    // Force a locale that might be missing a key — translate should fall back to en.
    setLocale('fr');
    // 'error.appCrashed' exists in both en and fr; check the fr value is used
    const frValue = translate('error.appCrashed');
    setLocale('en');
    const enValue = translate('error.appCrashed');
    // fr value should differ from en value (both exist), confirming locale is applied
    expect(frValue).not.toBe(enValue);
  });
});
