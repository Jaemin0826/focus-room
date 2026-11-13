export const TILE_PITCH = 1
export const TILE_SIZE = 0.965
export const TILE_H = 0.15
export const GRID = 3

/** Half-extent of the floor, from the center to the outer tile edge. */
export const FLOOR_EXT = ((GRID - 1) * TILE_PITCH) / 2 + TILE_SIZE / 2

export const CUBE_SIZE = 0.56
export const WALL_H = 1.62
export const WALL_T = 0.13

export const ZOOM_MIN = 0.62
export const ZOOM_MAX = 2.6

export const TOP_COLORS = ['#7d7a94', '#736f8a'] as const
export const SIDE_COLORS = ['#564f68', '#4c4660'] as const
export const WALL_COLORS = ['#6a6782', '#58556c'] as const
