import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Bell,
  BookOpen,
  Building2,
  CheckCircle2,
  ClipboardList,
  Crown,
  FileText,
  Filter,
  History,
  Lightbulb,
  MessageSquare,
  Package,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Timer,
  UploadCloud,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { auth } from '@/lib/auth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type GuideCard = {
  title: string;
  description: string;
  href?: string;
  icon: LucideIcon;
  accent: string;
  points: string[];
};

type WorkflowStep = {
  title: string;
  detail: string;
  icon: LucideIcon;
};

const officerCards: GuideCard[] = [
  {
    title: 'Dashboard และงานที่ต้องทำ',
    description: 'เริ่มวันด้วยการดูภาพรวมใบเสนอราคา ใบสั่งขาย และรายการที่ระบบแจ้งเตือน',
    href: '/dashboard',
    icon: Sparkles,
    accent: 'from-cyan-500 to-blue-500',
    points: ['ตรวจงานล่าสุดและสถานะเอกสาร', 'ดูรายการใกล้หมดอายุ', 'ใช้ตัวเลขสรุปเพื่อจัดลำดับงานก่อนหลัง'],
  },
  {
    title: 'สร้างและจัดการใบเสนอราคา',
    description: 'ทำเอกสารตั้งแต่ข้อมูลลูกค้า รายการสินค้า ส่วนลด ภาษี จนถึงส่งขออนุมัติ',
    href: '/quotations',
    icon: FileText,
    accent: 'from-blue-500 to-indigo-500',
    points: ['สร้างแบบร่างก่อนส่งจริง', 'แก้ไขข้อมูลสินค้าและเงื่อนไข', 'ส่งขออนุมัติเมื่อข้อมูลครบถ้วน'],
  },
  {
    title: 'Checklist รอ PO',
    description: 'ติดตามใบเสนอราคาที่อนุมัติแล้วและรอเอกสาร PO จากลูกค้า',
    href: '/quotations/checklist',
    icon: BadgeCheck,
    accent: 'from-emerald-500 to-teal-500',
    points: ['เช็กใบเสนอราคาที่พร้อมปิดงาน', 'แนบหรือบันทึกข้อมูล PO', 'ลดโอกาสตกหล่นหลังได้รับอนุมัติ'],
  },
  {
    title: 'ใบสั่งขาย',
    description: 'ดูรายการ Sale Order ที่สร้างจากงานขายและติดตามสถานะหลังปิดงาน',
    href: '/sale-orders',
    icon: ClipboardList,
    accent: 'from-violet-500 to-fuchsia-500',
    points: ['ตรวจรายละเอียดก่อนส่งต่อ', 'ติดตามเอกสารที่เกี่ยวข้อง', 'กลับไปดูต้นทางใบเสนอราคาได้สะดวก'],
  },
];

const managerCards: GuideCard[] = [
  {
    title: 'Manager Dashboard',
    description: 'ดูภาพรวมทีม ยอดงาน และรายการที่ต้องรีบตัดสินใจในระดับผู้จัดการ',
    href: '/dashboard',
    icon: Crown,
    accent: 'from-amber-400 to-orange-500',
    points: ['ดูปริมาณงานของทีม', 'ติดตามงานที่ค้างอนุมัติ', 'มองหาคอขวดในกระบวนการขาย'],
  },
  {
    title: 'คิวอนุมัติ',
    description: 'อนุมัติหรือปฏิเสธใบเสนอราคาที่เข้าข่ายต้องผ่าน Manager',
    href: '/approval-queue',
    icon: ShieldCheck,
    accent: 'from-orange-500 to-rose-500',
    points: ['อ่านยอดรวม ส่วนลด และเงื่อนไข', 'ตรวจประวัติการแก้ไขและคอมเมนต์', 'ตัดสินใจพร้อมเหตุผลที่ชัดเจน'],
  },
  {
    title: 'ทีมของฉัน',
    description: 'ดูสมาชิกในทีม บทบาท สถานะ และตั้ง Officer Lead เมื่อจำเป็น',
    href: '/team',
    icon: Users,
    accent: 'from-sky-500 to-cyan-500',
    points: ['แยก Manager และ Officer/Sales', 'ดูการเข้าใช้งานล่าสุด', 'จัดการ lead ของทีม'],
  },
  {
    title: 'ประวัติการอนุมัติ',
    description: 'ย้อนดูรายการที่เคยดำเนินการ เพื่อใช้ตรวจสอบหรือตอบคำถามย้อนหลัง',
    href: '/history',
    icon: History,
    accent: 'from-purple-500 to-pink-500',
    points: ['ค้นหางานที่อนุมัติแล้ว', 'ดูเหตุผลการปฏิเสธ', 'ใช้เป็นหลักฐานประกอบการติดตามงาน'],
  },
];

