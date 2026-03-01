import { CANVAS_HEIGHT, CANVAS_WIDTH, WORLD_HEIGHT, WORLD_WIDTH, BASE_EXP_REQUIREMENT, EXP_MULTIPLIER } from './constants';
import { CHARACTERS, ITEMS, WEAPONS } from './data';
import { Character, Stats, Vector2, Weapon, Item, EnemyProjectile } from './types';
import { audio } from './audio';

export interface Entity {
  id: number;
  x: number;
  y: number;
  radius: number;
  color: string;
}

export interface Player extends Entity {
  character: Character;
  stats: Stats;
  hp: number;
  level: number;
  exp: number;
  expToNext: number;
  weapons: { weapon: Weapon; level: number; cooldownTimer: number }[];
  items: { item: Item; level: number }[];
  gold: number;
  kills: number;
  facing: Vector2;
}

export interface Enemy extends Entity {
  hp: number;
  maxHp: number;
  damage: number;
  speed: number;
  expValue: number;
  knockback: Vector2;
  enemyType?: string;
  isBoss?: boolean;
  bossType?: 'remilia' | 'yukari' | 'okina';
  attackTimer?: number;
  bossPhase?: number;
  bossPhaseTimer?: number;
  slowTimer?: number;
}

export interface Projectile extends Entity {
  weaponId: string;
  damage: number;
  speed: number;
  vx: number;
  vy: number;
  duration: number;
  piercing: number;
  hitEnemies: Set<number>;
  isMelee?: boolean;
  angle?: number;
}

export interface Drop extends Entity {
  type: 'exp' | 'health' | 'gold';
  value: number;
}

export interface DamageText {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

export class GameEngine {
  player!: Player;
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  enemyProjectiles: EnemyProjectile[] = [];
  drops: Drop[] = [];
  damageTexts: DamageText[] = [];
  
  keys: { [key: string]: boolean } = {};
  joystick: Vector2 = { x: 0, y: 0 };
  
  lastTime: number = 0;
  gameTime: number = 0;
  nextEntityId: number = 1;
  
  camera: Vector2 = { x: 0, y: 0 };
  
  onLevelUp?: () => void;
  onGameOver?: () => void;
  onStateChange?: () => void;
  
  globalUpgrades: Record<string, number> = {};
  
  spawnTimer: number = 0;
  spawnRate: number = 1; // enemies per second
  enemyStatsMultiplier: number = 1;
  lastBossSpawnMinute: number = 0;

  constructor() {
    this.setupInput();
  }

