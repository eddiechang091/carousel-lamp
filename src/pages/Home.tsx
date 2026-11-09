import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  Plus,
  Wind,
  Sun,
  Moon,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  CirclePlay,
  Pause,
  Sparkles,
  ImagePlus,
  Crop as CropIcon,
  Trash2,
  X,
  Check,
  Music4,
  VolumeX,
  Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { createCarousel, type CarouselAPI } from '@/lib/carousel-scene';
import {
  PHOTO_COUNT,
  initialCrop,
  loadPhoto,
  drawCrop,
  renderPolaroidExport,
  type Crop,
} from '@/lib/photos';
import { ChimeAudio } from '@/lib/sounds';
import { MusicBoxAudio } from '@/lib/music-box';
import { readSavedPhotos, savePhotosLocally, type SavedPhoto } from '@/lib/photo-storage';
import { convertHeic, isHeicFile } from '@/lib/heic';
import { readSavedView, readMusicPref, saveMusicPref, readThemePref, saveThemePref } from '@/lib/view-storage';
import { THEMES, THEME_IDS, resolveTheme, type ThemeId, type ThemeMode } from '@/lib/themes';
import { useI18n } from '@/i18n';
import { getLlmService, LlmUnavailableError, LlmVisionNotCapableError } from '@/services/anna/llm';
import { generateAiCaption } from '@/services/anna/caption';
import LanguageSwitcher from '@/components/common/LanguageSwitcher';
import ThemeSwitcher from '@/components/common/ThemeSwitcher';

type Memory = {
  source: string;
  preview: string;
  crop: Crop;
  custom: boolean;
  empty: boolean;
  caption: string;
};
type Draft = { source: string; image: HTMLImageElement; crop: Crop };