const sharedCards: GuideCard[] = [
  {
    title: 'ข้อมูลลูกค้า',
    description: 'เก็บข้อมูลบริษัท ผู้ติดต่อ เลขภาษี ที่อยู่เรียกเก็บเงิน และที่อยู่จัดส่ง',
    href: '/customers',
    icon: Users,
    accent: 'from-teal-500 to-emerald-500',
    points: ['ค้นหาก่อนสร้างใหม่เพื่อลดข้อมูลซ้ำ', 'ตรวจเลขภาษีและที่อยู่ก่อนออกเอกสาร', 'อัปเดตข้อมูลติดต่อให้ล่าสุดเสมอ'],
  },
  {
    title: 'สินค้าและราคา',
    description: 'ดูข้อมูลสินค้า SKU หน่วย ราคา และรายละเอียดที่ใช้บนใบเสนอราคา',
    href: '/products',
    icon: Package,
    accent: 'from-indigo-500 to-violet-500',
    points: ['ตรวจชื่อสินค้าและหน่วยให้ตรง', 'ใช้ราคาตั้งต้นจากระบบ', 'แจ้งผู้ดูแลเมื่อข้อมูลสินค้าไม่ครบ'],
  },
  {
    title: 'ข้อมูลบริษัท',
    description: 'ตรวจข้อมูลบริษัทที่จะปรากฏบนเอกสารและ PDF',
    href: '/company',
    icon: Building2,
    accent: 'from-slate-500 to-blue-500',
    points: ['ตรวจชื่อบริษัท ภาษาไทย/อังกฤษ', 'เช็กข้อมูลติดต่อและธนาคาร', 'แจ้ง Admin หากข้อมูลที่แสดงไม่ถูกต้อง'],
  },
  {
    title: 'สิทธิ์ของฉัน',
    description: 'ดูบทบาทและสิทธิ์ที่บัญชีของคุณได้รับในระบบ',
    href: '/permissions',
    icon: Settings,
    accent: 'from-rose-500 to-pink-500',
    points: ['ตรวจ role ปัจจุบัน', 'ดูสิทธิ์ที่ใช้ได้ในแต่ละหมวด', 'ใช้ประกอบการแจ้ง Admin เมื่อเข้าหน้าไม่ได้'],
  },
];

const quotationFlow: WorkflowStep[] = [
  { title: 'เตรียมข้อมูล', detail: 'ตรวจลูกค้า สินค้า ราคา เงื่อนไขชำระเงิน และวันหมดอายุให้ครบ', icon: Search },
  { title: 'สร้างแบบร่าง', detail: 'บันทึก Draft เพื่อกันข้อมูลหาย และกลับมาแก้ไขก่อนส่งจริงได้', icon: FileText },
  { title: 'ส่งอนุมัติ', detail: 'เมื่อยอด ส่วนลด และเงื่อนไขถูกต้อง ให้ส่งเข้ากระบวนการอนุมัติ', icon: UploadCloud },
  { title: 'ติดตามผล', detail: 'ดูสถานะ คอมเมนต์ และแจ้งเตือน หากต้องแก้ไขให้ปรับแล้วส่งใหม่', icon: Bell },
  { title: 'รับ PO และออก SO', detail: 'เมื่ออนุมัติแล้ว ให้ตาม PO ใน Checklist และตรวจ Sale Order ต่อ', icon: ClipboardList },
];

