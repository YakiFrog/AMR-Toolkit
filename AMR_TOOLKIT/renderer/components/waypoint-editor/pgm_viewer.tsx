import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { getDB, clearDB } from '../../db'; // DB関連のインポートを追加
import debounce from 'lodash/debounce';
import throttle from 'lodash/throttle';
import { Tool, DrawingTools } from './drawing_tools';
import { LayerManager } from './layer_manager';
import { WaypointTool } from './waypoint_tool'; // WaypointToolのインポートを追加

declare global {
  interface Window {
    electron?: {
      onClearDB: (callback: () => Promise<void>) => void;
    }
  }
}

interface PGMViewerProps {
  file?: File;
  onLoadSuccess?: () => void;
  onLoadError?: (error: string) => void;
  // レイヤーの表示状態を props として受け取る
  layerVisibility: {
    pgm: boolean;
    drawing: boolean;
    path: boolean; // 追加
  };
  waypoints: { x: number; y: number; theta: number }[]; // 追加
  setWaypoints: React.Dispatch<React.SetStateAction<{ x: number; y: number; theta: number }[]>>; // 追加
  plannedPath: { x: number; y: number }[]; // 追加
}

// より厳密な型定義を追加（名前を変更）
type PGMImageData = {
  width: number;
  height: number;
  maxVal: number;
  pixelData: Uint8Array;
};

// レンダリング間隔の定数を定義
const RENDER_INTERVAL = 16; // 約60FPS

