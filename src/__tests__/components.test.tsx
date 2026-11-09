import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { I18nProvider, setLocale } from '@/i18n';
import LanguageSwitcher from '@/components/common/LanguageSwitcher';
import ThemeSwitcher from '@/components/common/ThemeSwitcher';
import { AppWrapper } from '@/components/common/PageMeta';

vi.mock('@/lib/carousel-scene', () => ({
  createCarousel: vi.fn(() => ({
    ready: Promise.resolve(),
    focus: vi.fn(), reset: vi.fn(), wind: vi.fn(),
    rotate: vi.fn(), light: vi.fn(), selectMode: vi.fn(),
    setPhoto: vi.fn().mockResolvedValue(undefined),
    setCaption: vi.fn().mockResolvedValue(undefined),
    swapPhotos: vi.fn(), setTheme: vi.fn(), dispose: vi.fn(),
  })),
}));

vi.mock('@/lib/sounds', () => ({
  ChimeAudio: vi.fn().mockImplementation(() => ({ play: vi.fn() })),
}));

vi.mock('@/lib/music-box', () => ({
  MusicBoxAudio: vi.fn().mockImplementation(() => ({
    start: vi.fn(), stop: vi.fn(), setVolume: vi.fn(),
  })),
}));

vi.mock('@/lib/photo-storage', () => ({
  readSavedPhotos: vi.fn().mockResolvedValue([]),
  savePhotosLocally: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/heic', () => ({
  isHeicFile: vi.fn().mockReturnValue(false),
  convertHeic: vi.fn(),
}));

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <AppWrapper>
    <I18nProvider>
      <BrowserRouter>{children}</BrowserRouter>
    </I18nProvider>
  </AppWrapper>
);

describe('LanguageSwitcher', () => {
  beforeEach(() => setLocale('en'));

  it('renders the current locale label', () => {
    render(<LanguageSwitcher />, { wrapper: Wrapper });
    expect(screen.getByRole('button')).toHaveTextContent('English');
  });

  it('opens the locale menu and shows all four locales', async () => {
    const user = userEvent.setup();
    render(<LanguageSwitcher />, { wrapper: Wrapper });
    await user.click(screen.getByRole('button'));
    await waitFor(() => {
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });
    expect(screen.getByText('Français')).toBeInTheDocument();
    expect(screen.getByText('Español')).toBeInTheDocument();
    expect(screen.getByText('中文')).toBeInTheDocument();
  });
});

describe('ThemeSwitcher', () => {
  it('renders the supplied theme label', () => {
    render(<ThemeSwitcher value="auto" onChange={vi.fn()} />, { wrapper: Wrapper });
    expect(screen.getByRole('button')).toHaveTextContent('Auto');
  });

  it('reflects a specific theme value', () => {
    render(<ThemeSwitcher value="halloween" onChange={vi.fn()} />, { wrapper: Wrapper });
    expect(screen.getByRole('button')).toHaveTextContent('Halloween');
  });

  it('opens the theme menu and shows all options', async () => {
    const user = userEvent.setup();
    render(<ThemeSwitcher value="auto" onChange={vi.fn()} />, { wrapper: Wrapper });
    await user.click(screen.getByRole('button'));
    await waitFor(() => {
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });
    expect(screen.getByText('Classic')).toBeInTheDocument();
    expect(screen.getByText('Halloween')).toBeInTheDocument();
    expect(screen.getByText('Christmas')).toBeInTheDocument();
    expect(screen.getByText('Spring Festival')).toBeInTheDocument();
  });

  it('calls onChange when a theme option is selected', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ThemeSwitcher value="auto" onChange={onChange} />, { wrapper: Wrapper });
    await user.click(screen.getByRole('button'));
    await waitFor(() => screen.getByText('Halloween'));
    await user.click(screen.getByText('Halloween'));
    expect(onChange).toHaveBeenCalledWith('halloween');
  });
});