  setupInput() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.key.toLowerCase()] = true;
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.key.toLowerCase()] = false;
    });
  }

  setJoystick(x: number, y: number) {
    this.joystick.x = x;
    this.joystick.y = y;
  }

  init(characterId: string, globalUpgrades: Record<string, number>) {
    this.globalUpgrades = globalUpgrades;
    const char = CHARACTERS.find((c) => c.id === characterId) || CHARACTERS[0];
    
    // Calculate initial stats with global upgrades
    const stats: Stats = {
      maxHp: char.baseStats.maxHp || 100,
      speed: char.baseStats.speed || 150,
      damage: char.baseStats.damage || 1,
      area: char.baseStats.area || 1,
      cooldown: char.baseStats.cooldown || 1,
      magnet: char.baseStats.magnet || 50,
      armor: char.baseStats.armor || 0,
      luck: char.baseStats.luck || 1,
      amount: char.baseStats.amount || 0,
      expMultiplier: char.baseStats.expMultiplier || 1,
      lifesteal: char.baseStats.lifesteal || 0,
    };

    // Apply global upgrades
    if (globalUpgrades.maxHp) stats.maxHp *= (1 + globalUpgrades.maxHp * 0.1);
    if (globalUpgrades.damage) stats.damage += globalUpgrades.damage * 0.05;
    if (globalUpgrades.speed) stats.speed *= (1 + globalUpgrades.speed * 0.05);
    if (globalUpgrades.armor) stats.armor += globalUpgrades.armor * 1;
    if (globalUpgrades.magnet) stats.magnet *= (1 + globalUpgrades.magnet * 0.1);
    if (globalUpgrades.cooldown) stats.cooldown += globalUpgrades.cooldown * -0.025;
    if (globalUpgrades.amount) stats.amount += globalUpgrades.amount;

    this.player = {
      id: 0,
      x: WORLD_WIDTH / 2,
      y: WORLD_HEIGHT / 2,
      radius: 15,
      color: char.color,
      character: char,
      stats,
      hp: stats.maxHp,
      level: 1,
      exp: 0,
      expToNext: BASE_EXP_REQUIREMENT,
      weapons: [{ weapon: WEAPONS[char.startingWeapon], level: 1, cooldownTimer: 0 }],
      items: [],
      gold: 0,
      kills: 0,
      facing: { x: 1, y: 0 },
    };

    this.enemies = [];
    this.projectiles = [];
    this.enemyProjectiles = [];
    this.drops = [];
    this.damageTexts = [];
    this.gameTime = 0;
    this.spawnTimer = 0;
    this.spawnRate = 1;
    this.enemyStatsMultiplier = 1;
    this.lastBossSpawnMinute = 0;
    this.joystick = { x: 0, y: 0 };
    this.lastTime = performance.now();
  }

  update(currentTime: number) {
    const dt = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;
    
    // Cap dt to prevent huge jumps if tab is inactive
    const safeDt = Math.min(dt, 0.1);

    this.gameTime += safeDt;
    
    // Increase difficulty over time
    this.spawnRate = 1 + this.gameTime / 30; // +1 enemy per sec every 30s
    this.enemyStatsMultiplier = 1 + this.gameTime / 120; // +100% stats every 120s (was 60s)

    this.updatePlayer(safeDt);
    this.updateWeapons(safeDt);
    this.updateEnemies(safeDt);
    this.updateProjectiles(safeDt);
    this.updateEnemyProjectiles(safeDt);
    this.updateDrops(safeDt);
    this.updateDamageTexts(safeDt);
    this.spawnEnemies(safeDt);
    this.updateCamera();
  }

  updatePlayer(dt: number) {
    let dx = this.joystick.x;
    let dy = this.joystick.y;

    if (dx === 0 && dy === 0) {
      if (this.keys['w'] || this.keys['arrowup']) dy -= 1;
      if (this.keys['s'] || this.keys['arrowdown']) dy += 1;
      if (this.keys['a'] || this.keys['arrowleft']) dx -= 1;
      if (this.keys['d'] || this.keys['arrowright']) dx += 1;
    }

    if (dx !== 0 || dy !== 0) {
      const length = Math.sqrt(dx * dx + dy * dy);
      if (length > 1) {
        dx /= length;
        dy /= length;
      }
      this.player.facing = { 
        x: dx === 0 ? this.player.facing.x : dx / Math.abs(dx || 1), 
        y: dy === 0 ? this.player.facing.y : dy / Math.abs(dy || 1) 
      };
      // Normalize facing
      const fLen = Math.sqrt(this.player.facing.x * this.player.facing.x + this.player.facing.y * this.player.facing.y);
      if (fLen > 0) {
        this.player.facing.x /= fLen;
        this.player.facing.y /= fLen;
      }
    }

    this.player.x += dx * this.player.stats.speed * dt;
    this.player.y += dy * this.player.stats.speed * dt;

    // Clamp to world bounds
    this.player.x = Math.max(this.player.radius, Math.min(WORLD_WIDTH - this.player.radius, this.player.x));
    this.player.y = Math.max(this.player.radius, Math.min(WORLD_HEIGHT - this.player.radius, this.player.y));
  }

  updateCamera() {
    this.camera.x = this.player.x - CANVAS_WIDTH / 2;
    this.camera.y = this.player.y - CANVAS_HEIGHT / 2;
    
    // Optional: clamp camera to world bounds
    this.camera.x = Math.max(0, Math.min(WORLD_WIDTH - CANVAS_WIDTH, this.camera.x));
    this.camera.y = Math.max(0, Math.min(WORLD_HEIGHT - CANVAS_HEIGHT, this.camera.y));
  }

  updateWeapons(dt: number) {
    for (const w of this.player.weapons) {
      w.cooldownTimer -= dt;
      if (w.cooldownTimer <= 0) {
        this.fireWeapon(w);
        
        // Calculate cooldown
        let cooldown = w.weapon.baseStats.cooldown;
        for (let i = 2; i <= w.level; i++) {
          if (w.weapon.levelUpgrades[i]?.cooldown) {
            cooldown += w.weapon.levelUpgrades[i].cooldown!;
          }
        }
        cooldown *= Math.max(0.1, this.player.stats.cooldown); // Apply player cooldown stat
        
        w.cooldownTimer = cooldown;
      }
    }
  }

  fireWeapon(wState: { weapon: Weapon; level: number }) {
    const w = wState.weapon;
    let damage = w.baseStats.damage;
    let area = w.baseStats.area;
    let speed = w.baseStats.speed;
    let amount = w.baseStats.amount + this.player.stats.amount;
    let duration = w.baseStats.duration;
    let piercing = w.baseStats.piercing;

    for (let i = 2; i <= wState.level; i++) {
      const upg = w.levelUpgrades[i];
      if (!upg) continue;
      if (upg.damage) damage += upg.damage;
      if (upg.area) area += upg.area;
      if (upg.speed) speed += upg.speed;
      if (upg.amount) amount += upg.amount;
      if (upg.duration) duration += upg.duration;
      if (upg.piercing) piercing += upg.piercing;
    }

    // Apply player stats
    damage *= this.player.stats.damage;
    area *= this.player.stats.area;

    if (w.id === 'amulet') {
      // Find nearest enemies
      const targets = [...this.enemies]
        .map(e => ({ e, dist: this.dist(this.player, e) }))
        .sort((a, b) => a.dist - b.dist)
        .slice(0, amount)
        .map(t => t.e);

      for (let i = 0; i < amount; i++) {
        const target = targets[i % targets.length];
        let vx = this.player.facing.x;
        let vy = this.player.facing.y;
        
        if (target) {
          const dx = target.x - this.player.x;
          const dy = target.y - this.player.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          vx = dx / len;
          vy = dy / len;
        } else {
          // Random direction if no targets
          const angle = Math.random() * Math.PI * 2;
          vx = Math.cos(angle);
          vy = Math.sin(angle);
        }

        this.projectiles.push({
          id: this.nextEntityId++,
          x: this.player.x,
          y: this.player.y,
          radius: area,
          color: w.color,
          weaponId: w.id,
          damage,
          speed,
          vx,
          vy,
          duration,
          piercing,
          hitEnemies: new Set(),
        });
      }
    } else if (w.id === 'magic_missile') {
      for (let i = 0; i < amount; i++) {
        // Spread slightly
        const spread = (i - (amount - 1) / 2) * 0.2;
        const angle = Math.atan2(this.player.facing.y, this.player.facing.x) + spread;
        
        this.projectiles.push({
          id: this.nextEntityId++,
          x: this.player.x,
          y: this.player.y,
          radius: area,
          color: w.color,
          weaponId: w.id,
          damage,
          speed,
          vx: Math.cos(angle),
          vy: Math.sin(angle),
          duration,
          piercing,
          hitEnemies: new Set(),
        });
      }
    } else if (w.id === 'icicle') {
      for (let i = 0; i < amount; i++) {
        const angle = Math.random() * Math.PI * 2;
        this.projectiles.push({
          id: this.nextEntityId++,
          x: this.player.x,
          y: this.player.y,
          radius: area,
          color: w.color,
          weaponId: w.id,
          damage,
          speed,
          vx: Math.cos(angle),
          vy: Math.sin(angle),
          duration,
          piercing,
          hitEnemies: new Set(),
        });
      }
    } else if (w.id === 'sword') {
      const baseAngle = Math.atan2(this.player.facing.y, this.player.facing.x);
      for (let i = 0; i < amount; i++) {
        const spread = (i - (amount - 1) / 2) * 0.5;
        const angle = baseAngle + spread;
        this.projectiles.push({
          id: this.nextEntityId++,
          x: this.player.x + Math.cos(angle) * 30,
          y: this.player.y + Math.sin(angle) * 30,
          radius: area,
          color: w.color,
          weaponId: w.id,
          damage,
          speed: 0,
          vx: 0,
          vy: 0,
          duration,
          piercing,
          hitEnemies: new Set(),
          isMelee: true,
          angle: angle,
        });
      }
    } else if (w.id === 'knife') {
      const baseAngle = Math.atan2(this.player.facing.y, this.player.facing.x);
      for (let i = 0; i < amount; i++) {
        const spread = (i - (amount - 1) / 2) * 0.15;
        const angle = baseAngle + spread;
        this.projectiles.push({
          id: this.nextEntityId++,
          x: this.player.x,
          y: this.player.y,
          radius: area,
          color: w.color,
          weaponId: w.id,
          damage,
          speed,
          vx: Math.cos(angle),
          vy: Math.sin(angle),
          duration,
          piercing,
          hitEnemies: new Set(),
        });
      }
    } else if (w.id === 'master_spark') {
      const angle = Math.atan2(this.player.facing.y, this.player.facing.x);
      this.projectiles.push({
        id: this.nextEntityId++,
        x: this.player.x,
        y: this.player.y,
        radius: area * 2,
        color: w.color,
        weaponId: w.id,
        damage,
        speed: speed, // Fast moving huge circle
        vx: Math.cos(angle),
        vy: Math.sin(angle),
        duration,
        piercing,
        hitEnemies: new Set(),
      });
    } else if (w.id === 'bounce_orb') {
      for (let i = 0; i < amount; i++) {
        const spread = (i - (amount - 1) / 2) * 0.5;
        const angle = Math.atan2(this.player.facing.y, this.player.facing.x) + spread;
        this.projectiles.push({
          id: this.nextEntityId++,
          x: this.player.x,
          y: this.player.y,
          radius: area,
          color: w.color,
          weaponId: w.id,
          damage,
          speed,
          vx: Math.cos(angle),
          vy: Math.sin(angle),
          duration,
          piercing,
          hitEnemies: new Set(),
        });
      }
    } else if (w.id === 'barrier') {
      // Aura is just a projectile that stays on the player
      // Check if one already exists
      const existing = this.projectiles.find(p => p.weaponId === 'barrier');
      if (!existing) {
        this.projectiles.push({
          id: this.nextEntityId++,
          x: this.player.x,
          y: this.player.y,
          radius: area,
          color: w.color,
          weaponId: w.id,
          damage,
          speed: 0,
          vx: 0,
          vy: 0,
          duration: 999,
          piercing,
          hitEnemies: new Set(),
          isMelee: true,
        });
      } else {
        existing.duration = 999;
        existing.radius = area;
        existing.damage = damage;
        existing.hitEnemies.clear(); // Allow hitting again
      }
    }
    
    // Play shoot sound for all weapons except aura
    if (w.id !== 'barrier') {
      audio.shoot();
    }
  }

  spawnEnemies(dt: number) {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 1 / this.spawnRate;
      
      // Spawn just outside camera
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.max(CANVAS_WIDTH, CANVAS_HEIGHT) / 2 + 50;
      const x = this.player.x + Math.cos(angle) * dist;
      const y = this.player.y + Math.sin(angle) * dist;

      // Determine enemy type based on time
      let hp = 5 * this.enemyStatsMultiplier; // Reduced from 10
      let speed = 80 + Math.random() * 40;
      let damage = 5 * this.enemyStatsMultiplier;
      let radius = 12;
      let color = '#ff5555';
      let expValue = 1;
      let isBoss = false;
      let enemyType = 'bat';

      if (this.gameTime > 180 && Math.random() < 0.15) {
        // Shooters
        hp = 15 * this.enemyStatsMultiplier;
        speed = 40;
        color = '#ffff55';
        radius = 14;
        expValue = 2;
        enemyType = 'shooter';
      } else if (this.gameTime > 360 && Math.random() < 0.1) {
        // Elite Shooters
        hp = 40 * this.enemyStatsMultiplier;
        speed = 50;
        color = '#ffaa00';
        radius = 16;
        expValue = 4;
        enemyType = 'elite_shooter';
      } else if (this.gameTime > 60 && Math.random() < 0.2) {
        // Fast enemies
        hp = 3 * this.enemyStatsMultiplier; // Reduced from 5
        speed = 150;
        color = '#55ff55';
        radius = 8;
        enemyType = 'fairy';
      } else if (this.gameTime > 120 && Math.random() < 0.1) {
        // Tank enemies
        hp = 25 * this.enemyStatsMultiplier; // Reduced from 50
        speed = 50;
        color = '#5555ff';
        radius = 18;
        expValue = 3;
        enemyType = 'ghost';
      }

      // Boss every 3 minutes
      const currentMinute = Math.floor(this.gameTime / 60);
      if (currentMinute > 0 && currentMinute % 3 === 0 && this.lastBossSpawnMinute !== currentMinute) {
        this.lastBossSpawnMinute = currentMinute;
        hp = 500 * this.enemyStatsMultiplier * (currentMinute / 3);
        speed = 60;
        damage = 20 * this.enemyStatsMultiplier;
        radius = 30;
        expValue = 100 * (currentMinute / 3);
        isBoss = true;

        let bossType: 'remilia' | 'yukari' | 'okina' = 'remilia';
        if (currentMinute === 3) { bossType = 'remilia'; color = '#ff0000'; }
        else if (currentMinute === 6) { bossType = 'yukari'; color = '#aa00ff'; }
        else { bossType = 'okina'; color = '#ffaa00'; }

        this.enemies.push({
          id: this.nextEntityId++,
          x,
          y,
          radius,
          color,
          hp,
          maxHp: hp,
          damage,
          speed,
          expValue,
          knockback: { x: 0, y: 0 },
          enemyType: 'boss',
          isBoss,
          bossType,
          attackTimer: 2,
          bossPhase: 0,
          bossPhaseTimer: 5,
        });
        return; // Don't spawn regular enemy this frame
      }

      this.enemies.push({
        id: this.nextEntityId++,
        x,
        y,
        radius,
        color,
        hp,
        maxHp: hp,
        damage,
        speed,
        expValue,
        knockback: { x: 0, y: 0 },
        enemyType,
        isBoss,
      });
    }
  }

  updateEnemies(dt: number) {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      
      // Boss AI
      if (e.isBoss && e.bossType) {
        e.bossPhaseTimer! -= dt;
        if (e.bossPhaseTimer! <= 0) {
          e.bossPhase = ((e.bossPhase || 0) + 1) % 2;
          e.bossPhaseTimer = 5; // Switch phase every 5 seconds
        }

        e.attackTimer! -= dt;
        if (e.attackTimer! <= 0) {
          if (e.bossType === 'remilia') {
            if (e.bossPhase === 0) {
              e.attackTimer = 1.5;
              // Spawn 16 bullets in circle
              for(let j=0; j<16; j++) {
                const angle = (j / 16) * Math.PI * 2;
                this.enemyProjectiles.push({
                  id: this.nextEntityId++, x: e.x, y: e.y, radius: 8, color: '#ff0000',
                  damage: e.damage, speed: 200, vx: Math.cos(angle), vy: Math.sin(angle), duration: 5, shape: 'star'
                });
              }
            } else {
              e.attackTimer = 0.5;
              // Targeted shotgun
              const angle = Math.atan2(this.player.y - e.y, this.player.x - e.x);
              for(let j=-1; j<=1; j++) {
                const a = angle + j * 0.15;
                this.enemyProjectiles.push({
                  id: this.nextEntityId++, x: e.x, y: e.y, radius: 6, color: '#ff5555',
                  damage: e.damage, speed: 300, vx: Math.cos(a), vy: Math.sin(a), duration: 3, shape: 'diamond'
                });
              }
            }
          } else if (e.bossType === 'yukari') {
            if (e.bossPhase === 0) {
              e.attackTimer = 0.8;
              // Spiral bullets
              const timeOffset = this.gameTime * 2;
              for(let j=0; j<4; j++) {
                const a = (j / 4) * Math.PI * 2 + timeOffset;
                this.enemyProjectiles.push({
                  id: this.nextEntityId++, x: e.x, y: e.y, radius: 10, color: '#aa00ff',
                  damage: e.damage, speed: 180, vx: Math.cos(a), vy: Math.sin(a), duration: 6, shape: 'circle'
                });
              }
            } else {
              e.attackTimer = 3;
              // Teleport and 8-way lasers
              const angle = Math.random() * Math.PI * 2;
              e.x = this.player.x + Math.cos(angle) * 150;
              e.y = this.player.y + Math.sin(angle) * 150;
              for(let j=0; j<8; j++) {
                const a = (j / 8) * Math.PI * 2;
                this.enemyProjectiles.push({
                  id: this.nextEntityId++, x: e.x, y: e.y, radius: 12, color: '#ff00ff',
                  damage: e.damage, speed: 250, vx: Math.cos(a), vy: Math.sin(a), duration: 5, shape: 'diamond'
                });
              }
            }
          } else if (e.bossType === 'okina') {
            if (e.bossPhase === 0) {
              e.attackTimer = 2;
              // Door lasers (fast bullets sweeping)
              const pAngle = Math.atan2(this.player.y - e.y, this.player.x - e.x);
              for(let j=-3; j<=3; j++) {
                const a = pAngle + j * 0.15;
                this.enemyProjectiles.push({
                  id: this.nextEntityId++, x: e.x, y: e.y, radius: 12, color: '#ffaa00',
                  damage: e.damage, speed: 350, vx: Math.cos(a), vy: Math.sin(a), duration: 4, shape: 'star'
                });
              }
            } else {
              e.attackTimer = 1;
              // Ring closing in
              const pAngle = Math.atan2(this.player.y - e.y, this.player.x - e.x);
              for(let j=0; j<8; j++) {
                const a = pAngle + (j / 8) * Math.PI * 2;
                this.enemyProjectiles.push({
                  id: this.nextEntityId++, x: e.x, y: e.y, radius: 8, color: '#ffff00',
                  damage: e.damage, speed: 150, vx: Math.cos(a), vy: Math.sin(a), duration: 6, shape: 'circle'
                });
              }
            }
          }
        }
      }
      
      // Shooter AI
      let isShooting = false;
      if (e.enemyType === 'shooter' || e.enemyType === 'elite_shooter') {
        const distToPlayer = this.dist(this.player, e);
        if (distToPlayer < 250) {
          isShooting = true;
          e.attackTimer = (e.attackTimer || 0) - dt;
          if (e.attackTimer <= 0) {
            e.attackTimer = e.enemyType === 'elite_shooter' ? 1.5 : 2.5;
            const angle = Math.atan2(this.player.y - e.y, this.player.x - e.x);
            
            if (e.enemyType === 'elite_shooter') {
              for(let j=-1; j<=1; j++) {
                const a = angle + j * 0.2;
                this.enemyProjectiles.push({
                  id: this.nextEntityId++, x: e.x, y: e.y, radius: 8, color: e.color,
                  damage: e.damage, speed: 180, vx: Math.cos(a), vy: Math.sin(a), duration: 4, shape: 'diamond'
                });
              }
            } else {
              this.enemyProjectiles.push({
                id: this.nextEntityId++, x: e.x, y: e.y, radius: 6, color: e.color,
                damage: e.damage, speed: 150, vx: Math.cos(angle), vy: Math.sin(angle), duration: 4, shape: 'diamond'
              });
            }
          }
        }
      }
      
      // Apply knockback
      if (e.knockback.x !== 0 || e.knockback.y !== 0) {
        e.x += e.knockback.x * dt;
        e.y += e.knockback.y * dt;
        e.knockback.x *= 0.9;
        e.knockback.y *= 0.9;
        if (Math.abs(e.knockback.x) < 1) e.knockback.x = 0;
        if (Math.abs(e.knockback.y) < 1) e.knockback.y = 0;
      } else if (!isShooting) {
        // Move towards player
        const dx = this.player.x - e.x;
        const dy = this.player.y - e.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > 0) {
          // Apply slow effect
          let currentSpeed = e.speed;
          if (e.slowTimer && e.slowTimer > 0) {
            e.slowTimer -= dt;
            currentSpeed *= 0.3; // 70% slow
          }
          
          e.x += (dx / dist) * currentSpeed * dt;
          e.y += (dy / dist) * currentSpeed * dt;
        }
      }

      // Collision with player
      const distToPlayer = this.dist(this.player, e);
      if (distToPlayer < this.player.radius + e.radius) {
        // Take damage
        const actualDamage = Math.max(1, e.damage - this.player.stats.armor);
        this.player.hp -= actualDamage * dt; // Continuous damage while touching
        
        if (this.player.hp <= 0 && this.onGameOver) {
          this.onGameOver();
        }
      }

      // Despawn if too far
      if (distToPlayer > Math.max(CANVAS_WIDTH, CANVAS_HEIGHT) * 1.5) {
        this.enemies.splice(i, 1);
      }
    }
  }

  updateEnemyProjectiles(dt: number) {
    for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
      const p = this.enemyProjectiles[i];
      p.duration -= dt;
      if (p.duration <= 0) {
        this.enemyProjectiles.splice(i, 1);
        continue;
      }
      p.x += p.vx * p.speed * dt;
      p.y += p.vy * p.speed * dt;

      if (this.dist(p, this.player) < p.radius + this.player.radius) {
        const actualDamage = Math.max(1, p.damage - this.player.stats.armor);
        this.player.hp -= actualDamage;
        this.enemyProjectiles.splice(i, 1);
        if (this.player.hp <= 0 && this.onGameOver) {
          this.onGameOver();
        }
      }
    }
  }

  updateProjectiles(dt: number) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.duration -= dt;
      
      if (p.duration <= 0) {
        this.projectiles.splice(i, 1);
        continue;
      }

      if (p.isMelee) {
        if (p.weaponId === 'barrier') {
          p.x = this.player.x;
          p.y = this.player.y;
        } else if (p.weaponId === 'sword') {
          p.x = this.player.x + Math.cos(p.angle!) * 30;
          p.y = this.player.y + Math.sin(p.angle!) * 30;
        }
      } else {
        p.x += p.vx * p.speed * dt;
        p.y += p.vy * p.speed * dt;
      }

      // Collision with enemies
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const e = this.enemies[j];
        if (p.hitEnemies.has(e.id)) continue;

        if (this.dist(p, e) < p.radius + e.radius) {
          e.hp -= p.damage;
          p.hitEnemies.add(e.id);
          
          audio.hit();
          
          // Add damage text
          this.damageTexts.push({
            id: this.nextEntityId++,
            x: e.x + (Math.random() - 0.5) * 20,
            y: e.y - 10,
            text: Math.floor(p.damage).toString(),
            color: '#ffffff',
            life: 0.5,
            maxLife: 0.5,
          });

          // Knockback or Slow
          if (p.weaponId === 'sword') {
            const dx = e.x - (p.isMelee ? this.player.x : p.x);
            const dy = e.y - (p.isMelee ? this.player.y : p.y);
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 0) {
              e.knockback.x = (dx / dist) * 150;
              e.knockback.y = (dy / dist) * 150;
            }
          } else {
            e.slowTimer = 0.5; // Apply slow for 0.5 seconds
          }

          // Lifesteal
          if (this.player.stats.lifesteal > 0 && Math.random() < this.player.stats.lifesteal) {
            this.player.hp = Math.min(this.player.stats.maxHp, this.player.hp + 1);
          }

          p.piercing--;

          if (e.hp <= 0) {
            this.player.kills++;
            this.spawnDrop(e.x, e.y, e.expValue, e.isBoss);
            this.enemies.splice(j, 1);
          }

          if (p.piercing <= 0) {
            this.projectiles.splice(i, 1);
            break; // Projectile destroyed, stop checking enemies
          } else if (p.weaponId === 'bounce_orb') {
            // Find next closest enemy to bounce to
            let closest = null;
            let minDist = Infinity;
            for (const other of this.enemies) {
              if (other.id === e.id || p.hitEnemies.has(other.id)) continue;
              const d = this.dist(p, other);
              if (d < minDist) { minDist = d; closest = other; }
            }
            if (closest) {
              const bdx = closest.x - p.x;
              const bdy = closest.y - p.y;
              const blen = Math.sqrt(bdx * bdx + bdy * bdy);
              if (blen > 0) {
                p.vx = bdx / blen;
                p.vy = bdy / blen;
              }
            }
          }
        }
      }
    }
  }

  spawnDrop(x: number, y: number, expValue: number, isBoss: boolean = false) {
    this.drops.push({
      id: this.nextEntityId++,
      x,
      y,
      radius: isBoss ? 10 : 4,
      color: isBoss ? '#ff00ff' : '#00aaff',
      type: 'exp',
      value: expValue,
    });

    if (isBoss || Math.random() < 0.05 * this.player.stats.luck) {
      this.drops.push({
        id: this.nextEntityId++,
        x: x + 10,
        y: y + 10,
        radius: 6,
        color: '#ffaa00',
        type: 'gold',
        value: isBoss ? 100 : 10,
      });
    }

    if (Math.random() < 0.01 * this.player.stats.luck) {
      this.drops.push({
        id: this.nextEntityId++,
        x: x - 10,
        y: y - 10,
        radius: 8,
        color: '#00ff00',
        type: 'health',
        value: 30,
      });
    }
  }

  updateDrops(dt: number) {
    const magnetRange = this.player.stats.magnet;
    
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      const dist = this.dist(this.player, d);
      
      if (dist < magnetRange) {
        // Move towards player
        const dx = this.player.x - d.x;
        const dy = this.player.y - d.y;
        d.x += (dx / dist) * 300 * dt;
        d.y += (dy / dist) * 300 * dt;
        
        if (dist < this.player.radius + d.radius) {
          // Collect
          audio.exp();
          if (d.type === 'exp') {
            this.addExp(d.value);
          } else if (d.type === 'gold') {
            this.player.gold += d.value;
          } else if (d.type === 'health') {
            this.player.hp = Math.min(this.player.stats.maxHp, this.player.hp + d.value);
          }
          this.drops.splice(i, 1);
        }
      }
    }
  }

  updateDamageTexts(dt: number) {
    for (let i = this.damageTexts.length - 1; i >= 0; i--) {
      const t = this.damageTexts[i];
      t.life -= dt;
      t.y -= 20 * dt; // Float up
      if (t.life <= 0) {
        this.damageTexts.splice(i, 1);
      }
    }
  }

  addExp(amount: number) {
    this.player.exp += amount * this.player.stats.expMultiplier;
    if (this.player.exp >= this.player.expToNext) {
      this.player.exp -= this.player.expToNext;
      this.player.level++;
      this.player.expToNext = Math.floor(this.player.expToNext * EXP_MULTIPLIER);
      
      audio.levelUp();
      
      // Trigger level up
      if (this.onLevelUp) {
        // Clear keys so player doesn't keep moving
        this.keys = {};
        this.onLevelUp();
      }
    }
    if (this.onStateChange) this.onStateChange();
  }

  dist(a: { x: number; y: number }, b: { x: number; y: number }) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  getAvailableUpgrades() {
    const options: any[] = [];
    
    // Check weapons
    for (const w of this.player.weapons) {
      if (w.level < w.weapon.maxLevel) {
        options.push({
          type: 'weapon_upgrade',
          weapon: w.weapon,
          nextLevel: w.level + 1,
          description: w.weapon.levelUpgrades[w.level + 1]?.description || 'Upgrade',
        });
      }
    }

    // Check items
    for (const i of this.player.items) {
      if (i.level < i.item.maxLevel) {
        options.push({
          type: 'item_upgrade',
          item: i.item,
          nextLevel: i.level + 1,
          description: i.item.statModifiers[i.level + 1]?.description || 'Upgrade',
        });
      }
    }

    // New weapons (if < 6 slots)
    if (this.player.weapons.length < 6) {
      const availableWeapons = Object.values(WEAPONS).filter(
        w => !this.player.weapons.some(pw => pw.weapon.id === w.id)
      );
      for (const w of availableWeapons) {
        options.push({
          type: 'weapon_new',
          weapon: w,
          description: w.description,
        });
      }
    }

    // New items (if < 6 slots)
    if (this.player.items.length < 6) {
      const availableItems = Object.values(ITEMS).filter(
        i => !this.player.items.some(pi => pi.item.id === i.id)
      );
      for (const i of availableItems) {
        options.push({
          type: 'item_new',
          item: i,
          description: i.description,
        });
      }
    }

    // Shuffle and pick 3
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }

    // Fallback if fully upgraded
    if (options.length === 0) {
      return [
        { type: 'heal', description: '恢复 30 点生命值' },
        { type: 'gold', description: '获得 50 金币' }
      ];
    }

    return options.slice(0, 3);
  }

  applyUpgrade(upgrade: any) {
    if (upgrade.type === 'weapon_upgrade') {
      const w = this.player.weapons.find(pw => pw.weapon.id === upgrade.weapon.id);
      if (w) w.level++;
    } else if (upgrade.type === 'weapon_new') {
      this.player.weapons.push({ weapon: upgrade.weapon, level: 1, cooldownTimer: 0 });
    } else if (upgrade.type === 'item_upgrade') {
      const i = this.player.items.find(pi => pi.item.id === upgrade.item.id);
      if (i) {
        i.level++;
        this.recalculateStats();
      }
    } else if (upgrade.type === 'item_new') {
      this.player.items.push({ item: upgrade.item, level: 1 });
      this.recalculateStats();
    } else if (upgrade.type === 'heal') {
      this.player.hp = Math.min(this.player.stats.maxHp, this.player.hp + 30);
    } else if (upgrade.type === 'gold') {
      this.player.gold += 50;
    }
  }

  recalculateStats() {
    // Reset to base + global
    const char = this.player.character;
    const stats: Stats = {
      maxHp: char.baseStats.maxHp || 100,
      speed: char.baseStats.speed || 150,
      damage: char.baseStats.damage || 1,
      area: char.baseStats.area || 1,
      cooldown: char.baseStats.cooldown || 1,
      magnet: char.baseStats.magnet || 50,
      armor: char.baseStats.armor || 0,
      luck: char.baseStats.luck || 1,
      amount: char.baseStats.amount || 0,
      expMultiplier: char.baseStats.expMultiplier || 1,
      lifesteal: char.baseStats.lifesteal || 0,
    };

    if (this.globalUpgrades.maxHp) stats.maxHp *= (1 + this.globalUpgrades.maxHp * 0.1);
    if (this.globalUpgrades.damage) stats.damage += this.globalUpgrades.damage * 0.05;
    if (this.globalUpgrades.speed) stats.speed *= (1 + this.globalUpgrades.speed * 0.05);
    if (this.globalUpgrades.armor) stats.armor += this.globalUpgrades.armor * 1;
    if (this.globalUpgrades.magnet) stats.magnet *= (1 + this.globalUpgrades.magnet * 0.1);
    if (this.globalUpgrades.cooldown) stats.cooldown += this.globalUpgrades.cooldown * -0.025;
    if (this.globalUpgrades.amount) stats.amount += this.globalUpgrades.amount;

    // Apply items
    for (const i of this.player.items) {
      for (let lvl = 1; lvl <= i.level; lvl++) {
        const mods = i.item.statModifiers[lvl];
        if (!mods) continue;
        if (mods.maxHp) stats.maxHp += mods.maxHp;
        if (mods.speed) stats.speed += mods.speed;
        if (mods.damage) stats.damage += mods.damage;
        if (mods.area) stats.area += mods.area;
        if (mods.cooldown) stats.cooldown += mods.cooldown;
        if (mods.magnet) stats.magnet += mods.magnet;
        if (mods.armor) stats.armor += mods.armor;
        if (mods.luck) stats.luck += mods.luck;
        if (mods.amount) stats.amount += mods.amount;
        if (mods.expMultiplier) stats.expMultiplier += mods.expMultiplier;
        if (mods.lifesteal) stats.lifesteal += mods.lifesteal;
      }
    }

    // Keep current HP within bounds
    const oldMax = this.player.stats.maxHp;
    this.player.stats = stats;
    if (stats.maxHp > oldMax) {
      this.player.hp += (stats.maxHp - oldMax);
    }
    this.player.hp = Math.min(this.player.hp, stats.maxHp);
  }
}
