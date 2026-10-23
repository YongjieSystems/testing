from pathlib import Path
import json,html
from reportlab.pdfgen import canvas
from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,PageBreak,Table,TableStyle,KeepTogether
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from pypdf import PdfReader
ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'output/pdf/yongjie-employee-handbook-2026-10-23-simple.pdf'
pdfmetrics.registerFont(TTFont('CJK','C:/Windows/Fonts/msjh.ttc',subfontIndex=0))
pdfmetrics.registerFont(TTFont('CJKB','C:/Windows/Fonts/msjhbd.ttc',subfontIndex=0))
BLUE=colors.HexColor('#1745A6');NAVY=colors.HexColor('#132B4A');GREY=colors.HexColor('#526173');PALE=colors.HexColor('#EFF5FF')
W,H=A4; BODY=W-96
styles={
 'title':ParagraphStyle('title',fontName='CJKB',fontSize=29,leading=42,textColor=NAVY,wordWrap='CJK',spaceAfter=14),
 'h1':ParagraphStyle('h1',fontName='CJKB',fontSize=21,leading=31,textColor=NAVY,wordWrap='CJK',spaceAfter=12),
 'lead':ParagraphStyle('lead',fontName='CJK',fontSize=11.5,leading=20,textColor=GREY,wordWrap='CJK',spaceAfter=17),
 'body':ParagraphStyle('body',fontName='CJK',fontSize=12,leading=21.5,textColor=NAVY,wordWrap='CJK',spaceAfter=9),
 'note':ParagraphStyle('note',fontName='CJK',fontSize=11.1,leading=19,textColor=NAVY,wordWrap='CJK'),
 'label':ParagraphStyle('label',fontName='CJKB',fontSize=10.4,leading=17,textColor=BLUE,wordWrap='CJK',spaceAfter=4),
 'small':ParagraphStyle('small',fontName='CJK',fontSize=9.4,leading=16,textColor=GREY,wordWrap='CJK'),
 'toc':ParagraphStyle('toc',fontName='CJK',fontSize=11,leading=18,textColor=NAVY,wordWrap='CJK'),
}
class Head(Paragraph):pass
class ManualDoc(SimpleDocTemplate):
 def afterFlowable(self,f):
  if isinstance(f,Head):
   self.canv.bookmarkPage('p'+str(self.page));self.canv.addOutlineEntry(f.getPlainText(),'p'+str(self.page),0,False)
def esc(t):return html.escape(t,quote=False)
def para(t,kind='body'):return Paragraph(esc(t),styles[kind])
def note(title,text):
 box=Table([[Paragraph(esc(title),styles['label'])],[Paragraph(esc(text),styles['note'])]],colWidths=[BODY-24])
 box.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),PALE),('BOX',(0,0),(-1,-1),0.6,colors.HexColor('#C9D9F6')),('LEFTPADDING',(0,0),(-1,-1),12),('RIGHTPADDING',(0,0),(-1,-1),12),('TOPPADDING',(0,0),(0,0),8),('BOTTOMPADDING',(0,-1),(-1,-1),9),('TOPPADDING',(0,1),(-1,1),0)]))
 return box
def decor(c,d):
 c.setTitle('永捷員工操作手冊 - 檢測、維修、租賃')
 c.setAuthor('永捷系統科技')
 c.setSubject('員工操作、客戶精簡版、主管核准與收送交接')
 c.setStrokeColor(colors.HexColor('#DAE3EF'));c.line(48,H-39,W-48,H-39)
 c.setFillColor(GREY);c.setFont('CJK',8.6);c.drawString(48,H-29,'永捷系統科技 | 員工操作手冊')
 c.drawRightString(W-48,H-29,'2026.10.23 / 第4版')
 c.line(48,38,W-48,38);c.setFont('CJK',8.2);c.drawString(48,25,'內部操作指引，請勿當作客戶報價交付')
 c.drawRightString(W-48,25,f'{d.page} / 22')
 if d.page>2:
  c.setFillColor(BLUE);c.roundRect(48,H-63,60,14,3,fill=1,stroke=0)
  c.setFillColor(colors.white);c.setFont('CJKB',8);c.drawCentredString(78,H-59,'工作步驟')
content=json.loads((ROOT/'manual-source/handbook.json').read_text(encoding='utf-8'))
story=[Spacer(1,39),Paragraph('員工操作手冊',styles['title']),para('檢測估價・維修估價・租賃估價','h1'),para('從接電話、建立案件，到交付報價與完成收送。\n每頁一個工作主題，按步驟就能操作。','lead'),Spacer(1,18)]
for title,body in [('新同事先看','第3頁看分工，第4頁看登入；接著直接翻到你要使用的程式。'),('交付報價前必看','第8、12、17頁說明複製與列印；第3、4頁先看新版流程與分工。'),('主管與收送人員','新增員工看第20頁；收送看第18、19頁；公司公告看第21頁。')]:
 story.extend([note(title,body),Spacer(1,13)])
story.extend([Spacer(1,8),para('編製日期：2026年10月23日','small'),para('適用：檢測v2.0.0、維修v3.0.0、租賃v2.0.0','small'),para('本手冊使用教學範例，不含真實客戶資料或登入密碼。','small'),PageBreak(),Head('目錄與快速入口',styles['h1']),para('在PDF中點章節可跳頁；列印時也能依右側頁碼選印。','lead')])
for n,item in enumerate(content,3):
 t=Table([[Paragraph(f'<link href="#p{n}" color="#1745A6">{esc(item["title"])}</link>',styles['toc']),para(str(n),'toc')]],colWidths=[BODY-35,35]);t.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('ALIGN',(1,0),(1,0),'RIGHT'),('LINEBELOW',(0,0),(-1,-1),0.35,colors.HexColor('#E5EBF3')),('TOPPADDING',(0,0),(-1,-1),4),('BOTTOMPADDING',(0,0),(-1,-1),4)]));story.append(t)
story.append(Spacer(1,12))
for label,url in [('檢測','https://yongjiesystems.github.io/testing/'),('維修','https://yongjiesystems.github.io/Maintenance/'),('租賃','https://equipment-rental-calculator.vercel.app/')]:
 story.append(Paragraph(label+'：<link href="'+url+'" color="#1745A6">'+url+'</link>',styles['small']))
for item in content:
 story.extend([PageBreak(),Spacer(1,12),Head(esc(item['title']),styles['h1']),para(item['lead'],'lead')])
 for n,text in enumerate(item['steps'],1):
  row=Table([[Paragraph(f'{n:02d}',styles['label']),para(text)]],colWidths=[27,BODY-27]);row.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),0),('RIGHTPADDING',(0,0),(-1,-1),0),('BOTTOMPADDING',(0,0),(-1,-1),6)]));story.append(row)
 story.append(Spacer(1,5))
 for title,text in item['notes']:story.extend([note(title,text),Spacer(1,10)])
doc=ManualDoc(str(OUT),pagesize=A4,rightMargin=48,leftMargin=48,topMargin=66,bottomMargin=52,pageCompression=1)
doc.build(story,onFirstPage=decor,onLaterPages=decor)
r=PdfReader(OUT);assert len(r.pages)==22,f'Unexpected overflow: {len(r.pages)} pages'
for n,p in enumerate(r.pages,1):
 text=p.extract_text();assert len(text)>150,(n,len(text));assert '\ufffd' not in text,n
print(f'Created {len(r.pages)} pages, {OUT.stat().st_size} bytes')
