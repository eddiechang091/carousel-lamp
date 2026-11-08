import HeicWorker from './heic.worker?worker';
import { translate } from '@/i18n';
export const isHeicFile = (file: File) => /\.(heic|heif)$/i.test(file.name) || /^image\/hei[cf](?:-sequence)?$/i.test(file.type);

export function convertHeic(file: File, signal: AbortSignal): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException('Cancelled', 'AbortError')); return; }
    const worker = new HeicWorker();
    const finish = (blob?: Blob, error?: Error) => {
      clearTimeout(timeout);
      signal.removeEventListener('abort', abort);
      worker.terminate();
      if (error) reject(error); else resolve(blob!);
    };
    const abort = () => finish(undefined, new DOMException('Cancelled', 'AbortError'));
    const timeout = setTimeout(() => finish(undefined, new Error(translate('error.heicTimeout'))), 90000);
    signal.addEventListener('abort', abort, { once: true });
    worker.onmessage = (event: MessageEvent<{blob?: Blob; error?: string}>) => {
      if (event.data.blob instanceof Blob) finish(event.data.blob);
      else finish(undefined, new Error(translate(event.data.error || 'error.heicConvert')));
    };
    worker.onerror = () => finish(undefined, new Error(translate('error.heicWorker')));
    worker.postMessage(file);
  });
}
