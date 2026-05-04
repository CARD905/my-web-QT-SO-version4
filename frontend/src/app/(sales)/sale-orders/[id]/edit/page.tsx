'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Loader2,
  Copy,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { api, getApiErrorMessage } from '@/lib/api'
import { formatNumber } from '@/lib/utils'
import type { ApiResponse, SaleOrder, SaleOrderItem, Product, DiscountType } from '@/types/api'

// ─── emptyItem ──────────────────────────────────────────────────────────────
function emptyItem(): SaleOrderItem {
  return {
    productId: '',
    productSku: '',
    productName: '',
    productDescription: '',
    unit: 'ชิ้น',
    unitPrice: 0,
    quantity: 1,
    discount: 0,
    discountType: 'PERCENTAGE' as DiscountType,
    lineTotal: 0,
  }
}

// ─── คำนวณ lineTotal ─────────────────────────────────────────────────────────
function calcLineTotal(item: SaleOrderItem): number {
  const qty = Number(item.quantity)
  const price = Number(item.unitPrice)
  const disc = Number(item.discount)

  if (item.discountType === 'PERCENTAGE') {
    return qty * price * (1 - disc / 100)
  }
  return Math.max(0, qty * price - disc)
}

// ─── UpdateSaleOrderPayload ───────────────────────────────────────────────────
interface UpdateSaleOrderPayload {
  customerCompany?: string
  customerContactName?: string
  customerTaxId?: string
  customerEmail?: string
  customerPhone?: string
  customerBillingAddress?: string
  customerShippingAddress?: string
  items?: Array<{
    productId?: string | null
    productSku?: string | null
    productName: string
    productDescription?: string | null
    unit: string
    unitPrice: number
    quantity: number
    discount: number
    discountType: DiscountType
    lineTotal: number
  }>
  discountTotal?: number
  vatRate?: number
  vatEnabled?: boolean
  paymentTerms?: string
  conditions?: string
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function SaleOrderEditPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const { data: session } = useSession()

  // ─── Loading states
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [so, setSo] = useState<SaleOrder | null>(null)

