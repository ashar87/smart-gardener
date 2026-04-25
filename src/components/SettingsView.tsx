import { motion } from 'motion/react';
import { Bell, BellOff, LogOut, User, Leaf, Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface SettingsViewProps {
  notificationsEnabled: boolean;
  onToggleNotifications: () => void;
}

export default function SettingsView({ notificationsEnabled, onToggleNotifications }: SettingsViewProps) {
  const { currentUser, logout } = useAuth();

  return (
    <motion.div
      key="settings"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="pb-6 space-y-6"
    >
      <h2 className="text-2xl font-serif font-bold text-moss">Settings</h2>

      {/* Profile Card */}
      <div className="bg-white rounded-3xl border border-moss/5 shadow-sm overflow-hidden">
        <div className="p-5 flex items-center gap-4 border-b border-moss/5">
          <div className="w-14 h-14 rounded-2xl bg-moss flex items-center justify-center text-white flex-shrink-0">
            <User size={24} />
          </div>
          <div className="min-w-0">
            <div className="font-serif font-bold text-stone truncate">
              {currentUser?.displayName || 'Gardener'}
            </div>
            <div className="text-xs text-stone/50 truncate">{currentUser?.email}</div>
          </div>
        </div>

        {/* Notifications Toggle */}
        <div className="p-5 flex items-center justify-between border-b border-moss/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-moss/10 flex items-center justify-center text-moss">
              {notificationsEnabled ? <Bell size={18} /> : <BellOff size={18} />}
            </div>
            <div>
              <div className="text-sm font-bold text-stone">Watering Reminders</div>
              <div className="text-[11px] text-stone/50">Get notified when plants need water</div>
            </div>
          </div>
          <button
            id="notifications-toggle"
            aria-label="Toggle watering reminders"
            onClick={onToggleNotifications}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-300 ${
              notificationsEnabled ? 'bg-moss' : 'bg-stone/20'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-300 ${
                notificationsEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* App Info */}
        <div className="p-5 flex items-center gap-3 border-b border-moss/5">
          <div className="w-9 h-9 rounded-xl bg-moss/10 flex items-center justify-center text-moss">
            <Leaf size={18} />
          </div>
          <div>
            <div className="text-sm font-bold text-stone">Smart Gardener</div>
            <div className="text-[11px] text-stone/50">Version 1.0 · Powered by Gemini AI</div>
          </div>
        </div>

        {/* Privacy note */}
        <div className="p-5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-moss/10 flex items-center justify-center text-moss">
            <Shield size={18} />
          </div>
          <div>
            <div className="text-sm font-bold text-stone">Cloud Sync</div>
            <div className="text-[11px] text-stone/50">Your plants are securely stored on Firebase</div>
          </div>
        </div>
      </div>

      {/* Sign Out */}
      <button
        id="sign-out-btn"
        onClick={logout}
        className="w-full flex items-center justify-center gap-3 bg-white border border-red-100 text-red-500 font-bold py-4 rounded-2xl shadow-sm hover:bg-red-50 transition-colors"
      >
        <LogOut size={18} />
        Sign Out
      </button>
    </motion.div>
  );
}
