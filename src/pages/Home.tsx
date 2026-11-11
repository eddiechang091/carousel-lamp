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
  ImagePlus,
  Cpu,
  Crop as CropIcon,
  Trash2,
  X,
  Check,
  Pencil,
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
import { THEMES, normalizeThemeMode, resolveTheme, type ThemeId, type ThemeMode } from '@/lib/themes';
import { useI18n, type Locale } from '@/i18n';
import { LlmUnavailableError } from '@/services/otari/llm';
import { generateAiCaption } from '@/services/otari/caption';
import { createAutoCaptionRunner } from '@/services/otari/auto-caption';
import { fetchAllowedModels, readSelectedModel, saveSelectedModel } from '@/services/otari/models';
import { readUsageEntries, type UsageEntry } from '@/services/otari/usage';
import ModelDashboard from '@/components/ModelDashboard';
import PonyMascot from '@/components/PonyMascot';
import LanguageSwitcher from '@/components/common/LanguageSwitcher';
import ThemeSwitcher from '@/components/common/ThemeSwitcher';

type Memory = {
  source: string;
  preview: string;
  crop: Crop;
  custom: boolean;
  empty: boolean;
  caption: string;
  /** True when the caption was written by the AI: it is regenerated in
      the new language when the locale changes; a hand-edited caption
      is never overwritten. Persisted via SavedPhoto.captionAi. */
  captionAi: boolean;
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
      captionAi: false,
    })),
  );
  const [captionDraft, setCaptionDraft] = useState('');
  const [captionBusy, setCaptionBusy] = useState(false);
  const [captionFailed, setCaptionFailed] = useState(false);
  // True while the caption input (not the text view) is open.
  const [editingCaption, setEditingCaption] = useState(false);
  const editingCaptionRef = useRef(false);
  useEffect(() => { editingCaptionRef.current = editingCaption; }, [editingCaption]);
  const memoriesRef = useRef(memories);
  useEffect(() => { memoriesRef.current = memories; }, [memories]);
  const play = (kind: Parameters<ChimeAudio['play']>[0]) =>
    audio.current?.play(kind);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => normalizeThemeMode(readThemePref()));
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

  // Model dashboard: the picker list comes from the server (GET
  // /api/llm); the user's pick is stored locally and sent with later
  // calls. The overlay fades out by itself after 10s idle; any
  // pointer/key interaction inside resets the timer.
  const [modelOpen, setModelOpen] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string | null>(() => readSelectedModel());
  const selectedModelRef = useRef(selectedModel);
  useEffect(() => { selectedModelRef.current = selectedModel; }, [selectedModel]);
  const [usageEntries, setUsageEntries] = useState<UsageEntry[]>(() => readUsageEntries());
  const modelHideTimer = useRef<number | null>(null);
  function stopModelHideTimer() {
    if (modelHideTimer.current !== null) {
      window.clearTimeout(modelHideTimer.current);
      modelHideTimer.current = null;
    }
  }
  function armModelHideTimer() {
    stopModelHideTimer();
    modelHideTimer.current = window.setTimeout(() => setModelOpen(false), 10000);
  }
  useEffect(() => () => stopModelHideTimer(), []);
  async function toggleModelDashboard() {
    if (modelOpen) {
      stopModelHideTimer();
      setModelOpen(false);
      return;
    }
    setUsageEntries(readUsageEntries());
    setModelOpen(true);
    armModelHideTimer();
    if (models.length === 0 && !modelsLoading) {
      setModelsLoading(true);
      setModelsError(false);
      try {
        setModels(await fetchAllowedModels());
      } catch {
        setModelsError(true);
      } finally {
        setModelsLoading(false);
      }
    }
  }
  function closeModelDashboard() {
    stopModelHideTimer();
    setModelOpen(false);
  }
  function pickModel(model: string | null) {
    saveSelectedModel(model);
    setSelectedModel(model);
  }

  // Auto-caption: when a photo is hung, the model writes one poetic line
  // and it is SAVED immediately — no Save tap. Refs keep the async
  // callbacks current.
  const selectedRef = useRef(selected);
  useEffect(() => { selectedRef.current = selected; }, [selected]);
  const localeRef = useRef(locale);
  useEffect(() => { localeRef.current = locale; }, [locale]);
  // Locale each slot's latest generation was requested in. A result
  // that arrives after the locale moved on is stale and must not be
  // saved (it would store a caption in the wrong language).
  const captionLocaleRef = useRef(new Map<number, Locale>());
  // Preview each slot's latest generation was requested for. A result
  // that arrives after the photo was removed, replaced, or re-cropped
  // belongs to a photo that is no longer there — drop it.
  const captionPreviewRef = useRef(new Map<number, string>());
  const generatingSlotRef = useRef<number | null>(null);
  const autoCaption = useRef(createAutoCaptionRunner({
    generate: generateAiCaption,
    onStart: (slot) => {
      if (slot === selectedRef.current) {
        generatingSlotRef.current = slot;
        setCaptionBusy(true);
        setCaptionFailed(false);
      }
    },
    onCaption: (slot, text) => {
      if (captionLocaleRef.current.get(slot) !== localeRef.current) return;
      if (captionPreviewRef.current.get(slot) !== memoriesRef.current[slot]?.preview) return;
      setUsageEntries(readUsageEntries());
      void queueCaptionSave(slot, text);
      if (slot === selectedRef.current) {
        if (!editingCaptionRef.current) setCaptionDraft(text);
        setNotice(t('ai.captionReady'));
        play('select');
      }
    },
    onError: (slot, err) => {
      if (captionLocaleRef.current.get(slot) !== localeRef.current) return;
      if (slot === selectedRef.current) {
        setCaptionFailed(true);
        setNotice(
          err instanceof LlmUnavailableError
            ? err.message || t('ai.captionUnavailable')
            : t('ai.captionFailed'),
        );
      }
    },
    onDone: (slot) => {
      if (captionLocaleRef.current.get(slot) !== localeRef.current) return;
      if (generatingSlotRef.current === slot) {
        generatingSlotRef.current = null;
        setCaptionBusy(false);
      }
    },
  }));
  // Ask the model for a caption for one freshly uploaded photo.
  function requestAutoCaption(slot: number, preview: string, hasCaption: boolean, force = false) {
    captionLocaleRef.current.set(slot, localeRef.current);
    captionPreviewRef.current.set(slot, preview);
    void autoCaption.current.request(slot, {
      imageDataUrl: preview,
      locale: localeRef.current,
      hasCaption,
      force,
      model: selectedModelRef.current ?? undefined,
    });
  }
  function retryAutoCaption() {
    if (selectedRef.current < 0) return;
    const memory = memoriesRef.current[selectedRef.current];
    if (!memory || memory.empty || !memory.preview) return;
    requestAutoCaption(selectedRef.current, memory.preview, false, true);
  }
  // Switching language regenerates every AI-written caption in the new
  // language. Hand-edited captions are never touched. A slot being
  // edited by hand right now is skipped — the user's edit wins.
  const prevLocaleRef = useRef(locale);
  useEffect(() => {
    if (prevLocaleRef.current === locale) return;
    prevLocaleRef.current = locale;
    for (let slot = 0; slot < PHOTO_COUNT; slot++) {
      const memory = memoriesRef.current[slot];
      if (!memory || !memory.captionAi || memory.empty || !memory.preview) continue;
      if (slot === selectedRef.current && editingCaptionRef.current) continue;
      requestAutoCaption(slot, memory.preview, false, true);
    }
  }, [locale]);
  useEffect(() => {
    if (selected >= 0) {
      // The saved caption is the text; the draft only exists while editing.
      setCaptionDraft(memoriesRef.current[selected]?.caption ?? '');
      setEditingCaption(false);
      setCaptionFailed(false);
    }
  }, [selected]);

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
              custom: !photo.empty, empty: photo.empty, caption: photo.caption ?? '', captionAi: photo.captionAi ?? false });
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
    instance.setTheme(resolveTheme(themeMode));
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
  // The tune follows the carousel theme (auto mode included: the hourly
  // re-check changes themeId, and this picks it up).
  useEffect(() => {
    music.current?.setTheme(themeId);
  }, [themeId]);
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
            caption: memories[slots[i]].caption ?? '', captionAi: memories[slots[i]].captionAi ?? false,
          } });
        } catch (error) { URL.revokeObjectURL(source); throw error; }
      }
      setBatchProgress(t('batch.saving'));
      await commitPhotos(async () => prepared.map(({slot, memory, blob}) => ({
        slot, source: blob, preview: memory.preview, crop: memory.crop, empty: false, caption: memory.caption, captionAi: memory.captionAi,
      })));
      for (const {memory} of prepared) {
        urls.current.add(memory.source);
      }
      committed = true;
      setMemories(list => list.map((memory, i) => prepared.find(p => p.slot === i)?.memory ?? memory));
      for (const {slot, memory} of prepared) {
        await api.current?.setPhoto(slot, memory.preview);
        if (memory.caption) await api.current?.setCaption(slot, memory.caption);
        // The model writes a caption for each freshly hung photo (unless
        // it already has one); each one is auto-saved as it arrives.
        requestAutoCaption(slot, memory.preview, (memory.caption ?? '').trim() !== '');
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
        return [{ slot: selected, source: original, preview: cropped, crop: { ...draft.crop }, empty: false, caption: memories[selected].caption, captionAi: memories[selected].captionAi }];
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
                captionAi: memories[selected].captionAi,
              }
            : m,
        ),
      );
      // A freshly hung photo gets its caption written by the model and
      // auto-saved; the user can edit it with the pencil afterwards.
      requestAutoCaption(selected, cropped, memories[selected].caption.trim() !== '');
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
          crop: { ...photo.crop }, empty: photo.empty, caption: photo.caption, captionAi: photo.captionAi };
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
      await commitPhotos(async () => [{ slot: selected, source: null, preview: '', crop: { ...initialCrop }, empty: true, caption: '', captionAi: false }]);
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
              captionAi: false,
            }
          : m,
      ),
    );
    play('hang');
    setNotice(t('notice.photoRemoved'));
  }
  // Caption saves, serialized: commitPhotos throws while another save
  // is in flight, and a batch upload can finish several generations
  // at once. Each link waits briefly for a user-initiated save, then
  // writes; a failure never breaks the chain.
  const captionSaveChainRef = useRef(Promise.resolve());
  function queueCaptionSave(slot: number, text: string) {
    captionSaveChainRef.current = captionSaveChainRef.current
      .catch(() => {})
      .then(() => saveCaptionForSlot(slot, text, 'ai'));
    return captionSaveChainRef.current;
  }
  async function saveCaptionForSlot(slot: number, next: string, source: 'ai' | 'user') {
    if (slot < 0 || !api.current) return;
    const text = next.trim().slice(0, 40);
    const current = memoriesRef.current[slot];
    // Never save a caption onto an empty frame (the photo was removed
    // while its generation was still in flight).
    if (!current || current.empty || text === current.caption) return;
    // A user-initiated save (hang / remove / swap) wins the store;
    // wait for it briefly instead of colliding with it.
    for (let i = 0; i < 20 && pendingSave.current; i++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (pendingSave.current) {
      if (slot === selectedRef.current) setCaptionFailed(true);
      return;
    }
    try {
      await commitPhotos(async () => {
        const memory = memoriesRef.current[slot];
        let blob: Blob | null = null;
        if (memory && !memory.empty && memory.source) {
          const response = await fetch(memory.source);
          if (!response.ok) throw new Error(t('error.photoReadFailed'));
          blob = await response.blob();
        }
        const memoryNow = memoriesRef.current[slot];
        return [{ slot, source: blob, preview: memoryNow?.preview ?? '', crop: memoryNow ? { ...memoryNow.crop } : { ...initialCrop }, empty: memoryNow?.empty ?? true, caption: text, captionAi: source === 'ai' }];
      });
      await api.current.setCaption(slot, text);
      if (slot === selectedRef.current && !editingCaptionRef.current) setCaptionDraft(text);
      setMemories(list => list.map((m, i) => i === slot ? { ...m, caption: text, captionAi: source === 'ai' } : m));
      play('select');
    } catch (err) {
      if (slot === selectedRef.current) setCaptionFailed(true);
      setNotice((err as Error).message);
    }
  }
  async function persistCaption(next: string) {
    if (selected < 0) return;
    await saveCaptionForSlot(selected, next, 'user');
    setEditingCaption(false);
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
        <button
          type="button"
          className="model-toggle"
          aria-label={t('a11y.modelButton')}
          aria-expanded={modelOpen}
          onClick={() => void toggleModelDashboard()}
        >
          <Cpu className="theme-icon" aria-hidden="true" />
          {t('model.title')}
        </button>
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
          {memories[selected].empty ? (
            <div className="photo-action-row">
              <Button onClick={() => void openEditor()}>
                <CropIcon />
                {t('action.addPhoto')}
              </Button>
            </div>
          ) : (
            <>
              <div className="caption-editor">
                {editingCaption ? (
                  <>
                    <input
                      type="text"
                      value={captionDraft}
                      maxLength={40}
                      placeholder={captionBusy ? t('ai.captionGenerating') : t('label.captionPlaceholder')}
                      aria-label={t('a11y.captionInput')}
                      disabled={captionBusy}
                      autoFocus
                      onChange={(e) => setCaptionDraft(e.target.value.slice(0, 40))}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          setCaptionDraft(memories[selected].caption);
                          setEditingCaption(false);
                        } else if (e.key === 'Enter') {
                          void persistCaption(captionDraft);
                        }
                      }}
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
                  </>
                ) : (
                  <>
                    <span
                      className={`caption-text ${memories[selected].caption ? '' : 'caption-placeholder'}`}
                      onClick={() => {
                        if (!captionBusy) {
                          setCaptionDraft(memories[selected].caption);
                          setEditingCaption(true);
                        }
                      }}
                    >
                      {captionBusy
                        ? t('ai.captionGenerating')
                        : memories[selected].caption || t('label.captionPlaceholder')}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="caption-edit"
                      aria-label={t('a11y.editCaption')}
                      disabled={captionBusy}
                      onClick={() => {
                        setCaptionDraft(memories[selected].caption);
                        setEditingCaption(true);
                      }}
                    >
                      <Pencil />
                    </Button>
                  </>
                )}
              </div>
              {captionFailed && (
                <button
                  type="button"
                  className="caption-retry"
                  onClick={() => void retryAutoCaption()}
                >
                  {t('ai.captionRetry')}
                </button>
              )}
              <div className="photo-action-row">
                <Button onClick={() => void openEditor()}>
                  <CropIcon />
                  {t('action.replaceAdjust')}
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
            </>
          )}
        </div>
      )}
      <ModelDashboard
        open={modelOpen}
        models={models}
        modelsLoading={modelsLoading}
        modelsError={modelsError}
        selectedModel={selectedModel}
        onSelectModel={pickModel}
        entries={usageEntries}
        onInteract={armModelHideTimer}
        onClose={closeModelDashboard}
      />
      <PonyMascot
        themeId={themeId}
        model={selectedModel}
        editorOpen={choosing || editor || uploadMenu || modelOpen}
      />
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
