
// 'use client';

// import { useEffect, useState, useCallback, useRef } from 'react';
// import Link from 'next/link';
// import {
//   TrendingUp, Clock, CheckCircle2, XCircle, DollarSign,
//   Users as UsersIcon, Inbox, Crown, Filter, Calendar,
//   BarChart2, Flame, ArrowRight, Info, AlertTriangle,
//   FileCheck, Timer,
// } from 'lucide-react';
// import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
// import { Skeleton } from '@/components/ui/skeleton';
// import { Badge } from '@/components/ui/badge';
// import { Button } from '@/components/ui/button';
// import { api, getApiErrorMessage } from '@/lib/api';
// import { formatDate, formatMoney } from '@/lib/utils';
// import { toast } from 'sonner';
// import type { ApiResponse } from '@/types/api';
// import { usePermissions } from '@/hooks/use-permissions';

// // ─── Types ────────────────────────────────────────────────────────────────────
// type DashboardFilter = 'self' | 'team' | 'all' | 'user';

// interface DashboardData {
//   filter: DashboardFilter;
//   filterUserId?: string;
//   totals: {
//     quotations: number; pending: number; escalated: number;
//     approved: number; rejected: number; totalValue: number; pendingValue: number;
//     poVerificationPending?: number;
//   };
//   todayActivity: { approved: number; rejected: number };
//   monthActivity?: { approved: number; rejected: number };
//   allTimeActivity?: { approved: number; rejected: number };
//   avgApprovalHours?: number;
//   topOfficers: Array<{ userId: string; userName: string; userEmail: string; count: number; value: number }>;
//   recentEscalated: Array<{ id: string; quotationNo: string; grandTotal: number; customerCompany: string; createdByName: string; submittedAt: string }>;
//   statusBreakdown: Array<{ status: string; count: number }>;
//   trendData?: Array<{ month: string; approved: number; rejected: number }>;
//   alerts?: Array<{ type: 'danger' | 'warning' | 'info'; title: string; desc: string }>;
//   rejectionReasons?: Array<{ reason: string; count: number }>;
// }

// interface FilterableUser {
//   id: string; name: string; email: string;
//   role: { code: string; nameTh: string };
//   reportsTo?: { id: string; name: string } | null;
// }

// const STATUS_CFG: Record<string, { color: string; label: string }> = {
//   DRAFT: { color: 'bg-slate-400', label: 'Draft' },
//   PENDING: { color: 'bg-amber-400', label: 'Pending' },
//   PENDING_BACKUP: { color: 'bg-amber-500', label: 'Pending Backup' },
//   PENDING_ESCALATED: { color: 'bg-rose-500', label: 'Escalated' },
//   APPROVED: { color: 'bg-emerald-500', label: 'Approved' },
//   REJECTED: { color: 'bg-red-500', label: 'Rejected' },
//   CANCELLED: { color: 'bg-gray-400', label: 'Cancelled' },
//   EXPIRED: { color: 'bg-gray-500', label: 'Expired' },
//   PO_PENDING: { color: 'bg-amber-300', label: 'PO Pending' },
//   PO_APPROVED: { color: 'bg-teal-500', label: 'PO Approved' },
//   PO_REJECTED: { color: 'bg-red-400', label: 'PO Rejected' },
// };

// // ─── Mock trend + reasons (ใช้เมื่อ backend ยังไม่ส่งมา) ────────────────────
// const MOCK_TREND = [
//   { month: 'Jan', approved: 78, rejected: 35 },
//   { month: 'Feb', approved: 85, rejected: 30 },
//   { month: 'Mar', approved: 90, rejected: 28 },
//   { month: 'Apr', approved: 102, rejected: 25 },
//   { month: 'May', approved: 108, rejected: 26 },
//   { month: 'Jun', approved: 112, rejected: 28 },
// ];

// const MOCK_REASONS = [
//   { reason: 'PO mismatch', count: 72 },
//   { reason: 'Incomplete details', count: 55 },
//   { reason: 'Wrong pricing', count: 40 },
//   { reason: 'Missing attachment', count: 28 },
//   { reason: 'Invalid information', count: 18 },
// ];

// // ════════════════════════════════════════════════════════════════════════════
// // MAIN PAGE
// // ════════════════════════════════════════════════════════════════════════════
// export default function ManagerDashboardPage() {
//   const { role, loading: permLoading } = usePermissions();
//   const [data, setData] = useState<DashboardData | null>(null);
//   const [users, setUsers] = useState<FilterableUser[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [filterValue, setFilterValue] = useState<string>('self');

//   const isExecutive = role?.code === 'CEO' || role?.code === 'ADMIN';
//   const isManagerLike = role?.code === 'MANAGER' || isExecutive;

//   useEffect(() => {
//     if (permLoading || !isManagerLike) return;
//     api.get<ApiResponse<FilterableUser[]>>('/manager-dashboard/filterable-users')
//       .then((r) => setUsers(r.data.data ?? []))
//       .catch(console.error);
//   }, [permLoading, isManagerLike]);

//   const fetchDashboard = useCallback(async () => {
//     if (permLoading) return;
//     setLoading(true);
//     try {
//       let url = '/manager-dashboard/overview';
//       if (filterValue.startsWith('user:')) {
//         url += '?filter=user&userId=' + encodeURIComponent(filterValue.slice(5));
//       } else {
//         url += '?filter=' + filterValue;
//       }
//       const res = await api.get<ApiResponse<DashboardData>>(url);
//       setData(res.data.data ?? null);
//     } catch (err) {
//       toast.error(getApiErrorMessage(err));
//     } finally {
//       setLoading(false);
//     }
//   }, [permLoading, filterValue]);

//   useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

//   if (permLoading) {
//     return (
//       <div className="space-y-4">
//         <Skeleton className="h-12 w-64" />
//         <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
//           {[0,1,2,3].map((i) => <Skeleton key={i} className="h-28" />)}
//         </div>
//         <Skeleton className="h-40" />
//         <Skeleton className="h-64" />
//       </div>
//     );
//   }

//   const managers = users.filter((u) => u.role.code === 'MANAGER');
//   const subordinates = users.filter((u) => u.role.code !== 'MANAGER');
//   const selectedUser = filterValue.startsWith('user:')
//     ? users.find((u) => u.id === filterValue.slice(5)) : null;
//   const filterLabel = filterValue === 'self' ? 'Me (Default)'
//     : filterValue === 'team' ? 'My Team'
//     : filterValue === 'all' ? 'ทั้งระบบ'
//     : selectedUser ? `${selectedUser.name} (${selectedUser.role.nameTh})` : 'User';
//   const isTeamView = filterValue === 'team' || filterValue === 'all';
//   const isUserView = filterValue.startsWith('user:');
//   const isSelfView = filterValue === 'self';

//   return (
//     <div className="space-y-5 max-w-7xl">
//       {/* Header */}
//       <div className="flex flex-wrap items-end justify-between gap-3">
//         <div>
//           <h1 className="text-2xl font-bold flex items-center gap-2">
//             <Crown className="h-6 w-6 text-amber-500" />
//             Dashboard
//           </h1>
//           <p className="text-sm text-muted-foreground mt-0.5">
//             กำลังดู: <span className="font-semibold text-foreground">{filterLabel}</span>
//             {role?.nameTh && <span> · บทบาท: {role.nameTh}</span>}
//           </p>
//         </div>
//         <div className="flex items-center gap-2 flex-wrap">
//           <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
//           <select
//             value={filterValue}
//             onChange={(e) => setFilterValue(e.target.value)}
//             className="h-10 min-w-[220px] rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
//           >
//             <option value="self">— Me (Default)</option>
//             {role?.code === 'MANAGER' && <option value="team">— My Team</option>}
//             {isExecutive && (
//               <>
//                 <option value="team">— My Team</option>
//                 <option value="all">— All Team (ทั้งระบบ)</option>
//               </>
//             )}
//             {managers.length > 0 && (
//               <optgroup label="Managers">
//                 {managers.map((u) => <option key={u.id} value={`user:${u.id}`}>{u.name}</option>)}
//               </optgroup>
//             )}
//             {subordinates.length > 0 && (
//               <optgroup label="Officers / Sales">
//                 {subordinates.map((u) => (
//                   <option key={u.id} value={`user:${u.id}`}>
//                     {u.reportsTo ? `↳ ${u.name}` : u.name}
//                   </option>
//                 ))}
//               </optgroup>
//             )}
//           </select>
//           {isExecutive && (
//             <Button asChild variant="outline" size="sm">
//               <Link href="/manager/users"><UsersIcon className="h-4 w-4" />จัดการผู้ใช้</Link>
//             </Button>
//           )}
//         </div>
//       </div>