export const PGMViewer: React.FC<PGMViewerProps> = ({ 
  file, 
  onLoadSuccess, 
  onLoadError, 
  layerVisibility,
  waypoints,
  setWaypoints,
  plannedPath // 追加
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [currentImageData, setCurrentImageData] = useState<{
    width: number;
    height: number;
    pixelData: Uint8Array;
  } | null>(null);
  const [scale, setScale] = useState(1.0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const [mousePos, setMousePos] = useState({ 
    x: 0, 
    y: 0, 
    imageX: -1, 
    imageY: -1, 
    pixelValue: -1 
  });
  const [showGrid, setShowGrid] = useState(false);
  const [scrollPosition, setScrollPosition] = useState({ left: 0, top: 0 });
  const [currentTool, setCurrentTool] = useState<Tool>('none');
  const [penSize, setPenSize] = useState(5);
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  // パフォーマンス最適化のための参照
  const renderRequestRef = useRef<number>();
  const lastRenderTime = useRef<number>(0);
  const lastDrawTimeRef = useRef<number>(0);
  const mouseMoveThrottleRef = useRef<Function>();
  const drawingRef = useRef<boolean>(false); // 描画中フラグを追加

  // グリッドレイヤーのキャンバス用のrefを追加
  const gridCanvasRef = useRef<HTMLCanvasElement>(null);

  // 描画履歴の状態を修正
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1); // 初期値を-1に戻す

  const layerManagerRef = useRef<LayerManager | null>(null);

  // saveToHistory を最初に定義
  const saveToHistory = useCallback(() => {
    if (!layerManagerRef.current) return;
    
    const drawingLayer = layerManagerRef.current.getLayer('drawing');
    if (!drawingLayer) return;

    const ctx = drawingLayer.ctx;
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, drawingLayer.canvas.width, drawingLayer.canvas.height);
    
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(imageData);
      return newHistory;
    });
    
    setHistoryIndex(prev => prev + 1);
    
    // 履歴保存後に強制的に再描画
    requestAnimationFrame(() => {
      if (layerManagerRef.current) {
        layerManagerRef.current.render();
      }
    });
  }, [historyIndex]);

  // グリッド描画を定義
  const drawGrid = useCallback((ctx: CanvasRenderingContext2D) => {
    if (!currentImageData) return;

    const { width, height } = currentImageData;
    // スケールに関係なく、元の画像サイズに合わせてキャンバスサイズを設定
    ctx.canvas.width = width;
    ctx.canvas.height = height;

    // グリッドの描画
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
    ctx.lineWidth = 1 / scale; // スケールに応じて線幅を調整

    const baseGridSize = 50;
    // スケールに関係なく固定サイズのグリッドを描画
    const gridSize = baseGridSize;
    
    ctx.beginPath();
    
    // 垂直線 - 画像の幅全体をカバー
    for (let x = 0; x <= width; x += gridSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    
    // 水平線 - 画像の高さ全体をカバー
    for (let y = 0; y <= height; y += gridSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    
    ctx.stroke();
  }, [currentImageData, scale]);

  // Waypoint配置用の一時状態を追加
  const [tempWaypoint, setTempWaypoint] = useState<{ x: number; y: number } | null>(null);

  // 矢印を描画する関数を修正
const drawArrow = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, theta: number, index?: number) => {
  const arrowLength = 30 / scale;
  const arrowWidth = 12 / scale;
  const lineWidth = 3 / scale;
    
  // 矢印の描画（既存のコード）
  const endX = x + arrowLength * Math.cos(theta);
  const endY = y + arrowLength * Math.sin(theta);
    
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(endX, endY);
  ctx.strokeStyle = 'red';
  ctx.lineWidth = lineWidth;
  ctx.stroke();
    
  // 矢印の頭を描画
  const angle = Math.PI / 6;
  ctx.beginPath();
  ctx.moveTo(endX, endY);
  ctx.lineTo(
    endX - arrowWidth * Math.cos(theta - angle),
    endY - arrowWidth * Math.sin(theta - angle)
  );
  ctx.lineTo(
    endX - arrowWidth * Math.cos(theta + angle),
    endY - arrowWidth * Math.sin(theta + angle)
  );
  ctx.closePath();
  ctx.fillStyle = 'red';
  ctx.fill();

  // Waypointの番号を描画
  if (typeof index === 'number') {
    ctx.save();
    ctx.font = `${12 / scale}px Arial`;
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // 番号を円で囲む
    const textWidth = 16 / scale;
    ctx.beginPath();
    ctx.arc(x, y, textWidth, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
    ctx.fill();
    
    // 番号を描画
    ctx.fillStyle = 'white';
    ctx.fillText(`${index + 1}`, x, y);
    ctx.restore();
  }
}, [scale]);

  // Waypoint描画関数を修正
const drawWaypoints = useCallback((ctx: CanvasRenderingContext2D) => {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    
  // 確定済みのWaypointを描画
  waypoints.forEach(({ x, y, theta }, index) => {
    drawArrow(ctx, x, y, theta, index); // indexを追加
  });
    
  // 配置中のWaypointを描画
  if (tempWaypoint && mousePos.imageX !== -1) {
    const theta = Math.atan2(
      mousePos.imageY - tempWaypoint.y,
      mousePos.imageX - tempWaypoint.x
    );
    drawArrow(ctx, tempWaypoint.x, tempWaypoint.y, theta);
  }
}, [waypoints, tempWaypoint, mousePos.imageX, mousePos.imageY, drawArrow]);

  // drawImage関数を定義
const drawImage = useCallback(() => {
  if (!currentImageData || !layerManagerRef.current) return;
  
  const { width, height, pixelData } = currentImageData;
  const pgmLayer = layerManagerRef.current.getLayer('pgm');
  
  if (pgmLayer) {
    const imageData = pgmLayer.ctx.createImageData(width, height);
    for (let i = 0; i < pixelData.length; i++) {
      const offset = i * 4;
      imageData.data[offset] = pixelData[i];
      imageData.data[offset + 1] = pixelData[i];
      imageData.data[offset + 2] = pixelData[i];
      imageData.data[offset + 3] = 255;
    }
    pgmLayer.ctx.putImageData(imageData, 0, 0);
  }

  if (showGrid) {
    const gridLayer = layerManagerRef.current.getLayer('grid');
    if (gridLayer) {
      drawGrid(gridLayer.ctx);
    }
  }

  const waypointLayer = layerManagerRef.current.getLayer('waypoints');
  if (waypointLayer) {
    drawWaypoints(waypointLayer.ctx);
  }

  // 追加: パスの再描画
  if (layerVisibility.path && plannedPath.length) {
    const pathLayer = layerManagerRef.current.getLayer('path');
    if (pathLayer) {
      const ctx = pathLayer.ctx;
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.beginPath();
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 3 / scale;
      ctx.moveTo(plannedPath[0].x, plannedPath[0].y);
      plannedPath.forEach((point) => {
        ctx.lineTo(point.x, point.y);
      });
      ctx.stroke();

      // パス上のポイントにもマーカーを描画
      ctx.fillStyle = '#10B981';
      plannedPath.forEach((point) => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 3 / scale, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }

  layerManagerRef.current.render();
}, [currentImageData, showGrid, drawGrid, drawWaypoints, layerVisibility.path, plannedPath, scale]);

  // requestDraw関数を定義
  const requestDraw = useCallback(() => {
    const now = performance.now();
    if (now - lastRenderTime.current < RENDER_INTERVAL) {
      if (renderRequestRef.current) {
        cancelAnimationFrame(renderRequestRef.current);
      }
      renderRequestRef.current = requestAnimationFrame(requestDraw);
      return;
    }
  
    lastRenderTime.current = now;
    drawImage();
    renderRequestRef.current = null;
  }, [drawImage]);

  // レイヤーマネージャーの初期化を修正
const initLayerManager = useCallback(() => {
  if (!currentImageData || !containerRef.current) return;

  const container = containerRef.current.querySelector('div[style*="transform"]') as HTMLElement;
  if (!container) return;
  
  // 既存のレイヤーマネージャーをクリーンアップ
  if (layerManagerRef.current) {
    const mainCanvas = layerManagerRef.current.getMainCanvas();
    mainCanvas.remove();
  }
  
  layerManagerRef.current = new LayerManager(
    currentImageData.width,
    currentImageData.height,
    container
  );

  // レイヤーの作成と初期化（順序を変更）
  const layers = [
    { id: 'pgm', zIndex: 0 },
    { id: 'grid', zIndex: 1 },
    { id: 'path', zIndex: 2 },
    { id: 'waypoints', zIndex: 3 },
    { id: 'drawing', zIndex: 5 }  // 描画レイヤーを最前面に
  ];

  layers.forEach(({ id, zIndex }) => {
    const layer = layerManagerRef.current!.createLayer(id, zIndex);
    if (layer) {
      layer.visible = layerVisibility[id as keyof typeof layerVisibility] ?? true;
      
      // 描画レイヤーの設定を追加
      if (id === 'drawing') {
        layer.ctx.lineCap = 'round';
        layer.ctx.lineJoin = 'round';
      }
    }
  });

  // コンテンツの描画
  requestAnimationFrame(() => {
    drawImage();
    requestDraw();
  });

  // レイヤーの設定を最適化
  if (layerManagerRef.current) {
    const drawingLayer = layerManagerRef.current.getLayer('drawing');
    if (drawingLayer) {
      const ctx = drawingLayer.ctx;
      // 描画パフォーマンスを向上させる設定
      ctx.imageSmoothingEnabled = false;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
  }
}, [currentImageData, layerVisibility, drawImage, requestDraw]);

  // レイヤーの表示状態の更新
  useEffect(() => {
    if (!layerManagerRef.current) return;

    try {
      const drawingLayer = layerManagerRef.current.getLayer('drawing');
      if (!drawingLayer) return;

      // 表示状態の更新
      layerManagerRef.current.setVisibility('pgm', layerVisibility.pgm);
      layerManagerRef.current.setVisibility('drawing', layerVisibility.drawing);

      // 表示時のデータ復元
      if (layerVisibility.drawing && drawingLayerDataRef.current) {
        // requestAnimationFrameを使用せず、直接データを復元
        drawingLayer.ctx.putImageData(drawingLayerDataRef.current, 0, 0);
        layerManagerRef.current.render();
      }

      // 非表示時のデータバックアップ
      if (!layerVisibility.drawing) {
        const imageData = drawingLayer.ctx.getImageData(0, 0, drawingLayer.canvas.width, drawingLayer.canvas.height);
        drawingLayerDataRef.current = imageData;
      }
    } catch (error) {
      console.error('Error updating layer visibility:', error);
    }
  }, [layerVisibility]);

  useEffect(() => {
    if (!canvasRef.current || !drawingCanvasRef.current) return;
    
    if (canvasRef.current) {
      canvasRef.current.style.display = layerVisibility.pgm ? 'block' : 'none';
    }
    if (drawingCanvasRef.current) {
      drawingCanvasRef.current.style.display = layerVisibility.drawing ? 'block' : 'none';
    }
  }, [layerVisibility]);

  // 描画レイヤーの初期化関数
  const initDrawingCanvas = useCallback(() => {
    if (!drawingCanvasRef.current || !currentImageData || !containerRef.current) return;
    
    const canvas = drawingCanvasRef.current;
    canvas.width = currentImageData.width;
    canvas.height = currentImageData.height;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalCompositeOperation = 'source-over';
      // 描画コンテキストの初期化
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [currentImageData]);

  // draw関数を修正
const draw = useCallback((e: React.MouseEvent<HTMLDivElement> | MouseEvent) => {
  if (!isDrawing.current || !layerManagerRef.current) return;
  
  const drawingLayer = layerManagerRef.current.getLayer('drawing');
  if (!drawingLayer || !drawingLayer.visible) return;

  const containerRect = containerRef.current?.getBoundingClientRect();
  if (!containerRect) return;

  const scrollLeft = containerRef.current?.scrollLeft || 0;
  const scrollTop = containerRef.current?.scrollTop || 0;

  const x = (e.clientX - containerRect.left + scrollLeft) / scale;
  const y = (e.clientY - containerRect.top + scrollTop) / scale;

  const ctx = drawingLayer.ctx;
  ctx.save();  // コンテキストの状態を保存

  // 描画スタイルの設定
  ctx.strokeStyle = currentTool === 'pen' ? 'black' : 'white';
  ctx.lineWidth = penSize / scale;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  if (lastPos.current) {
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(x, y);
  } else {
    ctx.moveTo(x, y);
    ctx.lineTo(x, y);
  }
  
  ctx.stroke();
  ctx.restore();  // コンテキストの状態を復元
  
  lastPos.current = { x, y };

  // レンダリングを最適化
  if (!renderRequestRef.current) {
    renderRequestRef.current = requestAnimationFrame(() => {
      layerManagerRef.current?.render();
      renderRequestRef.current = null;
    });
  }
}, [currentTool, penSize, scale]);

  // PGMファイルの読み込み処理
  useEffect(() => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const result = event.target?.result;
        if (!(result instanceof ArrayBuffer)) {
          onLoadError?.('ファイルの形式が不正です。');
          return;
        }

        const imageData = parsePGM(result);
        if (!imageData) {
          onLoadError?.('PGMファイルの解析に失敗しました。');
          return;
        }

        displayPGM(imageData);
        onLoadSuccess?.();

      } catch (error) {
        console.error('Error parsing PGM:', error);
        onLoadError?.(error instanceof Error ? error.message : '不明なエラーが発生しました。');
      }
    };

    reader.onerror = () => onLoadError?.('ファイル読み込みに失敗しました。');

    try {
      reader.readAsArrayBuffer(file);
    } catch (error) {
      onLoadError?.('ファイルの読み込みに失敗しました。');
    }
  }, [file, onLoadSuccess, onLoadError]);

  // PGMファイル解析関連の関数
  const parsePGM = (data: ArrayBuffer): PGMImageData => {
    const view = new DataView(data)
    let offset = 0
  
    const magicNumber = String.fromCharCode(view.getUint8(offset++)) + String.fromCharCode(view.getUint8(offset++))
    if (magicNumber !== 'P5') {
      throw new Error('PGM形式がサポートされていません (P5形式のみ対応)')
    }
  
    offset = skipCommentsAndWhitespace(view, offset)
  
    const width = parseInt(readNextToken(view, offset))
    offset += width.toString().length + 1
    offset = skipCommentsAndWhitespace(view, offset)
  
    const height = parseInt(readNextToken(view, offset))
    offset += height.toString().length + 1
    offset = skipCommentsAndWhitespace(view, offset)
  
    const maxVal = parseInt(readNextToken(view, offset))
    offset += maxVal.toString().length + 1
  
    const pixelData = new Uint8Array(data, offset)
  
    return { width, height, maxVal, pixelData }
  }
  
  const skipCommentsAndWhitespace = (view: DataView, offset: number) => {
    while (offset < view.byteLength) {
      const char = String.fromCharCode(view.getUint8(offset))
      if (char === '#') {
        while (offset < view.byteLength && view.getUint8(offset++) !== 10) {}
      } else if (/\s/.test(char)) {
        offset++
      } else {
        break
      }
    }
    return offset
  }
  
  const readNextToken = (view: DataView, offset: number) => {
    let token = ''
    while (offset < view.byteLength) {
      const char = String.fromCharCode(view.getUint8(offset))
      if (/\s/.test(char)) {
        break
      }
      token += char
      offset++
    }
    return token
  }

  // フィットするスケールを計算
  const calculateFitScale = useCallback(() => {
    if (!currentImageData) return 1.0;
    const container = document.getElementById('pgm-container');
    if (!container) return 1.0;

    const { width, height } = currentImageData;
    const containerRect = container.getBoundingClientRect();
    const containerWidth = containerRect.width - 16; // パディングを考慮
    const containerHeight = containerRect.height - 16; // パディングを考慮
    
    // 画像がコンテナより小さい場合は1.0を返す
    if (width <= containerWidth && height <= containerHeight) {
      return 1.0;
    }

    const scaleX = containerWidth / width;
    const scaleY = containerHeight / height;
    return Math.min(scaleX, scaleY);
  }, [currentImageData]);

  // ズーム処理
  const zoomAtPoint = useCallback((newScale: number, mouseX: number, mouseY: number) => {
    if (!containerRef.current || !currentImageData) return;
    
    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    const scrollLeft = container.scrollLeft;
    const scrollTop = container.scrollTop;
  
    const relativeX = mouseX - rect.left + scrollLeft;
    const relativeY = mouseY - rect.top + scrollTop;
  
    const imageX = relativeX / scale;
    const imageY = relativeY / scale;
  
    setScale(newScale);
  
    // RAF使用でスムーズなスクロール
    requestAnimationFrame(() => {
      if (containerRef.current) {
        const newX = imageX * newScale;
        const newY = imageY * newScale;
        containerRef.current.scrollLeft = newX - (mouseX - rect.left);
        containerRef.current.scrollTop = newY - (mouseY - rect.top);
      }
    });
  }, [currentImageData, scale]);

  // 画像表示処理を修正
  const displayPGM = useCallback(({ width, height, pixelData }: PGMImageData) => {
    setCurrentImageData({ width, height, pixelData });
    // initLayerManagerはuseEffectで呼び出される
  }, []);

  // currentImageDataが変更されたときにinitLayerManagerを呼び出す
  useEffect(() => {
    if (currentImageData) {
      initLayerManager();
    }
  }, [currentImageData, initLayerManager]);

  // 描画データの保存
  const saveDrawingData = useCallback(async () => {
    if (!drawingCanvasRef.current) return;

    try {
      const ctx = drawingCanvasRef.current.getContext('2d');
      if (!ctx) return;

      const imageData = ctx.getImageData(0, 0, drawingCanvasRef.current.width, drawingCanvasRef.current.height);
      const db = await getDB();
      const currentState = await db.get('pgmState', 'currentPGM');

      if (currentState) {
        await db.put('pgmState', {
          ...currentState,
          drawingData: {
            imageData,
            lastModified: Date.now()
          }
        }, 'currentPGM');
      }
    } catch (error) {
      console.error('Failed to save drawing data:', error);
    }
  }, []);

  // 描画データの読み込み
  const loadDrawingData = useCallback(async () => {
    if (!drawingCanvasRef.current || !currentImageData) return;

    try {
      const db = await getDB();
      const savedState = await db.get('pgmState', 'currentPGM');
      
      if (savedState?.drawingData) {
        const ctx = drawingCanvasRef.current.getContext('2d');
        if (!ctx) return;

        const { imageData } = savedState.drawingData;
        ctx.putImageData(imageData, 0, 0);
        
        // 履歴の初期化
        setHistory([imageData]);
        setHistoryIndex(0);
      }
    } catch (error) {
      console.error('Failed to load drawing data:', error);
    }
  }, [currentImageData]);

  // 描画データの保存をデバウンス
  const debouncedSaveDrawingData = useMemo(
    () => debounce(saveDrawingData, 1000),
    [saveDrawingData]
  );

  // 描画操作後のハンドラーを修正
  const handleDrawingComplete = useCallback(() => {
    if (!layerManagerRef.current) return;
    
    const drawingLayer = layerManagerRef.current.getLayer('drawing');
    if (!drawingLayer) return;

    // 描画内容を履歴に保存
    saveToHistory();
    // 描画内容を永続化
    debouncedSaveDrawingData();
  }, [saveToHistory, debouncedSaveDrawingData]);

  // handleMouseUpを修正
const handleMouseUp = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
  if (currentTool === 'waypoint' && tempWaypoint) {
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    const scrollLeft = containerRef.current?.scrollLeft || 0;
    const scrollTop = containerRef.current?.scrollTop || 0;

    const endX = (e.clientX - containerRect.left + scrollLeft) / scale;
    const endY = (e.clientY - containerRect.top + scrollTop) / scale;

    // 角度を計算
    const theta = Math.atan2(endY - tempWaypoint.y, endX - tempWaypoint.x);

    // Waypointを追加
    setWaypoints(prev => [...prev, { ...tempWaypoint, theta }]);
    setTempWaypoint(null);
    requestDraw();
    return;
  }
  if (currentTool !== 'none' && isDrawing.current) {
    isDrawing.current = false;
    lastPos.current = null;
    handleDrawingComplete();
    
    // 即座にレンダリング
    if (layerManagerRef.current) {
      layerManagerRef.current.render();
    }
  } else {
    setIsDragging(false);
    e.currentTarget.style.cursor = 'default';
  }
}, [currentTool, handleDrawingComplete, scale, tempWaypoint, setWaypoints, requestDraw]);

  // イベントハンドラの実装
  // handleMouseDownを修正
