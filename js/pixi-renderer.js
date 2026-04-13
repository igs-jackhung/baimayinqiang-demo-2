// =====================================================
// White Horse Silver Spear - pixi-renderer.js (PixiJS v7)
// Rendering layer: all visual output, animations, effects
// Listens to GameLogic events. Never touches game logic.
// =====================================================

// PixiJS UMD version loaded via <script> tag (window.PIXI)
const PIXI = window.PIXI;
import { SYMS, WILD_IMG, ROWS, COLS, state, spd } from './game-logic.js';

// �w�w Try to load pixi-filters for GlowFilter �w�w�w�w�w�w�w�w�w�w
// pixi-filters v5 �~���s���e�� 404�A�b�������ϥΤ��� ColorMatrixPulse
let GlowFilter = null;

// �w�w Constants �w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w
const CELL_W = 112;
const CELL_H = 112;
const CELL_GAP = 6;
const BOARD_PAD = 14;
const BOARD_W = COLS * CELL_W + (COLS - 1) * CELL_GAP + BOARD_PAD * 2;
const BOARD_H = ROWS * CELL_H + (ROWS - 1) * CELL_GAP + BOARD_PAD * 2;

const COLOR = {
  bg:     0x0a0c1c,
  cellBg: 0x111428,
  border: 0x44476a,
  gold:   0xf5c842,
  cyan:   0x00d4ff,
  green:  0x44ff66,
  purple: 0xd080ff,
  red:    0xff5050,
  wild:   0x221000,
};

// �w�w Easing library �w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w
const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
const easeOutBack  = t => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
const easeInCubic  = t => t * t * t;

// �w�w Tween helper (PixiJS Ticker) �w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w
function tween(app, { from, to, duration, easing = t => t, onUpdate, onComplete }) {
  return new Promise(resolve => {
    const start = performance.now();
    const tick = () => {
      const elapsed = performance.now() - start;
      const t = Math.min(elapsed / duration, 1);
      onUpdate(from + (to - from) * easing(t));
      if (t >= 1) {
        app.ticker.remove(tick);
        if (onComplete) onComplete();
        resolve();
      }
    };
    app.ticker.add(tick);
  });
}

