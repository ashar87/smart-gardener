import { motion, AnimatePresence } from 'motion/react';
import { Droplets, AlertTriangle, Clock, CalendarDays } from 'lucide-react';
import { Plant } from '../types';
import { groupPlantsByWateringSchedule, WateringGroup } from '../utils/calendarUtils';

interface CalendarViewProps {
  plants: Plant[];
  onWaterPlant: (plantId: string) => void;
  onPlantClick: (plant: Plant) => void;
}

const GROUP_CONFIG: Record<WateringGroup, { label: string; color: string; icon: React.ReactNode }> = {
  overdue: {
    label: 'Overdue',
    color: 'text-red-600 bg-red-50 border-red-100',
    icon: <AlertTriangle size={14} className="text-red-500" />,
  },
  today: {
    label: 'Today',
    color: 'text-terracotta bg-terracotta/10 border-terracotta/20',
    icon: <Droplets size={14} className="text-terracotta" />,
  },
  tomorrow: {
    label: 'Tomorrow',
    color: 'text-amber-600 bg-amber-50 border-amber-100',
    icon: <Clock size={14} className="text-amber-500" />,
  },
  upcoming: {
    label: 'Upcoming',
    color: 'text-moss bg-moss/10 border-moss/20',
    icon: <CalendarDays size={14} className="text-moss" />,
  },
};

const GROUP_ORDER: WateringGroup[] = ['overdue', 'today', 'tomorrow', 'upcoming'];

export default function CalendarView({ plants, onWaterPlant, onPlantClick }: CalendarViewProps) {
  const groups = groupPlantsByWateringSchedule(plants);

  const totalDue = groups.overdue.length + groups.today.length;

  return (
    <motion.div
      key="calendar"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="pb-6"
    >
      {/* Header summary */}
      <div className="mb-6">
        <h2 className="text-2xl font-serif font-bold text-moss">Watering Schedule</h2>
        {totalDue > 0 ? (
          <p className="text-sm text-red-500 mt-1 font-medium">
            {totalDue} plant{totalDue > 1 ? 's' : ''} need{totalDue === 1 ? 's' : ''} water today
          </p>
        ) : (
          <p className="text-sm text-stone/50 mt-1">All plants are up to date 🌿</p>
        )}
      </div>

      {plants.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 bg-moss/5 rounded-full flex items-center justify-center mb-4">
            <CalendarDays size={36} className="text-moss/30" />
          </div>
          <p className="text-stone/50 font-serif italic">No plants added yet</p>
          <p className="text-xs text-stone/30 mt-1">Switch to Garden to add your first plant</p>
        </div>
      ) : (
        <div className="space-y-6">
          {GROUP_ORDER.map((group) => {
            const items = groups[group];
            if (items.length === 0) return null;
            const config = GROUP_CONFIG[group];

            return (
              <div key={group}>
                {/* Section header */}
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border mb-3 ${config.color}`}>
                  {config.icon}
                  <span className="text-[11px] font-bold uppercase tracking-widest">{config.label}</span>
                  <span className="text-[11px] font-bold opacity-60">({items.length})</span>
                </div>

                {/* Plant cards */}
                <div className="space-y-3">
                  <AnimatePresence>
                    {items.map(({ plant, daysUntil }) => (
                      <motion.div
                        key={plant.id}
                        layout
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        className="bg-white rounded-2xl border border-moss/5 shadow-sm flex items-center gap-4 p-3 cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => onPlantClick(plant)}
                      >
                        {/* Thumbnail */}
                        <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-moss/5">
                          {plant.image ? (
                            <img
                              src={plant.image}
                              alt={plant.commonName}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-moss/20">
                              <Droplets size={24} />
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="font-serif font-bold text-stone truncate">{plant.commonName}</div>
                          <div className="text-[11px] text-stone/50 italic truncate">{plant.species}</div>
                          <div className="text-[11px] text-stone/40 mt-1">
                            {daysUntil < 0
                              ? `${Math.abs(daysUntil)} day${Math.abs(daysUntil) > 1 ? 's' : ''} overdue`
                              : daysUntil === 0
                              ? 'Due today'
                              : `In ${daysUntil} day${daysUntil > 1 ? 's' : ''}`}
                          </div>
                        </div>

                        {/* Water Now button */}
                        <button
                          id={`water-btn-${plant.id}`}
                          aria-label={`Water ${plant.commonName}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onWaterPlant(plant.id);
                          }}
                          className={`flex-shrink-0 flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wide transition-all active:scale-95 ${
                            group === 'overdue' || group === 'today'
                              ? 'bg-moss text-white shadow-lg shadow-moss/20'
                              : 'bg-moss/10 text-moss'
                          }`}
                        >
                          <Droplets size={16} />
                          Water
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
