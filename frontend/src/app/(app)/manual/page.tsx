import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowRight, BadgeCheck, Bell, BookOpen, Building2, CheckCircle2,
  ClipboardList, Crown, FileText, Filter, History, Lightbulb,
  MessageSquare, Package, Search, Settings, ShieldCheck, Sparkles,
  Timer, UploadCloud, Users, Zap, AlertTriangle, type LucideIcon,
} from 'lucide-react';
import { auth } from '@/lib/auth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────
type GuideCard = { title: string; description: string; href?: string; icon: LucideIcon; accent: string; points: string[] };
type WorkflowStep = { title: string; detail: string; icon: LucideIcon };

// ─── Officer content ──────────────────────────────────────────────────────────
const officerCards: GuideCard[] = [
  {
    title: 'Dashboard & งานที่ต้องทำ',
    description: 'เริ่มวันด้วยภาพรวมใบเสนอราคา สถานะเอกสาร และรายการใกล้หมดอายุ',
    href: '/dashboard',
    icon: Sparkles,
    accent: 'from-cyan-500 to-blue-500',
    points: ['ตรวจงานล่าสุดและสถานะทุกเอกสาร', 'เห็นรายการใกล้หมดอายุในมุมเดียว', 'ใช้ตัวเลขสรุปจัดลำดับงานก่อนหลัง'],
  },
  {
    title: 'สร้างใบเสนอราคา',
    description: 'ทำเอกสาร QT ตั้งแต่ข้อมูลลูกค้า รายการสินค้า ส่วนลด ภาษี จนถึงส่งขออนุมัติ',
    href: '/quotations',
    icon: FileText,
    accent: 'from-blue-500 to-indigo-500',
    points: ['บันทึก Draft เพื่อกลับมาแก้ได้ก่อนส่ง', 'แก้ไขรายการสินค้าและเงื่อนไขได้เสมอ', 'ส่งขออนุมัติเมื่อข้อมูลครบถ้วน'],
  },
  {
    title: 'Checklist รอ PO',
    description: 'ติดตามใบเสนอราคาที่อนุมัติแล้วและรอเอกสาร PO จากลูกค้า',
    href: '/quotations/checklist',
    icon: BadgeCheck,
    accent: 'from-emerald-500 to-teal-500',
    points: ['เช็กรายการที่พร้อมปิดงาน', 'แนบไฟล์ PO และบันทึกเลข PO', 'ลดโอกาสตกหล่นหลังได้รับอนุมัติ'],
  },
  {
    title: 'ใบสั่งขาย (SO)',
    description: 'ดูรายการ Sale Order และติดตามสถานะหลังปิดงานกับลูกค้า',
    href: '/sale-orders',
    icon: ClipboardList,
    accent: 'from-violet-500 to-fuchsia-500',
    points: ['ตรวจรายละเอียดก่อนยืนยัน SO', 'ติดตามสถานะการส่งมอบ', 'กลับดูต้นทาง QT ได้ทันที'],
  },
];

const officerFlow: WorkflowStep[] = [
  { title: 'เตรียมข้อมูล',    detail: 'ตรวจข้อมูลลูกค้า สินค้า ราคา เงื่อนไขชำระเงิน และวันหมดอายุให้ครบ', icon: Search },
  { title: 'สร้าง Draft',      detail: 'บันทึก Draft ก่อนเพื่อกันข้อมูลหาย และกลับมาแก้ไขก่อนส่งจริงได้', icon: FileText },
  { title: 'ส่งขออนุมัติ',    detail: 'เมื่อยอด ส่วนลด และเงื่อนไขถูกต้องครบ ให้กดส่งเข้ากระบวนการอนุมัติ', icon: UploadCloud },
  { title: 'ติดตามผล',         detail: 'เช็กสถานะ คอมเมนต์ และแจ้งเตือน ถ้าต้องแก้ไขให้ปรับแล้วส่งใหม่', icon: Bell },
  { title: 'รับ PO → ออก SO', detail: 'เมื่ออนุมัติแล้ว แนบ PO ใน Checklist จากนั้น SO จะสร้างให้อัตโนมัติ', icon: ClipboardList },
];

