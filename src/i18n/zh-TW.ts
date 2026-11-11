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

  'title.lead': '吃光所有寶石過關。燃料不斷消耗，寶石能補油；小心岩石，一撞就爆。',
  'title.drive': '駕駛，車子自動前進',
  'cta.start': '按 {key} 或點一下畫面開始',
  'cta.restart': '按 {key} 或點一下畫面重新開始',
  'cta.resume': '按 {key} 或點一下畫面繼續',

  'ready.go': '準備出發',
  'crash.fuel': '燃料耗盡',
  'crash.rock': '撞上岩石',
  'clear.title': '過關',
  'clear.fuelBonus': '燃料加成 +{n}',
  'clear.time': '本關時間 {t}',
  'over.title': '遊戲結束',
  'over.score': '得分 {n}',
  'over.summary': '突破 {n} 關・用時 {t}',
  'over.record': '刷新最高紀錄！',
  'pause.title': '暫停',

  'btn.pause': '暫停',
  'btn.resume': '繼續',

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