//       {/* User context banner */}
//       {isUserView && selectedUser && (
//         <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-sm">
//           <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
//           <div>
//             <span className="font-semibold text-blue-700 dark:text-blue-300">กำลังดูข้อมูลของ {selectedUser.name}</span>
//             <span className="text-muted-foreground ml-1">({selectedUser.role.nameTh})</span>
//           </div>
//         </div>
//       )}

//       {loading && (
//         <div className="space-y-4">
//           <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
//             {[0,1,2,3,4,5,6,7].map((i) => <Skeleton key={i} className="h-28" />)}
//           </div>
//           <Skeleton className="h-40" />
//           <Skeleton className="h-72" />
//           <div className="grid grid-cols-2 gap-4">
//             <Skeleton className="h-64" />
//             <Skeleton className="h-64" />
//           </div>
//         </div>
//       )}

//       {!loading && !data && (
//         <Card>
//           <CardContent className="py-20 text-center text-muted-foreground">
//             ไม่สามารถโหลดข้อมูลได้
//           </CardContent>
//         </Card>
//       )}

//       {!loading && data && (
//         <DashboardContent
//           data={data}
//           isTeamView={isTeamView}
//           isUserView={isUserView}
//           isSelfView={isSelfView}
//           selectedUserName={selectedUser?.name}
//         />
//       )}
//     </div>
//   );
// }

// // ════════════════════════════════════════════════════════════════════════════
// // DASHBOARD CONTENT
// // ════════════════════════════════════════════════════════════════════════════
// function DashboardContent({
//   data, isTeamView, isUserView, isSelfView, selectedUserName,
// }: {
//   data: DashboardData;
//   isTeamView: boolean;
//   isUserView: boolean;
//   isSelfView: boolean;
//   selectedUserName?: string;
// }) {
//   const kpiDecided = data.totals.approved + data.totals.rejected;
//   const kpiRate = kpiDecided > 0 ? Math.round((data.totals.approved / kpiDecided) * 100) : 0;
//   const monthApproved = data.monthActivity?.approved ?? 0;
//   const monthRejected = data.monthActivity?.rejected ?? 0;
//   const monthTotal = monthApproved + monthRejected;
//   const monthRate = monthTotal > 0 ? Math.round((monthApproved / monthTotal) * 100) : null;
//   const allApproved = data.allTimeActivity?.approved ?? data.totals.approved;
//   const allRejected = data.allTimeActivity?.rejected ?? data.totals.rejected;
//   const allTotal = allApproved + allRejected;
//   const allRate = allTotal > 0 ? Math.round((allApproved / allTotal) * 100) : null;
//   const todayTotal = data.todayActivity.approved + data.todayActivity.rejected;
//   const todayRate = todayTotal > 0 ? Math.round((data.todayActivity.approved / todayTotal) * 100) : null;

//   const noKpiData =
//     data.totals.quotations === 0 &&
//     data.totals.pending === 0 &&
//     data.totals.approved === 0 &&
//     data.totals.rejected === 0;

//   const trendData = data.trendData ?? MOCK_TREND;
//   const reasons = data.rejectionReasons ?? MOCK_REASONS;
//   const maxReason = Math.max(...reasons.map((r) => r.count), 1);

//   const alerts: Array<{ type: 'danger' | 'warning' | 'info'; title: string; desc: string }> =
//     data.alerts ?? [
//       ...(data.totals.escalated > 0
//         ? [{ type: 'danger' as const, title: `${data.totals.escalated} escalated case${data.totals.escalated > 1 ? 's' : ''} รอ CEO อนุมัติ`, desc: 'ใบเสนอราคามูลค่าสูงเกินอำนาจอนุมัติ' }]
//         : []),
//       ...(data.totals.pending > 5
//         ? [{ type: 'warning' as const, title: `${data.totals.pending} ใบรออนุมัติ`, desc: 'ตรวจสอบว่ามีรายการเกิน SLA 48 ชั่วโมงหรือไม่' }]
//         : []),
//       ...((data.totals.poVerificationPending ?? 0) > 0
//         ? [{ type: 'warning' as const, title: `${data.totals.poVerificationPending} PO รอตรวจสอบ`, desc: 'มีไฟล์ PO ที่ Officer อัปโหลดแล้ว รอการอนุมัติ' }]
//         : []),
//     ];

//   return (
//     <div className="space-y-5">

//       {/* ── KPI Cards ── */}
//       <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
//         <KpiCard
//           icon={<Inbox className="h-5 w-5" />}
//           label="รออนุมัติ"
//           value={data.totals.pending}
//           accent="from-amber-500 to-orange-500"
//           subtitle={data.totals.escalated > 0 ? `${data.totals.escalated} Escalated` : 'ไม่มีรายการด่วน'}
//           alert={data.totals.escalated > 0}
//         />
//         <KpiCard
//           icon={<FileCheck className="h-5 w-5" />}
//           label="PO รอตรวจสอบ"
//           value={data.totals.poVerificationPending ?? 0}
//           accent="from-blue-500 to-indigo-500"
//           subtitle="ไฟล์ PO ที่ต้องตรวจสอบ"
//         />
//         <KpiCard
//           icon={<CheckCircle2 className="h-5 w-5" />}
//           label="อนุมัติวันนี้"
//           value={data.todayActivity.approved}
//           accent="from-emerald-500 to-teal-500"
//           subtitle={`${kpiRate}% approval rate`}
//         />
//         <KpiCard
//           icon={<XCircle className="h-5 w-5" />}
//           label="ปฏิเสธวันนี้"
//           value={data.todayActivity.rejected}
//           accent="from-red-500 to-rose-500"
//           subtitle="รายการที่ปฏิเสธวันนี้"
//           alert={data.todayActivity.rejected > 3}
//         />
//         <KpiCard
//           icon={<Flame className="h-5 w-5" />}
//           label="Escalated"
//           value={data.totals.escalated}
//           accent="from-rose-500 to-pink-500"
//           subtitle="ต้องรอ CEO อนุมัติ"
//           alert={data.totals.escalated > 0}
//         />
//         <KpiCard
//           icon={<CheckCircle2 className="h-5 w-5" />}
//           label="อนุมัติทั้งหมด"
//           value={data.totals.approved}
//           accent="from-emerald-500 to-teal-500"
//           subtitle={`${kpiRate}% approval rate`}
//         />
//         <KpiCard
//           icon={<DollarSign className="h-5 w-5" />}
//           label="มูลค่ารวม"
//           value={formatMoney(data.totals.totalValue)}
//           accent="from-blue-500 to-cyan-500"
//           subtitle={`${data.totals.quotations} ใบเสนอราคา`}
//           isText
//         />
//         <KpiCard
//           icon={<Timer className="h-5 w-5" />}
//           label="เวลาเฉลี่ย"
//           value={data.avgApprovalHours != null ? `${data.avgApprovalHours.toFixed(1)}h` : '—'}
//           accent="from-violet-500 to-purple-500"
//           subtitle="เฉลี่ยต่อใบเสนอราคา"
//           isText
//         />
//       </div>