const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
  if (currentTool === 'waypoint') {
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    const scrollLeft = containerRef.current?.scrollLeft || 0;
    const scrollTop = containerRef.current?.scrollTop || 0;

    const x = (e.clientX - containerRect.left + scrollLeft) / scale;
    const y = (e.clientY - containerRect.top + scrollTop) / scale;

    // クリック位置を一時保存
    setTempWaypoint({ x, y });
    return;
  }
  if (currentTool !== 'none') {
    isDrawing.current = true;
    lastPos.current = null;
    // マウスダウン時に描画を開始
    draw(e);
  } else {
    if (!containerRef.current) return;

    setIsDragging(true);
    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    setStartX(e.pageX - rect.left);  // offsetLeftの代わりにrect.leftを使用
    setStartY(e.pageY - rect.top);   // offsetTopの代わりにrect.topを使用
    setScrollLeft(container.scrollLeft);
    setScrollTop(container.scrollTop);
    container.style.cursor = 'grabbing';
  }
}, [currentTool, draw, scale]); // saveToHistoryを依存から削除

  // マウス座標計算関数を宣言
  const calculateMousePosition = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!currentImageData || !layerManagerRef.current) {
      return { x: e.clientX, y: e.clientY, imageX: -1, imageY: -1, pixelValue: -1 };
    }

    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) {
      return { x: e.clientX, y: e.clientY, imageX: -1, imageY: -1, pixelValue: -1 };
    }

    // スクロール位置を考慮して修正
    const scrollLeft = containerRef.current?.scrollLeft || 0;
    const scrollTop = containerRef.current?.scrollTop || 0;

    // マウス座標をキャンバス座標に変換
    const x = (e.clientX - containerRect.left + scrollLeft) / scale;
    const y = (e.clientY - containerRect.top + scrollTop) / scale;
    
    // 整数値に変換
    const imageX = Math.floor(x);
    const imageY = Math.floor(y);
    
    const isInBounds = 
      imageX >= 0 && 
      imageX < currentImageData.width && 
      imageY >= 0 && 
      imageY < currentImageData.height;

    return {
      x: e.clientX,
      y: e.clientY,
      imageX: isInBounds ? imageX : -1,
      imageY: isInBounds ? imageY : -1,
      pixelValue: isInBounds ? currentImageData.pixelData[imageY * currentImageData.width + imageX] : -1
    };
  }, [currentImageData, scale]);

  // スクロール状態を管理するための参照を追加
