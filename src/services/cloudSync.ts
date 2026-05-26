import { collection, doc, setDoc, getDocs, deleteDoc, query, onSnapshot } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from './firebase';
import { Plant } from '../types';

export const uploadPlantImage = async (userId: string, plantId: string, base64Image: string, isMilestone = false, milestoneId?: string): Promise<string> => {
  if (!storage) {
    console.warn("Firebase Storage is not initialized. Storing base64 image in Firestore.");
    return base64Image;
  }
  
  try {
    const path = isMilestone 
      ? `users/${userId}/plants/${plantId}/milestones/${milestoneId || Date.now().toString()}.jpg`
      : `users/${userId}/plants/${plantId}/main.jpg`;
      
    const storageRef = ref(storage, path);
    await uploadString(storageRef, base64Image, 'data_url');
    const downloadUrl = await getDownloadURL(storageRef);
    return downloadUrl;
  } catch (error) {
    console.error("Error uploading image to Firebase Storage:", error);
    throw error;
  }
};

export const syncPlantToCloud = async (userId: string, plant: Plant): Promise<void> => {
  if (!db) throw new Error("Firestore is not initialized.");
  
  const plantRef = doc(db, `users/${userId}/plants/${plant.id}`);
  
  // Timeout wrapper in case Firestore hangs due to no database / offline
  const timeoutPromise = new Promise<void>((_, reject) => 
    setTimeout(() => reject(new Error("Firestore timeout: Could not connect to the database. Make sure you created the Firestore database in the Firebase Console.")), 10000)
  );

  await Promise.race([
    setDoc(plantRef, plant),
    timeoutPromise
  ]);
};

export const deletePlantFromCloud = async (userId: string, plantId: string): Promise<void> => {
  if (!db) throw new Error("Firestore is not initialized.");
  
  const plantRef = doc(db, `users/${userId}/plants/${plantId}`);
  await deleteDoc(plantRef);
  
  if (storage) {
    try {
      const storageRef = ref(storage, `users/${userId}/plants/${plantId}/main.jpg`);
      await deleteObject(storageRef);
    } catch (e) {
      console.warn("Could not delete plant image from storage:", e);
    }
  }
};

export const subscribeToPlants = (userId: string, callback: (plants: Plant[]) => void) => {
  if (!db) return () => {};
  
  const q = query(collection(db, `users/${userId}/plants`));
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const plants: Plant[] = [];
    snapshot.forEach((doc) => {
      plants.push(doc.data() as Plant);
    });
    // Sort by addedAt descending
    plants.sort((a, b) => b.addedAt - a.addedAt);
    callback(plants);
  }, (error) => {
    console.error("Error fetching plants from cloud:", error);
  });
  
  return unsubscribe;
};