export default function Home() {
  const { t, locale } = useI18n();
  const musicOnRef = useRef(readMusicPref());
  const [musicOn, setMusicOn] = useState(musicOnRef.current);
  const conversion = useRef<AbortController | null>(null);
  const [processingHeic, setProcessingHeic] = useState(false);
  const batchInput = useRef<HTMLInputElement>(null);
  const batchLock = useRef(false);
  const [uploadMenu, setUploadMenu] = useState(false);
  const [batchProgress, setBatchProgress] = useState('');
  const [batchError, setBatchError] = useState('');
  const swapHandler = useRef<(from: number, to: number) => Promise<void>>(async () => {});
  const exchanging = useRef(false);
  const pendingSave = useRef(false);
  const [photoSave, setPhotoSave] = useState<'saved' | 'saving' | 'error'>('saved');
  const [viewSaved, setViewSaved] = useState(true);
  const host = useRef<HTMLDivElement>(null),
    api = useRef<CarouselAPI | null>(null),
    audio = useRef<ChimeAudio | null>(null),
    music = useRef<MusicBoxAudio | null>(null),
    fileInput = useRef<HTMLInputElement>(null),
    preview = useRef<HTMLCanvasElement>(null),
    urls = useRef(new Set<string>()),
    fileRequest = useRef(0);
  const [night, setNight] = useState(false),
    [selected, setSelected] = useState(-1),
    [spinning, setSpinning] = useState(false),
    [ready, setReady] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [choosing, setChoosing] = useState(false),
    [editor, setEditor] = useState(false),
    [draft, setDraft] = useState<Draft | null>(null),
    [busy, setBusy] = useState(false),
    [editorError, setEditorError] = useState('');
  const [memories, setMemories] = useState<Memory[]>(() =>
    Array.from({ length: PHOTO_COUNT }, () => ({
      source: '',
      preview: '',
      crop: { ...initialCrop },
      custom: false,
      empty: true,
      caption: '',
    })),
  );
  const [captionDraft, setCaptionDraft] = useState('');
  const [captionBusy, setCaptionBusy] = useState(false);
  const [llmAvailable, setLlmAvailable] = useState(false);
  useEffect(() => {
    let mounted = true;
    getLlmService()
      .then((llm) => {
        if (mounted) setLlmAvailable(llm.available);
      })
      .catch(() => {
        if (mounted) setLlmAvailable(false);
      });
    return () => {
      mounted = false;
    };
  }, []);
  const memoriesRef = useRef(memories);
  useEffect(() => { memoriesRef.current = memories; }, [memories]);
  useEffect(() => {
    if (selected >= 0) setCaptionDraft(memoriesRef.current[selected]?.caption ?? '');
  }, [selected]);
  const play = (kind: Parameters<ChimeAudio['play']>[0]) =>
    audio.current?.play(kind);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const saved = readThemePref();
    return saved === 'auto' || (THEME_IDS as string[]).includes(saved)
      ? (saved as ThemeMode)
      : 'auto';
  });
  const [themeId, setThemeId] = useState<ThemeId>(() => resolveTheme(themeMode));
  const themeFirstApplied = useRef(false);
  useEffect(() => {
    saveThemePref(themeMode);
    const resolved = resolveTheme(themeMode);
    setThemeId(resolved);
    if (themeFirstApplied.current) api.current?.setTheme(resolved);
    // Auto mode: re-check the date window hourly so holiday borders flip live.
    if (themeMode !== 'auto') return;
    const timer = setInterval(() => {
      const next = resolveTheme('auto');
      setThemeId((cur) => {
        if (cur !== next) api.current?.setTheme(next);
        return next;
      });
    }, 3600e3);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeMode]);

  function toggleMusic() {
    const next = !musicOn;
    musicOnRef.current = next;
    setMusicOn(next);
    saveMusicPref(next);
    if (next) music.current?.start();
    else music.current?.stop();
  }
  useEffect(() => {
    if (!host.current) return;
    audio.current = new ChimeAudio();
    const savedView = readSavedView();
    if (savedView) { setNight(savedView.night); setSpinning(savedView.spinning); }
    let mounted = true;
    try {
      api.current = createCarousel(
        host.current,
        (index) => {
          setSelected(index);
          if (index >= 0) setChoosing(false);
        },
        setNotice,
        (from, to) => swapHandler.current(from, to),
        setViewSaved,
      );
      const carousel = api.current;
      carousel.setTheme(resolveTheme(themeMode));
      themeFirstApplied.current = true;
      carousel.ready.then(async () => {
        try {
          const stored = await readSavedPhotos();
          if (!mounted) return;
          const restored = new Map<number, Memory>();
          for (const photo of stored) {
            if (!Number.isInteger(photo.slot) || photo.slot < 0 || photo.slot >= PHOTO_COUNT) continue;
            if (!photo.empty && !(photo.source instanceof Blob)) continue;
            const source = photo.source ? URL.createObjectURL(photo.source) : '';
            if (source) urls.current.add(source);
            restored.set(photo.slot, { source, preview: photo.preview, crop: photo.crop,
              custom: !photo.empty, empty: photo.empty, caption: photo.caption ?? '' });
          }
          await Promise.all([...restored].map(async ([slot, photo]) => {
            await carousel.setPhoto(slot, photo.empty ? null : photo.preview);
            if (photo.caption) await carousel.setCaption(slot, photo.caption);
          }));
          if (mounted) setMemories(list => list.map((photo, slot) => restored.get(slot) ?? photo));
        } catch (err) {
          if (mounted) { setNotice((err as Error).message); setPhotoSave('error'); }
        }
        if (mounted) setReady(true);
      }).catch(() => {
        if (mounted) setError(t('error.sceneLoadFailed'));
      });
    } catch {
      queueMicrotask(() => {
        if (mounted)
          setError(t('error.webglUnsupported'));
      });
    }
    const held = urls.current;
    return () => {
      mounted = false;
      conversion.current?.abort();
      api.current?.dispose();
      api.current = null;
      audio.current?.dispose();
      held.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);
  useEffect(() => {
    const instance = new MusicBoxAudio();
    music.current = instance;
    const begin = () => {
      if (musicOnRef.current) instance.start();
      window.removeEventListener('pointerdown', begin);
      window.removeEventListener('keydown', begin);
    };
    if (musicOnRef.current) {
      instance.start();
      window.addEventListener('pointerdown', begin);
      window.addEventListener('keydown', begin);
    }
    return () => {
      window.removeEventListener('pointerdown', begin);
      window.removeEventListener('keydown', begin);
      instance.dispose();
      music.current = null;
    };
  }, []);
  useEffect(() => {
    api.current?.selectMode(choosing);
  }, [choosing]);
  useEffect(() => {
    const used = new Set(memories.map((m) => m.source));
    if (draft) used.add(draft.source);
    for (const url of urls.current) {
      if (!used.has(url)) {
        URL.revokeObjectURL(url);
        urls.current.delete(url);
      }
    }
  }, [memories, draft]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 4800);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (draft && preview.current)
      drawCrop(preview.current, draft.image, draft.crop);
  }, [draft, editor]);
  useEffect(() => {
    const protectSave = (event: BeforeUnloadEvent) => {
      if (pendingSave.current) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', protectSave);
    return () => window.removeEventListener('beforeunload', protectSave);
  }, []);
  async function commitPhotos(prepare: () => Promise<SavedPhoto[]>) {
    if (pendingSave.current) throw new Error(t('error.savingInProgress'));
    pendingSave.current = true;
    setPhotoSave('saving');
    try {
      await savePhotosLocally(await prepare());
      setPhotoSave('saved');
    } catch (error) {
      setPhotoSave('error');
      throw error;
    } finally { pendingSave.current = false; }
  }
  function choose(index: number) {
    api.current?.focus(index);
    play('select');
  }
  function closeEditor() {
    fileRequest.current++;
    conversion.current?.abort();
    setProcessingHeic(false);
    setEditor(false);
    setDraft(null);
    setEditorError('');
    setBusy(false);
  }
  async function openEditor() {
    if (selected < 0) return;
    setEditorError('');
    setDraft(null);
    setEditor(true);
    const memory = memories[selected];
    if (memory.empty) return;
    const token = ++fileRequest.current;
    setBusy(true);
    try {
      const image = await loadPhoto(memory.source);
      if (token === fileRequest.current)
        setDraft({ source: memory.source, image, crop: { ...memory.crop } });
    } catch (err) {
      if (token === fileRequest.current) setEditorError((err as Error).message);
    } finally {
      if (token === fileRequest.current) setBusy(false);
    }
  }
  async function readFile(file?: File) {
    if (!file) return;
    setEditorError('');
    const heic = isHeicFile(file);
    const supportedType = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type.toLowerCase());
    const supportedName = /\.(jpe?g|png|webp)$/i.test(file.name);
    if (!heic && !supportedType && !supportedName) {
      setEditorError(t('error.unsupportedFormat'));
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setEditorError(t('error.fileTooLarge'));
      return;
    }
    conversion.current?.abort();
    const controller = new AbortController();
    conversion.current = controller;
    let source = '';
    setProcessingHeic(heic);
    const token = ++fileRequest.current;
    setBusy(true);
    try {
      const blob = heic ? await convertHeic(file, controller.signal) : file;
      if (token !== fileRequest.current) return;
      source = URL.createObjectURL(blob);
      urls.current.add(source);
      const image = await loadPhoto(source);
      if (token === fileRequest.current)
        setDraft({ source, image, crop: { ...initialCrop } });
      else { URL.revokeObjectURL(source); urls.current.delete(source); }
    } catch (err) {
      if (token === fileRequest.current) setEditorError((err as Error).message);
      URL.revokeObjectURL(source);
      urls.current.delete(source);
    } finally {
      if (token === fileRequest.current) { setBusy(false); setProcessingHeic(false); }
    }
  }
  async function uploadBatch(files: File[]) {
    if (!files.length || batchLock.current || pendingSave.current || busy || !api.current) return;
    const slots = memories.map((m, i) => m.empty ? i : -1).filter(i => i >= 0);
    setBatchError('');
    if (files.length > slots.length) {
      setBatchError(t('error.tooManyFiles', { count: slots.length }));
      return;
    }
    const invalid = files.find(file => file.size > 50 * 1024 * 1024 ||
      !(['image/jpeg', 'image/png', 'image/webp'].includes(file.type.toLowerCase()) || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name) || /^image\/hei[cf]/i.test(file.type)));
    if (invalid) { setBatchError(t('error.invalidFile', { name: `“${invalid.name}”` })); return; }
    for (let i = slots.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [slots[i], slots[j]] = [slots[j], slots[i]];
    }
    batchLock.current = true;
    setBusy(true);
    const prepared: { slot: number; memory: Memory; blob: Blob }[] = [];
    let committed = false;
    try {
      for (let i = 0; i < files.length; i++) {
        setBatchProgress(t('batch.preparing', { current: i + 1, total: files.length }));
        const file = files[i];
        const heic = /\.(heic|heif)$/i.test(file.name) || /^image\/hei[cf]/i.test(file.type);
        const blob = heic ? await convertHeic(file, new AbortController().signal) : file;
        const source = URL.createObjectURL(blob);
        try {
          const image = await loadPhoto(source);
          const canvas = document.createElement('canvas');
          drawCrop(canvas, image, initialCrop);
          prepared.push({ slot: slots[i], blob, memory: {
            source, preview: canvas.toDataURL('image/jpeg', 0.92), crop: { ...initialCrop }, custom: true, empty: false,
            caption: memories[slots[i]].caption ?? '',
          } });
        } catch (error) { URL.revokeObjectURL(source); throw error; }
      }
      setBatchProgress(t('batch.saving'));
      await commitPhotos(async () => prepared.map(({slot, memory, blob}) => ({
        slot, source: blob, preview: memory.preview, crop: memory.crop, empty: false, caption: memory.caption,
      })));
      for (const {memory} of prepared) {
        urls.current.add(memory.source);
      }
      committed = true;
      setMemories(list => list.map((memory, i) => prepared.find(p => p.slot === i)?.memory ?? memory));
      for (const {slot, memory} of prepared) {
        await api.current?.setPhoto(slot, memory.preview);
        if (memory.caption) await api.current?.setCaption(slot, memory.caption);
      }
      api.current?.reset();
      setUploadMenu(false);
      setNotice(t('notice.batchUploaded', { count: prepared.length }));
      play('hang');
    } catch (error) {
      setBatchError(committed ? t('error.savedButNotUpdated') : t('error.batchFailed', { message: (error as Error).message }));
    } finally {
      if (!committed) for (const p of prepared) URL.revokeObjectURL(p.memory.source);
      batchLock.current = false;
      setBusy(false);
      setBatchProgress('');
    }
  }
  async function save() {
    if (!draft || selected < 0 || !api.current || pendingSave.current) return;
    setBusy(true);
    setEditorError('');
    try {
      const canvas = document.createElement('canvas');
      drawCrop(canvas, draft.image, draft.crop);
      const cropped = canvas.toDataURL('image/jpeg', 0.92);
      await commitPhotos(async () => {
        const response = await fetch(draft.source);
        if (!response.ok) throw new Error(t('error.cannotReadOriginal'));
        const original = await response.blob();
        return [{ slot: selected, source: original, preview: cropped, crop: { ...draft.crop }, empty: false, caption: memories[selected].caption }];
      });
      await api.current.setPhoto(selected, cropped);
      setMemories((list) =>
        list.map((m, i) =>
          i === selected
            ? {
                source: draft.source,
                preview: cropped,
                crop: { ...draft.crop },
                custom: true,
                empty: false,
                caption: memories[selected].caption,
              }
            : m,
        ),
      );
      play('hang');
      setNotice(t('notice.photoAttached', { number: String(selected + 1).padStart(2, '0') }));
      closeEditor();
      setChoosing(false);
    } catch (err) {
      setEditorError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function exchangePhotos(from: number, to: number) {
    if (!ready || busy || pendingSave.current || exchanging.current || selected >= 0 || !api.current)
      throw new Error(t('error.exchangeBusy'));
    const carousel = api.current;
    const first = memories[from], second = memories[to];
    if (from === to || first.empty) return;
    exchanging.current = true;
    try {
      await commitPhotos(() => Promise.all([second, first].map(async (photo, i) => {
        let source: Blob | null = null;
        if (!photo.empty) {
          const response = await fetch(photo.source);
          if (!response.ok) throw new Error(t('error.photoReadFailed'));
          source = await response.blob();
        }
        return { slot: i === 0 ? from : to, source, preview: photo.preview,
          crop: { ...photo.crop }, empty: photo.empty, caption: photo.caption };
      })));
      if (api.current !== carousel) return;
      carousel.swapPhotos(from, to);
      setMemories(list => list.map((photo, i) => i === from ? second : i === to ? first : photo));
      play('hang');
      setNotice(t('notice.photosSwapped', { from: String(from + 1).padStart(2, '0'), to: String(to + 1).padStart(2, '0') }));
    } finally { exchanging.current = false; }
  }
  useEffect(() => { swapHandler.current = exchangePhotos; });
  async function remove() {
    if (selected < 0 || !api.current || pendingSave.current) return;
    try {
      await commitPhotos(async () => [{ slot: selected, source: null, preview: '', crop: { ...initialCrop }, empty: true, caption: '' }]);
      await api.current.setPhoto(selected, null);
      await api.current.setCaption(selected, '');
    } catch (err) {
      setNotice((err as Error).message);
      return;
    }
    setMemories((list) =>
      list.map((m, i) =>
        i === selected
          ? {
              source: '',
              preview: '',
              crop: { ...initialCrop },
              custom: false,
              empty: true,
              caption: '',
            }
          : m,
      ),
    );
    play('hang');
    setNotice(t('notice.photoRemoved'));
  }
  // AI caption: the model looks at the photo and drafts one poetic line
  // (<= 20 chars, current language) into the caption input. The user
  // edits it and saves with the existing Save button — nothing is
  // auto-persisted here.
  async function generateCaption() {
    if (selected < 0 || captionBusy) return;
    const memory = memoriesRef.current[selected];
    if (!memory || memory.empty || !memory.preview) {
      setNotice(t('error.emptyFrame'));
      return;
    }
    setCaptionBusy(true);
    try {
      const text = await generateAiCaption({
        imageDataUrl: memory.preview,
        locale,
        themeId,
      });
      setCaptionDraft(text);
      setNotice(t('ai.captionReady'));
      play('select');
    } catch (err) {
      if (err instanceof LlmVisionNotCapableError) {
        setNotice(t('ai.captionVisionNeeded'));
      } else if (err instanceof LlmUnavailableError) {
        setNotice(t('ai.captionUnavailable'));
      } else {
        setNotice(t('ai.captionFailed'));
      }
    } finally {
      setCaptionBusy(false);
    }
  }
  async function persistCaption(next: string) {
    if (selected < 0 || !api.current || pendingSave.current) return;
    const text = next.trim().slice(0, 40);
    if (text === memories[selected].caption) return;
    try {
      await commitPhotos(async () => {
        const current = memories[selected];
        let source: Blob | null = null;
        if (!current.empty && current.source) {
          const response = await fetch(current.source);
          if (!response.ok) throw new Error(t('error.photoReadFailed'));
          source = await response.blob();
        }
        return [{ slot: selected, source, preview: current.preview, crop: { ...current.crop }, empty: current.empty, caption: text }];
      });
      await api.current.setCaption(selected, text);
      setCaptionDraft(text);
      setMemories(list => list.map((m, i) => i === selected ? { ...m, caption: text } : m));
      play('select');
    } catch (err) {
      setNotice((err as Error).message);
    }
  }
  async function exportPolaroid() {
    if (selected < 0) return;
    const memory = memories[selected];
    if (memory.empty && !memory.caption.trim()) {
      setNotice(t('error.emptyFrame'));
      return;
    }
    try {
      let image: HTMLImageElement | undefined;
      if (!memory.empty && memory.source) image = await loadPhoto(memory.source);
      const dataUrl = await renderPolaroidExport({
        image,
        crop: memory.crop,
        index: selected,
        caption: memory.caption,
      });
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `carousel-lamp-${String(selected + 1).padStart(2, '0')}.png`;
      link.click();
      setNotice(t('notice.exported'));
      play('select');
    } catch (err) {
      setNotice((err as Error).message);
    }
  }
  return (
    <main
      className={`workshop ${night ? 'night' : ''} ${selected >= 0 ? 'focused' : ''}`}
      style={{
        '--tpl-day-bg': THEMES[themeId].bgDay,
        '--tpl-night-bg': THEMES[themeId].bgNight,
      } as CSSProperties}
    >
      <div className="controls-row">
        <ThemeSwitcher value={themeMode} onChange={setThemeMode} />
        <LanguageSwitcher />
      </div>
      <h1 className="ribbon-title" aria-label="Carousel Lamp">
        <img src="/carousel-lamp-title-clean.png" alt="" width={900} height={780} draggable={false} />
        <span className="title-sparkles" aria-hidden="true">
          <i /><i /><i /><i /><i /><i /><i /><i />
        </span>
      </h1>
      <div
        ref={host}
        className="scene"
        aria-label={t('a11y.scene')}
      />
      {!ready && (
        <output className="loading">
          {error || t('loading.starting')}
        </output>
      )}
      {selected >= 0 && (
        <div className="focus-bar">
          <Button
            variant="ghost"
            aria-label={t('a11y.previous')}
            onClick={() => choose((selected + PHOTO_COUNT - 1) % PHOTO_COUNT)}
          >
            <ChevronLeft />
          </Button>
          <span>
            {t('label.photoCounter', { number: String(selected + 1).padStart(2, '0'), total: PHOTO_COUNT })}
          </span>
          <Button
            variant="ghost"
            aria-label={t('a11y.next')}
            onClick={() => choose((selected + 1) % PHOTO_COUNT)}
          >
            <ChevronRight />
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              api.current?.reset();
              play('select');
            }}
          >
            <ArrowLeft />
            {t('action.wholeLamp')}
          </Button>
        </div>
      )}
      {selected >= 0 && !choosing && (
        <div className="photo-actions">
          <div className="caption-editor">
            <input
              type="text"
              value={captionDraft}
              maxLength={40}
              placeholder={t('label.captionPlaceholder')}
              aria-label={t('a11y.captionInput')}
              onChange={(e) => setCaptionDraft(e.target.value.slice(0, 40))}
            />
            <span className="caption-count">{captionDraft.length}/40</span>
            <Button
              size="sm"
              className="caption-save"
              aria-label={t('a11y.saveCaption')}
              disabled={captionDraft.trim() === memories[selected].caption}
              onClick={() => void persistCaption(captionDraft)}
            >
              <Check />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="caption-clear"
              aria-label={t('a11y.clearCaption')}
              disabled={!memories[selected].caption}
              onClick={() => void persistCaption('')}
            >
              <X />
            </Button>
            {llmAvailable && (
              <Button
                size="sm"
                variant="ghost"
                className="caption-ai"
                aria-label={t('a11y.aiCaption')}
                disabled={captionBusy || memories[selected].empty}
                onClick={() => void generateCaption()}
              >
                <Sparkles />
                {captionBusy ? t('ai.captionGenerating') : t('action.aiCaption')}
              </Button>
            )}
          </div>
          <div className="photo-action-row">
            <Button onClick={() => void openEditor()}>
              <CropIcon />
              {memories[selected].empty ? t('action.addPhoto') : t('action.replaceAdjust')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => void exportPolaroid()}
            >
              <Download />
              {t('action.export')}
            </Button>
            <Button
              variant="ghost"
              disabled={memories[selected].empty}
              onClick={() => void remove()}
            >
              <Trash2 />
              {t('action.removePhoto')}
            </Button>
          </div>
        </div>
      )}
      <footer className="bottom">
        <div className="toolbar">
          <Button
            disabled={!ready || busy}
            className="upload"
            onClick={() => {
              setChoosing(false);
              setBatchError('');
              setUploadMenu(true);
              play('select');
            }}
          >
            <Plus />
            {t('action.hangPhoto')}
          </Button>
          <Button
            disabled={!ready}
            className="wind"
            onClick={() => {
              api.current?.wind();
              play('wind');
            }}
          >
            <Wind />
            {t('action.wind')}
          </Button>
          <Button
            disabled={!ready}
            className="spin"
            aria-pressed={spinning}
            onClick={() => {
              api.current?.rotate(!spinning);
              setSpinning(!spinning);
              play('select');
              if (!spinning && selected >= 0)
                setNotice(t('notice.resumedSpinning'));
            }}
          >
            {spinning ? <Pause /> : <CirclePlay />}
            {spinning ? t('action.pause') : t('action.spin')}
          </Button>
          <Button
            disabled={!ready}
            className="lamp"
            aria-pressed={night}
            onClick={() => {
              api.current?.light(!night);
              setNight(!night);
              play('light');
            }}
          >
            {night ? <Moon /> : <Sun />}
            {night ? t('action.turnOff') : t('action.turnOn')}
          </Button>
          <Button
            className="music"
            aria-pressed={musicOn}
            aria-label={musicOn ? t('a11y.musicOn') : t('a11y.musicOff')}
            onClick={toggleMusic}
          >
            {musicOn ? <Music4 /> : <VolumeX />}
            {musicOn ? t('action.mute') : t('action.music')}
          </Button>
          <Button
            disabled={!ready}
            variant="ghost"
            className="reset"
            aria-label={t('a11y.resetView')}
            onClick={() => {
              api.current?.reset();
              play('select');
            }}
          >
            <RotateCcw />
          </Button>
        </div>
        {(photoSave === 'saving' || photoSave === 'error' || !viewSaved) && (
          <p className="save-status" aria-live="polite" data-state={photoSave === 'saving' ? 'saving' : 'error'}>
            {photoSave === 'saving' ? t('status.saving') : t('status.saveFailed')}
          </p>
        )}
      </footer>
      <Dialog open={uploadMenu} onOpenChange={open => { if (!batchLock.current) setUploadMenu(open); }}>
        <DialogContent className="upload-menu">
          <DialogHeader>
            <DialogTitle>{t('dialog.uploadTitle')}</DialogTitle>
            <DialogDescription>
              {t('dialog.uploadDesc', { count: memories.filter(m => m.empty).length })}
            </DialogDescription>
          </DialogHeader>
          <Button disabled={busy} onClick={() => {
            setUploadMenu(false);
            api.current?.reset();
            setChoosing(true);
          }}>{t('action.choosePosition')}</Button>
          <Button className="batch-upload" disabled={busy || !memories.some(m => m.empty)} onClick={() => batchInput.current?.click()}>
            <ImagePlus />{t('action.batchUpload')}
          </Button>
          {!memories.some(m => m.empty) && <p>{t('dialog.framesFull')}</p>}
          <p className="batch-help">{t('dialog.batchHelp')}</p>
          {batchProgress && <p role="status">{batchProgress}</p>}
          {batchError && <p className="editor-error" role="alert">{batchError}</p>}
          <input ref={batchInput} type="file" multiple accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif" hidden onChange={event => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = '';
            void uploadBatch(files);
          }} />
        </DialogContent>
      </Dialog>
      {choosing && (
        <aside className="position-picker" aria-label={t('a11y.choosePosition')}>
          <div className="picker-heading">
            <div>
              <small>{t('picker.stepOne')}</small>
              <h2>{t('picker.title')}</h2>
            </div>
            <Button
              variant="ghost"
              aria-label={t('a11y.closePicker')}
              onClick={() => setChoosing(false)}
            >
              <X />
            </Button>
          </div>
          <p>{t('picker.hint')}</p>
          <div className="slots">
            {memories.map((memory, i) => (
              <button
                type="button"
                key={i}
                className={`slot ${selected === i ? 'chosen' : ''}`}
                aria-label={t('picker.slotLabel', { number: i + 1 }) + (memory.custom ? t('picker.slotHasPhoto') : memory.empty ? t('picker.slotEmpty') : '')}
                aria-pressed={selected === i}
                onClick={() => choose(i)}
              >
                {memory.preview ? (
                  <img src={memory.preview} alt="" width={88} height={104} />
                ) : (
                  <span className="empty-slot">
                    <Plus />
                  </span>
                )}
                <span>
                  {String(i + 1).padStart(2, '0')}
                  {memory.custom ? t('picker.attached') : ''}
                </span>
              </button>
            ))}
          </div>
          <Button
            className="choose-confirm"
            disabled={selected < 0}
            onClick={() => void openEditor()}
          >
            <ImagePlus />
            {selected >= 0
              ? t('picker.hangAt', { number: String(selected + 1).padStart(2, '0') })
              : t('picker.selectFirst')}
          </Button>
        </aside>
      )}
      <Dialog
        open={editor}
        onOpenChange={(open) => {
          if (!open && (!busy || processingHeic)) closeEditor();
        }}
      >
        <DialogContent className="photo-editor">
          <DialogHeader>
            <DialogTitle>
              {t('editor.title', { number: String(selected + 1).padStart(2, '0') })}
            </DialogTitle>
            <DialogDescription>
              {t('editor.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="editor-layout">
            <div className="crop-stage">
              {draft ? (
                <canvas ref={preview} aria-label={t('a11y.cropPreview')} />
              ) : (
                <div className="empty-preview">
                  <ImagePlus />
                  <p>{processingHeic ? t('editor.convertingHeic') : busy ? t('editor.reading') : t('editor.pickPhoto')}</p>
                </div>
              )}
            </div>
            <div className="crop-controls">
              <Button
                disabled={busy}
                variant="outline"
                onClick={() => fileInput.current?.click()}
              >
                <ImagePlus />
                {draft ? t('editor.chooseAnother') : t('editor.choosePhoto')}
              </Button>
              <p>{t('editor.formatHelp')}</p>
              {processingHeic && <p role="status">{t('editor.convertingHeicNote')}</p>}
              {(['zoom', 'x', 'y'] as const).map((key) => (
                <label key={key}>
                  <span>
                    {key === 'zoom'
                      ? t('editor.zoom')
                      : key === 'x'
                        ? t('editor.horizontal')
                        : t('editor.vertical')}
                  </span>
                  <input
                    type="range"
                    min={key === 'zoom' ? 1 : -1}
                    max={key === 'zoom' ? 3 : 1}
                    step="0.01"
                    value={draft?.crop[key] ?? initialCrop[key]}
                    disabled={!draft || busy}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      setDraft((d) =>
                        d ? { ...d, crop: { ...d.crop, [key]: value } } : d,
                      );
                    }}
                  />
                </label>
              ))}
              <Button
                variant="ghost"
                disabled={!draft || busy}
                onClick={() =>
                  setDraft((d) => (d ? { ...d, crop: { ...initialCrop } } : d))
                }
              >
                <RotateCcw />
                {t('editor.resetCrop')}
              </Button>
            </div>
          </div>
          {editorError && (
            <p className="editor-error" role="alert">
              {editorError}
            </p>
          )}
          <div className="editor-footer">
            <Button disabled={busy && !processingHeic} variant="ghost" onClick={closeEditor}>
              {t('action.cancel')}
            </Button>
            <Button disabled={!draft || busy} onClick={() => void save()}>
              <Check />
              {busy ? t('editor.preparing') : t('editor.confirm')}
            </Button>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif"
            hidden
            onChange={(e) => {
              void readFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </DialogContent>
      </Dialog>
      <output aria-live="polite" className={`toast ${notice ? 'show' : ''}`}>
        {notice}
      </output>
    </main>
  );
}