const approvalFlow: WorkflowStep[] = [
  { title: 'เปิดคิวอนุมัติ', detail: 'ดูรายการที่รอการตัดสินใจ พร้อมยอดรวมและระดับความเร่งด่วน', icon: Timer },
  { title: 'ตรวจรายละเอียด', detail: 'เช็กสินค้า ราคา ส่วนลด เงื่อนไข คอมเมนต์ และประวัติเอกสาร', icon: Filter },
  { title: 'คุยให้ชัด', detail: 'ใช้คอมเมนต์เพื่อถามข้อมูลเพิ่มก่อนตัดสินใจ โดยเฉพาะงานมูลค่าสูง', icon: MessageSquare },
  { title: 'อนุมัติหรือปฏิเสธ', detail: 'เลือกการตัดสินใจพร้อมเหตุผล เพื่อให้ทีมทำขั้นตอนต่อไปได้ทันที', icon: ShieldCheck },
];

const bestPractices = [
  'ค้นหาข้อมูลเดิมก่อนสร้างลูกค้าใหม่ เพื่อลดข้อมูลซ้ำและเอกสารผิดบริษัท',
  'ตรวจยอดรวม VAT ส่วนลด และเงื่อนไขทุกครั้งก่อนส่งอนุมัติ',
  'ใช้คอมเมนต์สั้น ชัดเจน ระบุสิ่งที่ต้องแก้หรือเหตุผลการตัดสินใจ',
  'อย่าปล่อยเอกสารใกล้หมดอายุค้างไว้ ให้ต่ออายุหรือปิดงานตามสถานการณ์',
  'เมื่อสิทธิ์หรือข้อมูลไม่ตรง ให้แจ้ง Admin พร้อมหน้าที่เจอปัญหาและเลขเอกสาร',
];

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-3xl">
      <div className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">{eyebrow}</div>
      <h2 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground md:text-base">{description}</p>
    </div>
  );
}

function GuideCardItem({ card }: { card: GuideCard }) {
  const Icon = card.icon;
  const content = (
    <Card className="group h-full overflow-hidden border-border/60 bg-card/75 backdrop-blur hover:-translate-y-1 hover:border-primary/40">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-lg', card.accent)}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-base leading-6">{card.title}</CardTitle>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{card.description}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {card.points.map((point) => (
          <div key={point} className="flex gap-2 text-sm leading-6">
            <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-500" />
            <span>{point}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );

  if (!card.href) return content;
  return (
    <Link href={card.href} className="block h-full focus-visible:rounded-xl">
      {content}
    </Link>
  );
}