// �w�w Column-staggered drop helper �w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w
function staggeredDrop(app, sprites, fromY, dur, anticipationCols = new Set(), pixiRenderer = null, customDelays = null, customAccelerateTimes = null, targetGrid = null, onReelStop = null) {
  const promises = [];
  const globalStart = performance.now();
  const stoppedCols = new Set();

  for (let c = 0; c < COLS; c++) {
    const isAnticipating = anticipationCols.has(c);
    const delay = customDelays ? customDelays[c] : (isAnticipating ? (app.ticker.speed > 1.5 ? 600 : 2000) : c * 50); 
    const accTime = (customAccelerateTimes && customAccelerateTimes[c] !== undefined) ? customAccelerateTimes[c] : (delay - 2000);

    let spinContainer = null;
    let spinTicker = null;
    let highlighted = false;

    // �Ҧ����ݮɶ��W�L60ms�����A���|�Ыءu����ʮe���v�H��{�@��t�ױ���
    if (pixiRenderer && delay > 60) {
      const tx = BOARD_PAD + c * (CELL_W + CELL_GAP) + CELL_W / 2;
      
      spinContainer = new PIXI.Container();
      spinContainer.x = tx;
      // �ϥΡu�Ԫ��Ÿ�+���C�z���סv�Ө��N�ӯ�B���Y������ BlurFilter
      for(let i=0; i<16; i++) {
         const tex = pixiRenderer.textures[`sym_${Math.floor(Math.random()*8)}`];
         if (tex) {
            const s = new PIXI.Sprite(tex);
            s.anchor.set(0.5);
            s.y = i * (CELL_H * 0.85); // �y�L�K���ƦC
            s.width = CELL_W * 0.85; 
            s.height = CELL_H * 1.5;   // ���z�Ԫ��s�y�ݼv
            s.alpha = 0.8;             // �ݼv�z����
            spinContainer.addChild(s);
         }
      }
      
      pixiRenderer.boardContainer.addChild(spinContainer);

      spinTicker = () => {
         const now = performance.now();
         const sysTime = now - globalStart;
         
         let speed = 45 * app.ticker.speed; // �@��t��
         
         // �Y�ӦC�O�w�i�C�A�B�F��[�t�ɶ��I�A�h�[�t
         if (isAnticipating && sysTime >= accTime) {
             speed = 100 * app.ticker.speed; // �N�P���t
             
             if (!highlighted) {
                 highlighted = true;
                 
                 // �[�t�ɡA�i�@�B�ݼv�ơA���̿� Shader
                 spinContainer.children.forEach(s => {
                     s.height = CELL_H * 2.8; 
                     s.alpha = 0.55; 
                     s.tint = 0xffeebb; // �V�W�@�h������~
                 });
                 
                 for (let r = 0; r < ROWS; r++) {
                    const bg = pixiRenderer.bgSprites[r][c];
                    pixiRenderer._drawCellBg(bg, 'win'); // ����I��
                 }
             }
         }
         
         spinContainer.y += speed;
         // �L�_���j�G��h 10 �ӲŸ������Z (10 * 0.85 = 8.5)
         if (spinContainer.y > BOARD_H) spinContainer.y -= (CELL_H * 8.5);
      };
      app.ticker.add(spinTicker);
    }

    for (let r = 0; r < ROWS; r++) {
      const ct = sprites[r][c];
      promises.push(new Promise(resolve => {
        const dropStart = globalStart + delay;
        
        ct.scale.set(1);
        ct.alpha = 1;
        ct.filters = null;
        
        const tx = BOARD_PAD + c * (CELL_W + CELL_GAP) + CELL_W / 2;
        const ty = BOARD_PAD + r * (CELL_H + CELL_GAP) + CELL_H / 2;
        ct.position.set(tx, ty);
        
        const homeY = ty;
        ct.y = fromY;
        ct.alpha = 0;

        const tick = () => {
          const now = performance.now();
          if (now < dropStart) return;

          // �ӦC�u��Ÿ��}�l���U�ɡA�M������ʮe��
          if (spinTicker) {
             app.ticker.remove(spinTicker);
             spinTicker = null;
             if (spinContainer) {
                spinContainer.destroy();
                spinContainer = null;
             }
             if (highlighted) {
                 for (let row = 0; row < ROWS; row++) {
                     pixiRenderer._drawCellBg(pixiRenderer.bgSprites[row][c], 'normal');
                 }
             }
          }

          const elapsed = now - dropStart;
          const t = Math.min(elapsed / dur, 1);
          // ��_�쥻�����Фϼu�G�@�뱼���ϥ� easeOutBack�A�N�P������ easeOutCubic
          const e = isAnticipating ? easeOutCubic(t) : easeOutBack(t);
          ct.alpha = Math.min(t * 3, 1);
          ct.scale.set(1); // �T�O�S���~��������
          ct.y = fromY + (homeY - fromY) * e;

          if (t >= 1) { 
              ct.y = homeY; ct.alpha = 1; ct.scale.set(1); app.ticker.remove(tick); 

              // ��Ÿ��u�����U�ɡA�~��ܸӦ����I������ (Wild/Scatter)
              if (targetGrid && pixiRenderer) {
                 const cell = targetGrid[r][c];
                 const sym = SYMS[cell.symId];
                 const bg = pixiRenderer.bgSprites[r][c];
                 if (cell.wild) pixiRenderer._drawCellBg(bg, 'wild');
                 else if (sym?.isScatter) pixiRenderer._drawCellBg(bg, 'scatter');
              }
              
              if (onReelStop && !stoppedCols.has(c)) {
                  stoppedCols.add(c);
                  onReelStop(c);
              }
              resolve(); 
          }
        };
        app.ticker.add(tick);
      }));
    }
  }
  return Promise.all(promises);
}

// =====================================================
export class PixiRenderer {
  constructor(canvasContainer) {
    this.container = canvasContainer;

    this.app = new PIXI.Application({
      width:           BOARD_W,
      height:          BOARD_H,
      backgroundColor: 0x0a0c1c,
      antialias:       true,
      resolution:      window.devicePixelRatio || 1,
      autoDensity:     true,
    });
    canvasContainer.appendChild(this.app.view);

    this.textures        = {};
    this.sprites         = [];   // sprites[r][c]  - symbol containers
    this.bgSprites       = [];   // bgSprites[r][c] - cell backgrounds
    this.boardContainer  = null;
    this.particleLayer   = null;
    this._wildTickers    = [];   // cleanup handles for wild pulse animations
    this._winGlows       = [];   // active win glow handles

    // Responsive scaling
    this._setupResizeObserver();
  }

