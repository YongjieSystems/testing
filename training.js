// 指定工程師可另外開通助理作業權限，涵蓋三套估價與同團隊共用案件；主管權限不變。
// 登入保存：24 小時（預設）／記住此電腦 30 天／共用電腦僅本次登入；按登出清除記住登入。
// 員工登入：三套使用同一帳號，各網站分別登入。主管可寄重設信，密碼由本人設定。
const tracks = {"basic": {"name": "三步完成檢測報價", "steps": [["填本次檢測需求", "填客戶稱呼、設備型號及故障現象。 選設備與服務方式，檢測與維修分開計費。", "不必等主管登入。", "quote"], ["先看客戶預覽", "核對故障、服務、費用與「報價聲明」，再複製或列印客戶版。聲明含新增費用須取得同意、不維修的約定費用、時程及含稅價格；不帶出內部成本。", "有待確認要先告知客戶。", "quote"], ["保存到團隊", "到團隊紀錄按「保存到團隊」，看到成功與版本後，同事即可接手。", "本機保存不等於團隊保存。", "team"]]}, "team": {"name": "共用紀錄與收送", "steps": [["同事接手", "共用清單找到客戶或單號，保存目前表單後載入修改，再保存新版。", "版本衝突先載入比較，不會強行覆寫。", "team"], ["直接安排收送", "新增路線、選人員與時間、按順序加站點，保存後按發布收送安排。", "不需主管核准，但費用、時間與人員要先確認。", "team"], ["回報與完成", "依實際交接回報；無法完成寫原因。經辦確認工作完成後可結案。", "不要為了清空任務而提前按完成。", "team"]]}, "manager": {"name": "主管與公司公告", "steps": [["日常不必核准", "助理與已開通同等作業權限的 engineer@service5c.com.tw 可在三套估價、保存與查詢同團隊案件、複製及列印。主管不必登入或核准，同事也能正常工作。一般收送帳號仍只看自己的任務。", "主管負責新增／停用員工、調整帳號權限、查看主管私有成本及發布公司公告；一般報價與收送安排不再等主管核准。", "team"], ["發布公告", "在頁面上方公司公告填標題與純文字，發布後三套約30秒內更新；可修改或下架。", "同事只閱讀，不加已讀打卡。", "team"], ["需要時再查紀錄", "主管可事後看共用版本與操作紀錄；舊關聯及舊核准資料保留歷史。", "新的檢測、維修及租賃各自獨立，不帶入、不自動折抵。", "team"]]}, "money": {"name": "新版金額欄位怎麼填", "steps": [["步驟1", "填客戶稱呼、設備型號及故障現象，再選設備與服務方式。故障現象會附在客戶報價，請寫得清楚。", "只填數字，核對金額後再保存。", "quote"], ["步驟2", "「NT$」表示新臺幣；貨車圖示表示收送或交通費。只輸入數字，不必再打NT$、逗號或負號。", "只填數字，核對金額後再保存。", "quote"], ["步驟3", "特殊減免、合約折抵填要扣除的正數，例如減免200元就填200；系統會扣除，請勿填-200。", "只填數字，核對金額後再保存。", "quote"], ["步驟4", "原廠檢測費及其他費用只填本次另外加收金額。不要把已列入的費用再填一次。", "只填數字，核對金額後再保存。", "quote"], ["步驟5", "客製化收送才填完整收送費；門市不收收送費，到府依目前方案計費。遠端基本費仍為500元。", "只填數字，核對金額後再保存。", "quote"], ["步驟6", "核對右側費用及客戶預覽，再保存或交付。維修另開維修程式，不從檢測帶入或自動折抵。", "只填數字，核對金額後再保存。", "quote"]]}, "rental": {"name": "租賃公版、客製化、收送與押金", "steps": [["先選計價方式", "公版按既有方案與期數計算；客製化填每台整段基本租金與報價說明，取代公版基本租金。", "不要把整批總額當每台價格。", "rental"], ["用例子核對", "每台15天1,800元、3台，填1800與數量3，基本租金5,400元。超印依原規則另計；客製價預設不再疊加優惠。", "切回公版會清除客製金額及說明。", "rental"], ["收送分項", "在STEP 03按送裝費或回收費，分別核對每次金額、數量、次數及範圍。選交付方式不會自動加費。", "例：送裝600與回收600，各填一項。", "rental"], ["押金另列", "選另收、免收或待確認。另收填整張報價總額，可帶入已乘台數的參考額；免收需原因。", "押金不計入租金，帶入也不是收款。", "rental"], ["看預覽再交付", "核對客戶表格，複製文字或列印。操作提醒不外傳，未報價費用仍標示待估。完整步驟見第5版手冊14至17頁。", "保存到團隊成功後，同事才能共用。", "rental"]]}};
const questions=[{"q": "主管今天沒登入，已開通的助理／工程師可以報價嗎？", "options": ["可以，保存與交付照常", "不行，必須等核准"], "answer": 0, "why": "三套已取消主管核准，經辦人可直接處理。"}, {"q": "維修要從檢測單帶入費用嗎？", "options": ["要，自動折抵", "不要，各自獨立計費"], "answer": 1, "why": "新的案件不再跨程式帶入或自動折抵，避免重複計費。"}, {"q": "公司公告要每套各發一次嗎？", "options": ["不用，同團隊三套共用", "要，每套都要填"], "answer": 0, "why": "主管寫一次，三套頁面約30秒內更新。"}];
export function initTraining(switchTab) {
    const $=id=>document.getElementById(id);
    const make=(tag,text,className='')=>{const el=document.createElement(tag);el.textContent=text;el.className=className;return el;};
    const storageKey='yj_training_progress_simple_v2';
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
            const go=make(['maintenance','rental'].includes(target)?'a':'button',`前往${{quote:'檢測報價',warranty:'保固查詢',drivers:'驅動程式',team:'團隊作業',maintenance:'維修估價程式',rental:'租賃估價程式'}[target]}`,'bg-blue-100 text-blue-800 p-3 rounded-xl font-bold');if(['maintenance','rental'].includes(target)){go.href=target==='rental'?'https://equipment-rental-calculator.vercel.app/':'https://yongjiesystems.github.io/Maintenance/';go.target='_blank';go.rel='noopener noreferrer';}else{go.type='button';go.onclick=()=>switchTab(target);}
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
