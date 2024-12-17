export interface Layer {
  id: string;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  visible: boolean;
  zIndex: number;
}

export class LayerManager {
  private layers: Map<string, Layer> = new Map();
  private mainCanvas: HTMLCanvasElement;
  private mainCtx: CanvasRenderingContext2D;

  constructor(width: number, height: number, containerElement: HTMLElement) {
    this.mainCanvas = document.createElement('canvas');
    this.mainCanvas.width = width;
    this.mainCanvas.height = height;
    this.mainCanvas.style.position = 'absolute';
    this.mainCanvas.style.left = '0';
    this.mainCanvas.style.top = '0';
    this.mainCanvas.style.width = '100%';
    this.mainCanvas.style.height = '100%';
    containerElement.appendChild(this.mainCanvas);
    this.mainCtx = this.mainCanvas.getContext('2d', { alpha: true })!;
    
    // 背景を透明に設定
    this.mainCtx.fillStyle = 'rgba(0, 0, 0, 0)';
    this.mainCtx.fillRect(0, 0, width, height);
  }

  createLayer(id: string, zIndex: number = 0): Layer {
    const canvas = document.createElement('canvas');
    canvas.width = this.mainCanvas.width;
    canvas.height = this.mainCanvas.height;
    canvas.style.position = 'absolute';
    canvas.style.left = '0';
    canvas.style.top = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    
    const ctx = canvas.getContext('2d', { 
      alpha: true,
      willReadFrequently: true 
    })!;
    
    // コンテキストの初期設定
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    const layer: Layer = {
      id,
      canvas,
      ctx,
      visible: true,
      zIndex
    };

    this.layers.set(id, layer);
    return layer;
  }

  getLayer(id: string): Layer | undefined {
    return this.layers.get(id);
  }

  setVisibility(id: string, visible: boolean) {
    const layer = this.layers.get(id);
    if (!layer) return;

    layer.visible = visible;
    
    // 即時再描画を強制
    this.render();
  }

  // レイヤーデータをバックアップするためのメソッドを追加
  getLayerData(id: string): ImageData | null {
    const layer = this.layers.get(id);
    if (!layer) return null;
    
    return layer.ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height);
  }

  // レイヤーデータを復元するメソッドを追加
  restoreLayerData(id: string, imageData: ImageData | null) {
    if (!imageData) return;
    
    const layer = this.layers.get(id);
    if (!layer) return;

    layer.ctx.putImageData(imageData, 0, 0);
    this.render();
  }

  render() {
    this.mainCtx.clearRect(0, 0, this.mainCanvas.width, this.mainCanvas.height);
    
    // 背景を設定（透明な代わりに暗いグレー）
    this.mainCtx.fillStyle = '#1f2937'; // tailwindのbg-gray-800相当
    this.mainCtx.fillRect(0, 0, this.mainCanvas.width, this.mainCanvas.height);
    
    // レイヤーを描画
    Array.from(this.layers.values())
      .sort((a, b) => a.zIndex - b.zIndex)
      .forEach(layer => {
        if (layer.visible) {
          this.mainCtx.globalAlpha = 1;
          this.mainCtx.drawImage(layer.canvas, 0, 0);
        }
      });
  }

  getMainCanvas(): HTMLCanvasElement {
    return this.mainCanvas;
  }

  clear(id?: string) {
    if (id) {
      const layer = this.layers.get(id);
      if (layer) {
        layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
      }
    } else {
      this.layers.forEach(layer => {
        layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
      });
    }
    this.render();
  }
}