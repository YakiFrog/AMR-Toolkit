export class LayerManager {
  private mainCanvas: HTMLCanvasElement;
  private layers: Map<string, { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; visible: boolean; }>;
  private container: HTMLElement;

  constructor(width: number, height: number, container: HTMLElement) {
    this.mainCanvas = document.createElement('canvas');
    this.mainCanvas.width = width;
    this.mainCanvas.height = height;
    this.container = container;
    this.layers = new Map();
    
    // メインキャンバスのスタイル設定を追加
    this.mainCanvas.style.position = 'absolute';
    this.mainCanvas.style.top = '0';
    this.mainCanvas.style.left = '0';
    
    container.appendChild(this.mainCanvas);
  }

  // メインキャンバスを取得するメソッドを追加
  public getMainCanvas(): HTMLCanvasElement {
    return this.mainCanvas;
  }

  createLayer(id: string, zIndex: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
    const canvas = document.createElement('canvas');
    canvas.width = this.mainCanvas.width;
    canvas.height = this.mainCanvas.height;
    
    const ctx = canvas.getContext('2d', {
      willReadFrequently: true,
      alpha: true
    });
    if (!ctx) throw new Error('Failed to get canvas context');

    ctx.imageSmoothingEnabled = true;
    
    // zIndexを設定
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.zIndex = zIndex.toString();
    
    this.layers.set(id, { canvas, ctx, visible: true });
    return { canvas, ctx }; // オブジェクトとして返す
  }

  getLayerData(id: string): ImageData | null {
    const layer = this.layers.get(id);
    if (!layer || !layer.ctx) return null;
    try {
      return layer.ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height);
    } catch (error) {
      console.error(`Failed to get layer data for ${id}:`, error);
      return null;
    }
  }

  restoreLayerData(id: string, imageData: ImageData | null): void {
    if (!imageData) return;
    const layer = this.layers.get(id);
    if (!layer || !layer.ctx) return;
    try {
      layer.ctx.putImageData(imageData, 0, 0);
      this.render();
    } catch (error) {
      console.error(`Failed to restore layer data for ${id}:`, error);
    }
  }

  setVisibility(id: string, visible: boolean) {
    try {
      const layer = this.layers.get(id);
      if (layer) {
        layer.visible = visible;
        if (!visible) {
          // 非表示時にクリアせずに維持
          layer.canvas.style.display = 'none';
        } else {
          layer.canvas.style.display = 'block';
        }
        this.render();
      }
    } catch (error) {
      console.error(`Failed to set visibility for layer ${id}:`, error);
    }
  }

  getLayer(id: string) {
    return this.layers.get(id);
  }

  render() {
    const mainCtx = this.mainCanvas.getContext('2d');
    if (!mainCtx) return;

    mainCtx.clearRect(0, 0, this.mainCanvas.width, this.mainCanvas.height);
    
    // レイヤーをzIndexの順番で描画
    const sortedLayers = Array.from(this.layers.entries())
      .sort((a, b) => parseInt(a[1].canvas.style.zIndex) - parseInt(b[1].canvas.style.zIndex));

    for (const [_, layer] of sortedLayers) {
      if (layer.visible) {
        mainCtx.drawImage(layer.canvas, 0, 0);
      }
    }
  }

  cleanup() {
    try {
      // 各レイヤーのキャンバスをクリーンアップ
      this.layers.forEach(({ canvas }) => {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        canvas.remove();
      });

      // レイヤーマップをクリア
      this.layers.clear();

      // メインキャンバスをクリーンアップ
      if (this.mainCanvas.parentNode) {
        const ctx = this.mainCanvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, this.mainCanvas.width, this.mainCanvas.height);
        }
        this.mainCanvas.remove();
      }
    } catch (error) {
      console.error('Error during layer manager cleanup:', error);
    }
  }
}