const officerTips = [
  'ค้นหาชื่อบริษัทก่อนสร้างลูกค้าใหม่ เพื่อลดข้อมูลซ้ำ',
  'ตรวจยอดรวม VAT และส่วนลดทุกครั้งก่อนกดส่งอนุมัติ',
  'ใช้คอมเมนต์ระบุสิ่งที่แก้ไขแล้วเมื่อส่งงานกลับ',
  'อย่าปล่อยใบเสนอราคาใกล้หมดอายุค้างไว้ ต่ออายุหรือยกเลิกตามสถานการณ์',
];

// ─── Manager content ──────────────────────────────────────────────────────────
const managerCards: GuideCard[] = [
  {
    title: 'Manager Dashboard',
    description: 'ดูภาพรวมทีม ยอดงาน KPI และรายการที่รอการตัดสินใจ',
    href: '/dashboard',
    icon: Crown,
    accent: 'from-amber-400 to-orange-500',
    points: ['ดูปริมาณงานและ KPI ทั้งทีม', 'ติดตามงานค้างอนุมัติตาม SLA', 'มองหาคอขวดในกระบวนการขาย'],
  },
  {
    title: 'คิวอนุมัติ',
    description: 'อนุมัติหรือปฏิเสธใบเสนอราคาที่อยู่ในอำนาจของคุณ',
    href: '/approval-queue',
    icon: ShieldCheck,
    accent: 'from-orange-500 to-rose-500',
    points: ['อ่านยอดรวม ส่วนลด และเงื่อนไขก่อนตัดสินใจ', 'ตรวจประวัติและคอมเมนต์เพิ่มเติม', 'ระบุเหตุผลทุกครั้งเพื่อให้ทีมทำงานต่อได้'],
  },
  {
    title: 'ทีมของฉัน',
    description: 'ดูสมาชิก บทบาท สถิติการทำงาน และดูแลลูกค้า',
    href: '/manager/users',
    icon: Users,
    accent: 'from-sky-500 to-cyan-500',
    points: ['ดู Officer และยอดงานรายคน', 'ตรวจสอบสถานะและผลงานทีม', 'แก้ไขข้อมูลลูกค้าในขอบเขตที่ได้รับ'],
  },
  {
    title: 'ประวัติและรายงาน',
    description: 'ย้อนดูรายการที่เคยดำเนินการ และใช้สำหรับติดตามงานย้อนหลัง',
    href: '/quotations',
    icon: History,
    accent: 'from-purple-500 to-pink-500',
    points: ['ค้นหางานที่อนุมัติ/ปฏิเสธแล้ว', 'ดูเหตุผลการตัดสินใจย้อนหลัง', 'ใช้ตรวจสอบและตอบคำถาม audit'],
  },
];

const approvalFlow: WorkflowStep[] = [
  { title: 'เปิดคิวอนุมัติ',     detail: 'ดูรายการที่รอตัดสินใจ พร้อมยอดรวมและระดับความเร่งด่วน', icon: Timer },
  { title: 'ตรวจรายละเอียด',    detail: 'เช็กสินค้า ราคา ส่วนลด เงื่อนไข คอมเมนต์ และประวัติเอกสาร', icon: Filter },
  { title: 'ถามก่อนตัดสินใจ',  detail: 'ใช้คอมเมนต์สอบถามข้อมูลเพิ่มก่อน โดยเฉพาะงานมูลค่าสูง', icon: MessageSquare },
  { title: 'อนุมัติ/ปฏิเสธ',   detail: 'เลือกการตัดสินใจพร้อมเหตุผลชัดเจน ทีมจะทำขั้นตอนถัดไปได้ทันที', icon: ShieldCheck },
  { title: 'ติดตามและรายงาน',  detail: 'ตรวจใบเสนอราคาที่ผ่านและ PO รอยืนยัน เพื่อไม่ให้กระบวนการสะดุด', icon: Zap },
];