//       {/* hint เมื่อ KPI ว่าง */}
//       {noKpiData && (isUserView || isSelfView) && (
//         <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-sm">
//           <Info className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
//           <span className="text-muted-foreground">
//             {isUserView
//               ? `ไม่พบข้อมูลใบเสนอราคาของ ${selectedUserName ?? 'บุคคลนี้'}`
//               : 'ไม่มีข้อมูลใน queue ขณะนี้ — ลองเปลี่ยน filter เป็น "My Team" หรือ "All Team"'}
//           </span>
//         </div>
//       )}

//       {/* ── Approval Activity ── */}
//       <Card>
//         <CardHeader className="pb-2">
//           <CardTitle className="text-sm flex items-center gap-2">
//             <BarChart2 className="h-4 w-4 text-primary" />
//             Approval Activity
//             <span className="text-[10px] text-muted-foreground font-normal ml-1">
//               (งานที่คุณอนุมัติ/ปฏิเสธเอง)
//             </span>
//           </CardTitle>
//         </CardHeader>
//         <CardContent>
//           <div className="grid grid-cols-3 gap-4 divide-x divide-border">
//             <ActivityCol icon={<Clock className="h-3 w-3" />} label="วันนี้" approved={data.todayActivity.approved} rejected={data.todayActivity.rejected} rate={todayRate} />
//             <ActivityCol icon={<Calendar className="h-3 w-3" />} label="เดือนนี้" approved={monthApproved} rejected={monthRejected} rate={monthRate} />
//             <ActivityCol icon={<TrendingUp className="h-3 w-3" />} label="ทั้งหมด" approved={allApproved} rejected={allRejected} rate={allRate} />
//           </div>
//         </CardContent>
//       </Card>

//       {/* ── Approval Trend Chart ── */}
//       <Card>
//         <CardHeader className="pb-2">
//           <CardTitle className="text-sm flex items-center gap-2">
//             <TrendingUp className="h-4 w-4 text-primary" />
//             Approval Trend — 6 เดือนล่าสุด
//           </CardTitle>
//         </CardHeader>
//         <CardContent>
//           <div className="flex gap-4 mb-3 text-xs text-muted-foreground">
//             <span className="flex items-center gap-1.5">
//               <span className="inline-block w-6 h-0.5 bg-emerald-500 rounded" />Approved
//             </span>
//             <span className="flex items-center gap-1.5">
//               <span className="inline-block w-6 h-0.5 bg-red-500 rounded border-dashed border-t-2 border-red-500" />Rejected
//             </span>
//           </div>
//           <TrendChart data={trendData} />
//         </CardContent>
//       </Card>

//       {/* ── Alerts ── */}
//       {alerts.length > 0 && (
//         <Card>
//           <CardHeader className="pb-2">
//             <CardTitle className="text-sm flex items-center gap-2">
//               <AlertTriangle className="h-4 w-4 text-amber-500" />
//               Alerts — ต้องดูแลเป็นพิเศษ
//               <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-300 ml-auto">
//                 {alerts.length}
//               </Badge>
//             </CardTitle>
//           </CardHeader>
//           <CardContent className="space-y-2">
//             {alerts.map((a, i) => (
//               <div key={i} className={`flex items-start gap-2.5 p-3 rounded-lg border text-sm ${
//                 a.type === 'danger'
//                   ? 'bg-red-500/5 border-red-500/30'
//                   : a.type === 'warning'
//                   ? 'bg-amber-500/5 border-amber-500/30'
//                   : 'bg-blue-500/5 border-blue-500/30'
//               }`}>
//                 <AlertTriangle className={`h-4 w-4 shrink-0 mt-0.5 ${
//                   a.type === 'danger' ? 'text-red-500'
//                   : a.type === 'warning' ? 'text-amber-500'
//                   : 'text-blue-500'
//                 }`} />
//                 <div>
//                   <div className="font-medium text-foreground">{a.title}</div>
//                   <div className="text-xs text-muted-foreground mt-0.5">{a.desc}</div>
//                 </div>
//               </div>
//             ))}
//           </CardContent>
//         </Card>
//       )}

//       {/* ── Escalated list ── */}
//       {data.recentEscalated.length > 0 && (
//         <Card className="border-rose-500/40 bg-rose-500/5">
//           <CardHeader className="pb-2">
//             <CardTitle className="text-sm flex items-center gap-2">
//               <Flame className="h-4 w-4 text-rose-500" />
//               <span className="text-rose-700 dark:text-rose-400">Escalated — รอ CEO อนุมัติ</span>
//               <Badge variant="outline" className="text-xs bg-rose-100 text-rose-800 border-rose-300 ml-auto">
//                 {data.recentEscalated.length} รายการ
//               </Badge>
//             </CardTitle>
//           </CardHeader>
//           <CardContent>
//             <div className="space-y-2">
//               {data.recentEscalated.map((q) => (
//                 <Link key={q.id} href={`/quotations/${q.id}`}
//                   className="flex items-center justify-between p-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 hover:border-rose-400 transition-colors gap-4"
//                 >
//                   <div className="min-w-0 flex-1">
//                     <div className="flex items-center gap-2 flex-wrap">
//                       <span className="font-semibold text-sm">{q.quotationNo}</span>
//                       <Badge variant="outline" className="text-[10px] bg-rose-100 text-rose-700 border-rose-300">ESCALATED</Badge>
//                     </div>
//                     <div className="text-xs text-muted-foreground mt-0.5 truncate">
//                       {q.customerCompany} · โดย {q.createdByName}
//                     </div>
//                     <div className="text-[10px] text-muted-foreground mt-0.5">
//                       ส่งเมื่อ {formatDate(q.submittedAt)}
//                     </div>
//                   </div>
//                   <div className="text-right shrink-0">
//                     <div className="font-bold text-rose-700 dark:text-rose-400">{formatMoney(q.grandTotal)}</div>
//                     <ArrowRight className="h-4 w-4 text-muted-foreground ml-auto mt-1" />
//                   </div>
//                 </Link>
//               ))}
//             </div>
//           </CardContent>
//         </Card>
//       )}

//       {/* ── Team Overview + Rejection Reasons ── */}
//       <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
//         <Card>
//           <CardHeader className="pb-2">
//             <CardTitle className="text-sm flex items-center gap-2">
//               <UsersIcon className="h-4 w-4 text-blue-500" />Team Overview
//             </CardTitle>
//           </CardHeader>
//           <CardContent>
//             {data.topOfficers.length === 0 ? (
//               <div className="text-center py-8 text-muted-foreground">
//                 <UsersIcon className="h-10 w-10 mx-auto mb-2 opacity-30" />
//                 <p className="text-sm font-medium">
//                   {isTeamView ? 'ยังไม่มีข้อมูลในช่วงนี้'
//                     : isSelfView ? 'เลือก "My Team" เพื่อดูข้อมูลทีม'
//                     : 'ไม่มีข้อมูลสำหรับบุคคลนี้'}
//                 </p>
//               </div>
//             ) : (
//               <div className="space-y-1">
//                 <div className="grid grid-cols-[1fr_auto_auto] text-[10px] text-muted-foreground uppercase px-2 pb-2 border-b gap-4">
//                   <span>ชื่อ</span><span className="text-center">QT</span><span className="text-right">มูลค่ารวม</span>
//                 </div>
//                 {data.topOfficers.map((o, idx) => (
//                   <Link key={o.userId} href={`/manager/users/${o.userId}`}
//                     className="grid grid-cols-[1fr_auto_auto] items-center p-2 rounded-md hover:bg-accent transition-colors gap-4"
//                   >
//                     <div className="min-w-0 flex items-center gap-2">
//                       <span className="text-xs text-muted-foreground w-4 shrink-0">{idx + 1}</span>
//                       <div className="min-w-0">
//                         <div className="font-medium text-sm truncate">{o.userName}</div>
//                         <div className="text-[10px] text-muted-foreground truncate">{o.userEmail}</div>
//                       </div>
//                     </div>
//                     <Badge variant="outline" className="text-xs">{o.count}</Badge>
//                     <div className="text-sm font-semibold text-right">{formatMoney(o.value)}</div>
//                   </Link>
//                 ))}
//               </div>
//             )}
//           </CardContent>
//         </Card>

