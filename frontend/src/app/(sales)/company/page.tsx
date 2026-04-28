'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Building2, Save, Loader2, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { api, getApiErrorMessage } from '@/lib/api';
import { useT } from '@/lib/i18n';
import type { ApiResponse, CompanySettings } from '@/types/api';

export default function CompanyPage() {
  const t = useT();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'ADMIN';

  const [data, setData] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<ApiResponse<CompanySettings>>('/company');
        if (res.data.data) setData(res.data.data);
      } catch (err) {
        toast.error(getApiErrorMessage(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const update = (k: keyof CompanySettings, v: string | number) => {
    if (!data) return;
    setData({ ...data, [k]: v });
  };

  const submit = async () => {
    if (!data) return;
    setSaving(true);
    try {
      await api.patch('/company', {
        companyName: data.companyName,
        companyNameTh: data.companyNameTh,
        taxId: data.taxId,
        address: data.address,
        addressTh: data.addressTh,
        phone: data.phone,
        fax: data.fax,
        email: data.email,
        website: data.website,
        defaultVatRate: Number(data.defaultVatRate),
        defaultPaymentTerms: data.defaultPaymentTerms,
        defaultCurrency: data.defaultCurrency,
        bankName: data.bankName,
        bankAccount: data.bankAccount,
        bankBranch: data.bankBranch,
      });
      toast.success(t('company.saved'));
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 max-w-4xl">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-start gap-3">
          <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{t('company.title')}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t('company.subtitle')}</p>
          </div>
        </div>
        {isAdmin && (
          <Button onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {t('common.save')}
          </Button>
        )}
      </div>

      {!isAdmin && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="pt-4 flex gap-3">
            <Lock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm">{t('company.adminOnly')}</p>
          </CardContent>
        </Card>
      )}

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('company.basicInfo')}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">
              {t('company.companyName')} <span className="text-destructive">*</span>
            </Label>
            <Input
              value={data.companyName}
              onChange={(e) => update('companyName', e.target.value)}
              disabled={!isAdmin}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label className="text-xs">{t('company.companyNameTh')}</Label>
            <Input
              value={data.companyNameTh || ''}
              onChange={(e) => update('companyNameTh', e.target.value)}
              disabled={!isAdmin}
              className="mt-1.5"
              placeholder="บริษัท ของคุณ จำกัด"
            />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">{t('company.taxId')}</Label>
            <Input
              value={data.taxId || ''}
              onChange={(e) => update('taxId', e.target.value)}
              disabled={!isAdmin}
              className="mt-1.5"
              placeholder="0105561234567"
            />
          </div>
        </CardContent>
      </Card>

      {/* Address */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('company.addressInfo')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs">{t('company.address')}</Label>
            <Input
              value={data.address || ''}
              onChange={(e) => update('address', e.target.value)}
              disabled={!isAdmin}
              className="mt-1.5"
              placeholder="123 Sukhumvit Rd, Bangkok 10110"
            />
          </div>
          <div>
            <Label className="text-xs">{t('company.addressTh')}</Label>
            <Input
              value={data.addressTh || ''}
              onChange={(e) => update('addressTh', e.target.value)}
              disabled={!isAdmin}
              className="mt-1.5"
              placeholder="123 ถนนสุขุมวิท เขตวัฒนา กรุงเทพฯ 10110"
            />
          </div>
        </CardContent>
      </Card>

      {/* Contact */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('company.contactInfo')}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">{t('company.phone')}</Label>
            <Input
              value={data.phone || ''}
              onChange={(e) => update('phone', e.target.value)}
              disabled={!isAdmin}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label className="text-xs">{t('company.fax')}</Label>
            <Input
              value={data.fax || ''}
              onChange={(e) => update('fax', e.target.value)}
              disabled={!isAdmin}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label className="text-xs">{t('company.email')}</Label>
            <Input
              type="email"
              value={data.email || ''}
              onChange={(e) => update('email', e.target.value)}
              disabled={!isAdmin}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label className="text-xs">{t('company.website')}</Label>
            <Input
              value={data.website || ''}
              onChange={(e) => update('website', e.target.value)}
              disabled={!isAdmin}
              className="mt-1.5"
              placeholder="https://yourcompany.com"
            />
          </div>
        </CardContent>
      </Card>

      {/* Defaults */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('company.defaults')}</CardTitle>
          <CardDescription>ใช้เป็นค่าเริ่มต้นเมื่อสร้างใบเสนอราคาใหม่</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs">{t('company.defaultVatRate')}</Label>
            <Input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={Number(data.defaultVatRate)}
              onChange={(e) => update('defaultVatRate', parseFloat(e.target.value) || 0)}
              disabled={!isAdmin}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label className="text-xs">{t('company.defaultPaymentTerms')}</Label>
            <select
              value={data.defaultPaymentTerms || ''}
              onChange={(e) => update('defaultPaymentTerms', e.target.value)}
              disabled={!isAdmin}
              className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm disabled:opacity-60"
            >
              <option value="Net 30">Net 30</option>
              <option value="Net 60">Net 60</option>
              <option value="Net 90">Net 90</option>
              <option value="COD">COD</option>
              <option value="Prepaid">Prepaid</option>
            </select>
          </div>
          <div>
            <Label className="text-xs">{t('company.defaultCurrency')}</Label>
            <select
              value={data.defaultCurrency}
              onChange={(e) => update('defaultCurrency', e.target.value)}
              disabled={!isAdmin}
              className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm disabled:opacity-60"
            >
              <option value="THB">THB</option>
              <option value="USD">USD</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Bank */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('company.bankInfo')}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs">{t('company.bankName')}</Label>
            <Input
              value={data.bankName || ''}
              onChange={(e) => update('bankName', e.target.value)}
              disabled={!isAdmin}
              className="mt-1.5"
              placeholder="Kasikorn Bank"
            />
          </div>
          <div>
            <Label className="text-xs">{t('company.bankAccount')}</Label>
            <Input
              value={data.bankAccount || ''}
              onChange={(e) => update('bankAccount', e.target.value)}
              disabled={!isAdmin}
              className="mt-1.5"
              placeholder="123-4-56789-0"
            />
          </div>
          <div>
            <Label className="text-xs">{t('company.bankBranch')}</Label>
            <Input
              value={data.bankBranch || ''}
              onChange={(e) => update('bankBranch', e.target.value)}
              disabled={!isAdmin}
              className="mt-1.5"
              placeholder="Sukhumvit"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}