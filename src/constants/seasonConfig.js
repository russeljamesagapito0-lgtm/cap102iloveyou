export const SEASON_CONFIGS = {
  philippines: {
    id: 'philippines',
    label: 'Philippines (Wet / Dry)',
    seasons: [
      { name: 'Wet Season', months: [5, 6, 7, 8, 9, 10] },
      { name: 'Dry Season', months: [11, 0, 1, 2, 3, 4] },
    ],
    firstSeason: 'Wet Season',
  },

  northern: {
    id: 'northern',
    label: 'Northern Hemisphere (Summer / Winter)',
    seasons: [
      { name: 'Summer', months: [4, 5, 6, 7, 8, 9] },   // May–Oct
      { name: 'Winter', months: [10, 11, 0, 1, 2, 3] }, // Nov–Apr
    ],
    firstSeason: 'Summer',
  },

  southern: {
    id: 'southern',
    label: 'Southern Hemisphere (Summer / Winter)',
    seasons: [
      { name: 'Summer', months: [10, 11, 0, 1, 2, 3] }, // Nov–Apr
      { name: 'Winter', months: [4, 5, 6, 7, 8, 9] },   // May–Oct
    ],
    firstSeason: 'Summer',
  },
};

export const DEFAULT_SEASON_CONFIG = SEASON_CONFIGS.philippines;

export const getSeasonConfig = (id) =>
  SEASON_CONFIGS[id] || DEFAULT_SEASON_CONFIG;