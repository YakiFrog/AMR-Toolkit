export interface ViewerState {
  scale: number;
  scrollLeft: number;
  scrollTop: number;
}

export interface PGMImageData {
  width: number;
  height: number;
  maxVal: number;
  pixelData: Uint8Array;
}

export interface LayerConfig {
  id: string;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  visible: boolean;
  zIndex: number;
}