const scrollStateRef = useRef({
  scrollLeft: 0,
  scrollTop: 0
});

// マウス移動のベース処理を最適化
const handleMouseMoveBase = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
  e.preventDefault();
  const now = performance.now();
  
  // スロットリングを適用
  if (now - lastScrollRef.current < SCROLL_THROTTLE_MS) {
    return;
  }
  
  const position = calculateMousePosition(e);
  setMousePos(position);

  if (currentTool !== 'none' && isDrawing.current) {
    draw(e);
  } else if (isDragging && containerRef.current) {
    if (scrollRAFRef.current) {
      cancelAnimationFrame(scrollRAFRef.current);
    }

    scrollRAFRef.current = requestAnimationFrame(() => {
      const container = containerRef.current;
      if (!container) return;
      
      const rect = container.getBoundingClientRect();
      const dragX = e.pageX - rect.left;
      const dragY = e.pageY - rect.top;

      // スクロール位置を参照経由で更新
      const newScrollLeft = scrollLeft - (dragX - startX);
      const newScrollTop = scrollTop - (dragY - startY);
      
      container.scrollLeft = newScrollLeft;
      container.scrollTop = newScrollTop;
      
      // 状態を参照に保存
      scrollStateRef.current = {
        scrollLeft: newScrollLeft,
        scrollTop: newScrollTop
      };
      
      lastScrollRef.current = now;
    });
  }
}, [calculateMousePosition, isDragging, scrollLeft, scrollTop, startX, startY, currentTool, draw]);