const managerTips = [
  'อย่าปล่อยงานค้างในคิวอนุมัติเกิน 48 ชั่วโมง ทีมรอผลอยู่',
  'ระบุเหตุผลปฏิเสธให้ชัด เช่น "ส่วนลดเกินนโยบาย X%" ไม่ใช่แค่ "ไม่ผ่าน"',
  'ใช้ Escalate เมื่อ QT เกินวงเงินหรือ discount limit ของคุณ',
  'ตรวจ Dashboard ทุกเช้าเพื่อดูงานค้างและรายการใกล้หมดอายุ',
];

// ─── Shared content ───────────────────────────────────────────────────────────
const sharedCards: GuideCard[] = [
  { title: 'ข้อมูลลูกค้า', description: 'ค้นหา ตรวจ และดูข้อมูลบริษัทผู้ติดต่อก่อนสร้างเอกสาร', href: '/customers', icon: Users, accent: 'from-teal-500 to-emerald-500', points: ['ค้นหาก่อนสร้างใหม่เพื่อลดซ้ำ', 'ตรวจเลขภาษีและที่อยู่ก่อนออกเอกสาร', 'อัปเดตข้อมูลติดต่อให้ล่าสุดเสมอ'] },
  { title: 'สินค้าและราคา', description: 'ดู SKU หน่วย ราคาตั้งต้น และรายละเอียดที่ใช้บนเอกสาร', href: '/products', icon: Package, accent: 'from-indigo-500 to-violet-500', points: ['ตรวจชื่อสินค้าและหน่วยให้ตรง', 'ใช้ราคาตั้งต้นจากระบบเป็นฐาน', 'แจ้งผู้ดูแลเมื่อข้อมูลสินค้าไม่ครบ'] },
  { title: 'ข้อมูลบริษัท', description: 'ตรวจข้อมูลบริษัทที่แสดงบนเอกสาร PDF ทุกฉบับ', href: '/company', icon: Building2, accent: 'from-slate-500 to-blue-500', points: ['ตรวจชื่อบริษัท ทั้งไทย/อังกฤษ', 'เช็กข้อมูลติดต่อและธนาคาร', 'แจ้ง Admin หากข้อมูลไม่ถูกต้อง'] },
  { title: 'สิทธิ์ของฉัน', description: 'ดู role และสิทธิ์ที่บัญชีของคุณได้รับในระบบ', href: '/permissions', icon: Settings, accent: 'from-rose-500 to-pink-500', points: ['ตรวจ role ปัจจุบัน', 'ดูสิทธิ์แต่ละหมวดที่ใช้ได้', 'ใช้ประกอบการแจ้ง Admin เมื่อเข้าไม่ได้'] },
];

const troubleshoot = [
  ['หาเมนูไม่เจอ', 'เปิดหน้า "สิทธิ์ของฉัน" ตรวจ role และสิทธิ์ที่ได้รับ'],
  ['ส่งอนุมัติไม่ได้', 'ตรวจข้อมูลลูกค้า รายการสินค้า ยอดรวม และเงื่อนไขว่ากรอกครบ'],
  ['Manager ไม่เห็นงาน', 'ตรวจว่าเอกสารถูกส่งอนุมัติแล้ว และอยู่ในสายอนุมัติที่ถูกต้อง'],
  ['ข้อมูลเอกสารผิด', 'แก้ต้นทางก่อนสร้างเอกสารถัดไป แจ้ง Admin หากเป็นข้อมูลกลาง'],
];

