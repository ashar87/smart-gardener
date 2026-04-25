/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, ChangeEvent, MouseEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Leaf, Calendar, Camera, Info, Check, Trash2, HeartPulse, Droplets, Sprout, Scissors, Bell, BellOff, History, Sparkles, ArrowLeftRight, Image as ImageIcon, ArrowLeft } from 'lucide-react';
import { Plant, IdentificationResult, CareEvent, GrowthMilestone } from './types';
import { identifyPlant, analyzeGrowth } from './services/geminiService';
import { requestNotificationPermission, scheduleWateringNotification, cancelWateringNotification } from './services/notificationService';
import { uploadPlantImage, syncPlantToCloud, deletePlantFromCloud, subscribeToPlants } from './services/cloudSync';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Onboarding from './components/Onboarding';
import BottomNav, { Tab } from './components/BottomNav';
import CalendarView from './components/CalendarView';
import SettingsView from './components/SettingsView';
import { filterPlantsByLocation } from './utils/calendarUtils';

const compressImage = (base64: string, maxWidth = 800, quality = 0.6): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error("Failed to load image for compression"));
    img.src = base64;
  });
};

// --- Components ---

const Header = ({ title, showBack, onBack, showLogout, onLogout }: { title: string; showBack?: boolean; onBack?: () => void; showLogout?: boolean; onLogout?: () => void }) => (
  <header className="sticky top-0 z-50 flex items-center justify-between p-6 pt-safe bg-sand/80 backdrop-blur-md border-b border-moss/10">
    <div className="flex items-center gap-3">
      {showBack && (
        <button onClick={onBack} aria-label="Go back" className="p-3 -ml-2 rounded-full hover:bg-moss/10 text-moss">
          <ArrowLeft size={20} />
        </button>
      )}
      <h1 className="text-2xl font-serif font-bold text-moss tracking-tight">{title}</h1>
    </div>
    {showLogout ? (
      <button onClick={onLogout} className="w-10 h-10 rounded-xl bg-white border border-clay flex items-center justify-center text-moss hover:bg-gray-50 shadow-sm transition-all" aria-label="Sign out">
        <LogOut size={18} />
      </button>
    ) : (
      <div className="w-10 h-10 rounded-xl bg-moss flex items-center justify-center text-white shadow-sm">
        <Leaf size={20} />
      </div>
    )}
  </header>
);

const PlantCard = ({ plant, onClick, onDelete }: { plant: Plant; onClick: () => void; onDelete: (e: MouseEvent) => void; key?: string }) => {
  const nextWateringDate = new Date(plant.careSchedule.watering.nextWatered);
  const isHealthy = plant.healthStatus.status === 'healthy';

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className="bg-white rounded-[32px] overflow-hidden shadow-sm border border-[#5A5A40]/5 cursor-pointer hover:shadow-md transition-shadow group relative"
    >
      <div className="aspect-square relative overflow-hidden">
        <img 
          src={plant.image} 
          alt={plant.commonName} 
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          referrerPolicy="no-referrer"
        />
        <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-white/90 backdrop-blur-sm text-xs font-bold uppercase tracking-wider text-moss flex items-center gap-1">
          <HeartPulse size={12} className={isHealthy ? 'text-green-600' : 'text-terracotta'} />
          {plant.healthStatus.status}
        </div>
      </div>
      <div className="p-4 bg-white">
        <h3 className="font-serif text-lg font-bold text-stone">{plant.commonName}</h3>
        <p className="text-sm text-stone/60 italic font-serif">{plant.species}</p>
        <div className="mt-3 pt-3 border-t border-moss/5 flex items-center gap-2 text-xs text-stone/70">
          <Calendar size={14} className="text-stone/30" />
          <span>Next water: {nextWateringDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
        </div>
      </div>
      <button 
        onClick={onDelete}
        aria-label="Delete plant"
        className="absolute bottom-4 right-4 p-3 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-full opacity-60 active:opacity-100 transition-all"
      >
        <Trash2 size={16} />
      </button>
    </motion.div>
  );
};

