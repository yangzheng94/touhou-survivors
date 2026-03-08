export type GameState = 'MENU' | 'CHAR_SELECT' | 'PLAYING' | 'LEVEL_UP' | 'GAME_OVER' | 'VICTORY' | 'UPGRADES' | 'PAUSED' | 'COMPENDIUM';

export interface Vector2 {
  x: number;
  y: number;
}

export interface Stats {
  maxHp: number;
  speed: number;
  damage: number;
  area: number;
  cooldown: number;
  magnet: number;
  armor: number;
  luck: number;
  amount: number;
  expMultiplier: number;
  lifesteal: number;
}

export interface Character {
  id: string;
  name: string;
  description: string;
  color: string;
  baseStats: Partial<Stats>;
  startingWeapon: string;
}

export interface Weapon {
  id: string;
  name: string;
  description: string;
  maxLevel: number;
  color: string;
  type: 'projectile' | 'melee' | 'aura';
  baseStats: {
    damage: number;
    cooldown: number;
    area: number;
    speed: number;
    amount: number;
    duration: number;
    piercing: number;
  };
  levelUpgrades: {
    [level: number]: Partial<{
      damage: number;
      cooldown: number;
      area: number;
      speed: number;
      amount: number;
      duration: number;
      piercing: number;
      description: string;
    }>;
  };
}

export interface Item {
  id: string;
  name: string;
  description: string;
  maxLevel: number;
  color: string;
  statModifiers: {
    [level: number]: Partial<Stats> & { description: string };
  };
}

export interface Upgrade {
  id: keyof Stats;
  name: string;
  description: string;
  maxLevel: number;
  baseCost: number;
  costMultiplier: number;
  statIncrease: number;
}

export interface Entity {
  id: number;
  x: number;
  y: number;
  radius: number;
  color: string;
}

export interface EnemyProjectile extends Entity {
  damage: number;
  speed: number;
  vx: number;
  vy: number;
  duration: number;
  shape?: 'circle' | 'star' | 'diamond';
}
