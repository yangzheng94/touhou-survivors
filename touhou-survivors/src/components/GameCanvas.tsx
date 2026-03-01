import React, { useEffect, useRef } from 'react';
import { GameEngine } from '../game/engine';
import { CANVAS_WIDTH, CANVAS_HEIGHT, TILE_SIZE } from '../game/constants';
import { GameState } from '../game/types';

interface Props {
  engine: GameEngine;
  gameState: GameState;
}

export default function GameCanvas({ engine, gameState }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const render = (time: number) => {
      if (gameState === 'PLAYING') {
        engine.update(time);
      } else {
        // Just update lastTime so delta time doesn't spike when unpausing
        engine.lastTime = time;
      }

      // Clear screen
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Draw grid (background)
      ctx.save();
      ctx.translate(-engine.camera.x, -engine.camera.y);

      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      
      const startX = Math.floor(engine.camera.x / TILE_SIZE) * TILE_SIZE;
      const startY = Math.floor(engine.camera.y / TILE_SIZE) * TILE_SIZE;
      const endX = startX + CANVAS_WIDTH + TILE_SIZE;
      const endY = startY + CANVAS_HEIGHT + TILE_SIZE;

      ctx.beginPath();
      for (let x = startX; x <= endX; x += TILE_SIZE) {
        ctx.moveTo(x, startY);
        ctx.lineTo(x, endY);
      }
      for (let y = startY; y <= endY; y += TILE_SIZE) {
        ctx.moveTo(startX, y);
        ctx.lineTo(endX, y);
      }
      ctx.stroke();

      // Draw drops
      for (const d of engine.drops) {
        ctx.fillStyle = d.color;
        ctx.beginPath();
        if (d.type === 'exp') {
          ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2);
        } else if (d.type === 'gold') {
          ctx.rect(d.x - d.radius, d.y - d.radius, d.radius * 2, d.radius * 2);
        } else {
          // Health cross
          ctx.fillRect(d.x - d.radius, d.y - d.radius/3, d.radius*2, d.radius*2/3);
          ctx.fillRect(d.x - d.radius/3, d.y - d.radius, d.radius*2/3, d.radius*2);
        }
        ctx.fill();
      }

      // Draw enemies
      for (const e of engine.enemies) {
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // HP bar for boss
        if (e.isBoss) {
          ctx.fillStyle = '#f00';
          ctx.fillRect(e.x - 20, e.y - e.radius - 10, 40, 5);
          ctx.fillStyle = '#0f0';
          ctx.fillRect(e.x - 20, e.y - e.radius - 10, 40 * (e.hp / e.maxHp), 5);
        }
      }

      // Draw player
      ctx.fillStyle = engine.player.color;
      ctx.beginPath();
      ctx.arc(engine.player.x, engine.player.y, engine.player.radius, 0, Math.PI * 2);
      ctx.fill();

      // Draw player facing direction
      ctx.strokeStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(engine.player.x, engine.player.y);
      ctx.lineTo(engine.player.x + engine.player.facing.x * 20, engine.player.y + engine.player.facing.y * 20);
      ctx.stroke();

      // Draw projectiles
      for (const p of engine.projectiles) {
        if (p.weaponId === 'master_spark') {
          // Draw a thick laser beam
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.radius;
          ctx.lineCap = 'round';
          ctx.globalAlpha = 0.8;
          ctx.beginPath();
          ctx.moveTo(p.x - p.vx * 100, p.y - p.vy * 100);
          ctx.lineTo(p.x + p.vx * 100, p.y + p.vy * 100);
          ctx.stroke();
          ctx.globalAlpha = 1.0;
        } else {
          ctx.fillStyle = p.weaponId === 'barrier' ? p.color + '44' : p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fill();
          if (p.weaponId === 'barrier') {
            ctx.strokeStyle = p.color;
            ctx.lineWidth = 2;
            ctx.stroke();
          }
        }
      }

      // Draw enemy projectiles
      for (const p of engine.enemyProjectiles) {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        if (p.shape === 'star') {
          for (let i = 0; i < 5; i++) {
            ctx.lineTo(p.x + Math.cos((18 + i * 72) / 180 * Math.PI) * p.radius, p.y - Math.sin((18 + i * 72) / 180 * Math.PI) * p.radius);
            ctx.lineTo(p.x + Math.cos((54 + i * 72) / 180 * Math.PI) * (p.radius/2), p.y - Math.sin((54 + i * 72) / 180 * Math.PI) * (p.radius/2));
          }
          ctx.closePath();
        } else if (p.shape === 'diamond') {
          ctx.moveTo(p.x, p.y - p.radius);
          ctx.lineTo(p.x + p.radius, p.y);
          ctx.lineTo(p.x, p.y + p.radius);
          ctx.lineTo(p.x - p.radius, p.y);
          ctx.closePath();
        } else {
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Draw damage texts
      ctx.font = '14px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      for (const t of engine.damageTexts) {
        ctx.fillStyle = t.color;
        ctx.globalAlpha = t.life / t.maxLife;
        ctx.fillText(t.text, t.x, t.y);
        ctx.globalAlpha = 1;
      }

      ctx.restore();

      // Draw UI (HUD)
      // HP Bar
      ctx.fillStyle = '#333';
      ctx.fillRect(20, 20, 200, 20);
      ctx.fillStyle = '#f00';
      ctx.fillRect(20, 20, 200 * Math.max(0, engine.player.hp / engine.player.stats.maxHp), 20);
      ctx.fillStyle = '#fff';
      ctx.font = '12px "Inter", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`HP: ${Math.floor(engine.player.hp)} / ${Math.floor(engine.player.stats.maxHp)}`, 25, 34);

      // EXP Bar
      ctx.fillStyle = '#333';
      ctx.fillRect(0, 0, CANVAS_WIDTH, 10);
      ctx.fillStyle = '#0af';
      ctx.fillRect(0, 0, CANVAS_WIDTH * (engine.player.exp / engine.player.expToNext), 10);

      // Level, Time, Gold, Kills
      ctx.fillStyle = '#fff';
      ctx.font = '16px "Inter", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`Level: ${engine.player.level}`, CANVAS_WIDTH - 20, 30);
      ctx.fillText(`Gold: ${engine.player.gold}`, CANVAS_WIDTH - 20, 50);
      ctx.fillText(`Kills: ${engine.player.kills}`, CANVAS_WIDTH - 20, 70);
      
      const mins = Math.floor(engine.gameTime / 60);
      const secs = Math.floor(engine.gameTime % 60);
      ctx.textAlign = 'center';
      ctx.font = '24px "JetBrains Mono", monospace';
      ctx.fillText(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`, CANVAS_WIDTH / 2, 40);

      // Draw weapons and items icons
      let slotX = 20;
      for (const w of engine.player.weapons) {
        ctx.fillStyle = w.weapon.color;
        ctx.fillRect(slotX, 50, 24, 24);
        ctx.fillStyle = '#fff';
        ctx.font = '10px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`Lv${w.level}`, slotX + 12, 85);
        slotX += 30;
      }
      
      slotX = 20;
      for (const i of engine.player.items) {
        ctx.fillStyle = i.item.color;
        ctx.fillRect(slotX, 100, 24, 24);
        ctx.fillStyle = '#fff';
        ctx.font = '10px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`Lv${i.level}`, slotX + 12, 135);
        slotX += 30;
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [engine, gameState]);

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      className="bg-black w-full h-full object-contain"
    />
  );
}
