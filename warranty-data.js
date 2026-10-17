// Entry points checked in a browser on 2026-10-17. No customer serial numbers were submitted.
export const WARRANTY_KINDS = Object.freeze({ SERIAL: '序號查詢', MODEL: '型號保固資訊', LOGIN: '需會員登入', SERVICE: '條款／客服' });
export const WARRANTY_ACTIONS = Object.freeze({ SERIAL: '前往序號查詢', MODEL: '查詢型號保固', LOGIN: '前往會員登入', SERVICE: '查看保固服務' });
export const WARRANTY_DATA = [
  {
    "id": "Genuine",
    "name": "捷元 Genuine",
    "type": "通路/電腦",
    "icon": "G",
    "url": "https://www.genuine.com.tw/Service/guaranteeInfo",
    "kind": "SERIAL",
    "note": "輸入完整產品序號；僅適用捷元供貨或代理產品。",
    "checkedOn": "2026-10-17"
  },
  {
    "id": "Weblink",
    "name": "展碁 Weblink",
    "type": "通路代理",
    "icon": "W",
    "url": "https://www.weblink.com.tw/service-inpuiry.htm",
    "kind": "SERIAL",
    "note": "輸入原廠序號；頁面提供保固內／外資訊，適用展碁通路產品。",
    "checkedOn": "2026-10-17"
  },
  {
    "id": "Xander",
    "name": "建達 Xander",
    "type": "通路代理",
    "icon": "X",
    "url": "https://www.xander.com.tw/repair/warranty_search.aspx",
    "kind": "SERIAL",
    "note": "輸入原廠序號；新品、福利品與專案保固可能不同，以建達或原廠確認為準。",
    "checkedOn": "2026-10-17"
  },
  {
    "id": "Unitech",
    "name": "精技 Unitech",
    "type": "通路代理",
    "icon": "U",
    "url": "https://www.unitech.com.tw/login.aspx",
    "kind": "LOGIN",
    "note": "目前入口為報修會員登入，沒有公開序號查詢欄位；需登入或洽精技確認保固。",
    "checkedOn": "2026-10-17",
    "phone": "02-2792-1521"
  },
  {
    "id": "Lenovo",
    "name": "聯想 Lenovo",
    "type": "電腦/筆電",
    "icon": "Le",
    "url": "https://support.lenovo.com/tw/zh/warranty-lookup",
    "kind": "SERIAL",
    "note": "輸入機器序號；可能顯示英文「Search By Serial Number」。原 PC 支援站曾回傳 no healthy upstream，已改用官方總支援站；如再遇到錯誤，請使用備用客服入口或稍後重試。",
    "checkedOn": "2026-10-18",
    "fallbackUrl": "https://www.lenovo.com/tw/zh/contact/",
    "fallbackLabel": "官方客服／支援（備用）"
  },
  {
    "id": "ViewSonic",
    "name": "ViewSonic",
    "type": "螢幕/投影",
    "icon": "VS",
    "url": "https://www.viewsonic.com/tw/support/warranty/check/",
    "kind": "SERIAL",
    "note": "輸入產品序號；台灣專案或政府採購產品請依合約確認。",
    "checkedOn": "2026-10-17"
  },
  {
    "id": "BenQ",
    "name": "BenQ 明基",
    "type": "螢幕/電子",
    "icon": "BQ",
    "url": "https://www.benq.com/zh-tw/support/registration-warranty/warranty-checker.html",
    "kind": "SERIAL",
    "note": "輸入產品序號，可搭配購買日期；原廠可能要求驗證碼。",
    "checkedOn": "2026-10-17"
  },
  {
    "id": "Gigabyte",
    "name": "技嘉 GIGABYTE",
    "type": "電腦/零件",
    "icon": "GA",
    "url": "https://www.gigabyte.com/tw/Support/Consumer/Warranty/Check",
    "kind": "SERIAL",
    "note": "先按「立即查詢 >」，再輸入產品序號；不需註冊或登入。",
    "checkedOn": "2026-10-17"
  },
  {
    "id": "Philips",
    "name": "飛利浦 Philips",
    "type": "螢幕/家電",
    "icon": "Ph",
    "url": "https://www.philips.com.tw/c-s/support/warranty",
    "kind": "SERVICE",
    "note": "此入口為產品保固政策與客服資訊，沒有通用序號到期日查詢欄位；請備妥型號、序號與購買證明洽原廠。",
    "checkedOn": "2026-10-17"
  },
  {
    "id": "AOC",
    "name": "AOC",
    "type": "螢幕顯示",
    "icon": "AO",
    "url": "https://www.aoc.com/tw/warranty-information",
    "kind": "SERVICE",
    "note": "官方提供保固條款、客服電話及 LINE 服務，未找到公開序號到期日表單。顯示器與大型顯示器服務窗口不同，請依原廠頁面確認。",
    "checkedOn": "2026-10-17",
    "phone": "0800-589-807"
  },
  {
    "id": "ADATA",
    "name": "威剛 ADATA",
    "type": "記憶體/SSD",
    "icon": "AD",
    "url": "https://www.adata.com/tw/support/warranty/",
    "kind": "SERIAL",
    "note": "輸入產品序號及驗證碼；已改為 ADATA 台灣保固查詢頁。",
    "checkedOn": "2026-10-17"
  },
  {
    "id": "Kingston",
    "name": "金士頓 Kingston",
    "type": "記憶體/SSD",
    "icon": "Ki",
    "url": "https://www.kingston.com/tw/company/warranty",
    "kind": "SERVICE",
    "note": "此頁提供各產品保固條款與台灣申請方式，沒有通用序號到期日欄位；請依型號、購買證明與 SSD 耗損條件確認。",
    "checkedOn": "2026-10-17"
  },
  {
    "id": "Transcend",
    "name": "創見 Transcend",
    "type": "記憶體/SSD",
    "icon": "Tr",
    "url": "https://tw.transcend-info.com/support/verification",
    "kind": "SERIAL",
    "note": "輸入產品序號 S/N 或 W/O；不需會員註冊。",
    "checkedOn": "2026-10-17"
  },
  {
    "id": "Seagate",
    "name": "希捷 SEAGATE",
    "type": "硬碟",
    "icon": "SG",
    "url": "https://www.seagate.com/tw/zh/support/warranty-and-replacements/",
    "kind": "SERIAL",
    "note": "在「檢查保固」區輸入序號 SN；OEM 產品可能須洽設備製造商。",
    "checkedOn": "2026-10-17"
  },
  {
    "id": "WD",
    "name": "WD 西部數據",
    "type": "硬碟",
    "icon": "WD",
    "url": "https://support-en.wd.com/app/warrantystatusweb",
    "kind": "SERIAL",
    "note": "先選國家／地區，再輸入硬碟序號；Flash／SSD 可能需轉至 SanDisk 查詢。",
    "checkedOn": "2026-10-17"
  },
  {
    "id": "Toshiba",
    "name": "東芝 Toshiba",
    "type": "硬碟",
    "icon": "To",
    "url": "https://www.afastor.com/tw/registration",
    "kind": "SERIAL",
    "note": "富基電通代理品：輸入序號，查詢出貨日及標準保固期；其他代理商貨請洽原購買通路。",
    "checkedOn": "2026-10-17"
  },
  {
    "id": "Acer",
    "name": "Acer 宏碁",
    "type": "電腦/零件",
    "icon": "AC",
    "url": "https://dss.acer.com.tw/DSSApp/custservice/MachineQuery_EndUser.jsp",
    "phone": "0800-258-222",
    "kind": "SERIAL",
    "note": "擇一輸入機器序號 S/N 或 SNID。",
    "checkedOn": "2026-10-17"
  },
  {
    "id": "Apple",
    "name": "Apple 蘋果",
    "type": "電腦/平板",
    "icon": "Ap",
    "url": "https://checkcoverage.apple.com/?locale=zh_TW",
    "phone": "0800-095-988",
    "kind": "SERIAL",
    "note": "輸入裝置序號，原廠可能要求圖形驗證碼；也可登入檢視裝置權益。",
    "checkedOn": "2026-10-17"
  },
  {
    "id": "ASUS",
    "name": "ASUS 華碩",
    "type": "電腦/零件",
    "icon": "A",
    "url": "https://www.asus.com/tw/support/warranty-status-inquiry/",
    "phone": "0800-093-456",
    "kind": "SERIAL",
    "note": "輸入 10–15 碼產品序號，並依原廠頁面完成必要的同意與驗證。",
    "checkedOn": "2026-10-17"
  },
  {
    "id": "Brother",
    "name": "Brother 兄弟",
    "type": "印表機",
    "icon": "B",
    "url": "https://crm.brother.tw/warranty_searches/new",
    "phone": "0800-600-211",
    "kind": "SERIAL",
    "note": "輸入機器序號並完成原廠 reCAPTCHA 驗證。",
    "checkedOn": "2026-10-17"
  },
  {
    "id": "Canon",
    "name": "Canon 佳能",
    "type": "印表機",
    "icon": "C",
    "url": "https://www.canon.com.tw/service/warrantylist.aspx?SPID=000002",
    "phone": "0809-022-888",
    "kind": "MODEL",
    "note": "以產品類別或型號查詢保固條款，不是個別機器的到期日；實際保固請備妥購買證明洽 Canon。",
    "checkedOn": "2026-10-17"
  },
  {
    "id": "Dell",
    "name": "DELL 戴爾",
    "type": "電腦/伺服器",
    "icon": "D",
    "url": "https://www.dell.com/support/contractservices/zh-tw",
    "phone": "0800-186-971",
    "kind": "SERIAL",
    "note": "輸入 Dell 產品服務編號或 Dell EMC 產品 ID；查詢欄位可能稍後才載入。",
    "checkedOn": "2026-10-17"
  },
  {
    "id": "Epson",
    "name": "Epson 愛普生",
    "type": "印表機",
    "icon": "E",
    "url": "https://www.epson-service.com.tw/servmMaintain.page",
    "phone": "0800-212-873",
    "kind": "SERIAL",
    "note": "在「保固查詢」區輸入機器序號；購買登錄、耗材活動或列印張數可能影響保固。",
    "checkedOn": "2026-10-17"
  },
  {
    "id": "HP",
    "name": "HP 惠普",
    "type": "電腦/印表機",
    "icon": "HP",
    "url": "https://support.hp.com/tw-zh/check-warranty",
    "phone": "0800-010-055",
    "kind": "SERIAL",
    "note": "選擇購買國家／地區並輸入序號，部分產品可能另需產品編號。",
    "checkedOn": "2026-10-17"
  },
  {
    "id": "MSI",
    "name": "MSI 微星",
    "type": "電腦/零件",
    "icon": "M",
    "url": "https://account.msi.com/zh-Hant/services/warranty-book",
    "phone": "0800-018-880",
    "kind": "SERIAL",
    "note": "輸入產品序號與圖形驗證碼，依原廠頁面完成查詢同意。",
    "checkedOn": "2026-10-17"
  }
];
