import {
  Award,
  Baby,
  BookOpen,
  Briefcase,
  Compass,
  Cpu,
  Crown,
  Film,
  Flame,
  Globe,
  GraduationCap,
  Landmark,
  LayoutGrid,
  Lightbulb,
  Medal,
  Music,
  Package,
  PawPrint,
  Quote,
  Rocket,
  Shapes,
  Shield,
  Smile,
  Sparkles,
  Star,
  Trophy,
  Tv,
  UtensilsCrossed,
  Zap,
} from 'lucide-react';
import React from 'react';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Trophy,
  Medal,
  Film,
  Tv,
  Smile,
  Star,
  GraduationCap,
  BookOpen,
  Music,
  Landmark,
  Globe,
  Quote,
  Lightbulb,
  PawPrint,
  UtensilsCrossed,
  Briefcase,
  Package,
  Cpu,
  Crown,
  Flame,
  Zap,
  Shield,
  Rocket,
  Compass,
  Award,
  Sparkles,
  Baby,
  LayoutGrid,
  Shapes,
};

interface DynamicIconProps {
  name: string;
  className?: string;
}

export const DynamicIcon: React.FC<DynamicIconProps> = ({ name, className = 'w-5 h-5' }) => {
  const IconComp = ICON_MAP[name] ?? Star;
  return <IconComp className={className} />;
};
