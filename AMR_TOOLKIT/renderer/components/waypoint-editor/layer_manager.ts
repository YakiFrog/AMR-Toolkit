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
    containerElement.appendChild(this.mainCanvas);
    this.mainCtx = this.mainCanvas.getContext('2d', { alpha: true })!;
  }

  createLayer(id: string, zIndex: number = 0): Layer {
    const canvas = document.createElement('canvas');
    canvas.width = this.mainCanvas.width;
    canvas.height = this.mainCanvas.height;
    canvas.style.position = 'absolute';
    canvas.style.left = '0';
    canvas.style.top = '0';
    
    const layer: Layer = {
      id,
      canvas,
      ctx: canvas.getContext('2d', { alpha: true })!,
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
    if (layer) {
      layer.visible = visible;
      this.render();
    }
  }

  render() {
    this.mainCtx.clearRect(0, 0, this.mainCanvas.width, this.mainCanvas.height);
    
    // zIndexでソートしてレンダリング
    Array.from(this.layers.values())
      .sort((a, b) => a.zIndex - b.zIndex)
      .forEach(layer => {
        if (layer.visible) {
          try {
            this.mainCtx.drawImage(layer.canvas, 0, 0);
          } catch (error) {
            console.error(`Failed to render layer ${layer.id}:`, error);
          }
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