//         {/* Rejection Reasons */}
//         <Card>
//           <CardHeader className="pb-2">
//             <CardTitle className="text-sm flex items-center gap-2">
//               <XCircle className="h-4 w-4 text-red-500" />Top Rejection Reasons
//             </CardTitle>
//           </CardHeader>
//           <CardContent className="space-y-3">
//             {reasons.map((r) => {
//               const pct = Math.round((r.count / maxReason) * 100);
//               return (
//                 <div key={r.reason}>
//                   <div className="flex items-center justify-between text-xs mb-1">
//                     <span className="font-medium text-foreground truncate">{r.reason}</span>
//                     <span className="text-muted-foreground ml-2 shrink-0">{r.count}%</span>
//                   </div>
//                   <div className="h-2 rounded-full bg-muted overflow-hidden">
//                     <div className="h-full bg-red-500 rounded-full transition-all duration-500"
//                       style={{ width: `${pct}%` }} />
//                   </div>
//                 </div>
//               );
//             })}
//           </CardContent>
//         </Card>
//       </div>

//       {/* ── Status Breakdown ── */}
//       <Card>
//         <CardHeader className="pb-2">
//           <CardTitle className="text-sm flex items-center gap-2">
//             <BarChart2 className="h-4 w-4 text-purple-500" />Status Breakdown
//           </CardTitle>
//         </CardHeader>
//         <CardContent>
//           {data.statusBreakdown.length === 0 ? (
//             <div className="text-center py-8 text-muted-foreground">
//               <BarChart2 className="h-10 w-10 mx-auto mb-2 opacity-30" />
//               <p className="text-sm">ไม่มีข้อมูลใน filter นี้</p>
//               {isSelfView && (
//                 <p className="text-xs mt-1 opacity-70">ลองเปลี่ยน filter เป็น "My Team" หรือ "All Team"</p>
//               )}
//             </div>
//           ) : (
//             <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
//               {data.statusBreakdown.map((s) => {
//                 const pct = data.totals.quotations > 0
//                   ? Math.round((s.count / data.totals.quotations) * 100) : 0;
//                 const cfg = STATUS_CFG[s.status];
//                 return (
//                   <div key={s.status}>
//                     <div className="flex items-center justify-between text-xs mb-1.5">
//                       <span className="font-medium flex items-center gap-1.5">
//                         <span className={`inline-block w-2 h-2 rounded-full ${cfg?.color ?? 'bg-gray-400'}`} />
//                         {cfg?.label ?? s.status}
//                       </span>
//                       <span className="text-muted-foreground tabular-nums">
//                         {s.count} <span className="text-[10px]">({pct}%)</span>
//                       </span>
//                     </div>
//                     <div className="h-1.5 rounded-full bg-muted overflow-hidden">
//                       <div className={`h-full rounded-full transition-all duration-500 ${cfg?.color ?? 'bg-gray-400'}`}
//                         style={{ width: `${Math.max(pct, 2)}%` }} />
//                     </div>
//                   </div>
//                 );
//               })}
//             </div>
//           )}
//           {data.statusBreakdown.length > 0 && (
//             <div className="pt-3 mt-2 border-t flex justify-between text-xs">
//               <span className="text-muted-foreground">รวมทั้งหมด</span>
//               <span className="font-semibold">{data.totals.quotations} ใบ</span>
//             </div>
//           )}
//         </CardContent>
//       </Card>
//     </div>
//   );
// }

// // ════════════════════════════════════════════════════════════════════════════
// // TREND CHART — SVG-based ไม่ต้องใช้ Chart.js ในไฟล์ Next.js
// // ════════════════════════════════════════════════════════════════════════════
// function TrendChart({ data }: { data: Array<{ month: string; approved: number; rejected: number }> }) {
//   const W = 600; const H = 180; const PL = 36; const PR = 16; const PT = 12; const PB = 28;
//   const cW = W - PL - PR; const cH = H - PT - PB;
//   const maxVal = Math.max(...data.flatMap((d) => [d.approved, d.rejected]), 1);
//   const xStep = cW / (data.length - 1);
//   const y = (v: number) => PT + cH - (v / maxVal) * cH;
//   const x = (i: number) => PL + i * xStep;
//   const polyApproved = data.map((d, i) => `${x(i)},${y(d.approved)}`).join(' ');
//   const polyRejected = data.map((d, i) => `${x(i)},${y(d.rejected)}`).join(' ');
//   const yTicks = [0, Math.round(maxVal * 0.5), maxVal];

//   return (
//     <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 180 }}>
//       {/* Grid lines */}
//       {yTicks.map((v) => (
//         <g key={v}>
//           <line x1={PL} y1={y(v)} x2={W - PR} y2={y(v)}
//             stroke="currentColor" strokeOpacity={0.08} strokeWidth={1} />
//           <text x={PL - 6} y={y(v) + 4} textAnchor="end" fontSize={10}
//             fill="currentColor" fillOpacity={0.45}>{v}</text>
//         </g>
//       ))}
//       {/* Approved area */}
//       <polyline points={polyApproved} fill="none" stroke="#10b981" strokeWidth={2} strokeLinejoin="round" />
//       {data.map((d, i) => (
//         <circle key={i} cx={x(i)} cy={y(d.approved)} r={3.5} fill="#10b981" />
//       ))}
//       {/* Rejected area */}
//       <polyline points={polyRejected} fill="none" stroke="#ef4444" strokeWidth={2}
//         strokeLinejoin="round" strokeDasharray="5 4" />
//       {data.map((d, i) => (
//         <circle key={i} cx={x(i)} cy={y(d.rejected)} r={3.5} fill="#ef4444" />
//       ))}
//       {/* X labels */}
//       {data.map((d, i) => (
//         <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize={11}
//           fill="currentColor" fillOpacity={0.5}>{d.month}</text>
//       ))}
//     </svg>
//   );
// }

// // ════════════════════════════════════════════════════════════════════════════
// // KPI CARD
// // ════════════════════════════════════════════════════════════════════════════
// function KpiCard({
//   icon, label, value, accent, subtitle, alert = false, isText = false,
// }: {
//   icon: React.ReactNode; label: string; value: number | string;
//   accent: string; subtitle?: string; alert?: boolean; isText?: boolean;
// }) {
//   return (
//     <Card className={alert && Number(value) > 0 ? 'border-rose-500/40 bg-rose-500/5' : ''}>
//       <CardContent className="p-4">
//         <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${accent} text-white flex items-center justify-center mb-3 shadow-md`}>
//           {icon}
//         </div>
//         <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{label}</div>
//         <div className={`font-bold mt-1 ${isText ? 'text-xl' : 'text-3xl'} ${alert && Number(value) > 0 ? 'text-rose-600 dark:text-rose-400' : ''}`}>
//           {value}
//         </div>
//         {subtitle && <div className="text-[10px] text-muted-foreground mt-1">{subtitle}</div>}
//       </CardContent>
//     </Card>
//   );
// }