// スクロール位置が変更されたときの処理を追加
useEffect(() => {
  if (containerRef.current) {
    containerRef.current.scrollLeft = scrollStateRef.current.scrollLeft;
    containerRef.current.scrollTop = scrollStateRef.current.scrollTop;
  }
}, [scrollStateRef.current]);

  // スロットル処理の適用
  const throttledMouseMove = useMemo(
    () => throttle(handleMouseMoveBase, 16),
    [handleMouseMoveBase]
  );

  // マウス移動のベース処理を最適化 (新しい実装を使用)
  const handleMouseMoveOptimized = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const now = performance.now();
    
    // スロットリングを適用
    if (now - lastScrollRef.current < SCROLL_THROTTLE_MS) {
      return;
    }
    
    const position = calculateMousePosition(e);
    setMousePos(position);
  
    if (currentTool !== 'none' && isDrawing.current) {
      draw(e);
    } else if (isDragging && containerRef.current) {
      if (scrollRAFRef.current) {
        cancelAnimationFrame(scrollRAFRef.current);
      }
  
      scrollRAFRef.current = requestAnimationFrame(() => {
        const container = containerRef.current;
        if (!container) return;
        
        const rect = container.getBoundingClientRect();
        const dragX = e.pageX - rect.left;
        const dragY = e.pageY - rect.top;
  
        container.scrollLeft = scrollLeft - (dragX - startX);
        container.scrollTop = scrollTop - (dragY - startY);
        
        lastScrollRef.current = now;
      });
    }
  }, [calculateMousePosition, isDragging, scrollLeft, scrollTop, startX, startY, currentTool, draw]);

  // マウス移動ハンドラ
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    handleMouseMoveOptimized(e);
  }, [handleMouseMoveOptimized]);

  // クリーンアップ処理の統合
  useEffect(() => {
    return () => {
      if (renderRequestRef.current) {
        cancelAnimationFrame(renderRequestRef.current);
      }
      if (throttledMouseMove.cancel) {
        throttledMouseMove.cancel();
      }
      if (offscreenCanvasRef.current) {
        offscreenCanvasRef.current = null;
      }
    };
  }, [throttledMouseMove]);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    if (isShiftPressed && currentImageData) {
      e.preventDefault();
      const zoomSpeed = 0.001;
      const delta = e.deltaY * -zoomSpeed;
      const currentScale = scale;
      const newScale = Math.min(Math.max(0.1, currentScale + delta), 5.0);
      
      if (newScale !== currentScale) {
        zoomAtPoint(newScale, e.clientX, e.clientY);
      }
    }
  }, [currentImageData, isShiftPressed, scale, zoomAtPoint]);

  // リサイズイベントの設定
  useEffect(() => {
    if (currentImageData) {
      requestDraw();
      window.addEventListener('resize', requestDraw);
      return () => window.removeEventListener('resize', requestDraw);
    }
  }, [currentImageData, requestDraw]);

  // キーイベントの設定
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsShiftPressed(true);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsShiftPressed(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // 座標軸の表示を表示するコンポーネント
  const CoordinateAxes: React.FC = useCallback(() => {
    if (!currentImageData || !showGrid) return null;
    const container = document.getElementById('pgm-container');
    if (!container) return null;

    const { scrollLeft, scrollTop, clientWidth, clientHeight } = container;
    
    // 基本グリッドサイズを50で固定
    const baseGridSize = 50;

    const startX = Math.floor(scrollLeft / scale / baseGridSize) * baseGridSize;
    const startY = Math.floor(scrollTop / scale / baseGridSize) * baseGridSize;
    const endX = Math.ceil((scrollLeft + clientWidth) / scale / baseGridSize) * baseGridSize;
    const endY = Math.ceil((scrollTop + clientHeight) / scale / baseGridSize) * baseGridSize;

    return (
      <>
        {/* X軸の座標値 */}
        <div className="absolute left-8 top-0 right-0 h-6 bg-gray-800/50 text-white text-xs flex items-center overflow-hidden z-10">
          {Array.from({ length: Math.floor((endX - startX) / 50) + 1 }, (_, i) => {
            const x = startX + i * 50;
            if (x > currentImageData.width) return null;
            const position = (x * scale - scrollLeft);
            // 両端のパディングを考慮した表示判定
            if (position < 0 || position > clientWidth - 20) return null;
            return (
              <div key={x} className="absolute px-1" style={{ left: `${position}px` }}>
                {x}
              </div>
            );
          })}
        </div>

        {/* Y軸の座標値 */}
        <div className="absolute left-0 top-6 bottom-0 w-8 bg-gray-800/50 text-white text-xs flex flex-col items-end overflow-hidden z-10">
          {Array.from({ length: Math.floor((endY - startY) / 50) + 1 }, (_, i) => {
            const y = startY + i * 50;
            if (y > currentImageData.height) return null;
            const position = (y * scale - scrollTop);
            // 両端のパディングを考慮した表示判定
            if (position < 0 || position > clientHeight - 20) return null;
            return (
              <div key={y} className="absolute px-1" style={{ top: `${position}px` }}>
                {y}
              </div>
            );
          })}
        </div>
      </>
    );
  }, [currentImageData, scale, showGrid, scrollPosition]);

  // 状態の保存
  const saveViewerState = useCallback(async () => {
    try {
      const container = document.getElementById('pgm-container');
      if (!container) return;

      const db = await getDB();
      const currentState = await db.get('pgmState', 'currentPGM');
      
      if (currentState) {
        await db.put('pgmState', {
          ...currentState,
          viewerState: {
            scale,
            scrollLeft: container.scrollLeft,
            scrollTop: container.scrollTop,
          }
        }, 'currentPGM');
      }
    } catch (error) {
      console.error('Failed to save viewer state:', error);
    }
  }, [scale]);

  // スクロールとズーム状態の復元
  useEffect(() => {
    if (!currentImageData) return;

    const loadViewerState = async () => {
      try {
        const db = await getDB();
        const savedState = await db.get('pgmState', 'currentPGM');
        const container = document.getElementById('pgm-container');
        
        if (savedState?.viewerState && container) {
          setScale(savedState.viewerState.scale);
          
          // スクロール位置の復元は、画像描画後に行う必要があるため、遅延実行
          requestAnimationFrame(() => {
            if (container) {
              container.scrollLeft = savedState.viewerState.scrollLeft;
              container.scrollTop = savedState.viewerState.scrollTop;
            }
          });
        }
      } catch (error) {
        console.error('Failed to load viewer state:', error);
      }
    };

    loadViewerState();
  }, [currentImageData]);

  // スクロールとズームの状態変更を監視して保存
  useEffect(() => {
    const container = document.getElementById('pgm-container');
    if (!container) return;

    const handleScroll = () => {
      saveViewerState();
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [saveViewerState]);

  // スケール変更時に状態を保存
  useEffect(() => {
    saveViewerState();
  }, [scale, saveViewerState]);

  // アプリケーション終了時のクリーンアップを修正
  useEffect(() => {
    // アプリケーション終了時の処理
    window.electron?.onClearDB(async () => {
      try {
        // 描画履歴を初期化
        setHistory([]);
        setHistoryIndex(-1);
        
        // 描画キャンバスをクリア
        if (drawingCanvasRef.current) {
          const ctx = drawingCanvasRef.current.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, drawingCanvasRef.current.width, drawingCanvasRef.current.height);
          }
        }

        // データベースをクリア
        await clearDB();
      } catch (error) {
        console.error('Failed to clear drawing history and DB:', error);
      }
    });

    return () => {};
  }, []);

  // アプリケーション起動時の初期化を追加
  useEffect(() => {
    // 描画履歴を初期化
    setHistory([]);
    setHistoryIndex(-1);
    
    // 描画キャンバスをクリア
    if (drawingCanvasRef.current) {
      const ctx = drawingCanvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, drawingCanvasRef.current.width, drawingCanvasRef.current.height);
      }
    }
  }, []); // 空の依存配列で初回マウント時のみ実行

  // クリーンアップ処理の強化
  useEffect(() => {
    return () => {
      if (offscreenCanvasRef.current) {
        offscreenCanvasRef.current = null;
      }
    };
  }, []);

  // エラーバウンダリの追加
  useEffect(() => {
    const handleError = (error: ErrorEvent) => {
      console.error('PGMViewer Error:', error);
      onLoadError?.('予期せぬエラーが発生しました。');
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, [onLoadError]);

  // currentImageDataまたはscaleが変更されたときに再描画
  useEffect(() => {
    if (currentImageData && canvasRef.current) {
      requestDraw();
    }
  }, [currentImageData, scale]);

  // 描画の最適化

  // スクロール処理の最適化
  const debouncedSaveViewerState = useMemo(
    () => debounce(saveViewerState, 300),
    [saveViewerState]
  );

  // メモリリーク防止のクリーンアップ
  useEffect(() => {
    return () => {
      if (renderRequestRef.current) {
        cancelAnimationFrame(renderRequestRef.current);
      }
      if (mouseMoveThrottleRef.current) {
        (mouseMoveThrottleRef.current as any).cancel();
      }
      if (offscreenCanvasRef.current) {
        // @ts-ignore: OffscreenCanvas cleanup
        offscreenCanvasRef.current = null;
      }
      debouncedSaveViewerState.cancel();
      throttledMouseMove.cancel();
    };
  }, [debouncedSaveViewerState, throttledMouseMove]);

  // エラー回復メカニズム
  const handleError = useCallback((error: Error) => {
    console.error('PGMViewer Error:', error);
    onLoadError?.('エラーが発生しました。再読み込みを試みています...');
    
    // 状態のリセットを試みる
    try {
      if (renderRequestRef.current) {
        cancelAnimationFrame(renderRequestRef.current);
      }
      setCurrentImageData(null);
      setScale(1.0);
      if (file) {
        // 再読み込みを試みる
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const result = event.target?.result;
            if (result instanceof ArrayBuffer) {
              const imageData = parsePGM(result);
              if (imageData) {
                displayPGM(imageData);
                onLoadSuccess?.();
              }
            }
          } catch (e) {
            onLoadError?.('ファイルの再読み込みに失敗しました。');
          }
        };
        reader.readAsArrayBuffer(file);
      }
    } catch (recoveryError) {
      console.error('Recovery failed:', recoveryError);
      onLoadError?.('復旧に失敗しました。ページを再読み込みしてください。');
    }
  }, [file, onLoadSuccess, onLoadError, displayPGM]);

  // 描画レイヤーの初期化のuseEffect
  useEffect(() => {
    initDrawingCanvas();
    // 初期状態を履歴に保存
    if (drawingCanvasRef.current && currentImageData) {
      const ctx = drawingCanvasRef.current.getContext('2d');
      if (ctx) {
        const imageData = ctx.getImageData(0, 0, drawingCanvasRef.current.width, drawingCanvasRef.current.height);
        setHistory([imageData]);
        setHistoryIndex(0);
      }
    }
  }, [currentImageData, initDrawingCanvas]);

  // Undo/Redoのための履歴管理
  const handleHistorySave = useCallback(() => {
    if (!drawingCanvasRef.current) return;
    const ctx = drawingCanvasRef.current.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, drawingCanvasRef.current.width, drawingCanvasRef.current.height);
    
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(imageData);
      // 履歴の最大数を制限（メモリ管理のため）
      while (newHistory.length > 50) {
        newHistory.shift();
      }
      return newHistory;
    });
    
    setHistoryIndex(prev => prev + 1);
  }, [historyIndex]); // historyを依存から削除

  // Undo/Redo 操作の実装を修正
  const handleUndo = useCallback(() => {
    if (!layerManagerRef.current) return;
    const drawingLayer = layerManagerRef.current.getLayer('drawing');
    if (!drawingLayer || historyIndex < 0) return;

    // 現在の描画レイヤーの状態を一時保存
    const currentVisible = drawingLayer.visible;

    // 一時的に表示を有効にして描画
    drawingLayer.visible = true;

    if (historyIndex === 0) {
      drawingLayer.ctx.clearRect(0, 0, drawingLayer.canvas.width, drawingLayer.canvas.height);
    } else {
      drawingLayer.ctx.putImageData(history[historyIndex - 1], 0, 0);
    }

    // 表示状態を元に戻す
    drawingLayer.visible = currentVisible;
    setHistoryIndex(prev => prev - 1);
    
    // 強制的に再レンダリング
    requestAnimationFrame(() => {
      layerManagerRef.current?.render();
    });
  }, [history, historyIndex]);

  const handleRedo = useCallback(() => {
    if (!layerManagerRef.current) return;
    const drawingLayer = layerManagerRef.current.getLayer('drawing');
    if (!drawingLayer || historyIndex >= history.length - 1) return;

    // 現在の描画レイヤーの状態を一時保存
    const currentVisible = drawingLayer.visible;

    // 一時的に表示を有効にして描画
    drawingLayer.visible = true;

    drawingLayer.ctx.putImageData(history[historyIndex + 1], 0, 0);

    // 表示状態を元に戻す
    drawingLayer.visible = currentVisible;
    setHistoryIndex(prev => prev + 1);

    // 強制的に再レンダリング
    requestAnimationFrame(() => {
      layerManagerRef.current?.render();
    });
  }, [history, historyIndex]);

  // 初期データ読み込み
  useEffect(() => {
    if (currentImageData) {
      loadDrawingData();
    }
  }, [currentImageData, loadDrawingData]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      debouncedSaveDrawingData.cancel();
    };
  }, [debouncedSaveDrawingData]);

  // 描画レイヤーのデータをメモリに保持するための参照を追加
  const drawingLayerDataRef = useRef<ImageData | null>(null);

  // クリーンアップ時にデータを解放
  useEffect(() => {
    return () => {
      drawingLayerDataRef.current = null;
    };
  }, []);

  // レンダリング最適化のための追加
