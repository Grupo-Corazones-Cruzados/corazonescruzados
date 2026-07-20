import Phaser from 'phaser';
import type { LayerData, Tile } from '@/components/landing/world/sheets';
import { tileZ } from '@/components/landing/world/sheets';
import { registerSheetsForMap, toGid, TILE_PX, type SheetRegistration } from './tilesets';

/**
 * Escena principal del mundo.
 *
 * Sustituye al render anterior, que pintaba un canvas del **mapa entero** y por
 * tanto crecía con el tamaño del mundo en vez de con lo que se ve: a 500×500
 * tiles eran ~1 GB de memoria de vídeo, y se instanciaban tres canvas así a la
 * vez. Un mapa de 200×200 ya reventaba en iPhone.
 *
 * Aquí el descarte por cámara es automático: `TilemapLayer` solo dibuja los
 * tiles visibles, así que el coste depende del tamaño de la pantalla y no del
 * mapa. Por eso el móvil deja de ser un problema estructural.
 */

export type WorldMapData = {
  width: number;
  height: number;
  layers: LayerData[];
  spawnX?: number;
  spawnY?: number;
  characterLayer?: string | null;
  ambientDarkness?: number;
};

/** Escala de presentación heredada del juego anterior (tile de 32 → 64 px). */
export const WORLD_SCALE = 2;

/** Velocidad del jugador en píxeles de mundo por segundo. */
const PLAYER_SPEED = 140;

export type WorldSceneInit = {
  sceneSlug: string;
  /** Trae los datos del mapa. Se inyecta para poder probar la escena sin red. */
  loadMap: (slug: string) => Promise<WorldMapData>;
  /** Avisa del cambio de tile, para persistir la posición. */
  onTileChange?: (sceneSlug: string, x: number, y: number, facing: string) => void;
};

export class WorldScene extends Phaser.Scene {
  static readonly KEY = 'WorldScene';

  private slug!: string;
  private loadMap!: WorldSceneInit['loadMap'];
  private onTileChange?: WorldSceneInit['onTileChange'];

  private map?: Phaser.Tilemaps.Tilemap;
  private collisionLayers: Phaser.Tilemaps.TilemapLayer[] = [];
  private player?: Phaser.Physics.Arcade.Sprite;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd?: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;

  /** Dirección del mando táctil, normalizada. Nula si no se está tocando. */
  private touchVector: { x: number; y: number } | null = null;

  private lastTile = { x: -1, y: -1 };
  private facing: 'n' | 's' | 'e' | 'w' = 's';

  constructor() {
    super(WorldScene.KEY);
  }

  init(data: WorldSceneInit) {
    this.slug = data.sceneSlug;
    this.loadMap = data.loadMap;
    this.onTileChange = data.onTileChange;
  }

  async create() {
    const data = await this.loadMap(this.slug);

    // Solo se cargan las hojas que el mapa usa. Cargar las 11 siempre era
    // trabajo desperdiciado: un interior no necesita acantilados ni bosque.
    const usedSheets = new Set<number>();
    for (const layer of data.layers ?? []) {
      for (const t of layer.tiles ?? []) {
        if (!t.color) usedSheets.add(t.s);
      }
    }
    const registry = await registerSheetsForMap(this, usedSheets);

    this.buildTilemap(data, registry);
    this.buildPlayer(data);
    this.buildCamera(data);
    this.buildInput();
  }

  // -------------------------------------------------------------------------
  // Mundo
  // -------------------------------------------------------------------------

  private buildTilemap(data: WorldMapData, registry: Map<number, SheetRegistration>) {
    const map = this.make.tilemap({
      tileWidth: TILE_PX,
      tileHeight: TILE_PX,
      width: data.width,
      height: data.height,
    });
    this.map = map;

    const tilesets: Phaser.Tilemaps.Tileset[] = [];
    for (const reg of registry.values()) {
      const ts = map.addTilesetImage(
        reg.textureKey,
        reg.textureKey,
        TILE_PX,
        TILE_PX,
        0,
        0,
        reg.firstGid,
      );
      if (ts) tilesets.push(ts);
    }

    // El orden de pintado replica el del renderer anterior: las capas apilan en
    // orden de array, y dentro de cada una se hacen dos pasadas por categoría
    // (suelo primero, resto encima) para que la decoración transparente siga
    // viendo la hierba sobre la que se pintó.
    data.layers?.forEach((layerData, i) => {
      if (layerData.visible === false) return;

      for (const pass of [0, 1] as const) {
        const tiles = (layerData.tiles ?? []).filter(
          (t) => (t.color ? 1 : tileZ(t.s)) === pass,
        );
        if (tiles.length === 0) continue;

        const layer = map.createBlankLayer(
          `L${i}_z${pass}`,
          tilesets,
          0,
          0,
          data.width,
          data.height,
        );
        if (!layer) continue;

        layer.setScale(WORLD_SCALE);
        layer.setDepth(i * 10 + pass);
        this.paintTiles(layer, tiles, registry);
      }
    });

    // Las colisiones vienen de la bandera `c` del propio tile, así que se
    // marcan sobre las capas ya pintadas en vez de mantener una rejilla aparte.
    for (const layer of this.collisionLayers) {
      layer.setCollisionByProperty({ collides: true });
    }
  }