// // ════════════════════════════════════════════════════════════════════════════
// // ACTIVITY COLUMN
// // ════════════════════════════════════════════════════════════════════════════
// function ActivityCol({
//   icon, label, approved, rejected, rate,
// }: {
//   icon: React.ReactNode; label: string;
//   approved: number; rejected: number; rate: number | null;
// }) {
//   const total = approved + rejected;
//   return (
//     <div className="px-4 first:pl-0 last:pr-0">
//       <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">{icon}{label}</div>
//       <div className="flex gap-5">
//         <div>
//           <div className="flex items-center gap-1">
//             <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
//             <span className="text-2xl font-bold">{approved}</span>
//           </div>
//           <div className="text-[10px] text-muted-foreground">Approved</div>
//         </div>
//         <div>
//           <div className="flex items-center gap-1">
//             <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
//             <span className="text-2xl font-bold">{rejected}</span>
//           </div>
//           <div className="text-[10px] text-muted-foreground">Rejected</div>
//         </div>
//       </div>
//       {total > 0 && (
//         <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
//           <div className="h-full bg-emerald-500 rounded-full"
//             style={{ width: `${Math.round((approved / total) * 100)}%` }} />
//         </div>
//       )}
//       <div className="mt-1">
//         {rate !== null
//           ? <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{rate}% approval</span>
//           : <span className="text-xs text-muted-foreground">ยังไม่มีกิจกรรม</span>}
//       </div>
//     </div>
//   );
// }
'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  TrendingUp, Clock, CheckCircle2, XCircle, DollarSign,
  Users as UsersIcon, Inbox, Crown, Filter, Calendar,
  BarChart2, Flame, ArrowRight, Info, AlertTriangle,
  FileCheck, Timer, ChevronRight, Zap, PackageCheck,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api, getApiErrorMessage } from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/utils';
import { toast } from 'sonner';
import type { ApiResponse } from '@/types/api';
import { usePermissions } from '@/hooks/use-permissions';

// ─── Types ────────────────────────────────────────────────────────────────────
type DashboardFilter = 'self' | 'team' | 'all' | 'user';

interface DashboardData {
  filter: DashboardFilter;
  filterUserId?: string;
  totals: {
    quotations: number; pending: number; escalated: number;
    approved: number; rejected: number; totalValue: number; pendingValue: number;
    poVerificationPending?: number;
    soConfirmed?: number;
    conversionRate?: number;
    waitingPo?: number;
  };
  todayActivity: { approved: number; rejected: number };
  monthActivity?: { approved: number; rejected: number };
  allTimeActivity?: { approved: number; rejected: number };
  avgApprovalHours?: number;
  topOfficers: Array<{ userId: string; userName: string; userEmail: string; count: number; value: number; soValue?: number; conversionRate?: number; pendingCount?: number }>;
  recentEscalated: Array<{ id: string; quotationNo: string; grandTotal: number; customerCompany: string; createdByName: string; submittedAt: string }>;
  statusBreakdown: Array<{ status: string; count: number }>;
  trendData?: Array<{ month: string; approved: number; rejected: number }>;
  alerts?: Array<{ type: 'danger' | 'warning' | 'info'; title: string; desc: string }>;
  rejectionReasons?: Array<{ reason: string; count: number }>;
  bottlenecks?: Array<{ type: string; count: number; value: number; reason: string; priority: 'high' | 'medium' | 'low' }>;
  actionRequired?: Array<{ id: string; quotationNo: string; customerCompany: string; grandTotal: number; dueDate?: string; priority: 'high' | 'medium' | 'low'; actionType: string }>;
}

interface FilterableUser {
  id: string; name: string; email: string;
  role: { code: string; nameTh: string };
  reportsTo?: { id: string; name: string } | null;
}

const STATUS_CFG: Record<string, { color: string; label: string }> = {
  DRAFT: { color: 'bg-slate-400', label: 'Draft' },
  PENDING: { color: 'bg-amber-400', label: 'Pending' },
  PENDING_BACKUP: { color: 'bg-amber-500', label: 'Pending Backup' },
  PENDING_ESCALATED: { color: 'bg-rose-500', label: 'Escalated' },
  APPROVED: { color: 'bg-emerald-500', label: 'Approved' },
  REJECTED: { color: 'bg-red-500', label: 'Rejected' },
  CANCELLED: { color: 'bg-gray-400', label: 'Cancelled' },
  EXPIRED: { color: 'bg-gray-500', label: 'Expired' },
  PO_PENDING: { color: 'bg-amber-300', label: 'PO Pending' },
  PO_APPROVED: { color: 'bg-teal-500', label: 'PO Approved' },
  PO_REJECTED: { color: 'bg-red-400', label: 'PO Rejected' },
};

const MOCK_TREND = [
  { month: 'Dec', approved: 0, rejected: 0 },
  { month: 'Jan', approved: 0, rejected: 0 },
  { month: 'Feb', approved: 0, rejected: 0 },
  { month: 'Mar', approved: 0, rejected: 0 },
  { month: 'Apr', approved: 1, rejected: 1 },
  { month: 'May', approved: 14, rejected: 5 },
];

const MOCK_REASONS = [
  { reason: 'PO mismatch', count: 72 },
  { reason: 'Incomplete details', count: 55 },
  { reason: 'Wrong pricing', count: 40 },
  { reason: 'Missing attachment', count: 28 },
  { reason: 'Invalid information', count: 18 },
];

