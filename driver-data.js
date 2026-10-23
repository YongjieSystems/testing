import { WARRANTY_DATA } from './warranty-data.js?v=1.13.3';

// Official entry points reviewed 2026-10-18. No installer was downloaded or run.
export const DRIVER_CATEGORIES = { COMPUTER:'電腦／主機板／零件', PRINTER:'印表機／掃描器', DISPLAY:'螢幕／投影機' };
const entries = [
  ['Genuine','COMPUTER','https://www.genuine.com.tw/DriverDownLoadList/1000','選擇捷元電腦的產品類別與完整型號，再下載對應作業系統的驅動。'],
  ['Lenovo','COMPUTER','https://support.lenovo.com/tw/zh/','先選 PC 或資料中心產品，再選機型或輸入序號，進入「驅動程式和軟體」。若子站暫時出現 upstream 錯誤，請稍後重試。'],
  ['ViewSonic','DISPLAY','https://www.viewsonic.com/tw/support/downloads','輸入顯示器、投影機或互動顯示器型號，選擇該產品提供的驅動或軟體。'],
  ['BenQ','DISPLAY','https://www.benq.com/zh-tw/support/downloads-faq/download-search.html','搜尋型號或選擇產品類別，進入軟體／驅動下載；不是每一款產品都有獨立驅動。'],
  ['Gigabyte','COMPUTER','https://www.gigabyte.com/tw/Support/Consumer/Download','以型號或序號找產品；主機板請核對 PCB 版本（rev.）與作業系統。'],
  ['Philips','DISPLAY','https://www.philips.com.tw/c-s/support','輸入完整顯示器型號（含 /96 等尾碼），進入產品支援中的「軟體與驅動程式」。此入口須先選產品。'],
  ['AOC','DISPLAY','https://www.aoc.com/tw/drivers-downloads','搜尋顯示器完整型號，再選取原廠提供的驅動、色彩設定檔或軟體。'],
  ['Acer','COMPUTER','https://www.acer.com/tw-zh/support/drivers-and-manuals','輸入序號、SNID 或產品型號，選取對應作業系統的驅動程式。'],
  ['Apple','COMPUTER','https://support.apple.com/zh-tw/102465','僅為 Intel 處理器 Mac 的 Boot Camp／Windows 支援軟體下載操作指引。需在 Mac 上用「啟動切換輔助程式」下載；不適用 Apple 晶片 Mac。','GUIDE'],
  ['ASUS','COMPUTER','https://www.asus.com/tw/support/download-center/','輸入完整型號，進入「驅動程式及工具程式」，核對作業系統版本。'],
  ['Brother','PRINTER','https://support.brother.com/g/b/productsearch.aspx?c=tw&lang=zh&content=dl','依型號搜尋或產品類別選機器，再選 Windows／macOS／Linux 版本與語言。'],
  ['Canon','PRINTER','https://tw.canon/zh_TW/support','以型號名稱搜尋，進入「驅動程式、軟體及韌體」，確認作業系統與連線方式。'],
  ['Dell','COMPUTER','https://www.dell.com/support/home/zh-tw?app=drivers','輸入產品服務編號或型號，再選「驅動程式與下載」。若被轉至其他地區，可在原廠網站切回台灣／繁體中文。'],
  ['Epson','PRINTER','https://www.epson.com.tw/Support/Printers/sh/s1','選擇印表機型號，再至下載區核對作業系統；掃描器可由原廠支援服務切換產品類別。'],
  ['HP','COMPUTER','https://support.hp.com/tw-zh/drivers','可選印表機、筆記型電腦或桌上型電腦，輸入型號／序號後選作業系統；印表機也可由官方 123.hp.com 進入設定。'],
  ['MSI','COMPUTER','https://tw.msi.com/support/download','依產品線、系列與型號找驅動；主機板與筆電型號不可混用。'],
];
export const DRIVER_DATA=entries.map(([id,category,url,note,kind='DRIVER'])=>{
  const brand=WARRANTY_DATA.find(item=>item.id===id);
  return {id,name:brand.name,icon:brand.icon,category,categories:id==='HP'?['COMPUTER','PRINTER']:[category],url,note,kind,checkedOn:'2026-10-18'};
});
export const DRIVER_EXCLUSIONS = [
  ['Weblink','展碁為多品牌通路，公開檔案下載區未確認有通用驅動選型入口，請依設備實際品牌找原廠。'],
  ['Xander','建達為多品牌代理商，未確認有公開通用驅動下載入口，請依設備實際品牌找原廠。'],
  ['Unitech','精技為多品牌代理商，未確認有公開通用驅動下載入口；與精聯電子 unitech 並非同一家公司。'],
  ['ADATA','本次找到 SSD Toolbox 管理／韌體工具，未列為通用驅動下載。記憶體本身通常不需獨立驅動。'],
  ['Kingston','本次找到 SSD Manager 管理／韌體工具，未列為通用驅動下載。'],
  ['Transcend','本次找到產品支援與儲存工具；未確認目前台灣通用驅動下載頁，因此暫不新增。'],
  ['Seagate','本次找到 SeaTools、Toolkit 等儲存工具，未列為通用驅動下載。'],
  ['WD','本次找到儲存管理／韌體工具，未列為通用驅動下載；SSD 另可能由 SanDisk 提供支援。'],
  ['Toshiba','保固清單對應 Toshiba 硬碟，未確認有適用的通用獨立驅動入口；不混用 Toshiba 印表機或舊筆電驅動。'],
].map(([id,reason])=>({id,name:WARRANTY_DATA.find(item=>item.id===id).name,reason}));
export function matchesDriver(brand,query='',category='ALL') {
  const words=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return (category==='ALL'||brand.categories.includes(category)) && words.every(word=>`${brand.name} ${brand.id} ${brand.categories.map(key=>DRIVER_CATEGORIES[key]).join(' ')} ${brand.note}`.toLocaleLowerCase().includes(word));
}