const RENDER_THROTTLE_MS = 16; // 約60FPS
const SAVE_DEBOUNCE_MS = 500;
const MOUSE_MOVE_THROTTLE_MS = 16;

// パフォーマンス監視用
const performanceRef = useRef({
  lastRenderTime: 0,
  frameCount: 0,
  fps: 0,
});

// レンダリング最適化
const optimizedRequestDraw = useCallback(() => {
  if (renderRequestRef.current) {
    cancelAnimationFrame(renderRequestRef.current);
  }

  const now = performance.now();
  if (now - performanceRef.current.lastRenderTime >= RENDER_THROTTLE_MS) {
    renderRequestRef.current = requestAnimationFrame(() => {
      drawImage();
      performanceRef.current.lastRenderTime = now;
      performanceRef.current.frameCount++;
    });
  }
}, [drawImage]);

// メモリ使用量の最適化
const cleanupUnusedResources = useCallback(() => {
  if (history.length > 50) {
    setHistory(prev => prev.slice(-50));
  }
  
  // 使用していないキャンバスのクリーンアップ
  if (offscreenCanvasRef.current && !drawingRef.current) {
    offscreenCanvasRef.current = null;
  }
}, [history]);

// レイヤーマネージャーの最適化
useEffect(() => {
  if (layerManagerRef.current) {
    // WebGLレンダリングの使用を試みる
    try {
      const canvas = layerManagerRef.current.getMainCanvas();
      const gl = canvas.getContext('webgl2');
      if (gl) {
        // WebGLコンテキストが利用可能な場合の処理
        // ...WebGL specific code...
      }
    } catch (error) {
      console.warn('WebGL not available, falling back to 2D context');
    }
  }
}, []);

