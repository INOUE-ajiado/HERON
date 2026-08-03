/**
 * HERON コンセプトカラー（設計書 第2部 1章）。
 *
 * アオサギの「スマートさ（知性）」「静寂（保管）」を表す
 * ネイビー〜シルバーのモノトーン7段階。
 */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        heron: {
          // Main 1 (Heron Navy) — テキスト、サイドバー、アイコン。
          navy: '#2A3A4A',
          // Gradient Step 1〜5
          1: '#465463',
          2: '#626F7B',
          3: '#7F8994',
          4: '#9BA3AD',
          5: '#B7BEC5',
          // Main 2 (Silver Plumage) — ベース背景、パネル、仕切り線。
          silver: '#D3D8DE',
        },
        // ステータス表示用のアクセント。モノトーン基調を崩さない彩度に抑える。
        status: {
          available: '#3F7D58',   // 保管中
          inuse: '#2F6FA8',       // 利用中
          maintenance: '#B07D2B', // 修理・メンテナンス中
          discarded: '#8A8F96',   // 廃棄・除却
        },
      },
      backgroundImage: {
        // 設計書記載の副色グラデーション。ヘッダー背景・ホバー・プログレスバー用。
        'heron-gradient':
          'linear-gradient(135deg, #465463, #626F7B, #7F8994, #9BA3AD, #B7BEC5)',
      },
      fontFamily: {
        sans: [
          'Hiragino Kaku Gothic ProN',
          'Yu Gothic UI',
          'Meiryo',
          'system-ui',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};