  private paintTiles(
    layer: Phaser.Tilemaps.TilemapLayer,
    tiles: Tile[],
    registry: Map<number, SheetRegistration>,
  ) {
    let hasCollision = false;

    for (const t of tiles) {
      if (t.x < 0 || t.y < 0) continue;

      // Los tiles de color sólido no salen de ninguna hoja: se dibujan como
      // rectángulo. Son pocos, así que no compensa generarles una textura.
      if (t.color) {
        const rect = this.add.rectangle(
          (t.x + 0.5) * TILE_PX * WORLD_SCALE,
          (t.y + 0.5) * TILE_PX * WORLD_SCALE,
          TILE_PX * WORLD_SCALE,
          TILE_PX * WORLD_SCALE,
          Phaser.Display.Color.HexStringToColor(t.color).color,
        );
        rect.setDepth(layer.depth);
        if (t.c) hasCollision = true;
        continue;
      }

      const reg = registry.get(t.s);
      if (!reg) continue; // Hoja desconocida en datos viejos: se ignora.
      if (t.sx < 0 || t.sy < 0 || t.sx >= reg.cols || t.sy >= reg.rows) continue;

      const placed = layer.putTileAt(toGid(reg, t.sx, t.sy), t.x, t.y);
      if (!placed) continue;

      if (t.fx) placed.flipX = true;
      if (t.fy) placed.flipY = true;
      if (t.rot) placed.rotation = Phaser.Math.DegToRad(t.rot);

      if (t.c) {
        placed.properties = { ...(placed.properties ?? {}), collides: true };
        hasCollision = true;
      }
    }

    if (hasCollision) this.collisionLayers.push(layer);
  }

  // -------------------------------------------------------------------------
  // Jugador y cámara
  // -------------------------------------------------------------------------

  private buildPlayer(data: WorldMapData) {
    const spawnX = ((data.spawnX ?? 2) + 0.5) * TILE_PX * WORLD_SCALE;
    const spawnY = ((data.spawnY ?? 2) + 0.5) * TILE_PX * WORLD_SCALE;

    // Marcador provisional. La composición del personaje LPC (12 capas
    // apiladas: cuerpo, pelo, ropa…) es el siguiente paso; se hace componiendo
    // las capas en UNA textura en vez de apilar divs como hasta ahora.
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x4b2d8e, 1);
    g.fillRoundedRect(0, 0, 28, 44, 6);
    g.generateTexture('player-placeholder', 28, 44);
    g.destroy();

    this.player = this.physics.add.sprite(spawnX, spawnY, 'player-placeholder');
    this.player.setDepth(1000);
    this.player.setCollideWorldBounds(true);

    for (const layer of this.collisionLayers) {
      this.physics.add.collider(this.player, layer);
    }
  }

  private buildCamera(data: WorldMapData) {
    const w = data.width * TILE_PX * WORLD_SCALE;
    const h = data.height * TILE_PX * WORLD_SCALE;

    this.physics.world.setBounds(0, 0, w, h);
    this.cameras.main.setBounds(0, 0, w, h);
    if (this.player) {
      // El seguimiento suave evita el tirón que tenía la cámara anterior, que
      // se movía por traslación CSS directa sin interpolar.
      this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    }
    // Sin esto, el redondeo a subpíxel produce temblor con arte pixelado.
    this.cameras.main.setRoundPixels(true);
  }

  private buildInput() {
    if (!this.input.keyboard) return;
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = {
      up: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
  }

  /** Lo llama el mando táctil de React. Vector ya normalizado, o null al soltar. */
  setTouchVector(v: { x: number; y: number } | null) {
    this.touchVector = v;
  }

  update() {
    const player = this.player;
    if (!player) return;

    let vx = 0;
    let vy = 0;

    if (this.touchVector) {
      vx = this.touchVector.x;
      vy = this.touchVector.y;
    } else {
      if (this.cursors?.left.isDown || this.wasd?.left.isDown) vx -= 1;
      if (this.cursors?.right.isDown || this.wasd?.right.isDown) vx += 1;
      if (this.cursors?.up.isDown || this.wasd?.up.isDown) vy -= 1;
      if (this.cursors?.down.isDown || this.wasd?.down.isDown) vy += 1;
      // Normalizar para que moverse en diagonal no sea más rápido.
      if (vx !== 0 && vy !== 0) {
        const inv = Math.SQRT1_2;
        vx *= inv;
        vy *= inv;
      }
    }

    player.setVelocity(vx * PLAYER_SPEED, vy * PLAYER_SPEED);

    if (vx !== 0 || vy !== 0) {
      this.facing =
        Math.abs(vx) > Math.abs(vy) ? (vx > 0 ? 'e' : 'w') : vy > 0 ? 's' : 'n';
    }

    // Avisar solo al cambiar de tile: el guardado es una escritura en base de
    // datos, no telemetría por frame.
    const tx = Math.floor(player.x / (TILE_PX * WORLD_SCALE));
    const ty = Math.floor(player.y / (TILE_PX * WORLD_SCALE));
    if (tx !== this.lastTile.x || ty !== this.lastTile.y) {
      this.lastTile = { x: tx, y: ty };
      this.onTileChange?.(this.slug, tx, ty, this.facing);
    }
  }
}