// イメージデータの処理を最適化
const processImageData = useCallback((imageData: ImageData) => {
  // Web Workerを使用してバックグラウンドで処理
  const worker = new Worker(new URL('./imageProcessor.worker', import.meta.url));
  
  worker.onmessage = (e) => {
    const processedData = e.data;
    // 処理済みデータを使用
    // ...処理後の描画など
  };
  
  worker.postMessage({ imageData });
}, []);

// マウス座標計算の最適化
const optimizedCalculateMousePosition = useMemo(() => {
  return throttle(calculateMousePosition, MOUSE_MOVE_THROTTLE_MS, {
    leading: true,
    trailing: true
  });
}, [calculateMousePosition]);

// 定期的なクリーンアップとパフォーマンスモニタリング
useEffect(() => {
  const cleanupInterval = setInterval(() => {
    cleanupUnusedResources();
    
    // FPS計算
    const now = performance.now();
    const elapsed = now - performanceRef.current.lastRenderTime;
    if (elapsed >= 1000) {
      performanceRef.current.fps = performanceRef.current.frameCount;
      performanceRef.current.frameCount = 0;
      performanceRef.current.lastRenderTime = now;
    }
  }, 1000);

  return () => clearInterval(cleanupInterval);
}, [cleanupUnusedResources]);

