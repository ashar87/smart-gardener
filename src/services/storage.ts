export const get = async <T>(key: string): Promise<T | undefined> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('smart-gardener-db', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('store');
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('store', 'readonly');
      const store = tx.objectStore('store');
      const getReq = store.get(key);
      getReq.onsuccess = () => resolve(getReq.result);
      getReq.onerror = () => reject(getReq.error);
    };
    request.onerror = () => reject(request.error);
  });
};

export const set = async (key: string, value: any): Promise<void> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('smart-gardener-db', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('store');
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('store', 'readwrite');
      const store = tx.objectStore('store');
      const putReq = store.put(value, key);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };
    request.onerror = () => reject(request.error);
  });
};
