const tracks = {
    basic: {name:'新人基本操作',steps:[
        ['認識保存位置','「保存報價」存在目前瀏覽器；「同步目前估價至團隊」才讓同事共用。登入不會自動上傳全部歷史。','確認自己分得清本機歷史與團隊共用案件。','quote'],
        ['建立檢測估價','先保存未完成表單，再按「建立新報價」。填客戶、型號、設備種類、服務方式、故障現象及報價人員。','檢查右側客戶、設備、金額與報價單號。','quote'],
        ['確認費用與服務範圍','檢測階段不含零件耗材。客戶同意維修後切換維修階段，維修總費用取代檢測基本費。已包含的費用不要再加一次。','待確認項目未補齊時，只能當小計，不要承諾完整報價。','quote'],
        ['保存與交付報價','選正確處理狀態，按「保存報價」。列印或複製文字摘要前先核對內容；複製後仍需自行貼到交付位置。','看到保存成功提示，並在本機歷史找到該案。','quote'],
        ['查詢原廠保固','選品牌後看入口類型，再前往原廠輸入序號。型號條款不是個別機器到期日；查不到不等於過保。','在案件備註記下查詢日期與結論，估價頁保固狀態需自行確認。','warranty'],
        ['找正確驅動並備份','驅動中心先選品牌，到原廠核對完整型號及作業系統再下載。每日依公司安排匯出報價備份，妥善保存。','知道驅動入口在哪，也知道本機備份不能取代完整雲端備份。','drivers'],
    ]},
    dispatch: {name:'客服與收送流程',steps:[
        ['確認完整收送約定','服務方式選「收回公司檢測」。收送費包含約定取件及回送；空白不是免費。填雙程時段，取得客戶同意後再勾確認。經濟排線還需確認能執行的路線。','優先取件不代表當日修復；檢修急件與優先收送分開談。','quote'],
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
            const go=make('button',`前往${{quote:'檢測報價',warranty:'保固查詢',drivers:'驅動程式',team:'團隊作業'}[target]}`,'bg-blue-100 text-blue-800 p-3 rounded-xl font-bold');go.type='button';go.onclick=()=>switchTab(target);
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