// 定数を追加
const RENDER_BATCH_MS = 16; // 約60FPS
const SCROLL_THROTTLE_MS = 16;

// スクロール最適化のための参照を追加
const lastScrollRef = useRef<number>(0);
const scrollRAFRef = useRef<number>();

// マウス移動のベース処理を最適化
const optimizedHandleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
  e.preventDefault();
  const now = performance.now();
  
  // スロットリングを適用
  if (now - lastScrollRef.current < SCROLL_THROTTLE_MS) {
    return;
  }
  
  const position = calculateMousePosition(e);
  setMousePos(position);

  if (currentTool !== 'none' && isDrawing.current) {
    draw(e);
  } else if (isDragging && containerRef.current) {
    if (scrollRAFRef.current) {
      cancelAnimationFrame(scrollRAFRef.current);
    }

    scrollRAFRef.current = requestAnimationFrame(() => {
      const container = containerRef.current;
      if (!container) return;
      
      const rect = container.getBoundingClientRect();
      const dragX = e.pageX - rect.left;
      const dragY = e.pageY - rect.top;

      container.scrollLeft = scrollLeft - (dragX - startX);
      container.scrollTop = scrollTop - (dragY - startY);
      
      lastScrollRef.current = now;
    });
  }
}, [calculateMousePosition, isDragging, scrollLeft, scrollTop, startX, startY, currentTool, draw]);

// スクロール処理の最適化
const optimizedScroll = useCallback(() => {
  if (!containerRef.current) return;
  
  const now = performance.now();
  if (now - lastScrollRef.current < SCROLL_THROTTLE_MS) {
    return;
  }

  requestAnimationFrame(() => {
    requestDraw();
    lastScrollRef.current = now;
  });
}, [requestDraw]);

// スクロールイベントリスナーの設定を最適化
useEffect(() => {
  const container = containerRef.current;
  if (!container) return;

  const throttledScroll = throttle(optimizedScroll, SCROLL_THROTTLE_MS, {
    leading: true,
    trailing: true
  });

  container.addEventListener('scroll', throttledScroll);
  
  return () => {
    container.removeEventListener('scroll', throttledScroll);
    if (scrollRAFRef.current) {
      cancelAnimationFrame(scrollRAFRef.current);
    }
  };
}, [optimizedScroll]);

// クリーンアップを強化
useEffect(() => {
  return () => {
    if (scrollRAFRef.current) {
      cancelAnimationFrame(scrollRAFRef.current);
    }
    if (renderRequestRef.current) {
      cancelAnimationFrame(renderRequestRef.current);
    }
  };
}, []);

  return (
    <div className="flex flex-col h-full">
      {/* デバッグ情報 */}
      <div className="fixed top-0 right-0 bg-black/50 text-white p-2 rounded m-2 font-mono text-sm z-[9000]">
        <div>Screen: x:{mousePos.x} y:{mousePos.y}</div>
        <div>Image: x:{mousePos.imageX} y:{mousePos.imageY}</div>
        {mousePos.pixelValue >= 0 && (
          <div>Pixel Value: {mousePos.pixelValue}</div>
        )}
        <div>Scale: {(scale * 100).toFixed(0)}%</div>
        <div>Shift: {isShiftPressed ? 'ON' : 'OFF'}</div>
      </div>

      {/* 上部コントロールパネル */}
      <div className="flex items-center gap-2 p-2 bg-white shadow-sm z-10">
        <div className="flex items-center gap-4 w-full">
          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={() => setScale(calculateFitScale())}
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded whitespace-nowrap"
            >
              デフォルト
            </button>
            <button
              onClick={() => {
                setShowGrid(!showGrid);
                requestDraw();
              }}
              className={`${
                showGrid ? 'bg-gray-900 hover:bg-gray-800' : 'bg-gray-700 hover:bg-gray-600'
              } text-white font-bold py-2 px-4 rounded whitespace-nowrap`}
            >
              グリッド
            </button>
          </div>
          <div className="flex items-center gap-2 min-w-0 flex-grow">
            <input
              type="range"
              min="0.1"
              max="2"
              step="0.1"
              value={scale}
              onChange={(e) => setScale(parseFloat(e.target.value))}
              className="w-full custom-slider"
            />
            <span className="scale-display min-w-[4rem] text-right whitespace-nowrap">
              {(scale * 100).toFixed(0)}%
            </span>
          </div>
          <button
            onClick={async () => {
              await clearDB();
              window.location.reload();
            }}
            className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded ml-2 whitespace-nowrap"
          >
            クリア
          </button>
        </div>
      </div>

      {/* メインビューア領域 */}
      <div className="flex-1 relative overflow-hidden"> {/* この部分が重要 */}
        <div 
          id="pgm-container"
          ref={containerRef}
          className="absolute inset-0 overflow-auto bg-gray-800"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          style={{ 
            cursor: currentTool === 'pen' ? 'crosshair' : 
                    currentTool === 'eraser' ? 'cell' :
                    currentTool === 'waypoint' ? 'crosshair' :
                    isDragging ? 'grabbing' : 'default'
          }}
        >
          <div 
            className="relative"
            style={{ 
              width: currentImageData ? `${currentImageData.width}px` : '100%',
              height: currentImageData ? `${currentImageData.height}px` : '100%',
              transformOrigin: '0 0',
              transform: `scale(${scale})`
            }}
          />
        </div>
        <CoordinateAxes />
      </div>

      {/* 下部ツールパネル */}
      <div className="bg-gray-800 p-3 shadow-lg rounded-b">
        <DrawingTools
          currentTool={currentTool}
          setCurrentTool={setCurrentTool}
          penSize={penSize}
          setPenSize={setPenSize}
          canUndo={historyIndex > 0}
          canRedo={historyIndex < history.length - 1}
          onUndo={handleUndo}
          onRedo={handleRedo}
        />
      </div>
    </div>
  );
};
