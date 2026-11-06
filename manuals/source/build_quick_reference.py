from pathlib import Path
import argparse,html
from reportlab.pdfgen import canvas
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.graphics import renderPDF
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from pypdf import PdfReader

ROOT=Path(__file__).resolve().parent.parent
parser=argparse.ArgumentParser()
parser.add_argument('--output',type=Path,default=ROOT/'output/pdf/yongjie-quote-quick-reference-2026-11-06-v2.pdf')
out=parser.parse_args().output;out.parent.mkdir(parents=True,exist_ok=True)
pdfmetrics.registerFont(TTFont('QuickCJK','C:/Windows/Fonts/msjh.ttc',subfontIndex=0))
pdfmetrics.registerFont(TTFont('QuickBold','C:/Windows/Fonts/msjhbd.ttc',subfontIndex=0))
W,H=A4;L=34;CW=W-2*L
NAVY=colors.HexColor('#132B4A');BLUE=colors.HexColor('#1745A6');LINE=colors.HexColor('#B4C5DC')
c=canvas.Canvas(str(out),pagesize=A4,pageCompression=1)
c.setTitle('永捷報價快速操作表 - 保存、複製與手機備援')
c.setAuthor('永捷系統科技');c.setSubject('A4一頁式；檢測、維修、租賃共用')
body=ParagraphStyle('body',fontName='QuickCJK',fontSize=13.5,leading=19,textColor=NAVY,wordWrap='CJK')
small=ParagraphStyle('small',fontName='QuickCJK',fontSize=11.5,leading=16,textColor=NAVY,wordWrap='CJK')
def text(t,x,y,width,style=body):
 p=Paragraph(html.escape(t,quote=False),style);_,height=p.wrap(width,H)
 p.drawOn(c,x,y-height);return y-height
def heading(n,title,top):
 c.setFillColor(BLUE);c.roundRect(L,top-27,38,27,6,fill=1,stroke=0)
 c.setFillColor(colors.white);c.setFont('QuickBold',15);c.drawCentredString(L+19,top-20,n)
 c.setFillColor(NAVY);c.setFont('QuickBold',18);c.drawString(L+50,top-21,title)
 return top-33
def bullet(n,t,y):
 c.setFillColor(BLUE);c.setFont('QuickBold',13);c.drawString(L+7,y-16,n)
 return text(t,L+31,y,CW-38)-3
def divider(y):
 c.setStrokeColor(LINE);c.line(L,y,L+CW,y);return y-10

c.setFillColor(NAVY);c.setFont('QuickBold',27);c.drawString(L,H-42,'報價快速操作表')
c.setFont('QuickCJK',13);c.drawString(L,H-65,'檢測・維修・租賃共用  |  先用員工帳號登入')
y=H-80
c.setFillColor(colors.HexColor('#EEF4FC'));c.roundRect(L,y-31,CW,31,7,fill=1,stroke=0)
c.setFillColor(BLUE);c.setFont('QuickBold',13.3);c.drawCentredString(W/2,y-21,'看預覽 → 保存到團隊 → 複製報價 → 貼上核對')
y=heading('01','保存到團隊',y-40)
y=bullet('1','填好本次資料，核對「客戶報價預覽」的服務、費用與備註。',y)
y=bullet('2','按「保存到團隊」，等到保存成功、時間與版本出現，同事才查得到。',y)
y=text('記住：本機草稿只是這台瀏覽器的備援，不等於團隊已保存。',L+7,y-1,CW-14,small)-10
y=heading('02','複製客戶報價',divider(y))
y=bullet('1','按「複製客戶報價」。未保存或有漏填時，中央會出現確認視窗。',y)
y=bullet('2','選「保存到團隊並繼續」；只是先傳目前試算，可選「只輸出目前畫面」（不會保存共用）。',y)
y=bullet('3','看到「已複製客戶報價」成功提示，再貼到LINE或訊息；核對後才傳給客戶。',y)
y=text('已保存且資料齊全時，可能直接複製，不再跳出確認視窗。',L+7,y-1,CW-14,small)-10
y=heading('03','手機無法自動複製',divider(y))
y=bullet('1','出現「手動複製客戶報價」時，按「選取全部文字」。',y)
y=bullet('2','長按已選取的文字，選手機選單的「複製」，再貼到LINE核對。',y)
y=bullet('3','核對完成再關閉視窗。「完成／關閉」只會關閉，不會替你複製。',y)
y=text('電腦手動複製：選取全部後按Ctrl+C；Mac按Command+C。',L+7,y-1,CW-14,small)-12
y=text('保存失敗：依提示處理再重試。若手機受限制，改用Chrome或Safari。',L,y,CW,small)-8
assert y>190,f'Content overflow: QR section begins at {y}'
c.setStrokeColor(LINE);c.line(L,y,W-L,y)
c.setFillColor(NAVY);c.setFont('QuickBold',13);c.drawString(L,y-20,'手機掃描開啟程式（需員工登入）')
links=[
 ('檢測報價','https://yongjiesystems.github.io/testing/',['https://yongjiesystems.github.io/','testing/']),
 ('維修估價','https://yongjiesystems.github.io/Maintenance/',['https://yongjiesystems.github.io/','Maintenance/']),
 ('租賃估價','https://equipment-rental-calculator.vercel.app/',['https://equipment-rental-','calculator.vercel.app/'])
]
col=CW/3;size=76
for i,(label,url,lines) in enumerate(links):
 x=L+i*col;cx=x+col/2
 c.setFillColor(NAVY);c.setFont('QuickBold',13);c.drawCentredString(cx,y-42,label)
 qr=QrCodeWidget(url,barLevel='M',barBorder=4)
 bounds=qr.getBounds();qw=bounds[2]-bounds[0];qh=bounds[3]-bounds[1]
 d=Drawing(size,size,transform=[size/qw,0,0,size/qh,0,0]);d.add(qr)
 renderPDF.draw(d,c,cx-size/2,y-125)
 c.linkURL(url,(x+2,y-156,x+col-2,y-30),relative=0,thickness=0)
 c.setFillColor(BLUE);c.setFont('Helvetica',8.4)
 for j,line in enumerate(lines):c.drawCentredString(cx,y-138-j*11,line)
text('詳細步驟：各程式 → 操作說明／教育訓練 → 員工手冊',L,y-163,CW,small)
c.setStrokeColor(LINE);c.line(L,35,W-L,35)
c.setFillColor(NAVY);c.setFont('QuickCJK',9)
c.drawString(L,21,'永捷系統科技  |  內部操作參考，請勿當作客戶報價')
c.drawRightString(W-L,21,'2026.11.06  第2版  |  A4直式')
c.showPage();c.save()
r=PdfReader(out);assert len(r.pages)==1;page=r.pages[0];assert abs(float(page.mediabox.width)-W)<1
content=page.extract_text()
for t in ['保存到團隊','只輸出目前畫面','選取全部文字','長按','完成／關閉','Chrome','Safari']:assert t in content,t
assert '\ufffd' not in content
print(f'Created one A4 page, {out.stat().st_size} bytes: {out}')