  // �w�w Responsive canvas scaling �w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w
  _setupResizeObserver() {
    const resize = () => {
      const canvas = this.app.view;
      // �p���ڤ���i�ΪŶ� (�����ⰼ200px���O�Pgap���]�w)
      const sidePanelsW = 480; // �ⰼ panel + gap + padding
      const maxAvailable = Math.max(300, window.innerWidth - sidePanelsW);
      const scale = Math.min(1, maxAvailable / BOARD_W);
      
      canvas.style.width  = `${Math.round(BOARD_W * scale)}px`;
      canvas.style.height = `${Math.round(BOARD_H * scale)}px`;
    };
    resize();
    window.addEventListener('resize', resize);
  }

  // �w�w Asset preload (native Image + PIXI.Texture.from) �w
  async preload() {
    const entries = [
      ...SYMS.map(s => ({ key: `sym_${s.id}`, url: s.img })),
      { key: 'wild', url: WILD_IMG },
    ];

    const loadOne = ({ key, url }) => new Promise(resolve => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try { this.textures[key] = PIXI.Texture.from(img); } catch (_) {}
        resolve();
      };
      img.onerror = () => resolve();
      img.src = url;
    });

    await Promise.all(entries.map(loadOne));
    this._buildBoard();
    this._buildParticleLayer();

    // ���J Spine �ʷŸ귽�]�e���B�z�A���Ѥ����_�C���Ұʡ^
    await this._loadSpineAssets();
  }

  // �w�w Build game board �w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w
  _buildBoard() {
    this.boardContainer = new PIXI.Container();
    this.app.stage.addChild(this.boardContainer);

    // Board background
    const bg = new PIXI.Graphics();
    bg.beginFill(0x0d0f22, 0.85);
    bg.lineStyle(2, COLOR.border, 0.7);
    bg.drawRoundedRect(0, 0, BOARD_W, BOARD_H, 18);
    bg.endFill();
    this.boardContainer.addChild(bg);

    // Subtle column dividers
    for (let c = 1; c < COLS; c++) {
      const x = BOARD_PAD + c * (CELL_W + CELL_GAP) - CELL_GAP / 2;
      const divider = new PIXI.Graphics();
      divider.beginFill(0xffffff, 0.025);
      divider.drawRect(x - 1, BOARD_PAD, 2, BOARD_H - BOARD_PAD * 2);
      divider.endFill();
      this.boardContainer.addChild(divider);
    }

    this.sprites   = [];
    this.bgSprites = [];

    for (let r = 0; r < ROWS; r++) {
      this.sprites[r]   = [];
      this.bgSprites[r] = [];
      for (let c = 0; c < COLS; c++) {
        const x = BOARD_PAD + c * (CELL_W + CELL_GAP);
        const y = BOARD_PAD + r * (CELL_H + CELL_GAP);

        // Cell background graphics
        const cellBg = new PIXI.Graphics();
        this._drawCellBg(cellBg, 'normal');
        cellBg.x = x;
        cellBg.y = y;
        this.boardContainer.addChild(cellBg);
        this.bgSprites[r][c] = cellBg;

        // Symbol container (pivot at center for scale/rotate animations)
        const cellCt = new PIXI.Container();
        cellCt.pivot.set(CELL_W / 2, CELL_H / 2);
        cellCt.position.set(x + CELL_W / 2, y + CELL_H / 2);
        this.boardContainer.addChild(cellCt);
        this.sprites[r][c] = cellCt;
      }
    }
    
  }

  _drawCellBg(g, type = 'normal') {
    g.clear();
    const styles = {
      wild:    { fill: 0x2a1400, a: 1, lc: COLOR.gold,   lw: 2, la: 0.9 },
      scatter: { fill: 0x080c1e, a: 1, lc: COLOR.cyan,   lw: 0, la: 0.0 }, // �������
      win:     { fill: 0x3a2600, a: 1, lc: COLOR.gold,   lw: 2, la: 1.0 },
      normal:  { fill: COLOR.cellBg, a: 1, lc: COLOR.border, lw: 1, la: 0.55 },
    };
    const s = styles[type] || styles.normal;
    g.beginFill(s.fill, s.a);
    if (s.lw > 0) g.lineStyle(s.lw, s.lc, s.la);
    g.drawRoundedRect(0, 0, CELL_W, CELL_H, 12);
    g.endFill();
  }

  _buildParticleLayer() {
    this.particleLayer = new PIXI.Container();
    this.app.stage.addChild(this.particleLayer);
  }

  // �w�w Spine �귽���J �w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w
    async _loadSpineAssets() {
    this.spineData = {};
    this._spineLoaded = false;
    this._spineLib = null;

    // 策略：優先使用已存在的 window.spine，否則嘗試動態 ESM 載入
    let spineLib = null;
    if (typeof window.spine !== 'undefined' && window.spine.Spine) {
      spineLib = window.spine;
      console.log('[Spine] Using window.spine (pre-loaded).');
    } else {
      console.log('[Spine] window.spine not found, trying dynamic ESM import...');
      try {
        spineLib = await import('https://cdn.jsdelivr.net/npm/@esotericsoftware/spine-pixi-v7@4.2.108/dist/esm/spine-pixi-v7.mjs');
        window.spine = spineLib; // 也設到 window 方便後續使用
        console.log('[Spine] Dynamic ESM import successful.');
      } catch (importErr) {
        console.warn('[Spine] Dynamic ESM import failed, VFX disabled:', importErr);
        return;
      }
    }
    this._spineLib = spineLib;

    const BASE = 'assets/spine/';
    const toLoad = [
      { key: 'symbolVfx', atlas: BASE + 'Symbol_VFX.atlas', skel: BASE + 'Symbol_VFX.skel' },
      { key: 'binWinOmen', atlas: BASE + 'BinWin_Omen.atlas', skel: BASE + 'BinWin_Omen.skel' },
    ];

    try {
      for (const entry of toLoad) {
        const atlasText = await fetch(entry.atlas).then(r => r.text());
        const skelBin   = await fetch(entry.skel).then(r => r.arrayBuffer());

        // 建立 TextureAtlas（spine-pixi-v7 API）
        const texLoader = new spineLib.TextureAtlas(atlasText, (path, loaderFunc) => {
          const tex = PIXI.Texture.from(BASE + path);
          loaderFunc(tex.baseTexture);
        });

        // 讀取 binary skeleton
        const skelData = new spineLib.SkeletonBinary(new spineLib.AtlasAttachmentLoader(texLoader));
        skelData.scale = 1;
        const iData = skelData.readSkeletonData(new Uint8Array(skelBin));

        this.spineData[entry.key] = iData;
      }
      this._spineLoaded = true;
      console.log('[Spine] Assets loaded OK. Keys:', Object.keys(this.spineData));
    } catch (e) {
      console.warn('[Spine] Asset load failed, VFX disabled:', e);
    }
  }

  // �إߤ@�� Spine ��Ҩê�^
  _createSpine(key) {
    if (!this._spineLoaded || !this.spineData[key]) return null;
    try {
      const sd = this.spineData[key];
      // spine-pixi-v7: new Spine(skeletonData) auto-creates skeleton + animState
      const spineLib = this._spineLib || window.spine; const sp = new spineLib.Spine(sd);
      return sp;
    } catch (e) {
      console.warn('[Spine] createSpine failed:', key, e);
      return null;
    }
  }

  // �w�w Render single cell �w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w
  renderCell(r, c, cellData) {
    const ct  = this.sprites[r][c];
    const bgG = this.bgSprites[r][c];

    // Clear previous contents
    while (ct.children.length > 0) ct.removeChild(ct.children[0]);
    ct.scale.set(1);
    ct.alpha = 1;
    ct.filters = null;

    // Reset to canonical grid position (fixes positioning drift)
    const tx = BOARD_PAD + c * (CELL_W + CELL_GAP) + CELL_W / 2;
    const ty = BOARD_PAD + r * (CELL_H + CELL_GAP) + CELL_H / 2;
    ct.position.set(tx, ty);

    if (!cellData) { this._drawCellBg(bgG, 'normal'); return; }

    const sym = SYMS[cellData.symId];

    // Cell background style
    if (cellData.wild)       this._drawCellBg(bgG, 'wild');
    else if (sym?.isScatter) this._drawCellBg(bgG, 'scatter');
    else                     this._drawCellBg(bgG, 'normal');

    const texKey = cellData.wild ? 'wild' : `sym_${cellData.symId}`;
    const tex    = this.textures[texKey];

    if (tex) {
      const isFullBleed = sym?.isScatter || cellData.symId === 8;
      // Scatter �ؤo�X�j�ܥ���
      const size = sym?.isScatter ? CELL_W : (isFullBleed ? CELL_W - 6 : CELL_W - 22);
      const sprite = new PIXI.Sprite(tex);
      sprite.width  = size;
      sprite.height = size;
      sprite.anchor.set(0.5);
      sprite.x = CELL_W / 2;
      sprite.y = CELL_H / 2;

      // �p�G�O���� Scatter�A�ϥ� ADD �� SCREEN �ӹL�o�©�
      if (sym?.isGolden) {
        sprite.blendMode = PIXI.BLEND_MODES.SCREEN;
      }

      ct.addChild(sprite);
    } else {
      // Fallback text
      const label = new PIXI.Text(sym?.icon || '?', { fontSize: 38, fill: 0xffffff });
      label.anchor.set(0.5);
      label.x = CELL_W / 2;
      label.y = CELL_H / 2;
      ct.addChild(label);
    }



  }

  // �w�w Render full grid �w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w


  // �w�w Render full grid �w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w
  renderGrid(grid) {
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        this.renderCell(r, c, grid[r][c]);
  }

  // �w�w Spin start animation �w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w
  async playSpinStart(newGrid, onReelStop = null) {
    const isBuyFeature = newGrid.isBuyFeature || false;
    const dur = spd(150);
    const all = this.sprites.flat();

    const anticipationCols = new Set();
    let consecutiveSc = 0;
    for (let c = 0; c < COLS; c++) {
      let hasScatter = false;
      for (let r = 0; r < ROWS; r++) {
         const sym = SYMS[newGrid[r][c]?.symId];
         if (sym?.isScatter) hasScatter = true;
      }
      if (hasScatter) consecutiveSc++;
      else break;
      
      if (consecutiveSc >= 3 && (c + 1) < COLS) {
        anticipationCols.add(c + 1);
      }
    }

    // Quick flash out
    await tween(this.app, {
      from: 1, to: 0.12, duration: dur, easing: easeInCubic,
      onUpdate: v => all.forEach(ct => ct.alpha = v),
    });

    this.renderGrid(newGrid);
    all.forEach(ct => { ct.alpha = 0; });
    
    // �w���}��G�b�٨S���U�e�A�Ҧ��I���س��j��^�Ь� normal
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
         this._drawCellBg(this.bgSprites[r][c], 'normal');
      }
    }

    let customDelays = null;
    let customAccelerateTimes = null;
    let dropDur = spd(300);
    
    // Override timings strictly for Buy Feature requirement
    if (isBuyFeature) {
      // �����Ҧb����C1, 2, 3 ���̧ǰ���C�� 4 �b�b�� 3 �b���U�ɥ[�t�C�� 5 �b���`��ʡA���� 4 �b���U��~���C
      customDelays = [
        800,            // Reel 1: drops at 0.8s 
        1800,           // Reel 2: drops at 1.8s (���j 1.0s)
        2800,           // Reel 3: drops at 2.8s (���j 1.0s)
        4500,           // Reel 4 (Near Win): drops at 4.5s (���N�P�] 1.7s)
        5500            // Reel 5: drops at 5.5s (���j 1.0s ���`���U)
      ];
      customAccelerateTimes = {
        3: 2800 // Reel 4 exactly synchronizes its acceleration with Reel 3's drop
      };
      
      // Force ONLY Reel 4 to trigger the visual anticipation effect
      anticipationCols.clear();
      anticipationCols.add(3); 
    }

    // Staggered column drop-in
    await staggeredDrop(this.app, this.sprites, -BOARD_H * 0.35, dropDur, anticipationCols, this, customDelays, customAccelerateTimes, newGrid, onReelStop);
  }

  // �w�w Win highlight animation �w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w
  async playWinAnim(winCells) {
    const winSet = new Set(winCells.map(({ r, c }) => `${r}_${c}`));

    // Dim losers, highlight winners
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const ct = this.sprites[r][c];
        if (winSet.has(`${r}_${c}`)) {
          ct.alpha = 1;
          this._drawCellBg(this.bgSprites[r][c], 'win');
          this._applyWinGlow(ct);
        } else {
          ct.alpha = 0.28;
        }
      }
    }

    // Win cells bounce
    const bouncePromises = winCells.map(({ r, c }) => {
      const ct = this.sprites[r][c];
      return tween(this.app, {
        from: 1, to: 1.12, duration: spd(180), easing: easeOutBack,
        onUpdate: v => ct.scale.set(v),
      }).then(() => tween(this.app, {
        from: 1.12, to: 1, duration: spd(160), easing: easeOutCubic,
        onUpdate: v => ct.scale.set(v),
      }));
    });

    await Promise.all(bouncePromises);
    await this._sleep(spd(350));

    // Restore
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        this.sprites[r][c].alpha = 1;
        this.sprites[r][c].scale.set(1);
        this._removeWinGlow(this.sprites[r][c]);
      }
    }
  }

  // �w�w Scatter breathe animation �w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w
  async playScatterBreathe(cells) {
    // �l�� (Breathe in), �x�𰱹y (Hold), �R���� (Exhale/Impact)
    const promises = cells.map(({r, c}) => {
      const ct = this.sprites[r][c];
      
      return tween(this.app, {
        from: 1, to: 1.45, duration: 600, easing: easeOutCubic, // �l��
        onUpdate: v => ct.scale.set(v)
      }).then(() => tween(this.app, {
        from: 1.45, to: 1.5, duration: 400, easing: t => t, // �x��L�L����
        onUpdate: v => ct.scale.set(v)
      })).then(() => tween(this.app, {
        from: 1.5, to: 0.95, duration: 250, easing: easeInCubic, // �R�������U���Y
        onUpdate: v => ct.scale.set(v)
      })).then(() => tween(this.app, {
        from: 0.95, to: 1, duration: 150, easing: easeOutCubic, // �̲�í�w
        onUpdate: v => ct.scale.set(v)
      }));
    });
    
    // �P�l��ܳ��p�ɳs�ʰ{����
    this._sleep(800).then(() => {
        this.flashBoard(COLOR.gold, 3);
    });
    
    await Promise.all(promises);
  }

  _applyWinGlow(ct) {
    if (GlowFilter) {
      if (!ct._winGlow) {
        try {
          ct._winGlow = new GlowFilter({ distance: 18, outerStrength: 2.5, innerStrength: 0.5, color: COLOR.gold });
          ct.filters = (ct.filters || []).concat(ct._winGlow);
        } catch (_) {}
      }
    } else {
      // Fallback: ColorMatrix brightness pulse
      const cmf = new PIXI.ColorMatrixFilter();
      cmf.brightness(1.6, false);
      ct.filters = [cmf];
      ct._winGlow = cmf;
    }
  }

  _removeWinGlow(ct) {
    if (ct._winGlow) {
      ct.filters = (ct.filters || []).filter(f => f !== ct._winGlow);
      ct._winGlow = null;
    }
    if (!ct._pulseTicker) ct.filters = null;
  }

  // �w�w Eliminate animation �w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w
  async playEliminateAnim(cells) {
    // �p�G Spine VFX �w���J�A��������K�K��ʵe�A����
    if (this._spineLoaded && this.spineData['symbolVfx']) {
      await this._playSymbolVfx(cells);
    }

    // �зǮ����Y��ʵe
    const dur = spd(320);
    const promises = cells.map(({ r, c }) => {
      const ct = this.sprites[r][c];
      this._spawnBurst(ct.position.x, ct.position.y);
      return tween(this.app, {
        from: 1, to: 0, duration: dur, easing: easeInCubic,
        onUpdate: v => { ct.scale.set(v); ct.alpha = v; },
        onComplete: () => { ct.scale.set(1); ct.alpha = 0; },
      });
    });
    await Promise.all(promises);
  }

  // ���K�K������S�ġ]Spine Symbol_VFX�^
  async _playSymbolVfx(cells) {
    const CELL_SCALE = 0.55;
    const spineInstances = [];
    const sd = this.spineData['symbolVfx'];
    const animName = (sd && sd.animations && sd.animations[0]) ? sd.animations[0].name : 'animation';

    for (const { r, c } of cells) {
      const sp = this._createSpine('symbolVfx');
      if (!sp) continue;
      const tx = BOARD_PAD + c * (CELL_W + CELL_GAP) + CELL_W / 2;
      const ty = BOARD_PAD + r * (CELL_H + CELL_GAP) + CELL_H / 2;
      sp.x = tx;
      sp.y = ty;
      sp.scale.set(CELL_SCALE);
      this.boardContainer.addChild(sp);
      try { sp.state.setAnimation(0, animName, false); } catch (_) {}
      spineInstances.push(sp);
    }

    if (spineInstances.length === 0) return;
    await this._sleep(spd(500));
    spineInstances.forEach(sp => { try { sp.destroy(); } catch (_) {} });
  }

  // �w�w Drop-down animation (cascade refill) �w�w�w�w�w�w�w�w�w�w�w�w�w�w
  async playDropDownAnim(grid) {
    this.renderGrid(grid);
    const sprites = this.sprites;
    const app     = this.app;
    const dur     = spd(280);
    await staggeredDrop(app, sprites, -BOARD_H * 0.35, dur, new Set(), this);
  }

  // �w�w Particle burst (on cell elimination) �w�w�w�w�w�w�w�w�w�w�w�w�w�w
  _spawnBurst(wx, wy) {
    // 1. �֤߽����i (Shockwave flash)
    const flash = new PIXI.Graphics();
    flash.beginFill(0xffffff, 0.8);
    flash.drawCircle(0, 0, 18);
    flash.endFill();
    flash.x = wx; flash.y = wy;
    flash.blendMode = PIXI.BLEND_MODES.ADD;
    this.particleLayer.addChild(flash);

    tween(this.app, {
      from: 1, to: 0, duration: 250, easing: easeOutCubic,
      onUpdate: v => { flash.scale.set(1 + (1 - v) * 2.0); flash.alpha = v; },
      onComplete: () => flash.destroy()
    });

    // 2. �Ԯ����P��q�H�� (Battle aura sparks & shards)
    const sparkCount = 20 + Math.random() * 12;
    const colors = [COLOR.gold, COLOR.cyan, COLOR.red, 0xffffff, 0xffffff];
    
    for (let i = 0; i < sparkCount; i++) {
      const g = new PIXI.Graphics();
      const isLine = Math.random() > 0.35;
      const c = colors[Math.floor(Math.random() * colors.length)];
      
      g.beginFill(c, 0.95);
      if (isLine) {
        // �U�Q�Ԫ����ݼv���� (elongated spark)
        const w = 2 + Math.random() * 3.5;
        const h = 15 + Math.random() * 35;
        g.drawRect(-w/2, -h/2, w, h);
      } else {
        // �U�Q�٧θH�� (sharp shard)
        const r = 4 + Math.random() * 7;
        g.drawPolygon([0, -r, r/2, 0, 0, r, -r/2, 0]);
      }
      g.endFill();
      
      g.blendMode = PIXI.BLEND_MODES.ADD;
      g.x = wx; g.y = wy;
      this.particleLayer.addChild(g);

      // �¥|���K��r�P���}
      const angle = Math.random() * Math.PI * 2;
      g.rotation = angle + Math.PI / 2; // ��������V�B�ʤ�V
      
      // �z����t����
      const spd2 = 300 + Math.random() * 450; 
      const vx = Math.cos(angle) * spd2;
      const vy = Math.sin(angle) * spd2;
      
      // �԰��S�įS�x�G�u�P�B�z�o�O�j
      const life = 250 + Math.random() * 250;
      const born = performance.now();
      
      const tick = () => {
        const elapsed = performance.now() - born;
        const t = Math.min(elapsed / life, 1);
        const e = easeOutCubic(t); // �ֳt�ĥX���J��t
        
        g.x = wx + vx * e * 0.45; // ����̲��X���d��
        g.y = wy + vy * e * 0.45;
        g.scale.set(1 - t * 0.5); // �H�ۮ����ܲ�
        g.alpha = 1 - t;
        
        if (t >= 1) { this.app.ticker.remove(tick); g.destroy(); }
      };
      this.app.ticker.add(tick);
    }
  }

  // �w�w BigWin particle shower �w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w�w
  spawnParticles(color = COLOR.gold) {
    const colors = typeof color === 'number' ? [color] : [COLOR.gold, COLOR.cyan];
    const cx     = BOARD_W / 2;

    for (let i = 0; i < 70; i++) {
      const g = new PIXI.Graphics();
      const c = colors[Math.floor(Math.random() * colors.length)];
      const r = 4 + Math.random() * 7;
      g.beginFill(c, 0.92);
      Math.random() > 0.5
        ? g.drawCircle(0, 0, r)
        : g.drawRect(-r * 0.6, -r * 0.6, r * 1.2, r * 1.2);
      g.endFill();
      g.x = cx + (Math.random() - 0.5) * BOARD_W;
      g.y = BOARD_H + 10;
      this.app.stage.addChild(g);

      const vx   = (Math.random() - 0.5) * 350;
      const vy   = -(200 + Math.random() * 280);
      const life = 1200 + Math.random() * 800;
      const born = performance.now();
      const tick = () => {
        const t = Math.min((performance.now() - born) / life, 1);
        g.x += vx * 0.016;
        g.y += vy * 0.016 + 80 * 0.016 * t;
        g.alpha = 1 - Math.pow(t, 1.5);
        g.rotation += 0.05;
        if (t >= 1) { this.app.ticker.remove(tick); g.destroy(); }
      };
      this.app.ticker.add(tick);
    }
  }

  // �w�w Flash entire board (e.g. on jackpot) �w�w�w�w�w�w�w�w�w�w�w�w�w
  flashBoard(color = 0xffffff, times = 3) {
    const overlay = new PIXI.Graphics();
    overlay.beginFill(color, 0.45);
    overlay.drawRect(0, 0, BOARD_W, BOARD_H);
    overlay.endFill();
    this.app.stage.addChild(overlay);
    let count = 0;
    const period = 160;
    const born = performance.now();
    const tick = () => {
      const t = (performance.now() - born) % period / period;
      overlay.alpha = 0.45 * Math.sin(t * Math.PI);
      if (performance.now() - born > period * times * 2) {
        this.app.ticker.remove(tick);
        overlay.destroy();
      }
    };
    this.app.ticker.add(tick);
  }

  // �w�w Set board spinning state (blur effect) �w�w�w�w�w�w�w�w�w�w�w�w
  setBoardSpinning(on) {
    if (on) {
      if (!this.boardContainer._blurFilter) {
        const bf = new PIXI.BlurFilter(1.8);
        bf.quality = 6;
        bf.resolution = window.devicePixelRatio || 1;
        this.boardContainer._blurFilter = bf;
        this.boardContainer.filters = [bf];
      }
    } else {
      this.boardContainer.filters = null;
      this.boardContainer._blurFilter = null;
    }
  }

  _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  // �w�w ���b�B�j���w���]BinWin Omen Spine ���ù��t�X�^�w�w�w�w�w�w�w�w�w�w�w�w�w
  async playBinWinOmen() {
    if (!this._spineLoaded || !this.spineData['binWinOmen']) {
      // �����J�h�Υ��ù��{���@���ƥ�
      this.flashBoard(0xff8800, 5);
      await this._sleep(spd(1200));
      return;
    }

    const sp = this._createSpine('binWinOmen');
    if (!sp) { await this._sleep(spd(800)); return; }

    const sd = this.spineData['binWinOmen'];
    const animName = (sd && sd.animations && sd.animations[0]) ? sd.animations[0].name : 'animation';

    sp.x = BOARD_W / 2;
    sp.y = BOARD_H / 2;
    sp.scale.set(1.0);
    this.app.stage.addChild(sp);

    return new Promise(resolve => {
      let resolved = false;
      const done = () => {
        if (resolved) return;
        resolved = true;
        try { sp.destroy(); } catch (_) {}
        resolve();
      };

      const safety = setTimeout(done, 5000);

      try {
        sp.state.setAnimation(0, animName, false);
        sp.state.addListener({
          complete: () => { clearTimeout(safety); done(); }
        });
      } catch (e) {
        clearTimeout(safety);
        done();
      }
    });
  }

  // �w�w SoundManager stub (to be wired later) �w�w�w�w�w�w�w�w�w�w�w�w�w
  playSound(_key) { /* TODO: connect sound system */ }
}
