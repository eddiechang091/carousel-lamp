import type { Crop } from './photos';
import { translate } from '@/i18n';

export type SavedPhoto = {
  slot: number;
  source: Blob | null;
  preview: string;
  crop: Crop;
  empty: boolean;
  caption: string;
};
function openStore(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('carousel-lamp-photos', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('photos', { keyPath: 'slot' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error(translate('error.storageOpen')));
    request.onblocked = () => reject(new Error(translate('error.storageBlocked')));
  });
}
export async function readSavedPhotos(): Promise<SavedPhoto[]> {
  const db = await openStore();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('photos', 'readonly');
      const request = tx.objectStore('photos').getAll();
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = tx.onabort = () => reject(new Error(translate('error.storageRead')));
    });
  } finally { db.close(); }
}
export async function savePhotoLocally(photo: SavedPhoto): Promise<void> {
  return savePhotosLocally([photo]);
}

// Commit both sides of an exchange together, so a failed write cannot lose a photo.
export async function savePhotosLocally(photos: SavedPhoto[]): Promise<void> {
  const db = await openStore();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('photos', 'readwrite', { durability: 'strict' });
      try {
        for (const photo of photos) tx.objectStore('photos').put(photo);
      } catch {
        tx.abort();
        reject(new Error(translate('error.storageSaveNoChange')));
      }
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(new Error(translate('error.storageFull')));
    });
  } finally { db.close(); }
}
