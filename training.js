// 登入保存：24 小時（預設）／記住此電腦 30 天／共用電腦僅本次登入；按登出清除記住登入。
// 員工登入：三套使用同一帳號，各網站分別登入。主管可寄重設信，密碼由本人設定。
const tracks = {
    basic: {name:'新人基本操作',steps:[
        ['認識保存位置','「保存報價」存在目前瀏覽器；「同步目前估價至團隊」才讓同事共用。登入不會自動上傳全部歷史。','確認自己分得清本機歷史與團隊共用案件。登入可選24小時、個人電腦30天或共用電腦僅本次登入；期限從登入起算，登出會清除記住登入。','quote'],
        ['建立檢測估價','先保存未完成表單，再按「建立新報價」。填客戶、型號、設備種類、服務方式、故障現象及報價人員。','檢查右側客戶、設備、金額與報價單號。','quote'],
        ['選擇三種服務方式','門市檢測：客戶自行送件，不收收送費，檢測費照原規則。到府檢測：選服務區域，沿用原出勤費，後續取回與回送依原約定確認。客製化收送服務：一般安排不適用或需特殊調度時，再選方案、填完整收送費及約定時段。','只有客製化收送會顯示方案、內部成本試算及實際工程師時間；切換服務不會刪除已填成本，但門市與到府不採用客製化收送費。','quote'],
        ['確認費用與服務範圍','檢測階段不含零件耗材。本頁切換維修階段時，維修總費用取代檢測基本費；若使用另一套維修程式，請依「檢測 → 維修 → 收送完整流程」連結共用案件並核准折抵。已包含的費用不要再加一次。','待確認項目未補齊時，只能當小計，不要承諾完整報價。','quote'],
        ['保存與交付報價','選正確處理狀態，按「保存報價」。本頁輸出是客戶精簡報價，複製或列印前核對客戶、設備、費用及收送約定；格式精簡不代表已正式核准。','看到保存成功提示，並在本機歷史找到該案。','quote'],
        ['查詢原廠保固','選品牌後看入口類型，再前往原廠輸入序號。型號條款不是個別機器到期日；查不到不等於過保。','在案件備註記下查詢日期與結論，估價頁保固狀態需自行確認。','warranty'],
        ['找正確驅動並備份','驅動中心先選品牌，到原廠核對完整型號及作業系統再下載。每日依公司安排匯出報價備份，妥善保存。','知道驅動入口在哪，也知道本機備份不能取代完整雲端備份。','drivers'],
        ["先預覽，再複製客戶版", "填好資料後往下展開「客戶報價預覽」。依序核對服務內容、費用明細及收送約定；故障現象會完整帶出。按「複製文字摘要」，看到「已複製內容」後貼到LINE、郵件或文件，再核對一次才交付。", "預覽不會保存或同步。故障欄請填適合給客戶看的文字；待確認不代表免費，內部成本、姓名與部門不帶出。", "quote"],
        ["列印或另存客戶報價PDF", "先展開「客戶報價預覽」核對內容，再按「列印客戶版報價」。在瀏覽器列印預覽逐頁檢查，選印表機或「另存為PDF」；貼上文字、列印及預覽使用相同客戶摘要。", "手機請往下滑到報價區。案件備份及原始資料備援是內部資料，不是客戶報價PDF。", "quote"],
        ["分清三套程式的交付方式", "檢測客戶版標題為「永捷檢測報價」；內部草稿與團隊核准狀態分開管理，手動選狀態不代表核准。維修本機報價可依主管口頭確認直接交付；需要團隊已核准正式版時，連結原案、同步及核准後由維修團隊頁輸出。租賃正式版仍須團隊核准。", "保存、同步、客戶同意與主管核准是不同步驟；直接交付本機維修報價不會自動建立線上核准紀錄。", "maintenance"],
    ]},
    integration: {name:'檢測 → 維修 → 收送完整流程',steps:[
        ['先保存，再同步檢測案件','在檢測報價填好客戶、設備、故障、服務方式及約定費用，按「保存報價」。登入「團隊作業」後按「同步目前估價至團隊」，確認成功及版本。','只有本機歷史的紀錄不會出現在維修共用列表。請記下客戶與案件，避免連錯。','team'],
        ['在維修程式連結原案件','開啟維修估價程式，使用同一員工帳號登入團隊。在「維修報價同步與檢測費整合」的「選擇已有檢測案件」選原案，按「連結並帶入檢測客戶資料」，返回草稿填設備及維修項目。已有維修版本時，從共用維修案件按「載入維修（修改後另存版本）」。','檢測與維修共用同一案件；不要為同一客戶重建第二案。不同分頁可能需再次登入。','maintenance'],
        ['確認維修價格與客戶同意','在維修草稿核對零件、工資、運費、折扣及調整原因，正式報價須確認單一金額。回到團隊填「檢測費折抵」，按「同步目前維修草稿（送主管核准）」。','記錄客戶同意的金額、範圍、方式與時間；同步成功不代表主管已核准。','maintenance'],
        ['檢測費折抵不是自動免收','維修程式的「檢測費折抵」預設 0，需要折抵時填金額並送主管核准。上限是原檢測報價扣掉原收送／出勤費後的金額。按「檢視此版明細」核對原檢測、維修小計、折抵與案件合計。','檢測程式內的「維修報價（免另收檢測費）」是本機計費方式，不會自動連結或核准另一套維修程式的折抵。跨程式作業請以共用維修明細為準。','maintenance'],
        ['不要重收同一趟收送費','例如原檢測 500＋收送 300＝800；維修小計 1,000（又含收送 300）；核准檢測折抵 500。案件合計＝800＋1,000－500－300＝1,000 元。系統扣除同一收送重複列出的較小金額，原到府出勤費不當作重複收送。','已收金額只是參考，要再對公司收款紀錄；折抵不會自動扣款、退款或入帳。','maintenance'],
        ['主管分別核准檢測與維修','主管先在「共用案件」選取原案，在「主管管理」填原因並按「核准最新報價與減免」。再到維修程式的「共用維修案件與主管核准」，核對明細，填主管理由及客戶同意方式與時間，按「核准本版維修與折抵」。','檢測核准不等於維修核准。任一報價或折抵改動後要重新同步、核准最新版本，正式維修報價從維修團隊頁輸出。','maintenance'],
        ['同一案件安排取件與回送','兩套程式共用路線，不要各排一次。在「集中排線」展開「編排路線草稿」，按「另建空白路線」，填名稱、人員與整趟時間，按「加入站點」選案件、取件或回送，填地址與各站時間。依行程順序加入站點，保存後由主管按「核准發布排線」。','臺北時間填寫；取件與回送是不同站點，預留車程與交接。系統不自動計算最佳路徑。回送發布及完成回報會再檢查最新維修核准。','team'],
        ['回報交接並完成案件','收送人員用本人帳號在「集中排線／我的任務」查看已發布路線。實際交接後按「回報已完成」；無法完成先填原因，再按「回報無法完成」並通知客服。主管最後核對維修、交接與收款，再結案。','未完成取件不能回報回送完成；路線結束不代表已修好或收款。已結案或回送完成後不能再改價，新需求另建新案。','team'],
    ]},
    dispatch: {name:'客服與收送流程',steps:[
        ['確認完整收送約定','需要特殊安排時選「客製化收送服務」。可選順路排線、預約專程、優先收送或外包物流；收送費包含約定取件及回送，空白不是免費。填雙程時段，取得客戶同意後再勾確認。順路排線還需確認能執行的路線。','一般到府檢測沿用原區域出勤費，不必填客製化方案與成本；優先收送不代表當日修復，檢修急件另約。','quote'],
        ['同步並請主管核准','保存本機後，到團隊按「同步目前估價至團隊」。確認成功及最新版本，請主管核准；修改後同步會使原核准失效。','共用案件顯示正確內容，主管已核准最新報價。','team'],
        ['建立路線草稿','填路線名稱、人員、開始與結束時間，依順序加入案件、取件或回送、地址與站點時間。預留交通及交接，保存草稿後請主管發布。','只有已開通且啟用的工程師或收送人員可選；系統不會自動算車程。','team'],
        ['依順序回報','用本人帳號查看已發布任務。每站完成後回報；無法完成必須寫原因並通知客服。未取件不能回報回送完成。','路線結束不代表修好、收款或整案結案，仍需主管核對。','team'],
    ]},
    manager: {name:'主管管理與成本',steps:[
        ['新增員工並給適當權限','展開「員工名單與權限」，填電子郵件、姓名、角色，勾啟用後保存。新帳號產生一次性連結並私下交給本人設定密碼。','客服、工程師、收送人員各用本人帳號，不要全部設成主管。','team'],
        ['核准與技術分派','先從共用案件按「選取供主管處理」，填原因並核准最新報價。需要維修分工時再選技術工程師及分派。','核准不等於客戶同意；技術分派與路線收送人員分開。','team'],
        ['核對成本與發布路線','成本試算要含完整雙程、人員、交通及其他費用。低於目標時調整方案或費用。發布前核對人員、時間及站點順序。','試算不會自動改收費；改價須客戶同意並重新核准。','team'],
        ['結案與成效核對','核對維修、交接、未完任務及收款，再選案件填原因並結束。本機成效另須保存最新已完成版本及完整核對的實際成本。','本機成效不是全公司雲端報表；工程師時間已包含在人員總分鐘內，不重複加計。','team'],
    ]},
};
const questions=[
    {q:'檢測報價已核准，維修報價是否也已核准？',options:['是，同一案件只需核准一次','否，維修與折抵仍須另外核准最新版本'],answer:1,why:'主管先核准檢測，再核准維修與折抵；改價後需重新核准。'},
    {q:'兩套程式都看得到收送案件，要各排一條路線嗎？',options:['不用，兩套程式共用案件與路線','需要各建立一次'],answer:0,why:'同一案件不要重複排線；取件與回送分別建立站點。'},
    {q:'按「保存報價」後，同事一定看得到嗎？',options:['一定看得到','還需要同步至團隊，並依角色權限查看'],answer:1,why:'本機保存與團隊同步是兩個動作。'},
    {q:'收送費尚未確認，應如何處理？',options:['留白並保留待確認，先存草稿','填 0 元代表以後再談'],answer:0,why:'0 元代表已確認免收；空白才是未知。'},
    {q:'路線所有站點都已回報，是否就代表整案結束？',options:['是，系統已確認修復與收款','否，主管仍須核對維修、交接及收款'],answer:1,why:'路線結束可能含無法完成的站點，整案結案需另外確認。'},
];
export function initTraining(switchTab) {
    const $=id=>document.getElementById(id);
    const make=(tag,text,className='')=>{const el=document.createElement(tag);el.textContent=text;el.className=className;return el;};
    const storageKey='yj_training_progress_v1';
    const valid=new Set(Object.entries(tracks).flatMap(([key,track])=>track.steps.map((_,i)=>`${key}-${i}`)));
    let done=new Set();
    try {const saved=JSON.parse(localStorage.getItem(storageKey)||'[]');if(Array.isArray(saved))done=new Set(saved.filter(id=>valid.has(id)));} catch {$('training-storage').textContent='此瀏覽器無法讀取學習紀錄，仍可閱讀教學。';}
    function save(){try{localStorage.setItem(storageKey,JSON.stringify([...done]));$('training-storage').textContent='學習紀錄只存在此瀏覽器，不會送到主管或雲端。';}catch{$('training-storage').textContent='學習紀錄保存失敗，本次仍可閱讀；重新開啟可能不會保留勾選。';}}
    function render(){
        const key=$('training-track').value;const track=tracks[key];const list=$('training-steps');list.replaceChildren();
        $('training-progress').textContent=`${track.name}：已自行確認 ${track.steps.filter((_,i)=>done.has(`${key}-${i}`)).length}／${track.steps.length} 步；全部路徑 ${done.size}／${valid.size} 步。`;
        track.steps.forEach(([title,text,check,target],i)=>{
            const item=make('section','','border rounded-2xl p-5 space-y-3 bg-white');
            item.append(make('h3',`${i+1}. ${title}`,'font-bold text-lg'),make('p',text,'text-sm leading-7'),make('p','完成時檢查：'+check,'text-sm text-slate-600 leading-7'));
            const controls=make('div','','flex flex-wrap items-center gap-4');
            const go=make(target==='maintenance'?'a':'button',`前往${{quote:'檢測報價',warranty:'保固查詢',drivers:'驅動程式',team:'團隊作業',maintenance:'維修估價程式'}[target]}`,'bg-blue-100 text-blue-800 p-3 rounded-xl font-bold');if(target==='maintenance'){go.href='https://yongjiesystems.github.io/Maintenance/?v=2.4.1';go.target='_blank';go.rel='noopener noreferrer';}else{go.type='button';go.onclick=()=>switchTab(target);}
            const label=make('label','我已閱讀並理解這一步','flex items-center gap-2 text-sm');const box=make('input','');box.type='checkbox';box.checked=done.has(`${key}-${i}`);box.setAttribute('aria-label',`${track.name} 第 ${i+1} 步 已閱讀並理解`);
            box.onchange=()=>{box.checked?done.add(`${key}-${i}`):done.delete(`${key}-${i}`);save();$('training-progress').textContent=`${track.name}：已自行確認 ${track.steps.filter((_,n)=>done.has(`${key}-${n}`)).length}／${track.steps.length} 步；全部路徑 ${done.size}／${valid.size} 步。`;};label.prepend(box);controls.append(go,label);item.append(controls);list.append(item);
        });
    }
    $('training-track').onchange=render;render();
    questions.forEach((item,i)=>{
        const field=make('fieldset','','border rounded-xl p-4 space-y-3');field.append(make('legend',`${i+1}. ${item.q}`,'font-bold'));
        item.options.forEach((text,j)=>{const label=make('label',text,'flex items-start gap-2 text-sm');const radio=make('input','');radio.type='radio';radio.name=`training-q-${i}`;radio.value=String(j);label.prepend(radio);field.append(label);});$('training-quiz').append(field);
    });
    $('training-check-quiz').onclick=()=>{
        const result=$('training-quiz-result');result.replaceChildren();let score=0;
        questions.forEach((q,i)=>{const chosen=document.querySelector(`input[name="training-q-${i}"]:checked`);const correct=chosen?.value===String(q.answer);if(correct)score++;result.append(make('p',`第 ${i+1} 題${!chosen?'尚未作答':correct?'答對':'請再確認'}：${q.why}`,'text-sm leading-7'));});
        result.prepend(make('p',`本次答對 ${score}／${questions.length} 題。這是自我練習，不是正式考核或權限認證。`,'font-bold'));
    };
}