// ─── Sub-components ───────────────────────────────────────────────────────────
function GuideCardItem({ card }: { card: GuideCard }) {
  const Icon = card.icon;
  const inner = (
    <Card className="group h-full overflow-hidden border-border/60 bg-card/80 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/30">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md transition-transform duration-300 group-hover:scale-110', card.accent)}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-base">{card.title}</CardTitle>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{card.description}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {card.points.map((p) => (
          <div key={p} className="flex gap-2 text-sm">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
            <span className="leading-5">{p}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
  if (!card.href) return inner;
  return <Link href={card.href} className="block h-full focus-visible:rounded-xl">{inner}</Link>;
}

function WorkflowSteps({ steps, tone }: { steps: WorkflowStep[]; tone: 'officer' | 'manager' }) {
  const gradient = tone === 'manager' ? 'from-amber-400 to-orange-500' : 'from-cyan-500 to-blue-500';
  return (
    <div className="relative">
      {/* connector line */}
      <div className="absolute top-8 left-8 right-8 h-0.5 bg-gradient-to-r from-border via-border/60 to-border hidden xl:block" />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <div key={step.title} className="relative rounded-2xl border border-border/60 bg-card/80 p-4 backdrop-blur transition-all hover:border-primary/30 hover:shadow-sm">
              <div className="flex items-start gap-3 xl:block">
                <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md xl:mb-3', gradient)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">ขั้นที่ {i + 1}</span>
                  </div>
                  <h3 className="mt-0.5 font-semibold text-sm">{step.title}</h3>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{step.detail}</p>
                </div>
              </div>
              {i < steps.length - 1 && (
                <ArrowRight className="absolute -right-3 top-5 hidden h-5 w-5 text-muted-foreground/40 xl:block z-10" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function ManualPage() {
  const session = await auth();
  const roleCode = (session?.user as { role?: string })?.role || 'OFFICER';
  if (!['OFFICER', 'SALES', 'MANAGER'].includes(roleCode)) redirect('/dashboard');

  const isManager = roleCode === 'MANAGER';
  const heroGradient = isManager ? 'from-amber-400 via-orange-500 to-rose-500' : 'from-cyan-400 via-blue-500 to-indigo-600';
  const accentLine  = isManager ? 'from-amber-400 via-orange-500 to-rose-500' : 'from-cyan-400 via-blue-500 to-indigo-600';

  const cards   = isManager ? managerCards   : officerCards;
  const flow    = isManager ? approvalFlow   : officerFlow;
  const tips    = isManager ? managerTips    : officerTips;
  const flowTitle = isManager
    ? { eyebrow: 'Approval Workflow', title: 'ขั้นตอนอนุมัติอย่างมีคุณภาพ', desc: 'ทุกการตัดสินใจควรมีข้อมูลครบ เหตุผลชัด และไม่ทิ้งคำถามค้างไว้' }
    : { eyebrow: 'QT Workflow', title: 'ลำดับการทำงานใบเสนอราคา', desc: 'ใช้เป็น checklist ก่อนส่งเอกสาร และหลังได้รับผลการอนุมัติ' };

  const heroStats = isManager
    ? [{ label: 'หน้าที่หลัก', value: 'อนุมัติงาน' }, { label: 'ดูแลส่วน', value: 'ทีม & QT' }, { label: 'ระดับ', value: 'Manager' }]
    : [{ label: 'หน้าที่หลัก', value: 'สร้างเอกสาร' }, { label: 'ดูแลส่วน', value: 'QT & SO' }, { label: 'ระดับ', value: 'Officer' }];

  return (
    <div className="mx-auto max-w-7xl space-y-10 pb-10">

      {/* ── Hero ── */}
      <section className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/80 shadow-xl">
        <div className={cn('absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r', accentLine)} />
        <div className="p-6 md:p-8">
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <Badge variant="outline" className="mb-4 gap-1.5 bg-background/60 text-xs">
                <BookOpen className="h-3.5 w-3.5" />
                Web User Manual
              </Badge>
              <h1 className={cn('text-3xl font-bold tracking-tight md:text-4xl bg-gradient-to-r bg-clip-text text-transparent', heroGradient)}>
                {isManager ? 'คู่มือสำหรับ Manager' : 'คู่มือสำหรับ Officer / Sales'}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
                {isManager
                  ? 'คู่มือนี้ครอบคลุมการอนุมัติงาน ดูภาพรวมทีม จัดการลูกค้า และการ Escalate งานเกินอำนาจ ออกแบบให้อ่านเร็วและปฏิบัติได้ทันที'
                  : 'คู่มือนี้ครอบคลุมการสร้างใบเสนอราคา ส่งขออนุมัติ รับ PO และออก Sale Order ออกแบบให้อ่านเร็วและปฏิบัติได้ทันที'}
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button asChild className={cn('bg-gradient-to-r text-white shadow-md hover:opacity-90 transition-opacity', heroGradient)}>
                  <Link href={isManager ? '/approval-queue' : '/quotations'}>
                    {isManager ? 'ไปคิวอนุมัติ' : 'ไปจัดการ QT'}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="gap-1.5">
                  <Link href="/permissions">ดูสิทธิ์ของฉัน</Link>
                </Button>
              </div>
            </div>
            <div className="flex gap-3 lg:flex-col">
              {heroStats.map((s) => (
                <div key={s.label} className="min-w-[90px] rounded-2xl border border-border/60 bg-background/60 p-4 text-center">
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                  <div className="mt-1 font-bold text-sm">{s.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Feature Cards ── */}
      <section className="space-y-4">
        <div>
          <div className="mb-1 text-xs font-bold uppercase tracking-widest text-primary">
            {isManager ? 'Manager Guide' : 'Officer Guide'}
          </div>
          <h2 className="text-2xl font-bold">
            {isManager ? 'หน้าที่หลักของ Manager' : 'หน้าที่หลักของ Officer / Sales'}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isManager
              ? 'คลิกการ์ดเพื่อไปยังหน้านั้นได้เลย'
              : 'คลิกการ์ดเพื่อไปยังหน้านั้นได้เลย'}
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => <GuideCardItem key={card.title} card={card} />)}
        </div>
      </section>

      {/* ── Workflow ── */}
      <section className="space-y-4">
        <div>
          <div className="mb-1 text-xs font-bold uppercase tracking-widest text-primary">{flowTitle.eyebrow}</div>
          <h2 className="text-2xl font-bold">{flowTitle.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{flowTitle.desc}</p>
        </div>
        <WorkflowSteps steps={flow} tone={isManager ? 'manager' : 'officer'} />
      </section>

      {/* ── Shared Tools ── */}
      <section className="space-y-4">
        <div>
          <div className="mb-1 text-xs font-bold uppercase tracking-widest text-primary">Shared Tools</div>
          <h2 className="text-2xl font-bold">หน้าที่ใช้ร่วมกัน</h2>
          <p className="mt-1 text-sm text-muted-foreground">ข้อมูลพื้นฐานเหล่านี้ส่งผลต่อเอกสารโดยตรง ตรวจให้ถูกก่อนเริ่มงาน</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {sharedCards.map((card) => <GuideCardItem key={card.title} card={card} />)}
        </div>
      </section>

      {/* ── Tips + Troubleshoot ── */}
      <section className="grid gap-4 lg:grid-cols-2">
        <Card className={cn('border-2', isManager ? 'border-amber-300/50 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-950/20' : 'border-cyan-300/50 bg-cyan-50/60 dark:border-cyan-500/30 dark:bg-cyan-950/20')}>
          <CardHeader className="pb-3">
            <CardTitle className={cn('flex items-center gap-2 text-base', isManager ? 'text-amber-700 dark:text-amber-300' : 'text-cyan-700 dark:text-cyan-300')}>
              <AlertTriangle className="h-4 w-4" />
              สิ่งที่ควรระวัง — {isManager ? 'Manager' : 'Officer'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {tips.map((tip) => (
              <div key={tip} className="flex gap-2 text-sm leading-6">
                <CheckCircle2 className={cn('mt-0.5 h-4 w-4 shrink-0', isManager ? 'text-amber-500' : 'text-cyan-500')} />
                <span>{tip}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/80">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Lightbulb className="h-4 w-4 text-primary" />
              วิธีแก้เมื่อเจอปัญหา
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {troubleshoot.map(([title, detail]) => (
              <div key={title} className="rounded-xl border border-border/60 bg-background/60 p-3">
                <h3 className="font-semibold text-sm">{title}</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

    </div>
  );
}
