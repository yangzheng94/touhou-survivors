import React, { useState, useEffect } from 'react';
import { GameEngine } from './game/engine';
import { GameState } from './game/types';
import GameCanvas from './components/GameCanvas';
import { CHARACTERS, UPGRADES, WEAPONS, ITEMS, ENEMY_DICTIONARY } from './game/data';
import { Play, Settings, Trophy, ChevronLeft, Plus, Volume2, VolumeX, BookOpen, Pause } from 'lucide-react';
import { audio } from './game/audio';

// Initialize engine once
const engine = new GameEngine();

export default function App() {
  const [gameState, setGameState] = useState<GameState>('MENU');
  const [globalGold, setGlobalGold] = useState(0);
  const [globalUpgrades, setGlobalUpgrades] = useState<Record<string, number>>({});
  const [selectedCharId, setSelectedCharId] = useState(CHARACTERS[0].id);
  const [upgradeOptions, setUpgradeOptions] = useState<any[]>([]);
  
  // Joystick state
  const [joystickPos, setJoystickPos] = useState({ x: 0, y: 0 });
  const [joystickOrigin, setJoystickOrigin] = useState({ x: 0, y: 0 });
  const [isTouching, setIsTouching] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [compendiumTab, setCompendiumTab] = useState<'WEAPONS' | 'ITEMS' | 'ENEMIES'>('WEAPONS');

  // Load save data
  useEffect(() => {
    const saved = localStorage.getItem('touhou_survivors_save');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setGlobalGold(data.gold || 0);
        setGlobalUpgrades(data.upgrades || {});
      } catch (e) {
        console.error('Failed to load save', e);
      }
    }
  }, []);

  // Save data
  useEffect(() => {
    localStorage.setItem('touhou_survivors_save', JSON.stringify({
      gold: globalGold,
      upgrades: globalUpgrades,
    }));
  }, [globalGold, globalUpgrades]);

  // Engine callbacks
  useEffect(() => {
    engine.onLevelUp = () => {
      setUpgradeOptions(engine.getAvailableUpgrades());
      setGameState('LEVEL_UP');
    };
    engine.onGameOver = () => {
      setGlobalGold(prev => prev + engine.player.gold);
      setGameState('GAME_OVER');
      audio.stopBGM();
    };
  }, []);

  const startGame = () => {
    audio.init();
    audio.startBGM();
    engine.init(selectedCharId, globalUpgrades);
    setGameState('PLAYING');
  };

  const handleUpgradeSelect = (upgrade: any) => {
    engine.applyUpgrade(upgrade);
    setGameState('PLAYING');
  };

  const buyGlobalUpgrade = (upgradeId: string) => {
    const upgrade = UPGRADES.find(u => u.id === upgradeId);
    if (!upgrade) return;

    const currentLevel = globalUpgrades[upgradeId] || 0;
    if (currentLevel >= upgrade.maxLevel) return;

    const cost = Math.floor(upgrade.baseCost * Math.pow(upgrade.costMultiplier, currentLevel));
    if (globalGold >= cost) {
      setGlobalGold(prev => prev - cost);
      setGlobalUpgrades(prev => ({
        ...prev,
        [upgradeId]: currentLevel + 1,
      }));
    }
  };

  return (
    <div className="w-screen h-screen bg-zinc-950 text-zinc-100 font-sans overflow-hidden flex items-center justify-center">
      
      {/* GLOBAL AUDIO TOGGLE */}
      <button 
        onClick={(e) => { e.stopPropagation(); setIsMuted(audio.toggleMute()); }}
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute bottom-8 right-8 z-50 p-3 bg-zinc-900/80 backdrop-blur-md rounded-full border border-zinc-800 hover:bg-zinc-800 transition-colors"
      >
        {isMuted ? <VolumeX size={24} className="text-zinc-500" /> : <Volume2 size={24} className="text-zinc-100" />}
      </button>

      {/* MENU STATE */}
      {gameState === 'MENU' && (
        <div className="flex flex-col items-center justify-center space-y-8 animate-in fade-in zoom-in duration-500">
          <div className="text-center">
            <h1 className="text-6xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-pink-500 to-purple-500 mb-2">
              东方幸存者
            </h1>
            <p className="text-zinc-400 tracking-widest uppercase text-sm">弹幕肉鸽生存</p>
          </div>
          
          <div className="flex flex-col space-y-4 w-64">
            <button 
              onClick={() => setGameState('CHAR_SELECT')}
              className="group relative flex items-center justify-center space-x-2 bg-zinc-100 text-zinc-900 px-6 py-4 rounded-xl font-bold hover:bg-white transition-all hover:scale-105 active:scale-95"
            >
              <Play size={20} className="group-hover:translate-x-1 transition-transform" />
              <span>开始游戏</span>
            </button>
            <button 
              onClick={() => setGameState('UPGRADES')}
              className="flex items-center justify-center space-x-2 bg-zinc-800 text-zinc-100 px-6 py-4 rounded-xl font-bold hover:bg-zinc-700 transition-all hover:scale-105 active:scale-95 border border-zinc-700"
            >
              <Settings size={20} />
              <span>能力升级</span>
            </button>
            <button 
              onClick={() => setGameState('COMPENDIUM')}
              className="flex items-center justify-center space-x-2 bg-zinc-800 text-zinc-100 px-6 py-4 rounded-xl font-bold hover:bg-zinc-700 transition-all hover:scale-105 active:scale-95 border border-zinc-700"
            >
              <BookOpen size={20} />
              <span>游戏图鉴</span>
            </button>
          </div>
        </div>
      )}

      {/* CHARACTER SELECT STATE */}
      {gameState === 'CHAR_SELECT' && (
        <div className="flex flex-col items-center justify-center w-full max-w-4xl p-8">
          <h2 className="text-4xl font-black mb-8">选择角色</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full mb-8">
            {CHARACTERS.map(char => (
              <button
                key={char.id}
                onClick={() => setSelectedCharId(char.id)}
                className={`p-4 rounded-2xl border-2 transition-all text-left flex flex-col items-center
                  ${selectedCharId === char.id 
                    ? 'border-white bg-zinc-800 scale-105' 
                    : 'border-zinc-800 bg-zinc-900 hover:border-zinc-600'}`}
              >
                <div 
                  className="w-16 h-16 rounded-full mb-4 shadow-lg"
                  style={{ backgroundColor: char.color }}
                />
                <h3 className="font-bold text-lg text-center">{char.name}</h3>
                <p className="text-xs text-zinc-400 text-center mt-2 h-12">{char.description}</p>
              </button>
            ))}
          </div>

          <div className="flex space-x-4">
            <button 
              onClick={() => setGameState('MENU')}
              className="px-8 py-3 rounded-xl font-bold bg-zinc-800 hover:bg-zinc-700 transition-colors"
            >
              返回
            </button>
            <button 
              onClick={startGame}
              className="px-8 py-3 rounded-xl font-bold bg-white text-black hover:bg-zinc-200 transition-colors"
            >
              出击
            </button>
          </div>
        </div>
      )}

      {/* UPGRADES STATE */}
      {gameState === 'UPGRADES' && (
        <div className="flex flex-col w-full max-w-4xl p-8 h-full">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-4xl font-black">强化能力</h2>
            <div className="flex items-center space-x-2 bg-yellow-500/10 text-yellow-500 px-4 py-2 rounded-full font-mono font-bold">
              <Trophy size={18} />
              <span>{globalGold} 金币</span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto pr-4 pb-20">
            {UPGRADES.map(upg => {
              const currentLvl = globalUpgrades[upg.id] || 0;
              const cost = Math.floor(upg.baseCost * Math.pow(upg.costMultiplier, currentLvl));
              const isMax = currentLvl >= upg.maxLevel;
              const canAfford = globalGold >= cost && !isMax;

              return (
                <div key={upg.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-lg">{upg.name}</h3>
                    <p className="text-sm text-zinc-400 mb-2">{upg.description}</p>
                    <div className="flex space-x-1">
                      {Array.from({ length: upg.maxLevel }).map((_, i) => (
                        <div 
                          key={i} 
                          className={`w-4 h-4 rounded-sm ${i < currentLvl ? 'bg-yellow-500' : 'bg-zinc-800'}`}
                        />
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => buyGlobalUpgrade(upg.id)}
                    disabled={!canAfford || isMax}
                    className={`ml-4 px-4 py-2 rounded-xl font-bold flex items-center space-x-1 whitespace-nowrap
                      ${isMax ? 'bg-zinc-800 text-zinc-500' : 
                        canAfford ? 'bg-yellow-500 text-black hover:bg-yellow-400' : 'bg-zinc-800 text-zinc-500'}`}
                  >
                    {isMax ? '已满级' : (
                      <>
                        <Plus size={16} />
                        <span>{cost}</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="absolute bottom-8 left-8">
            <button 
              onClick={() => setGameState('MENU')}
              className="px-8 py-3 rounded-xl font-bold bg-zinc-800 hover:bg-zinc-700 transition-colors flex items-center space-x-2"
            >
              <ChevronLeft size={20} />
              <span>返回</span>
            </button>
          </div>
        </div>
      )}

      {/* COMPENDIUM STATE */}
      {gameState === 'COMPENDIUM' && (
        <div className="flex flex-col w-full max-w-4xl p-8 h-full">
          <h2 className="text-4xl font-black mb-8">游戏图鉴</h2>
          
          <div className="flex space-x-4 mb-6">
            <button 
              onClick={() => setCompendiumTab('WEAPONS')}
              className={`px-6 py-2 rounded-xl font-bold transition-colors ${compendiumTab === 'WEAPONS' ? 'bg-white text-black' : 'bg-zinc-800 hover:bg-zinc-700'}`}
            >
              武器
            </button>
            <button 
              onClick={() => setCompendiumTab('ITEMS')}
              className={`px-6 py-2 rounded-xl font-bold transition-colors ${compendiumTab === 'ITEMS' ? 'bg-white text-black' : 'bg-zinc-800 hover:bg-zinc-700'}`}
            >
              道具
            </button>
            <button 
              onClick={() => setCompendiumTab('ENEMIES')}
              className={`px-6 py-2 rounded-xl font-bold transition-colors ${compendiumTab === 'ENEMIES' ? 'bg-white text-black' : 'bg-zinc-800 hover:bg-zinc-700'}`}
            >
              敌人
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto pr-4 pb-20">
            {compendiumTab === 'WEAPONS' && Object.values(WEAPONS).map(w => (
              <div key={w.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-xl mb-4" style={{ backgroundColor: w.color }} />
                <h3 className="font-bold text-lg mb-2">{w.name}</h3>
                <p className="text-sm text-zinc-400">{w.description}</p>
              </div>
            ))}
            {compendiumTab === 'ITEMS' && Object.values(ITEMS).map(i => (
              <div key={i.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-xl mb-4" style={{ backgroundColor: i.color }} />
                <h3 className="font-bold text-lg mb-2">{i.name}</h3>
                <p className="text-sm text-zinc-400">{i.description}</p>
              </div>
            ))}
            {compendiumTab === 'ENEMIES' && ENEMY_DICTIONARY.map(e => (
              <div key={e.id} className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl flex flex-col relative overflow-hidden">
                {e.isBoss && <div className="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg">BOSS</div>}
                <div className="flex items-center space-x-4 mb-4">
                  <div className="w-12 h-12 rounded-full shrink-0" style={{ backgroundColor: e.color }} />
                  <h3 className="font-bold text-xl">{e.name}</h3>
                </div>
                <div className="space-y-2 text-sm">
                  <p><span className="text-zinc-500 font-bold">介绍：</span><span className="text-zinc-300">{e.desc}</span></p>
                  <p><span className="text-zinc-500 font-bold">攻击方式：</span><span className="text-zinc-300">{e.attack}</span></p>
                  <p><span className="text-zinc-500 font-bold">出现时间：</span><span className="text-zinc-300">{e.spawn}</span></p>
                </div>
              </div>
            ))}
          </div>

          <div className="absolute bottom-8 left-8">
            <button 
              onClick={() => setGameState('MENU')}
              className="px-8 py-3 rounded-xl font-bold bg-zinc-800 hover:bg-zinc-700 transition-colors flex items-center space-x-2"
            >
              <ChevronLeft size={20} />
              <span>返回</span>
            </button>
          </div>
        </div>
      )}

      {/* GAME CANVAS */}
      {(gameState === 'PLAYING' || gameState === 'LEVEL_UP' || gameState === 'GAME_OVER' || gameState === 'PAUSED') && (
        <div 
          className="relative w-full h-full flex items-center justify-center bg-black touch-none"
          onPointerDown={(e) => {
            if (gameState !== 'PLAYING') return;
            setIsTouching(true);
            setJoystickOrigin({ x: e.clientX, y: e.clientY });
            setJoystickPos({ x: e.clientX, y: e.clientY });
            engine.setJoystick(0, 0);
          }}
          onPointerMove={(e) => {
            if (!isTouching || gameState !== 'PLAYING') return;
            setJoystickPos({ x: e.clientX, y: e.clientY });
            const dx = e.clientX - joystickOrigin.x;
            const dy = e.clientY - joystickOrigin.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            const maxDist = 50;
            if (dist > 0) {
              engine.setJoystick(dx / Math.max(dist, maxDist), dy / Math.max(dist, maxDist));
            }
          }}
          onPointerUp={() => {
            setIsTouching(false);
            engine.setJoystick(0, 0);
          }}
          onPointerCancel={() => {
            setIsTouching(false);
            engine.setJoystick(0, 0);
          }}
        >
          <GameCanvas engine={engine} gameState={gameState} />
          
          {/* JOYSTICK OVERLAY */}
          {gameState === 'PLAYING' && isTouching && (
            <div 
              className="absolute w-24 h-24 border-2 border-white/30 rounded-full bg-white/10 pointer-events-none -translate-x-1/2 -translate-y-1/2 z-40"
              style={{ left: joystickOrigin.x, top: joystickOrigin.y }}
            >
              <div 
                className="absolute w-10 h-10 bg-white/50 rounded-full -translate-x-1/2 -translate-y-1/2"
                style={{ 
                  left: 48 + Math.max(-48, Math.min(48, joystickPos.x - joystickOrigin.x)), 
                  top: 48 + Math.max(-48, Math.min(48, joystickPos.y - joystickOrigin.y)) 
                }}
              />
            </div>
          )}

          {/* PAUSE BUTTON */}
          {gameState === 'PLAYING' && (
            <button 
              onClick={(e) => { e.stopPropagation(); setGameState('PAUSED'); }}
              onPointerDown={(e) => e.stopPropagation()}
              className="absolute bottom-8 left-8 z-40 p-3 bg-zinc-900/80 backdrop-blur-md rounded-full border border-zinc-800 hover:bg-zinc-800 transition-colors"
            >
              <Pause size={24} className="text-zinc-100" />
            </button>
          )}

          {/* PAUSE MODAL */}
          {gameState === 'PAUSED' && (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
              <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl max-w-sm w-full mx-4 text-center animate-in zoom-in duration-300">
                <h2 className="text-4xl font-black mb-8">游戏暂停</h2>
                <div className="flex flex-col space-y-4">
                  <button 
                    onClick={() => setGameState('PLAYING')}
                    className="px-8 py-4 rounded-xl font-bold bg-white text-black hover:bg-zinc-200 transition-colors text-xl"
                  >
                    继续游戏
                  </button>
                  <button 
                    onClick={() => {
                      engine.player.hp = 0;
                      if (engine.onGameOver) engine.onGameOver();
                    }}
                    className="px-8 py-4 rounded-xl font-bold bg-red-600 text-white hover:bg-red-500 transition-colors text-xl"
                  >
                    放弃游戏
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* LEVEL UP MODAL */}
          {gameState === 'LEVEL_UP' && (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
              <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl max-w-2xl w-full mx-4 animate-in slide-in-from-bottom-8 fade-in duration-300">
                <h2 className="text-4xl font-black text-center mb-8 text-yellow-500">等级提升！</h2>
                <div className="space-y-4">
                  {upgradeOptions.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => handleUpgradeSelect(opt)}
                      className="w-full text-left bg-zinc-800 hover:bg-zinc-700 p-4 rounded-2xl flex items-center space-x-4 transition-all hover:scale-[1.02]"
                    >
                      <div 
                        className="w-12 h-12 rounded-xl shrink-0"
                        style={{ backgroundColor: opt.weapon?.color || opt.item?.color || '#fff' }}
                      />
                      <div>
                        <h3 className="font-bold text-xl">
                          {opt.weapon?.name || opt.item?.name || '奖励'} 
                          {(opt.type === 'weapon_upgrade' || opt.type === 'item_upgrade') && ` (等级 ${opt.nextLevel})`}
                          {(opt.type === 'weapon_new' || opt.type === 'item_new') && ` (新)`}
                        </h3>
                        <p className="text-zinc-400">{opt.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* GAME OVER MODAL */}
          {gameState === 'GAME_OVER' && (
            <div className="absolute inset-0 bg-red-950/80 backdrop-blur-md flex items-center justify-center z-50">
              <div className="text-center animate-in zoom-in duration-500">
                <h2 className="text-7xl font-black text-red-500 mb-4">游戏结束</h2>
                <div className="bg-black/50 p-6 rounded-2xl mb-8 inline-block text-left space-y-2">
                  <p className="text-xl"><span className="text-zinc-400">达到等级:</span> {engine.player.level}</p>
                  <p className="text-xl"><span className="text-zinc-400">存活时间:</span> {Math.floor(engine.gameTime / 60)}:{Math.floor(engine.gameTime % 60).toString().padStart(2, '0')}</p>
                  <p className="text-xl"><span className="text-zinc-400">击败敌人:</span> {engine.player.kills}</p>
                  <p className="text-xl text-yellow-500 font-bold mt-4 pt-4 border-t border-zinc-800">
                    + {engine.player.gold} 金币
                  </p>
                </div>
                <br />
                <button 
                  onClick={() => {
                    audio.stopBGM();
                    setGameState('MENU');
                  }}
                  className="px-8 py-4 rounded-xl font-bold bg-white text-black hover:bg-zinc-200 transition-colors text-xl"
                >
                  返回主菜单
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
