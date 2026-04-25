import { Sprout, CalendarDays, Settings } from 'lucide-react';

export type Tab = 'garden' | 'calendar' | 'settings';

interface BottomNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const tabs: { id: Tab; label: string; Icon: React.FC<{ size?: number; className?: string }> }[] = [
  { id: 'garden', label: 'Garden', Icon: Sprout },
  { id: 'calendar', label: 'Calendar', Icon: CalendarDays },
  { id: 'settings', label: 'Settings', Icon: Settings },
];

export default function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav
      id="bottom-nav"
      aria-label="Main navigation"
      className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-t border-moss/10"
    >
      <div className="max-w-md mx-auto flex items-center justify-around">
        {tabs.map(({ id, label, Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              id={`nav-tab-${id}`}
              aria-label={label}
              aria-selected={isActive}
              onClick={() => onTabChange(id)}
              className={`relative flex flex-col items-center justify-center gap-1 py-3 flex-1 transition-all duration-200 ${
                isActive ? 'text-moss' : 'text-stone/40 hover:text-stone/70'
              }`}
            >
              <Icon
                size={22}
                className={`transition-all duration-200 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.5]'}`}
              />
              <span
                className={`text-[10px] font-bold uppercase tracking-widest transition-all duration-200 ${
                  isActive ? 'text-moss' : 'text-stone/40'
                }`}
              >
                {label}
              </span>
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-[2.5px] rounded-full bg-moss" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