function AppContent() {
  const { currentUser, logout } = useAuth();
  const [plants, setPlants] = useState<Plant[]>([]);
  const [view, setView] = useState<'dashboard' | 'add' | 'analyzing' | 'result' | 'detail'>('dashboard');
  const [activeTab, setActiveTab] = useState<Tab>('garden');
  const [locationFilter, setLocationFilter] = useState<'all' | 'indoor' | 'outdoor'>('all');
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<IdentificationResult | null>(null);
  const [selectedPlant, setSelectedPlant] = useState<Plant | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('Identifying species...');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [compareMode, setCompareMode] = useState(false);

  // Cloud Sync
  useEffect(() => {
    if (!currentUser) return;
    const unsubscribe = subscribeToPlants(currentUser.uid, (fetchedPlants) => {
      setPlants(fetchedPlants);
      
      // Update selected plant if it exists
      if (selectedPlant) {
        const updatedSelected = fetchedPlants.find(p => p.id === selectedPlant.id);
        if (updatedSelected) setSelectedPlant(updatedSelected);
      }
    });
    return () => unsubscribe();
  }, [currentUser]);

  // Load notif settings
  useEffect(() => {
    const savedNotifs = localStorage.getItem('smart-gardener-notifications');
    if (savedNotifs === 'true') setNotificationsEnabled(true);
  }, []);

  useEffect(() => {
    localStorage.setItem('smart-gardener-notifications', notificationsEnabled.toString());
  }, [notificationsEnabled]);

  useEffect(() => {
    plants.forEach(plant => {
      if (notificationsEnabled) {
        scheduleWateringNotification(plant, true);
      } else {
        cancelWateringNotification(plant.id);
      }
    });
  }, [plants, notificationsEnabled]);

  const handleNotificationToggle = async () => {
    if (!notificationsEnabled) {
      const granted = await requestNotificationPermission();
      setNotificationsEnabled(granted);
      if (!granted) {
        alert("Notification permissions are required for reminders. Please enable them in your browser settings and ensure you are viewing the app in a new tab if it's blocked by the iframe.");
      }
    } else {
      setNotificationsEnabled(false);
    }
  };

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const originalBase64 = reader.result as string;
      setView('analyzing');
      setLoadingMessage('Optimizing image for AI...');
      
      try {
        await new Promise(r => setTimeout(r, 50));
        const base64 = await compressImage(originalBase64, 1024, 0.7);
        
        // Check for duplicates
        const isDuplicate = plants.some(p => 
          p.image === base64 || 
          p.growthLog?.some(m => m.image === base64)
        );

        if (isDuplicate) {
          alert("It seems this exact same image has been uploaded already. Try a fresh photo of your plant!");
          setView('dashboard');
          return;
        }

        setCurrentImage(base64);
        setLoadingMessage('Consulting botanist AI...');
        
        console.log("Starting plant identification...");
        const result = await identifyPlant(base64);
        console.log("Identification successful", result);
        setAnalysisResult(result);
        setView('result');
      } catch (error) {
        console.error("Analysis failed", error);
        alert("Failed to analyze plant: " + (error instanceof Error ? error.message : "Unknown error"));
        setView('dashboard');
      }
    };
    reader.readAsDataURL(file);
  };

  const confirmAddPlant = async () => {
    if (!analysisResult || !currentImage || !currentUser) return;

    setLoadingMessage('Uploading to Cloud Garden...');
    setView('analyzing');

    const newPlant: Plant = {
      id: Math.random().toString(36).substring(7),
      species: analysisResult.species,
      commonName: analysisResult.commonName,
      image: '', // Will be set after upload
      addedAt: Date.now(),
      healthStatus: analysisResult.health,
      careSchedule: {
        watering: {
          frequency: analysisResult.careSuggestions.watering?.frequency || 'Weekly',
          lastWatered: Date.now(),
          nextWatered: Date.now() + 7 * 24 * 60 * 60 * 1000,
        },
        sunlight: analysisResult.careSuggestions.sunlight || 'Medium light',
        fertilizer: analysisResult.careSuggestions.fertilizer,
        pruning: analysisResult.careSuggestions.pruning,
      },
      history: [],
      growthLog: [],
      reminders: {
        watering: true,
        pruningFertilizing: true
      }
    };

    try {
      const compressed = await compressImage(currentImage, 800, 0.7);
      const url = await uploadPlantImage(currentUser.uid, newPlant.id, compressed);
      newPlant.image = url;
      await syncPlantToCloud(currentUser.uid, newPlant);
      
      setView('dashboard');
      setCurrentImage(null);
      setAnalysisResult(null);
    } catch (e) {
      console.error(e);
      alert("Failed to save plant. Make sure Firestore is enabled.");
      setView('dashboard');
    }
  };

  const deletePlant = async (id: string, e: MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) return;
    if (confirm('Remove this plant from your collection?')) {
      cancelWateringNotification(id);
      try {
        await deletePlantFromCloud(currentUser.uid, id);
        if (selectedPlant?.id === id) setView('dashboard');
      } catch (e) {
        console.error(e);
        alert("Failed to delete plant.");
      }
    }
  };

  const addCareEvent = async (plantId: string, type: CareEvent['type'], note?: string) => {
    if (!currentUser) return;
    const plant = plants.find(p => p.id === plantId);
    if (!plant) return;

    const newEvent: CareEvent = {
      id: Math.random().toString(36).substring(7),
      type,
      timestamp: Date.now(),
      note
    };
    
    let newCareSchedule = { ...plant.careSchedule };
    if (type === 'watering') {
      newCareSchedule.watering = {
        ...newCareSchedule.watering,
        lastWatered: Date.now(),
        nextWatered: Date.now() + 7 * 24 * 60 * 60 * 1000 // Simple logic for demo
      };
    }

    const updatedPlant = {
      ...plant,
      careSchedule: newCareSchedule,
      history: [newEvent, ...(plant.history || [])]
    };

    try {
      await syncPlantToCloud(currentUser.uid, updatedPlant);
    } catch (e) {
      console.error(e);
      alert("Failed to sync care event.");
    }
  };

  const toggleReminder = async (type: 'watering' | 'pruningFertilizing') => {
    if (!selectedPlant || !currentUser) return;
    
    const updatedReminders = {
      ...(selectedPlant.reminders || { watering: true, pruningFertilizing: true }),
      [type]: !((selectedPlant.reminders || { watering: true, pruningFertilizing: true })[type])
    };

    const updatedPlant = { ...selectedPlant, reminders: updatedReminders as any };
    try {
      await syncPlantToCloud(currentUser.uid, updatedPlant);
    } catch (e) {
      console.error(e);
    }
  };

  const handleProgressUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!selectedPlant) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const originalBase64 = reader.result as string;
      setView('analyzing');
      setLoadingMessage('Optimizing journey photo...');
      
      try {
        await new Promise(r => setTimeout(r, 50));
        const base64 = await compressImage(originalBase64, 1024, 0.7);
        
        // Check for duplicates in the current plant
        const isDuplicate = selectedPlant.image === base64 || 
                           selectedPlant.growthLog?.some(m => m.image === base64);
        
        if (isDuplicate) {
          alert("It seems this exact same image has been uploaded already for this plant. Please upload a new progress photo!");
          setView('detail');
          return;
        }

        setLoadingMessage('Analyzing growth journey...');
        
        const analysis = await analyzeGrowth(base64, []);
        console.log("Growth analysis result:", analysis);
        
        const milestoneId = Math.random().toString(36).substring(7);
        setLoadingMessage('Uploading to Cloud...');
        
        const url = await uploadPlantImage(currentUser!.uid, selectedPlant.id, base64, true, milestoneId);

        const milestone: GrowthMilestone = {
          id: milestoneId,
          image: url,
          timestamp: Date.now(),
          analysis
        };

        const newGrowthLog = [milestone, ...(selectedPlant.growthLog || [])].slice(0, 10);
        const updatedPlant = { ...selectedPlant, growthLog: newGrowthLog };
        
        await syncPlantToCloud(currentUser!.uid, updatedPlant);
        setView('detail');
      } catch (error) {
        console.error("Growth analysis failed", error);
        alert("Failed to analyze growth. Please try again.");
        setView('detail');
      }
    };
    reader.readAsDataURL(file);
  };

  // Navigate back from detail/add to garden tab
  const handleBack = () => {
    setView('dashboard');
    setActiveTab('garden');
  };

  if (!currentUser) {
    return <Onboarding />;
  }

  // Determine which header title to show
  const headerTitle =
    view === 'detail' ? (selectedPlant?.commonName || 'Plant Detail') :
    view === 'add' || view === 'analyzing' || view === 'result' ? 'Add Plant' :
    activeTab === 'garden' ? 'My Garden' :
    activeTab === 'calendar' ? 'Watering Schedule' :
    'Settings';

  const showBack = view !== 'dashboard' || activeTab !== 'garden';
  const showBottomNav = view === 'dashboard';

  // Filtered plants for the garden grid
  const filteredPlants = filterPlantsByLocation(plants, locationFilter);

  return (
    <div className="min-h-screen bg-[#f5f5f0] font-sans text-[#1a1a1a] pb-24">
      <Header
        title={headerTitle}
        showBack={showBack && (view !== 'dashboard')}
        onBack={handleBack}
        showLogout={false}
      />

      <main className="max-w-md mx-auto px-6 pt-6">
        <AnimatePresence mode="wait">
          {/* ── GARDEN TAB ── */}
          {view === 'dashboard' && activeTab === 'garden' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Location filter pills */}
              {plants.length > 0 && (
                <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
                  {(['all', 'indoor', 'outdoor'] as const).map((f) => (
                    <button
                      key={f}
                      id={`filter-${f}`}
                      onClick={() => setLocationFilter(f)}
                      className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide border transition-all ${
                        locationFilter === f
                          ? 'bg-moss text-white border-moss shadow-sm'
                          : 'bg-white text-stone/50 border-stone/10 hover:border-moss/30'
                      }`}
                    >
                      {f === 'all' ? '🌿 All' : f === 'indoor' ? '🏠 Indoor' : '☀️ Outdoor'}
                    </button>
                  ))}
                </div>
              )}

              {plants.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-24 h-24 bg-[#5A5A40]/5 rounded-full flex items-center justify-center text-[#5A5A40]/20 mb-6">
                    <Leaf size={48} />
                  </div>
                  <h2 className="text-xl font-serif font-medium text-[#5A5A40]">Your garden is empty</h2>
                  <p className="mt-2 text-[#5A5A40]/60 leading-relaxed mb-6">
                    Tap the button below to identify and add your first plant.
                  </p>
                </div>
              ) : filteredPlants.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <p className="text-stone/40 font-serif italic">No {locationFilter} plants yet</p>
                  <button
                    onClick={() => setLocationFilter('all')}
                    className="mt-3 text-xs text-moss underline"
                  >Show all plants</button>
                </div>
              ) : (
                <div className="space-y-6">
                  {!notificationsEnabled && plants.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-moss text-white p-4 rounded-2xl flex items-center justify-between shadow-lg mx-2"
                    >
                      <div className="flex items-center gap-3">
                        <Bell className="animate-bounce" size={20} />
                        <div>
                          <div className="text-xs font-bold uppercase tracking-wider">Reminders are Off</div>
                          <div className="text-[10px] opacity-80">Enable to get watering alerts</div>
                        </div>
                      </div>
                      <button
                        onClick={handleNotificationToggle}
                        className="bg-white text-moss px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-transform active:scale-95"
                      >
                        Enable
                      </button>
                    </motion.div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    {filteredPlants.map(plant => (
                      <PlantCard
                        key={plant.id}
                        plant={plant}
                        onClick={() => { setSelectedPlant(plant); setView('detail'); }}
                        onDelete={(e) => deletePlant(plant.id, e)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* FAB - Add Plant */}
              <button
                id="add-plant-fab"
                onClick={() => setView('add')}
                className="fixed bottom-20 right-6 flex items-center gap-2 bg-terracotta text-white px-5 py-3.5 rounded-full shadow-xl shadow-terracotta/30 hover:scale-105 active:scale-95 transition-transform font-bold"
              >
                <Plus size={20} />
                <span className="text-sm">Add Plant</span>
              </button>
            </motion.div>
          )}

          {/* ── CALENDAR TAB ── */}
          {view === 'dashboard' && activeTab === 'calendar' && (
            <CalendarView
              plants={plants}
              onWaterPlant={(plantId) => addCareEvent(plantId, 'watering')}
              onPlantClick={(plant) => { setSelectedPlant(plant); setView('detail'); }}
            />
          )}

          {/* ── SETTINGS TAB ── */}
          {view === 'dashboard' && activeTab === 'settings' && (
            <SettingsView
              notificationsEnabled={notificationsEnabled}
              onToggleNotifications={handleNotificationToggle}
            />
          )}

          {view === 'add' && (
            <motion.div 
              key="add"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center py-10"
            >
              <div className="mb-10 inline-flex items-center justify-center w-32 h-32 bg-moss rounded-full text-white shadow-2xl relative overflow-hidden group">
                <Camera size={48} />
                <input 
                  type="file" 
                  accept="image/*" 
                  capture="environment" 
                  onChange={handleImageUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </div>
              <h2 className="text-2xl font-serif font-bold text-moss">Identify your plant</h2>
              <p className="mt-3 text-stone/60 px-4">
                Take a clear photo of the leaves or stem to identify the species and check its health.
              </p>
              
              <div className="mt-12 flex flex-col gap-4">
                <label className="flex items-center justify-center gap-3 w-full bg-white border-2 border-moss/10 p-4 rounded-2xl text-moss font-bold uppercase tracking-wide text-sm cursor-pointer hover:bg-moss/5 transition-colors">
                  <Camera size={20} />
                  Take a Photo
                  <input type="file" accept="image/*" capture="environment" onChange={handleImageUpload} className="hidden" />
                </label>
                <label className="flex items-center justify-center gap-3 w-full bg-white border-2 border-moss/10 p-4 rounded-2xl text-moss font-bold uppercase tracking-wide text-sm cursor-pointer hover:bg-moss/5 transition-colors">
                  <Plus size={20} />
                  Choose from Gallery
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </label>
              </div>
            </motion.div>
          )}

          {view === 'analyzing' && (
            <motion.div 
              key="analyzing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-20 text-center"
            >
              <div className="relative mb-8">
                <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center shadow-lg border-2 border-clay shadow-stone/5 animate-pulse">
                  <div className="w-12 h-12 border-4 border-terracotta border-t-transparent rounded-full animate-spin"></div>
                </div>
              </div>
              <h2 className="text-xl font-serif font-bold text-moss">{loadingMessage}</h2>
              <p className="mt-2 text-stone/50 text-sm max-w-[240px]">CV Engine analyzing leaf structure and browning patterns</p>
            </motion.div>
          )}

          {view === 'result' && analysisResult && (
            <motion.div 
              key="result"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="pb-10"
            >
              <div className="rounded-[40px] overflow-hidden shadow-2xl mb-8 border-4 border-white">
                <img src={currentImage!} className="w-full h-80 object-cover" referrerPolicy="no-referrer" />
              </div>
              
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-moss/40">AI Result</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-green-600 flex items-center gap-1">
                      <Check size={12} /> {Math.round(analysisResult.confidence * 100)}% Match
                    </span>
                  </div>
                  <h2 className="text-3xl font-serif font-bold text-stone">{analysisResult.commonName}</h2>
                  <p className="text-stone/60 italic font-serif">{analysisResult.species}</p>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-moss/10">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`p-2 rounded-xl ${analysisResult.health.status === 'healthy' ? 'bg-green-50 text-green-700' : 'bg-terracotta/10 text-terracotta'}`}>
                      <HeartPulse size={20} />
                    </div>
                    <h3 className="font-serif font-bold text-stone capitalize">{analysisResult.health.status} Health</h3>
                  </div>
                  <p className="text-sm text-stone/80 leading-relaxed mb-4">
                    {analysisResult.health.assessment}
                  </p>
                  {analysisResult.health.issues.length > 0 && (
                    <div className="flex flex-wrap gap-2 text-[#333]">
                      {analysisResult.health.issues.map(issue => (
                        <span key={issue} className="text-[10px] bg-red-50 text-red-700 px-3 py-1 rounded-full border border-red-100 font-medium">
                          {issue}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <h3 className="font-serif font-bold text-moss px-1">Care Plan</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-clay/30 p-4 rounded-2xl border border-moss/5">
                      <div className="text-moss mb-2"><Calendar size={20} /></div>
                      <div className="text-[10px] uppercase font-bold text-moss/30 mb-1">Watering</div>
                      <div className="text-sm font-bold text-stone">{analysisResult.careSuggestions.watering?.frequency}</div>
                    </div>
                    <div className="bg-clay/30 p-4 rounded-2xl border border-moss/5">
                      <div className="text-moss mb-2"><Info size={20} /></div>
                      <div className="text-[10px] uppercase font-bold text-moss/30 mb-1">Sunlight</div>
                      <div className="text-sm font-bold text-stone">{analysisResult.careSuggestions.sunlight}</div>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={confirmAddPlant}
                  className="w-full bg-terracotta text-white py-4 rounded-2xl font-bold uppercase tracking-wide shadow-xl shadow-terracotta/20 flex items-center justify-center gap-3"
                >
                  <Plus size={20} />
                  Add to My Garden
                </button>
                <button 
                  onClick={() => setView('dashboard')}
                  className="w-full py-4 text-[#5A5A40]/60 font-medium"
                >
                  Discard Analysis
                </button>
              </div>
            </motion.div>
          )}

          {view === 'detail' && selectedPlant && (
            <motion.div 
              key="detail"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="pb-10"
            >
              <div className="rounded-[40px] overflow-hidden shadow-2xl mb-8 relative">
                <img src={selectedPlant.image} className="w-full h-96 object-cover" referrerPolicy="no-referrer" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-8">
                  <p className="text-white/60 text-xs italic font-serif mb-1">{selectedPlant.species}</p>
                  <h2 className="text-4xl font-serif font-medium text-white">{selectedPlant.commonName}</h2>
                </div>
              </div>

              <div className="space-y-8">
                <div className="flex items-center gap-4 bg-white p-6 rounded-[32px] shadow-sm border border-moss/5">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${selectedPlant.healthStatus.status === 'healthy' ? 'bg-green-100 text-green-700' : 'bg-terracotta/20 text-terracotta'}`}>
                    <HeartPulse size={32} />
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-stone text-lg capitalize">{selectedPlant.healthStatus.status} Condition</h3>
                    <p className="text-xs text-stone/40 italic">Last checked {new Date(selectedPlant.addedAt).toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between px-2">
                    <h3 className="font-serif font-bold text-moss text-xl">Growth Journey</h3>
                    {selectedPlant.growthLog && selectedPlant.growthLog.length > 0 && (
                      <button 
                        onClick={() => setCompareMode(!compareMode)}
                        className={`text-[10px] font-bold px-3 py-1 rounded-full border transition-all flex items-center gap-2 ${compareMode ? 'bg-terracotta text-white border-terracotta' : 'border-moss/10 text-moss'}`}
                      >
                        <ArrowLeftRight size={12} />
                        {compareMode ? 'Exit Compare' : 'Then vs Now'}
                      </button>
                    )}
                  </div>
                  
                  {compareMode && selectedPlant.growthLog && selectedPlant.growthLog.length > 0 ? (
                    <div className="bg-white p-4 rounded-[32px] border border-moss/5 shadow-sm space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <span className="text-[10px] font-bold uppercase text-moss/40 tracking-widest px-1">Day 1</span>
                          <div className="aspect-[4/5] rounded-2xl overflow-hidden border border-moss/5">
                            <img src={selectedPlant.image} className="w-full h-full object-cover" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <span className="text-[10px] font-bold uppercase text-moss/40 tracking-widest px-1">Today</span>
                          <div className="aspect-[4/5] rounded-2xl overflow-hidden border border-moss/5">
                            <img src={selectedPlant.growthLog[0].image} className="w-full h-full object-cover" />
                          </div>
                        </div>
                      </div>
                      <div className="bg-sand/30 p-4 rounded-2xl border border-moss/5">
                        <div className="flex items-center gap-2 mb-2 text-moss">
                          <Sparkles size={16} />
                          <span className="text-[10px] font-bold uppercase tracking-wider">AI Growth Report</span>
                        </div>
                        <p className="text-xs text-stone/80 leading-relaxed italic">"{selectedPlant.growthLog[0].analysis.description}"</p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white p-6 rounded-[32px] border border-moss/5 shadow-sm">
                      <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
                        <label className="shrink-0 w-24 h-32 bg-sand rounded-2xl border-2 border-dashed border-moss/10 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-moss/5 transition-colors">
                          <Camera size={24} className="text-moss/40" />
                          <span className="text-[10px] font-bold text-moss/40 uppercase">Update</span>
                          <input type="file" accept="image/*" capture="environment" onChange={handleProgressUpload} className="hidden" />
                        </label>
                        
                        {selectedPlant.growthLog?.map((milestone) => (
                          <div key={milestone.id} className="shrink-0 w-24 h-32 rounded-2xl overflow-hidden relative group shadow-sm border border-moss/5">
                            <img src={milestone.image} alt="Growth milestone" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2 text-center pointer-events-none">
                              <span className="text-[8px] text-white font-bold">{new Date(milestone.timestamp).toLocaleDateString()}</span>
                              {milestone.analysis.growthDetected && <Sparkles size={12} className="text-yellow-400 mt-1" />}
                            </div>
                          </div>
                        ))}
                        
                        <div className="shrink-0 w-24 h-32 rounded-2xl overflow-hidden relative opacity-40 grayscale-[50%] border border-moss/5">
                          <img src={selectedPlant.image} className="w-full h-full object-cover" />
                          <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-moss text-white text-[8px] font-bold rounded-md">START</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                       <h3 className="font-serif font-bold text-moss text-xl">Care Schedule</h3>
                       <span className="text-[10px] font-bold bg-moss/10 text-moss px-3 py-1 rounded-full uppercase tracking-widest">Active</span>
                    </div>
                    
                    <div className="bg-white p-6 rounded-[32px] space-y-6 border border-moss/5 shadow-sm">
                      <div className="flex gap-4">
                        <div className="w-10 h-10 bg-[#E8F2E8] rounded-2xl flex items-center justify-center shrink-0">
                          <span className="text-moss">💧</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <div className="font-bold text-sm text-stone">Watering</div>
                            <button 
                              onClick={() => toggleReminder('watering')}
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors ${selectedPlant.reminders?.watering ? 'bg-blue-100 text-blue-600' : 'bg-stone/10 text-stone/40'}`}
                            >
                              {selectedPlant.reminders?.watering ? 'Reminders On' : 'Reminders Off'}
                            </button>
                          </div>
                          <div className="text-xs text-stone/50">{selectedPlant.careSchedule.watering.frequency}</div>
                          <div className="text-[10px] mt-1 text-moss font-bold">Next: {new Date(selectedPlant.careSchedule.watering.nextWatered).toLocaleDateString()}</div>
                        </div>
                      </div>

                      <div className="flex gap-4 pt-6 border-t border-moss/5">
                        <div className="w-10 h-10 bg-[#FEF5ED] rounded-2xl flex items-center justify-center shrink-0">
                          <span className="text-terracotta">☀️</span>
                        </div>
                        <div>
                          <div className="font-bold text-sm text-stone">Sunlight Requirements</div>
                          <div className="text-xs text-stone/50">{selectedPlant.careSchedule.sunlight}</div>
                        </div>
                      </div>

                      {(selectedPlant.careSchedule.fertilizer || selectedPlant.careSchedule.pruning) && (
                        <div className="flex gap-4 pt-6 border-t border-moss/5">
                          <div className="w-10 h-10 bg-clay/30 rounded-2xl flex items-center justify-center shrink-0">
                            <span className="text-moss">✂️</span>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <div className="font-bold text-sm text-stone">Pruning / Fertilizer</div>
                              <button 
                                onClick={() => toggleReminder('pruningFertilizing')}
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors ${selectedPlant.reminders?.pruningFertilizing ? 'bg-emerald-100 text-emerald-600' : 'bg-stone/10 text-stone/40'}`}
                              >
                                {selectedPlant.reminders?.pruningFertilizing ? 'Reminders On' : 'Reminders Off'}
                              </button>
                            </div>
                            <div className="text-xs text-stone/50">{selectedPlant.careSchedule.fertilizer || selectedPlant.careSchedule.pruning}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                       <h3 className="font-serif font-bold text-moss text-xl">Log Your Care</h3>
                       <span className="text-[10px] text-stone/40 italic">Tap to record action</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <button 
                        onClick={() => addCareEvent(selectedPlant.id, 'watering')}
                        className="flex flex-col items-center gap-2 bg-white p-4 rounded-3xl border border-moss/5 shadow-sm hover:bg-blue-50 active:scale-95 transition-all group"
                      >
                        <div className="p-2 bg-blue-100 text-blue-600 rounded-xl group-active:bg-blue-600 group-active:text-white transition-colors">
                          <Droplets size={20} />
                        </div>
                        <span className="text-[10px] font-bold uppercase text-moss/60">I Watered</span>
                      </button>
                      <button 
                        onClick={() => addCareEvent(selectedPlant.id, 'fertilizing')}
                        className="flex flex-col items-center gap-2 bg-white p-4 rounded-3xl border border-moss/5 shadow-sm hover:bg-emerald-50 active:scale-95 transition-all group"
                      >
                        <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl group-active:bg-emerald-600 group-active:text-white transition-colors">
                          <Sprout size={20} />
                        </div>
                        <span className="text-[10px] font-bold uppercase text-moss/60">I Fertilized</span>
                      </button>
                      <button 
                        onClick={() => addCareEvent(selectedPlant.id, 'pruning')}
                        className="flex flex-col items-center gap-2 bg-white p-4 rounded-3xl border border-moss/5 shadow-sm hover:bg-amber-50 active:scale-95 transition-all group"
                      >
                        <div className="p-2 bg-amber-100 text-amber-600 rounded-xl group-active:bg-amber-600 group-active:text-white transition-colors">
                          <Scissors size={20} />
                        </div>
                        <span className="text-[10px] font-bold uppercase text-moss/60">I Pruned</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between px-2">
                     <h3 className="font-serif font-bold text-moss text-xl">Care History</h3>
                  </div>
                  <div className="bg-white rounded-[32px] overflow-hidden border border-moss/5">
                    {selectedPlant.history && selectedPlant.history.length > 0 ? (
                      <div className="divide-y divide-moss/5">
                        {selectedPlant.history.slice(0, 5).map(event => (
                          <div key={event.id} className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg ${
                                event.type === 'watering' ? 'bg-blue-50 text-blue-600' :
                                event.type === 'fertilizing' ? 'bg-emerald-50 text-emerald-600' :
                                event.type === 'pruning' ? 'bg-amber-50 text-amber-600' :
                                'bg-sand text-moss'
                              }`}>
                                {event.type === 'watering' && <Droplets size={16} />}
                                {event.type === 'fertilizing' && <Sprout size={16} />}
                                {event.type === 'pruning' && <Scissors size={16} />}
                                {event.type === 'health_check' && <HeartPulse size={16} />}
                              </div>
                              <div>
                                <div className="text-sm font-bold text-stone capitalize">{event.type.replace('_', ' ')}</div>
                                <div className="text-[10px] text-stone/40">{new Date(event.timestamp).toLocaleString()}</div>
                              </div>
                            </div>
                            {event.note && (
                              <div className="text-[10px] text-stone/60 italic max-w-[100px] truncate">
                                {event.note}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 text-center">
                        <div className="text-[#5A5A40]/30 mb-2 font-serif italic">No care recorded yet</div>
                        <p className="text-[10px] text-[#5A5A40]/40 uppercase tracking-widest">History will appear as you care for your plant</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="h-4"></div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Navigation — only visible on main dashboard screens */}
      {showBottomNav && (
        <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