// ════════════════════════════════════════════════════════════════════════════
// MAIN PAGE — dropdown เหมือนเดิมทุกอย่าง
// ════════════════════════════════════════════════════════════════════════════
export default function ManagerDashboardPage() {
  const { role, loading: permLoading } = usePermissions();
  const [data, setData] = useState<DashboardData | null>(null);
  const [users, setUsers] = useState<FilterableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterValue, setFilterValue] = useState<string>('self');

  const isExecutive = role?.code === 'CEO' || role?.code === 'ADMIN';
  const isManagerLike = role?.code === 'MANAGER' || isExecutive;

  useEffect(() => {
    if (permLoading || !isManagerLike) return;
    api.get<ApiResponse<FilterableUser[]>>('/manager-dashboard/filterable-users')
      .then((r) => setUsers(r.data.data ?? []))
      .catch(console.error);
  }, [permLoading, isManagerLike]);

  const fetchDashboard = useCallback(async () => {
    if (permLoading) return;
    setLoading(true);
    try {
      let url = '/manager-dashboard/overview';
      if (filterValue.startsWith('user:')) {
        url += '?filter=user&userId=' + encodeURIComponent(filterValue.slice(5));
      } else {
        url += '?filter=' + filterValue;
      }
      const res = await api.get<ApiResponse<DashboardData>>(url);
      setData(res.data.data ?? null);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [permLoading, filterValue]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  if (permLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[0,1,2,3].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-40" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const managers = users.filter((u) => u.role.code === 'MANAGER');
  const subordinates = users.filter((u) => u.role.code !== 'MANAGER');
  const selectedUser = filterValue.startsWith('user:')
    ? users.find((u) => u.id === filterValue.slice(5)) : null;
  const filterLabel = filterValue === 'self' ? 'Me (Default)'
    : filterValue === 'team' ? 'My Team'
    : filterValue === 'all' ? 'ทั้งระบบ'
    : selectedUser ? `${selectedUser.name} (${selectedUser.role.nameTh})` : 'User';
  const isTeamView = filterValue === 'team' || filterValue === 'all';
  const isUserView = filterValue.startsWith('user:');
  const isSelfView = filterValue === 'self';

  return (
    <div className="space-y-5 max-w-7xl">
      {/* ── Header + Dropdown (เหมือนเดิม) ── */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Crown className="h-6 w-6 text-amber-500" />
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            กำลังดู: <span className="font-semibold text-foreground">{filterLabel}</span>
            {role?.nameTh && <span> · บทบาท: {role.nameTh}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
          <select
            value={filterValue}
            onChange={(e) => setFilterValue(e.target.value)}
            className="h-10 min-w-[220px] rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="self">— Me (Default)</option>
            {role?.code === 'MANAGER' && <option value="team">— My Team</option>}
            {isExecutive && (
              <>
                <option value="team">— My Team</option>
                <option value="all">— All Team (ทั้งระบบ)</option>
              </>
            )}
            {managers.length > 0 && (
              <optgroup label="Managers">
                {managers.map((u) => <option key={u.id} value={`user:${u.id}`}>{u.name}</option>)}
              </optgroup>
            )}
            {subordinates.length > 0 && (
              <optgroup label="Officers / Sales">
                {subordinates.map((u) => (
                  <option key={u.id} value={`user:${u.id}`}>
                    {u.reportsTo ? `↳ ${u.name}` : u.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          {isExecutive && (
            <Button asChild variant="outline" size="sm">
              <Link href="/manager/users"><UsersIcon className="h-4 w-4" />จัดการผู้ใช้</Link>
            </Button>
          )}
        </div>
      </div>

      {/* User context banner */}
      {isUserView && selectedUser && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-sm">
          <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-blue-700 dark:text-blue-300">กำลังดูข้อมูลของ {selectedUser.name}</span>
            <span className="text-muted-foreground ml-1">({selectedUser.role.nameTh})</span>
          </div>
        </div>
      )}

      {loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[0,1,2,3,4,5,6,7].map((i) => <Skeleton key={i} className="h-28" />)}
          </div>
          <Skeleton className="h-40" />
          <Skeleton className="h-56" />
          <Skeleton className="h-72" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-64" /><Skeleton className="h-64" />
          </div>
        </div>
      )}

      {!loading && !data && (
        <Card>
          <CardContent className="py-20 text-center text-muted-foreground">
            ไม่สามารถโหลดข้อมูลได้
          </CardContent>
        </Card>
      )}

      {!loading && data && (
        <DashboardContent
          data={data}
          isTeamView={isTeamView}
          isUserView={isUserView}
          isSelfView={isSelfView}
          selectedUserName={selectedUser?.name}
        />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// DASHBOARD CONTENT
// ════════════════════════════════════════════════════════════════════════════
function DashboardContent({
  data, isTeamView, isUserView, isSelfView, selectedUserName,
}: {
  data: DashboardData;
  isTeamView: boolean;
  isUserView: boolean;
  isSelfView: boolean;
  selectedUserName?: string;
}) {
  const kpiDecided = data.totals.approved + data.totals.rejected;
  const kpiRate = kpiDecided > 0 ? Math.round((data.totals.approved / kpiDecided) * 100) : 0;
  const monthApproved = data.monthActivity?.approved ?? 0;
  const monthRejected = data.monthActivity?.rejected ?? 0;
  const monthTotal = monthApproved + monthRejected;
  const monthRate = monthTotal > 0 ? Math.round((monthApproved / monthTotal) * 100) : null;
  const allApproved = data.allTimeActivity?.approved ?? data.totals.approved;
  const allRejected = data.allTimeActivity?.rejected ?? data.totals.rejected;
  const allTotal = allApproved + allRejected;
  const allRate = allTotal > 0 ? Math.round((allApproved / allTotal) * 100) : null;
  const todayTotal = data.todayActivity.approved + data.todayActivity.rejected;
  const todayRate = todayTotal > 0 ? Math.round((data.todayActivity.approved / todayTotal) * 100) : null;

  const noKpiData = data.totals.quotations === 0 && data.totals.pending === 0 &&
    data.totals.approved === 0 && data.totals.rejected === 0;

  const trendData = data.trendData ?? MOCK_TREND;
  const reasons = data.rejectionReasons ?? MOCK_REASONS;
  const maxReason = Math.max(...reasons.map((r) => r.count), 1);

  // Conversion rate จาก backend หรือคำนวณเอง
  const conversionRate = data.totals.conversionRate ??
    (data.totals.quotations > 0 && data.totals.approved > 0
      ? Math.round((data.totals.approved / data.totals.quotations) * 100) : 0);

  const alerts: Array<{ type: 'danger' | 'warning' | 'info'; title: string; desc: string }> =
    data.alerts ?? [
      ...(data.totals.escalated > 0
        ? [{ type: 'danger' as const, title: `${data.totals.escalated} escalated case${data.totals.escalated > 1 ? 's' : ''} รอ CEO อนุมัติ`, desc: 'ใบเสนอราคามูลค่าสูงเกินอำนาจอนุมัติ' }]
        : []),
      ...(data.totals.pending > 5
        ? [{ type: 'warning' as const, title: `${data.totals.pending} ใบรออนุมัติ`, desc: 'ตรวจสอบว่ามีรายการเกิน SLA 48 ชั่วโมงหรือไม่' }]
        : []),
      ...((data.totals.poVerificationPending ?? 0) > 0
        ? [{ type: 'warning' as const, title: `${data.totals.poVerificationPending} PO รอตรวจสอบ`, desc: 'มีไฟล์ PO ที่ Officer อัปโหลดแล้ว รอการอนุมัติ' }]
        : []),
    ];

  // Mock bottlenecks ถ้า backend ยังไม่มี
  const bottlenecks = data.bottlenecks ?? [
    ...(data.totals.pending > 0 ? [{ type: 'SO Pending Approval', count: data.totals.pending, value: data.totals.pendingValue, reason: 'รอ Manager อนุมัติ', priority: 'high' as const }] : []),
    ...((data.totals.poVerificationPending ?? 0) > 0 ? [{ type: 'PO Validation Pending', count: data.totals.poVerificationPending!, value: 0, reason: 'PO รอตรวจสอบความถูกต้อง', priority: 'medium' as const }] : []),
    ...(data.totals.escalated > 0 ? [{ type: 'Escalated Cases', count: data.totals.escalated, value: 0, reason: 'มูลค่าเกินอำนาจอนุมัติ — รอ CEO', priority: 'high' as const }] : []),
  ];

  return (
    <div className="space-y-5">

      {/* ══ SECTION 1: Executive KPI Summary ══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={<DollarSign className="h-5 w-5" />} label="Total QT Value"
          value={formatMoney(data.totals.totalValue)} accent="from-blue-600 to-indigo-600"
          subtitle={`${data.totals.quotations} ใบเสนอราคา`} isText />
        <KpiCard icon={<Clock className="h-5 w-5" />} label="Waiting PO"
          value={data.totals.waitingPo ?? data.totals.approved} accent="from-amber-500 to-orange-500"
          subtitle="QT อนุมัติแล้ว รอ PO จากลูกค้า" />
        <KpiCard icon={<FileCheck className="h-5 w-5" />} label="PO Received"
          value={data.totals.poVerificationPending ?? 0} accent="from-cyan-500 to-blue-500"
          subtitle="PO ที่ได้รับและรอตรวจสอบ" />
        <KpiCard icon={<PackageCheck className="h-5 w-5" />} label="SO Confirmed"
          value={data.totals.soConfirmed ?? 0} accent="from-emerald-500 to-teal-500"
          subtitle="Sale Order ที่ confirmed แล้ว" />
        <KpiCard icon={<Inbox className="h-5 w-5" />} label="รออนุมัติ"
          value={data.totals.pending} accent="from-amber-500 to-orange-500"
          subtitle={data.totals.escalated > 0 ? `${data.totals.escalated} Escalated` : 'ไม่มีรายการด่วน'}
          alert={data.totals.escalated > 0} />
        <KpiCard icon={<Flame className="h-5 w-5" />} label="Escalated"
          value={data.totals.escalated} accent="from-rose-500 to-pink-500"
          subtitle="ต้องรอ CEO อนุมัติ" alert={data.totals.escalated > 0} />
        <KpiCard icon={<XCircle className="h-5 w-5" />} label="Rejected / Lost"
          value={data.totals.rejected} accent="from-red-500 to-rose-600"
          subtitle="โอกาสที่สูญเสียไป" alert={data.totals.rejected > 3} />
        <KpiCard icon={<Zap className="h-5 w-5" />} label="Conversion Rate"
          value={`${conversionRate}%`} accent="from-violet-500 to-purple-600"
          subtitle="SO Confirmed / Total QT" isText />
      </div>

      {/* hint เมื่อ KPI ว่าง */}
      {noKpiData && (isUserView || isSelfView) && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-sm">
          <Info className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <span className="text-muted-foreground">
            {isUserView
              ? `ไม่พบข้อมูลใบเสนอราคาของ ${selectedUserName ?? 'บุคคลนี้'}`
              : 'ไม่มีข้อมูลใน queue ขณะนี้ — ลองเปลี่ยน filter เป็น "My Team" หรือ "All Team"'}
          </span>
        </div>
      )}

      {/* ══ SECTION 2: Sales Funnel / Pipeline ══ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Sales Pipeline — QT → PO → SO
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SalesFunnel data={data} conversionRate={conversionRate} />
        </CardContent>
      </Card>

      {/* ══ SECTION 3: Approval Activity ══ */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-primary" />
            Approval Activity
            <span className="text-[10px] text-muted-foreground font-normal ml-1">
              (งานที่คุณอนุมัติ/ปฏิเสธเอง)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 divide-x divide-border">
            <ActivityCol icon={<Clock className="h-3 w-3" />} label="วันนี้"
              approved={data.todayActivity.approved} rejected={data.todayActivity.rejected} rate={todayRate} />
            <ActivityCol icon={<Calendar className="h-3 w-3" />} label="เดือนนี้"
              approved={monthApproved} rejected={monthRejected} rate={monthRate} />
            <ActivityCol icon={<TrendingUp className="h-3 w-3" />} label="ทั้งหมด"
              approved={allApproved} rejected={allRejected} rate={allRate} />
          </div>
        </CardContent>
      </Card>

      {/* ══ SECTION 4: Exception / Bottleneck ══ */}
      {bottlenecks.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Bottleneck — จุดติดขัดที่ต้องจัดการ
              <Badge variant="outline" className="ml-auto text-[10px] bg-amber-50 text-amber-700 border-amber-300">
                {bottlenecks.length} รายการ
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {bottlenecks.map((b, i) => (
                <div key={i} className={`flex items-center gap-4 p-3 rounded-lg border ${
                  b.priority === 'high' ? 'bg-red-500/5 border-red-500/30'
                  : b.priority === 'medium' ? 'bg-amber-500/5 border-amber-500/30'
                  : 'bg-blue-500/5 border-blue-500/30'
                }`}>
                  <div className={`w-2 h-8 rounded-full shrink-0 ${
                    b.priority === 'high' ? 'bg-red-500'
                    : b.priority === 'medium' ? 'bg-amber-500'
                    : 'bg-blue-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{b.type}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{b.reason}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-lg">{b.count}</div>
                    {b.value > 0 && <div className="text-xs text-muted-foreground">{formatMoney(b.value)}</div>}
                  </div>
                  <Badge variant="outline" className={`text-[10px] shrink-0 ${
                    b.priority === 'high' ? 'bg-red-50 text-red-700 border-red-300'
                    : b.priority === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-300'
                    : 'bg-blue-50 text-blue-700 border-blue-300'
                  }`}>
                    {b.priority.toUpperCase()}
                  </Badge>
                  <Button asChild size="sm" variant="outline" className="h-7 text-xs shrink-0">
                    <Link href="/quotations">ดู <ChevronRight className="h-3 w-3 ml-0.5" /></Link>
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ══ SECTION 5: Alerts ══ */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Action Required — ต้องดูแลเป็นพิเศษ
              <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-300 ml-auto">
                {alerts.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.map((a, i) => (
              <div key={i} className={`flex items-start gap-2.5 p-3 rounded-lg border text-sm ${
                a.type === 'danger' ? 'bg-red-500/5 border-red-500/30'
                : a.type === 'warning' ? 'bg-amber-500/5 border-amber-500/30'
                : 'bg-blue-500/5 border-blue-500/30'
              }`}>
                <AlertTriangle className={`h-4 w-4 shrink-0 mt-0.5 ${
                  a.type === 'danger' ? 'text-red-500'
                  : a.type === 'warning' ? 'text-amber-500'
                  : 'text-blue-500'
                }`} />
                <div>
                  <div className="font-medium text-foreground">{a.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{a.desc}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ══ Escalated list ══ */}
      {data.recentEscalated.length > 0 && (
        <Card className="border-rose-500/40 bg-rose-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Flame className="h-4 w-4 text-rose-500" />
              <span className="text-rose-700 dark:text-rose-400">Escalated — รอ CEO อนุมัติ</span>
              <Badge variant="outline" className="text-xs bg-rose-100 text-rose-800 border-rose-300 ml-auto">
                {data.recentEscalated.length} รายการ
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.recentEscalated.map((q) => (
                <Link key={q.id} href={`/quotations/${q.id}`}
                  className="flex items-center justify-between p-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 hover:border-rose-400 transition-colors gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{q.quotationNo}</span>
                      <Badge variant="outline" className="text-[10px] bg-rose-100 text-rose-700 border-rose-300">ESCALATED</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">
                      {q.customerCompany} · โดย {q.createdByName}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">ส่งเมื่อ {formatDate(q.submittedAt)}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-rose-700 dark:text-rose-400">{formatMoney(q.grandTotal)}</div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground ml-auto mt-1" />
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ══ SECTION 6: Trend Chart ══ */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Approval Trend — 6 เดือนล่าสุด
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-6 h-0.5 bg-emerald-500 rounded" />Approved
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-6 h-0.5 bg-red-500 rounded" />Rejected
            </span>
          </div>
          <TrendChart data={trendData} />
        </CardContent>
      </Card>

      {/* ══ SECTION 7: Sales Team Performance + Rejection Reasons ══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Sales Team Performance */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <UsersIcon className="h-4 w-4 text-blue-500" />Sales Team Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.topOfficers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <UsersIcon className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm font-medium">
                  {isTeamView ? 'ยังไม่มีข้อมูลในช่วงนี้'
                    : isSelfView ? 'เลือก "My Team" เพื่อดูข้อมูลทีม'
                    : 'ไม่มีข้อมูลสำหรับบุคคลนี้'}
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="grid grid-cols-[auto_1fr_auto_auto] text-[10px] text-muted-foreground uppercase px-2 pb-2 border-b gap-3">
                  <span>#</span><span>ชื่อ</span><span className="text-center">QT</span><span className="text-right">มูลค่า</span>
                </div>
                {data.topOfficers.map((o, idx) => {
                  const maxVal = Math.max(...data.topOfficers.map((x) => x.value), 1);
                  const barPct = Math.round((o.value / maxVal) * 100);
                  return (
                    <Link key={o.userId} href={`/manager/users/${o.userId}`}
                      className="block p-2 rounded-md hover:bg-accent transition-colors"
                    >
                      <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 mb-1.5">
                        <span className={`text-xs font-bold w-5 text-center ${
                          idx === 0 ? 'text-amber-500' : idx === 1 ? 'text-slate-500' : idx === 2 ? 'text-orange-400' : 'text-muted-foreground'
                        }`}>{idx + 1}</span>
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">{o.userName}</div>
                          <div className="text-[10px] text-muted-foreground truncate">{o.userEmail}</div>
                        </div>
                        <Badge variant="outline" className="text-xs">{o.count}</Badge>
                        <div className="text-sm font-semibold text-right">{formatMoney(o.value)}</div>
                      </div>
                      {/* Progress bar */}
                      <div className="ml-8 h-1 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full transition-all duration-500"
                          style={{ width: `${barPct}%` }} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Rejection Reasons */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />Top Rejection Reasons
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {reasons.map((r) => {
              const pct = Math.round((r.count / maxReason) * 100);
              return (
                <div key={r.reason}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-foreground truncate">{r.reason}</span>
                    <span className="text-muted-foreground ml-2 shrink-0">{r.count}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-red-500 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* ══ Status Breakdown ══ */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-purple-500" />Status Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.statusBreakdown.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <BarChart2 className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">ไม่มีข้อมูลใน filter นี้</p>
              {isSelfView && (
                <p className="text-xs mt-1 opacity-70">ลองเปลี่ยน filter เป็น "My Team" หรือ "All Team"</p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
              {data.statusBreakdown.map((s) => {
                const pct = data.totals.quotations > 0
                  ? Math.round((s.count / data.totals.quotations) * 100) : 0;
                const cfg = STATUS_CFG[s.status];
                return (
                  <div key={s.status}>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-medium flex items-center gap-1.5">
                        <span className={`inline-block w-2 h-2 rounded-full ${cfg?.color ?? 'bg-gray-400'}`} />
                        {cfg?.label ?? s.status}
                      </span>
                      <span className="text-muted-foreground tabular-nums">
                        {s.count} <span className="text-[10px]">({pct}%)</span>
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${cfg?.color ?? 'bg-gray-400'}`}
                        style={{ width: `${Math.max(pct, 2)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {data.statusBreakdown.length > 0 && (
            <div className="pt-3 mt-2 border-t flex justify-between text-xs">
              <span className="text-muted-foreground">รวมทั้งหมด</span>
              <span className="font-semibold">{data.totals.quotations} ใบ</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SALES FUNNEL COMPONENT
// ════════════════════════════════════════════════════════════════════════════
function SalesFunnel({ data, conversionRate }: { data: DashboardData; conversionRate: number }) {
  const stages = [
    {
      label: 'Quotation Issued',
      count: data.totals.quotations,
      value: data.totals.totalValue,
      color: 'bg-blue-500',
      textColor: 'text-blue-600 dark:text-blue-400',
      pct: 100,
    },
    {
      label: 'Approved / PO Stage',
      count: data.totals.approved,
      value: 0,
      color: 'bg-cyan-500',
      textColor: 'text-cyan-600 dark:text-cyan-400',
      pct: data.totals.quotations > 0 ? Math.round((data.totals.approved / data.totals.quotations) * 100) : 0,
    },
    {
      label: 'PO Received',
      count: data.totals.poVerificationPending ?? 0,
      value: 0,
      color: 'bg-teal-500',
      textColor: 'text-teal-600 dark:text-teal-400',
      pct: data.totals.approved > 0
        ? Math.round(((data.totals.poVerificationPending ?? 0) / Math.max(data.totals.approved, 1)) * 100) : 0,
    },
    {
      label: 'SO Confirmed',
      count: data.totals.soConfirmed ?? 0,
      value: 0,
      color: 'bg-emerald-500',
      textColor: 'text-emerald-600 dark:text-emerald-400',
      pct: conversionRate,
    },
  ];

  return (
    <div className="space-y-2">
      {stages.map((s, i) => (
        <div key={s.label} className="flex items-center gap-3">
          <div className="w-36 text-xs text-right text-muted-foreground shrink-0 hidden sm:block">
            {s.label}
          </div>
          <div className="flex-1 relative">
            <div className="h-8 rounded-md bg-muted overflow-hidden">
              <div
                className={`h-full ${s.color} rounded-md transition-all duration-700 flex items-center px-3`}
                style={{ width: `${Math.max(s.pct, s.count > 0 ? 8 : 0)}%` }}
              >
                <span className="text-white text-xs font-semibold truncate">
                  {s.count > 0 ? `${s.count} รายการ` : ''}
                </span>
              </div>
            </div>
          </div>
          <div className="w-16 text-right shrink-0">
            <div className={`text-sm font-bold ${s.textColor}`}>{s.pct}%</div>
          </div>
          {i < stages.length - 1 && (
            <div className="absolute left-36 mt-8 ml-3 hidden sm:block">
              <ArrowRight className="h-3 w-3 text-muted-foreground rotate-90" />
            </div>
          )}
        </div>
      ))}
      <div className="pt-2 border-t flex items-center justify-between text-xs text-muted-foreground">
        <span>QT → SO Conversion Rate</span>
        <span className="font-bold text-emerald-600 text-sm">{conversionRate}%</span>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TREND CHART — SVG-based
// ════════════════════════════════════════════════════════════════════════════
function TrendChart({ data }: { data: Array<{ month: string; approved: number; rejected: number }> }) {
  const W = 600; const H = 180; const PL = 36; const PR = 16; const PT = 12; const PB = 28;
  const cW = W - PL - PR; const cH = H - PT - PB;
  const maxVal = Math.max(...data.flatMap((d) => [d.approved, d.rejected]), 1);
  const xStep = cW / Math.max(data.length - 1, 1);
  const y = (v: number) => PT + cH - (v / maxVal) * cH;
  const x = (i: number) => PL + i * xStep;
  const polyApproved = data.map((d, i) => `${x(i)},${y(d.approved)}`).join(' ');
  const polyRejected = data.map((d, i) => `${x(i)},${y(d.rejected)}`).join(' ');
  const yTicks = [0, Math.round(maxVal * 0.5), maxVal];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 180 }}>
      {yTicks.map((v) => (
        <g key={v}>
          <line x1={PL} y1={y(v)} x2={W - PR} y2={y(v)}
            stroke="currentColor" strokeOpacity={0.08} strokeWidth={1} />
          <text x={PL - 6} y={y(v) + 4} textAnchor="end" fontSize={10}
            fill="currentColor" fillOpacity={0.45}>{v}</text>
        </g>
      ))}
      <polyline points={polyApproved} fill="none" stroke="#10b981" strokeWidth={2} strokeLinejoin="round" />
      {data.map((d, i) => (
        <circle key={`a${i}`} cx={x(i)} cy={y(d.approved)} r={3.5} fill="#10b981" />
      ))}
      <polyline points={polyRejected} fill="none" stroke="#ef4444" strokeWidth={2}
        strokeLinejoin="round" strokeDasharray="5 4" />
      {data.map((d, i) => (
        <circle key={`r${i}`} cx={x(i)} cy={y(d.rejected)} r={3.5} fill="#ef4444" />
      ))}
      {data.map((d, i) => (
        <text key={`l${i}`} x={x(i)} y={H - 6} textAnchor="middle" fontSize={11}
          fill="currentColor" fillOpacity={0.5}>{d.month}</text>
      ))}
    </svg>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// KPI CARD
// ════════════════════════════════════════════════════════════════════════════
function KpiCard({
  icon, label, value, accent, subtitle, alert = false, isText = false,
}: {
  icon: React.ReactNode; label: string; value: number | string;
  accent: string; subtitle?: string; alert?: boolean; isText?: boolean;
}) {
  return (
    <Card className={alert && Number(value) > 0 ? 'border-rose-500/40 bg-rose-500/5' : ''}>
      <CardContent className="p-4">
        <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${accent} text-white flex items-center justify-center mb-3 shadow-md`}>
          {icon}
        </div>
        <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{label}</div>
        <div className={`font-bold mt-1 ${isText ? 'text-xl' : 'text-3xl'} ${alert && Number(value) > 0 ? 'text-rose-600 dark:text-rose-400' : ''}`}>
          {value}
        </div>
        {subtitle && <div className="text-[10px] text-muted-foreground mt-1">{subtitle}</div>}
      </CardContent>
    </Card>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ACTIVITY COLUMN
// ════════════════════════════════════════════════════════════════════════════
function ActivityCol({
  icon, label, approved, rejected, rate,
}: {
  icon: React.ReactNode; label: string;
  approved: number; rejected: number; rate: number | null;
}) {
  const total = approved + rejected;
  return (
    <div className="px-4 first:pl-0 last:pr-0">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">{icon}{label}</div>
      <div className="flex gap-5">
        <div>
          <div className="flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            <span className="text-2xl font-bold">{approved}</span>
          </div>
          <div className="text-[10px] text-muted-foreground">Approved</div>
        </div>
        <div>
          <div className="flex items-center gap-1">
            <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
            <span className="text-2xl font-bold">{rejected}</span>
          </div>
          <div className="text-[10px] text-muted-foreground">Rejected</div>
        </div>
      </div>
      {total > 0 && (
        <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full"
            style={{ width: `${Math.round((approved / total) * 100)}%` }} />
        </div>
      )}
      <div className="mt-1">
        {rate !== null
          ? <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{rate}% approval</span>
          : <span className="text-xs text-muted-foreground">ยังไม่มีกิจกรรม</span>}
      </div>
    </div>
  );
}