function Workflow({ steps, tone }: { steps: WorkflowStep[]; tone: 'officer' | 'manager' }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      {steps.map((step, index) => {
        const Icon = step.icon;
        return (
          <div key={step.title} className="relative rounded-xl border border-border/60 bg-card/70 p-4 backdrop-blur">
            <div
              className={cn(
                'mb-4 flex h-10 w-10 items-center justify-center rounded-lg text-white shadow-lg',
                tone === 'manager' ? 'bg-gradient-to-br from-amber-400 to-orange-500' : 'bg-gradient-to-br from-cyan-500 to-blue-500',
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div className="text-xs font-bold text-muted-foreground">ขั้นตอนที่ {index + 1}</div>
            <h3 className="mt-1 font-semibold">{step.title}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.detail}</p>
            {index < steps.length - 1 && (
              <ArrowRight className="absolute -right-3 top-8 hidden h-5 w-5 text-muted-foreground/50 xl:block" />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default async function ManualPage() {
  const session = await auth();
  const roleCode = session?.user?.role || 'OFFICER';
  const canView = ['OFFICER', 'SALES', 'MANAGER'].includes(roleCode);

  if (!canView) redirect('/dashboard');

  const isManager = roleCode === 'MANAGER';
  const heroGradient = isManager
    ? 'from-amber-400 via-orange-500 to-rose-500'
    : 'from-cyan-400 via-blue-500 to-indigo-500';

  return (
    <div className="mx-auto max-w-7xl space-y-10 pb-10">
      <section className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/70 p-6 shadow-xl backdrop-blur md:p-8">
        <div className={cn('absolute inset-x-0 top-0 h-1 bg-gradient-to-r', heroGradient)} />
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <Badge variant="outline" className="mb-4 bg-background/60">
              <BookOpen className="mr-1 h-3.5 w-3.5" />
              Web User Manual
            </Badge>
            <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
              คู่มือการใช้งานเว็บสำหรับ Officer และ Manager
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-muted-foreground md:text-base">
              รวมขั้นตอนสำคัญตั้งแต่การสร้างใบเสนอราคา การติดตาม PO การออก Sale Order ไปจนถึงการอนุมัติและดูแลทีม
              ออกแบบให้อ่านเร็ว ทำตามง่าย และใช้ได้ทั้งโหมดสว่าง/มืด
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild className={cn('bg-gradient-to-r text-white shadow-lg hover:opacity-95', heroGradient)}>
                <Link href={isManager ? '/approval-queue' : '/quotations'}>
                  ไปงานหลักของฉัน
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/permissions">ตรวจสิทธิ์ของฉัน</Link>
              </Button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {[
              { label: 'เหมาะกับ', value: 'Officer / Manager', icon: Users },
              { label: 'ครอบคลุม', value: 'Quotation ถึง SO', icon: ClipboardList },
              { label: 'โหมดธีม', value: 'Light และ Dark', icon: Sparkles },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-border/60 bg-background/50 p-4">
                <item.icon className="mb-3 h-5 w-5 text-primary" />
                <div className="text-xs text-muted-foreground">{item.label}</div>
                <div className="mt-1 font-semibold">{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <SectionHeader
          eyebrow="Officer Guide"
          title="คู่มือสำหรับ Officer / Sales"
          description="หน้าที่หลักคือสร้างเอกสารให้ถูกต้อง ติดตามสถานะ และปิดงานหลังได้รับ PO"
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {officerCards.map((card) => (
            <GuideCardItem key={card.title} card={card} />
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <SectionHeader
          eyebrow="Quotation Workflow"
          title="ลำดับการทำงานใบเสนอราคา"
          description="ใช้ลำดับนี้เป็น checklist ก่อนส่งเอกสารเข้ากระบวนการอนุมัติและหลังได้รับคำตอบจากลูกค้า"
        />
        <Workflow steps={quotationFlow} tone="officer" />
      </section>

      <section className="space-y-5">
        <SectionHeader
          eyebrow="Manager Guide"
          title="คู่มือสำหรับ Manager"
          description="โฟกัสที่การอนุมัติอย่างมีข้อมูล ดูภาพรวมทีม และช่วยให้เอกสารเดินต่อได้เร็ว"
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {managerCards.map((card) => (
            <GuideCardItem key={card.title} card={card} />
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <SectionHeader
          eyebrow="Approval Workflow"
          title="แนวทางอนุมัติให้ครบและตรวจสอบย้อนหลังได้"
          description="ทุกการอนุมัติควรมีข้อมูลครบ เหตุผลชัด และไม่ทิ้งคำถามสำคัญไว้หลังตัดสินใจ"
        />
        <Workflow steps={approvalFlow} tone="manager" />
      </section>

      <section className="space-y-5">
        <SectionHeader
          eyebrow="Shared Tools"
          title="หน้าที่ใช้ร่วมกัน"
          description="ข้อมูลพื้นฐานเหล่านี้ส่งผลต่อเอกสารโดยตรง ควรตรวจให้ถูกต้องก่อนเริ่มงาน"
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {sharedCards.map((card) => (
            <GuideCardItem key={card.title} card={card} />
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="border-amber-300/50 bg-amber-50/70 dark:border-amber-500/30 dark:bg-amber-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-5 w-5" />
              จุดที่ควรระวัง
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6">
            {bestPractices.map((item) => (
              <div key={item} className="flex gap-2">
                <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" />
                <span>{item}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-primary/30 bg-card/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-primary" />
              วิธีแก้เมื่อเจอปัญหา
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {[
              ['หาเมนูไม่เจอ', 'เปิดหน้า “สิทธิ์ของฉัน” เพื่อตรวจ role และสิทธิ์ที่ได้รับ'],
              ['ส่งอนุมัติไม่ได้', 'ตรวจข้อมูลลูกค้า รายการสินค้า ยอดรวม และเงื่อนไขว่ากรอกครบหรือยัง'],
              ['Manager ไม่เห็นงาน', 'ตรวจว่าเอกสารถูกส่งอนุมัติแล้ว และอยู่ในทีม/สายอนุมัติที่ถูกต้อง'],
              ['ข้อมูลเอกสารผิด', 'แก้ไขในต้นทางก่อนสร้างเอกสารถัดไป และแจ้ง Admin หากเป็นข้อมูลกลาง'],
            ].map(([title, detail]) => (
              <div key={title} className="rounded-lg border border-border/60 bg-background/50 p-4">
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{detail}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
