import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Sidebar } from '../components/common/sidebar';
import { PGMViewer } from '../components/waypoint-editor/pgm_viewer';
import { getDB } from '../db'; // DB関連のインポートを追加
import { LayerPanel } from '../components/waypoint-editor/layer_panel';
import { WaypointTool } from '../components/waypoint-editor/waypoint_tool';
import { calculateAstarPath } from '../utils/path-planning'; // 新しく作成する必要があります

export default function PGMViewerPage() {
  const [selectedFile, setSelectedFile] = useState<File | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true); // 追加
  const [resizeRatio, setResizeRatio] = useState<number>(66.66); // 2:1の比率（66.66%）
  const resizeRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const resizeTimeoutRef = useRef<number>();
  const isDragging = useRef(false);

  // パフォーマンス最適化のための参照を追加
  const resizeAnimationFrame = useRef<number>();
  const lastResizeTime = useRef<number>(0);
  const initialRatio = useRef<number>(66.66);

  // リサイズハンドラーを最適化して簡略化
  const handleResize = useCallback((e: MouseEvent) => {
    if (!containerRef.current || !isDragging.current) return;

    // リサイズのスロットリング
    const now = performance.now();
    if (now - lastResizeTime.current < 16) { // 約60FPS
      if (resizeAnimationFrame.current) {
        cancelAnimationFrame(resizeAnimationFrame.current);
      }
      resizeAnimationFrame.current = requestAnimationFrame(() => {
        handleResize(e);
      });
      return;
    }
    lastResizeTime.current = now;

    const containerRect = containerRef.current.getBoundingClientRect();
    const newRatio = ((e.clientX - containerRect.left) / containerRect.width) * 100;
    
    // 単純に30%から90%の範囲に制限
    const clampedRatio = Math.min(Math.max(newRatio, 30), 90);
    setResizeRatio(clampedRatio);
  }, []);

  // マウスイベントの設定を簡略化
  const startResize = useCallback(() => {
    isDragging.current = true;

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      handleResize(e);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';

      if (resizeAnimationFrame.current) {
        cancelAnimationFrame(resizeAnimationFrame.current);
      }
    };

    document.addEventListener('mousemove', handleMouseMove, { passive: false });
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
  }, [handleResize]);

  // クリーンアップを強化
  useEffect(() => {
    return () => {
      if (resizeAnimationFrame.current) {
        cancelAnimationFrame(resizeAnimationFrame.current);
      }
    };
  }, []);

  // ページロード時のPGMファイル読み込み処理を最適化
  useEffect(() => {
    let isSubscribed = true; // アンマウント後の状態更新を防ぐ

    const loadSavedPGM = async () => {
      try {
        setIsLoading(true);
        const db = await getDB();
        const savedState = await db.get('pgmState', 'currentPGM');
        
        if (savedState?.file && isSubscribed) {
          const blob = new Blob([savedState.file], { type: 'image/x-portable-graymap' });
          const file = new File([blob], savedState.fileName, {
            lastModified: savedState.lastModified,
            type: 'image/x-portable-graymap'
          });
          setSelectedFile(file);
        }
      } catch (error) {
        console.error('Failed to load saved PGM:', error);
        toast.error('保存されたPGMファイルの読み込みに失敗しました');
      } finally {
        if (isSubscribed) {
          setIsLoading(false);
        }
      }
    };

    loadSavedPGM();
    return () => { isSubscribed = false };
  }, []);

  // savePGMState関数を修正
  const savePGMState = async (file: File) => {
    try {
      if (file.size > 50 * 1024 * 1024) {
        throw new Error('ファイルサイズが大きすぎます（上限: 50MB）');
      }

      const arrayBuffer = await file.arrayBuffer();
      const db = await getDB();
      
      const tx = db.transaction('pgmState', 'readwrite');
      const store = tx.objectStore('pgmState');
      const currentState = await store.get('currentPGM');

      await store.put({
        file: arrayBuffer,
        fileName: file.name,
        lastModified: file.lastModified,
        viewerState: currentState?.viewerState || {
          scale: 1.0,
          scrollLeft: 0,
          scrollTop: 0,
        }
      }, 'currentPGM');

      await tx.done;
    } catch (error) {
      console.error('Failed to save PGM state:', error);
      throw error;
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) {
      toast.error('ファイルが選択されていません。');
      return;
    }

    if (!file.name.toLowerCase().endsWith('.pgm')) {
      toast.error('PGMファイル(.pgm)を選択してください。');
      return;
    }

    setSelectedFile(file);
    try {
      await savePGMState(file);
      toast.success('ファイルを保存しました。');
    } catch (error) {
      toast.error('ファイルの保存に失敗しました。');
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pgm';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) {
        toast.error('ファイルが選択されていません。');
        return;
      }

      if (!file.name.toLowerCase().endsWith('.pgm')) {
        toast.error('PGMファイル(.pgm)を選択してください。');
        return;
      }

      setSelectedFile(file);
      await savePGMState(file);
    };
    input.click();
  };

  // レイアウトの最適化
  const containerStyle = useMemo(() => ({
    width: `calc(${resizeRatio}% - 2px)`,
    transition: isDragging.current ? 'none' : 'width 0.1s ease-out'
  }), [resizeRatio]);

  const [waypoints, setWaypoints] = useState<{ x: number; y: number; theta: number }[]>([]); // 型定義を追加
  
  const [plannedPath, setPlannedPath] = useState<{ x: number; y: number }[]>([]);
  const [isPlanning, setIsPlanning] = useState(false);

  const handlePlanPath = async () => {
    if (waypoints.length < 2) return;
    
    setIsPlanning(true);
    try {
      // 少し遅延を入れてUIのフィードバックを見やすくする
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const path = await calculateAstarPath(waypoints);
      setPlannedPath(path);
      toast.success('パスプランニングが完了しました');
    } catch (error) {
      console.error('Path planning failed:', error);
      toast.error('パスプランニングに失敗しました');
    } finally {
      setIsPlanning(false);
    }
  };

  const [layers, setLayers] = useState([
    { id: 'pgm', name: 'PGMマップ', visible: true, color: '#666666' },
    { id: 'drawing', name: '描写レイヤー', visible: true, color: '#3B82F6' },
    { id: 'path', name: '計画パス', visible: true, color: '#10B981' } // 追加
  ]);

  const handleToggleLayer = useCallback((layerId: string) => {
    setLayers(prev => prev.map(layer =>
      layer.id === layerId ? { ...layer, visible: !layer.visible } : layer
    ));
  }, []);

  // レイヤーの表示状態をオブジェクトとして生成
  const layerVisibility = {
    pgm: layers.find(l => l.id === 'pgm')?.visible ?? true,
    drawing: layers.find(l => l.id === 'drawing')?.visible ?? true,
    path: layers.find(l => l.id === 'path')?.visible ?? true // 追加
  };

  return (
    <React.Fragment>
      <Head>
        <title>PGM ビューアー - PGM Map Editor</title>
      </Head>
      <ToastContainer />
      <Sidebar />
      <div className="ml-16 min-h-screen bg-neutral-50 p-8">
        <div className="max-w-full mx-auto h-[calc(100vh-120px)]">
          <h1 className="text-4xl font-bold text-neutral-800 mb-2">PGM ビューアー</h1>
          <p className="text-neutral-600 mb-4">PGMファイルを表示して編集できます。</p>

          <div ref={containerRef} className="h-[calc(100vh-220px)]">
            <div className="flex h-full space-x-2">
              {/* PGMビューアー部分 */}
              <div 
                className="bg-white rounded-lg shadow-lg overflow-hidden h-full border border-neutral-200"
                style={containerStyle}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={!selectedFile ? handleClick : undefined}
              >
                {isLoading ? ( // ローディング表示を追加
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
                      <p className="text-gray-600">読み込み中...</p>
                    </div>
                  </div>
                ) : selectedFile ? (
                  <PGMViewer
                    key={selectedFile.name} // キーを追加して再マウントを制御
                    file={selectedFile}
                    layerVisibility={layerVisibility}
                    waypoints={waypoints}
                    setWaypoints={setWaypoints}
                    plannedPath={plannedPath} // 追加
                    onLoadSuccess={() => {
                      // 初回のみ通知を表示
                      if (!sessionStorage.getItem(`loaded-${selectedFile.name}`)) {
                        toast.success('PGMファイルを読み込みました。');
                        sessionStorage.setItem(`loaded-${selectedFile.name}`, 'true');
                      }
                    }}
                    onLoadError={(error) => toast.error(error)}
                  />
                ) : (
                  <div className="w-full h-full bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
                    <div className="text-center text-gray-500">
                      <p className="text-xl mb-2">ここにPGMファイルをドロップ</p>
                      <p className="text-sm">または、クリックしてファイルを選択</p>
                      <p className="text-sm">対応形式: PGM (P5)</p>
                    </div>
                  </div>
                )}
              </div>

              {/* リサイザー */}
              <div
                ref={resizeRef}
                className="w-1 hover:bg-neutral-400 cursor-col-resize active:bg-neutral-500 transition-colors bg-neutral-200 flex-shrink-0"
                onMouseDown={startResize}
              />

              {/* 右サイドパネル */}
              <div 
                className="bg-white rounded-lg shadow-lg p-6 border border-neutral-200"
                style={{ width: `calc(${100 - resizeRatio}% - 2px)` }}
              >
                <div className="space-y-4">
                  <LayerPanel
                    layers={layers}
                    onToggleLayer={handleToggleLayer}
                  />
                  
                  <WaypointTool
                    waypoints={waypoints}
                    setWaypoints={setWaypoints}
                    onPlanPath={handlePlanPath}
                    isPlanning={isPlanning}
                  />

                  <div className="bg-neutral-100 rounded-lg p-4 border border-neutral-200">
                    <h2 className="text-lg font-semibold text-neutral-800 mb-3">操作方法</h2>
                    <ul className="space-y-2 text-neutral-600">
                      <li>• ドラッグで画像を移動</li>
                      <li>• Shiftキー + スクロールでズーム</li>
                      <li>• グリッド表示で座標確認</li>
                      <li>• PGMファイルをドラッグ&ドロップで読み込み</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </React.Fragment>
  );
}