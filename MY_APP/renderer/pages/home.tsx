import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { FaMap } from 'react-icons/fa';
import { Sidebar } from '../components/common/sidebar';
import { DatabaseItems } from '../components/common/database-items';

export default function HomePage() {
  return (
    <React.Fragment>
      <Head>
        <title>ホーム - PGM Map Editor</title>
      </Head>
      <Sidebar />
      <div className="ml-16 min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-gray-800 mb-6">
            PGM Map Editor
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            PGMファイルを使用して地図編集を行うためのツールです。
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Link href="/pgm-viewer" className="block">
              <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
                <div className="flex items-center mb-4">
                  <FaMap className="w-8 h-8 text-blue-500 mr-3" />
                  <h2 className="text-2xl font-semibold text-gray-800">
                    PGM ビューアー
                  </h2>
                </div>
                <p className="text-gray-600">
                  PGMファイルを開いて表示・編集することができます。グリッド表示や座標確認などの機能を使用できます。
                </p>
              </div>
            </Link>
            {/* 追加の機能カードをここに配置できます */}
          </div>

          {/* データベース項目を追加 */}
          <div className="mt-8">
            <DatabaseItems />
          </div>

          <div className="mt-12 bg-blue-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-800 mb-2">
              使い方
            </h3>
            <ul className="list-disc list-inside text-blue-700 space-y-2">
              <li>サイドバーのアイコンから各機能にアクセスできます</li>
              <li>PGMビューアーでは、ファイルを開いて内容を確認できます</li>
              <li>Shiftキーを押しながらスクロールでズームイン/アウトができます</li>
              <li>グリッド表示で正確な座標を確認できます</li>
            </ul>
          </div>
        </div>
      </div>
    </React.Fragment>
  );
}