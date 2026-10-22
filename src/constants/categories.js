import {
  Construction,
  Trash2,
  MapPin,
} from 'lucide-react';

export const CATEGORY_ALIASES = {
  ROAD_DAMAGE: 'ROAD_DAMAGED',
};

export const CATEGORY_META = {
  ROAD_DAMAGED: {
    label: 'Road Damaged',
    icon: Construction,
  },

  GARBAGE: {
    label: 'Garbage',
    icon: Trash2,
  },

  GOOD_ROAD: {
    label: 'Good Road',
    icon: Construction,
  },

  OTHER: {
    label: 'Other',
    icon: MapPin,
  },
};

export const normalizeCategory = (category) => {
  return CATEGORY_ALIASES[category] || category;
};

export const getCategoryMeta = (category) => {
  const normalizedCategory =
    normalizeCategory(category);

  return (
    CATEGORY_META[normalizedCategory] || {
      label: category || 'Unknown',
      icon: MapPin,
    }
  );
};

export const getCategoryIcon = (category) => {
  return getCategoryMeta(category).icon;
};

export const getCategoryLabel = (category) => {
  return getCategoryMeta(category).label;
};