  // ─── Customer fields (ตรงกับ SaleOrder type)
  const [customerCompany, setCustomerCompany] = useState('')
  const [customerContactName, setCustomerContactName] = useState('')
  const [customerTaxId, setCustomerTaxId] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerBillingAddress, setCustomerBillingAddress] = useState('')
  const [customerShippingAddress, setCustomerShippingAddress] = useState('')

  // ─── Items
  const [items, setItems] = useState<SaleOrderItem[]>([emptyItem()])

  // ─── Pricing (ตรงกับ SaleOrder type)
  const [discountTotal, setDiscountTotal] = useState(0)
  const [vatRate, setVatRate] = useState(7)
  const [vatEnabled, setVatEnabled] = useState(true)

  // ─── Terms
  const [paymentTerms, setPaymentTerms] = useState('')
  const [conditions, setConditions] = useState('')

  // ─── Fetch ──────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const [soRes, productsRes] = await Promise.all([
        api.get<ApiResponse<SaleOrder>>(`/sale-orders/${id}`),
        api.get<ApiResponse<{ items: Product[] }>>('/products?limit=500'),
      ])

      const soData = soRes.data.data
      if (!soData) throw new Error('ไม่พบข้อมูล Sale Order')

      // Guard: ต้อง DRAFT เท่านั้น
      if (soData.status !== 'DRAFT') {
        router.replace(`/sale-orders/${id}`)
        return
      }

      // Guard: ต้องเป็น owner (เทียบผ่าน quotation.createdById)
      const userId = session?.user?.id
      const ownerId = (soData as any)?.quotation?.createdById
      if (userId && ownerId && userId !== ownerId) {
        router.replace(`/sale-orders/${id}`)
        return
      }

      const productList: Product[] =
        (productsRes.data.data as any)?.items ??
        (productsRes.data.data as any) ??
        []

      setSo(soData)
      setProducts(productList)

      // Populate — ใช้ชื่อ field ตรงกับ SaleOrder type
      setCustomerCompany(soData.customerCompany ?? '')
      setCustomerContactName(soData.customerContactName ?? '')
      setCustomerTaxId(soData.customerTaxId ?? '')
      setCustomerEmail(soData.customerEmail ?? '')
      setCustomerPhone(soData.customerPhone ?? '')
      setCustomerBillingAddress(soData.customerBillingAddress ?? '')
      setCustomerShippingAddress(soData.customerShippingAddress ?? '')
      setItems(soData.items?.length ? soData.items : [emptyItem()])
      setDiscountTotal(Number(soData.discountTotal) || 0)
      setVatRate(Number(soData.vatRate) || 7)
      setVatEnabled(soData.vatEnabled ?? true)
      setPaymentTerms(soData.paymentTerms ?? '')
      setConditions(soData.conditions ?? '')
    } catch (err: any) {
      setError(getApiErrorMessage(err) ?? 'โหลดข้อมูลไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }, [id, session, router])

  useEffect(() => {
    if (session !== undefined) fetchData()
  }, [fetchData, session])

  // ─── Item helpers ──────────────────────────────────────────────────────
  function updateItem(
    index: number,
    field: keyof SaleOrderItem,
    value: string | number,
  ) {
    setItems(prev => {
      const next = [...prev]
      const item = { ...next[index], [field]: value }

      // เลือก product → auto-fill
      if (field === 'productId') {
        const product = products.find(p => p.id === value)
        if (product) {
          item.productName = product.name
          item.productSku = product.sku
          item.productDescription = product.description ?? ''
          item.unit = product.unit
          item.unitPrice = Number(product.unitPrice)
        }
      }

      item.lineTotal = calcLineTotal(item)
      next[index] = item
      return next
    })
  }

  function addItem() {
    setItems(prev => [...prev, emptyItem()])
  }

  function removeItem(index: number) {
    if (items.length <= 1) return
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  // ─── Summary ────────────────────────────────────────────────────────────
  const subtotal = items.reduce((sum, it) => sum + calcLineTotal(it), 0)
  const afterDiscount = Math.max(0, subtotal - discountTotal)
  const vatAmount = vatEnabled ? (afterDiscount * vatRate) / 100 : 0
  const grandTotal = afterDiscount + vatAmount

  // ─── Save ────────────────────────────────────────────────────────────────
  async function handleSave() {
    const hasEmpty = items.some(it => !it.productName.trim())
    if (hasEmpty) {
      setError('กรุณาเลือกสินค้าให้ครบทุกรายการ')
      return
    }
    if (!customerCompany.trim()) {
      setError('กรุณากรอกชื่อบริษัท / ลูกค้า')
      return
    }

    setSaving(true)
    setError(null)

    const payload: UpdateSaleOrderPayload = {
      customerCompany,
      customerContactName,
      customerTaxId,
      customerEmail,
      customerPhone,
      customerBillingAddress,
      customerShippingAddress,
      items: items.map(it => ({
        productId: it.productId || null,
        productSku: it.productSku || null,
        productName: it.productName,
        productDescription: it.productDescription || null,
        unit: it.unit,
        unitPrice: Number(it.unitPrice),
        quantity: Number(it.quantity),
        discount: Number(it.discount),
        discountType: it.discountType,
        lineTotal: calcLineTotal(it),
      })),
      discountTotal,
      vatRate,
      vatEnabled,
      paymentTerms,
      conditions,
    }

    try {
      await api.patch(`/sale-orders/${id}`, payload)
      toast.success('บันทึกสำเร็จ')
      router.push(`/sale-orders/${id}`)
    } catch (err: any) {
      setError(getApiErrorMessage(err) ?? 'บันทึกไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  // ─── Render: Loading ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!so) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-gray-500">ไม่พบข้อมูล Sale Order</p>
        <Button asChild variant="outline" size="sm">
          <Link href="/sale-orders"><ArrowLeft className="h-4 w-4" /> กลับ</Link>
        </Button>
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href={`/sale-orders/${id}`}>
              <ArrowLeft className="h-4 w-4" />
              กลับ
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">แก้ไข Sale Order</h1>
            <p className="text-sm text-gray-500">
              {so.saleOrderNo} ·{' '}
              <span className="inline-flex items-center gap-1 text-gray-600 font-medium">
                📝 DRAFT
              </span>
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push(`/sale-orders/${id}`)}
            disabled={saving}
          >
            ยกเลิก
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? 'กำลังบันทึก...' : 'บันทึก'}
          </Button>
        </div>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm flex items-start gap-2">
          <span className="shrink-0">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* ── Section 1: ข้อมูลลูกค้า ── */}
      <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-800">ข้อมูลลูกค้า</h2>
        </div>
        <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* ชื่อบริษัท */}
          <div className="md:col-span-2">
            <Label required>ชื่อบริษัท / ลูกค้า</Label>
            <input
              type="text"
              value={customerCompany}
              onChange={e => setCustomerCompany(e.target.value)}
              className={inputCls}
              placeholder="บริษัท XYZ จำกัด"
            />
          </div>

          {/* เลขผู้เสียภาษี */}
          <div>
            <Label>เลขผู้เสียภาษี</Label>
            <input
              type="text"
              value={customerTaxId}
              onChange={e => setCustomerTaxId(e.target.value)}
              className={inputCls}
              placeholder="0000000000000"
              maxLength={13}
            />
          </div>

          {/* ผู้ติดต่อ */}
          <div>
            <Label>ชื่อผู้ติดต่อ</Label>
            <input
              type="text"
              value={customerContactName}
              onChange={e => setCustomerContactName(e.target.value)}
              className={inputCls}
              placeholder="คุณสมชาย ใจดี"
            />
          </div>

          {/* อีเมล */}
          <div>
            <Label>อีเมล</Label>
            <input
              type="email"
              value={customerEmail}
              onChange={e => setCustomerEmail(e.target.value)}
              className={inputCls}
              placeholder="contact@company.com"
            />
          </div>

          {/* โทรศัพท์ */}
          <div>
            <Label>โทรศัพท์</Label>
            <input
              type="tel"
              value={customerPhone}
              onChange={e => setCustomerPhone(e.target.value)}
              className={inputCls}
              placeholder="02-XXX-XXXX"
            />
          </div>

          {/* ที่อยู่ออกใบกำกับ */}
          <div className="md:col-span-2">
            <Label>ที่อยู่ออกใบกำกับภาษี</Label>
            <textarea
              value={customerBillingAddress}
              onChange={e => setCustomerBillingAddress(e.target.value)}
              rows={3}
              className={`${inputCls} resize-none`}
              placeholder="123 ถนน... แขวง... เขต... กรุงเทพฯ 10000"
            />
          </div>

          {/* ที่อยู่จัดส่ง */}
          <div className="md:col-span-2">
            <div className="flex items-center justify-between mb-1.5">
              <Label>ที่อยู่จัดส่ง</Label>
              <button
                type="button"
                onClick={() => setCustomerShippingAddress(customerBillingAddress)}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition"
              >
                <Copy className="h-3 w-3" />
                คัดลอกจากที่อยู่ออกใบกำกับ
              </button>
            </div>
            <textarea
              value={customerShippingAddress}
              onChange={e => setCustomerShippingAddress(e.target.value)}
              rows={3}
              className={`${inputCls} resize-none`}
              placeholder="ที่อยู่จัดส่ง (ถ้าต่างจากที่อยู่ออกใบกำกับ)"
            />
          </div>
        </div>
      </section>

      {/* ── Section 2: รายการสินค้า ── */}
      <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-800">รายการสินค้า</h2>
          <Button size="sm" variant="outline" onClick={addItem}>
            <Plus className="h-4 w-4" />
            เพิ่มรายการ
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 text-xs">
                <th className="text-left px-4 py-3 w-8">#</th>
                <th className="text-left px-4 py-3 min-w-[200px]">สินค้า</th>
                <th className="text-left px-4 py-3 w-20">หน่วย</th>
                <th className="text-right px-4 py-3 w-24">จำนวน</th>
                <th className="text-right px-4 py-3 w-32">ราคา/หน่วย</th>
                <th className="text-right px-4 py-3 w-28">ส่วนลด</th>
                <th className="text-center px-4 py-3 w-24">ประเภทส่วนลด</th>
                <th className="text-right px-4 py-3 w-32">รวม</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item, idx) => (
                <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 text-gray-400 text-xs">{idx + 1}</td>

                  {/* Product select */}
                  <td className="px-4 py-3">
                    <select
                      value={item.productId ?? ''}
                      onChange={e => updateItem(idx, 'productId', e.target.value)}
                      className={selectCls}
                    >
                      <option value="">-- เลือกสินค้า --</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.sku ? `[${p.sku}] ` : ''}{p.name}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Unit */}
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={item.unit}
                      onChange={e => updateItem(idx, 'unit', e.target.value)}
                      className={`${inputCls} text-center`}
                    />
                  </td>

                  {/* Quantity */}
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={e => updateItem(idx, 'quantity', Number(e.target.value))}
                      className={`${inputCls} text-right`}
                    />
                  </td>

                  {/* Unit price */}
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={item.unitPrice}
                      onChange={e => updateItem(idx, 'unitPrice', Number(e.target.value))}
                      className={`${inputCls} text-right`}
                    />
                  </td>

                  {/* Discount */}
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={item.discount}
                      onChange={e => updateItem(idx, 'discount', Number(e.target.value))}
                      className={`${inputCls} text-right`}
                    />
                  </td>

                  {/* Discount type */}
                  <td className="px-4 py-3">
                    <select
                      value={item.discountType}
                      onChange={e =>
                        updateItem(idx, 'discountType', e.target.value as DiscountType)
                      }
                      className={selectCls}
                    >
                      <option value="PERCENTAGE">%</option>
                      <option value="FIXED">฿</option>
                    </select>
                  </td>

                  {/* Line total */}
                  <td className="px-4 py-3 text-right font-semibold text-gray-800">
                    {formatNumber(calcLineTotal(item))}
                  </td>

                  {/* Remove */}
                  <td className="px-2 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      disabled={items.length <= 1}
                      className="text-gray-300 hover:text-red-500 transition disabled:opacity-20 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Summary ── */}
        <div className="border-t border-gray-200 px-6 py-5 flex justify-end">
          <div className="w-80 space-y-3 text-sm">
            <SummaryRow label="ยอดรวมก่อนหักส่วนลด" value={formatNumber(subtotal)} />

            {/* ส่วนลดรวม */}
            <div className="flex items-center justify-between text-gray-600">
              <span>ส่วนลดรวม (บาท)</span>
              <input
                type="number"
                min={0}
                step={0.01}
                value={discountTotal}
                onChange={e => setDiscountTotal(Number(e.target.value))}
                className="w-32 border border-gray-300 rounded-md px-2 py-1 text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <SummaryRow label="หลังหักส่วนลด" value={formatNumber(afterDiscount)} />

            {/* VAT toggle + rate */}
            <div className="flex items-center justify-between text-gray-600">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="vatEnabled"
                  checked={vatEnabled}
                  onChange={e => setVatEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="vatEnabled" className="select-none cursor-pointer">
                  VAT (%)
                </label>
              </div>
              <input
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={vatRate}
                disabled={!vatEnabled}
                onChange={e => setVatRate(Number(e.target.value))}
                className="w-20 border border-gray-300 rounded-md px-2 py-1 text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-40"
              />
            </div>

            {vatEnabled && (
              <SummaryRow
                label={`ภาษีมูลค่าเพิ่ม ${vatRate}%`}
                value={formatNumber(vatAmount)}
              />
            )}

            {/* Grand total */}
            <div className="flex justify-between items-baseline border-t border-gray-200 pt-3 font-bold text-base text-gray-900">
              <span>ยอดรวมสุทธิ</span>
              <span className="text-blue-600 text-lg">
                {formatNumber(grandTotal)} {so.currency}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 3: เงื่อนไข ── */}
      <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-800">เงื่อนไขและหมายเหตุ</h2>
        </div>
        <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <Label>เงื่อนไขการชำระเงิน</Label>
            <input
              type="text"
              value={paymentTerms}
              onChange={e => setPaymentTerms(e.target.value)}
              className={inputCls}
              placeholder="เช่น ชำระภายใน 30 วัน, เงินสด"
            />
          </div>

          <div className="md:col-span-2">
            <Label>เงื่อนไขอื่นๆ / Conditions</Label>
            <textarea
              value={conditions}
              onChange={e => setConditions(e.target.value)}
              rows={3}
              className={`${inputCls} resize-none`}
              placeholder="เช่น ราคานี้มีผลภายใน 30 วัน"
            />
          </div>
        </div>
      </section>

      {/* ── Bottom Action Buttons ── */}
      <div className="flex items-center justify-end gap-3 pb-10">
        <Button
          variant="outline"
          onClick={() => router.push(`/sale-orders/${id}`)}
          disabled={saving}
        >
          ยกเลิก
        </Button>
        <Button onClick={handleSave} disabled={saving} className="min-w-[120px]">
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saving ? 'กำลังบันทึก...' : 'บันทึก'}
        </Button>
      </div>
    </div>
  )
}

// ─── Shared CSS strings ────────────────────────────────────────────────────
const inputCls =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition'

const selectCls =
  'w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition bg-white'

// ─── Sub-components ────────────────────────────────────────────────────────
function Label({
  children,
  required,
}: {
  children: React.ReactNode
  required?: boolean
}) {
  return (
    <label className="block text-sm font-medium text-gray-700 mb-1.5">
      {children}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-gray-600">
      <span>{label}</span>
      <span className="font-medium text-gray-800">{value}</span>
    </div>
  )
}