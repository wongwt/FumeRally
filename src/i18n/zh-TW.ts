/** Source-of-truth message table. Other languages must provide exactly the same keys. */
export const zhTW = {
  'app.title': '廢氣拉力賽',
  'app.subtitle': 'FUME RALLY',
  'app.language': '語言',

  'hud.score': '分數',
  'hud.hi': '最高',
  'hud.level': '關卡',
  'hud.combo': '連擊',
  'hud.lives': '生命',
  'hud.gems': '寶石',
  'hud.power': '無敵',
  'hud.armor': '裝甲',
  'hud.siren': '警笛',
  'hud.time': '時間',
  'hud.fuel': '燃料',
  'hud.livesAria': '剩餘 {n} 台車',

  'view.scroll': '視角：追焦',
  'view.full': '視角：全圖',

  'error.webgl.title': '無法啟動 WebGL',
  'error.webgl.body': '這個瀏覽器或裝置沒有開啟 WebGL，遊戲無法顯示。',

  'keys.or': '或',
  'keys.drive': '駕駛',
  'keys.smoke': '放廢氣',
  'keys.pause': '暫停',
  'keys.view': '切換視角',
  'keys.mute': '靜音',
  'keys.space': '空白鍵'
} as const;

export type MessageKey = keyof typeof zhTW;
export type Messages = Record<MessageKey, string>;
