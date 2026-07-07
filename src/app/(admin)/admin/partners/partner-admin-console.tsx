"use client";

import { useEffect, useState } from 'react';
import {
  adjustPartnerWallet,
  getPartnerAdminData,
  reviewPartnerApplication,
  reviewPartnerFunding,
  resolvePartnerTransaction,
  updatePartnerProgramSettings,
} from '@/lib/admin-api';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type PartnerAdminData = {
  success: boolean;
  message?: string;
  settings?: Record<string, any>;
  applications?: any[];
  partners?: any[];
  transactions?: any[];
  fundingRequests?: any[];
  packages?: any[];
};

const WEEKDAY_OPTIONS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function PartnerAdminConsole() {
  const { toast } = useToast();
  const [data, setData] = useState<PartnerAdminData | null>(null);
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [review, setReview] = useState<Record<string, any>>({});
  const [adjustments, setAdjustments] = useState<Record<string, string>>({});

  const load = async () => {
    const result = await getPartnerAdminData();
    if (result.success) {
      setData(result as PartnerAdminData);
      setSettings((result as PartnerAdminData).settings || {});
      return;
    }
    toast({ title: 'Partner data unavailable', description: result.message, variant: 'destructive' });
  };

  useEffect(() => {
    void load();
  }, []);

  if (!data) return null;

  const selectedPartnerWithdrawalDays = Array.isArray(settings.partnerWithdrawalDays)
    ? settings.partnerWithdrawalDays
    : String(settings.partnerWithdrawalDays || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

  const togglePartnerWithdrawalDay = (day: string, checked: boolean) => {
    const current = selectedPartnerWithdrawalDays;
    const next = checked
      ? Array.from(new Set([...current, day]))
      : current.filter((item) => item !== day);
    setSettings({ ...settings, partnerWithdrawalDays: next });
  };

  const selectedPartnerDepositDays = Array.isArray(settings.partnerDepositDays)
    ? settings.partnerDepositDays
    : String(settings.partnerDepositDays || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

  const togglePartnerDepositDay = (day: string, checked: boolean) => {
    const current = selectedPartnerDepositDays;
    const next = checked
      ? Array.from(new Set([...current, day]))
      : current.filter((item) => item !== day);
    setSettings({ ...settings, partnerDepositDays: next });
  };

  const saveSettings = async () => {
    const result = await updatePartnerProgramSettings({
      ...settings,
      partnerSupportedCountries: String(settings.partnerSupportedCountries || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      partnerDepositDays: selectedPartnerDepositDays,
      partnerWithdrawalDays: selectedPartnerWithdrawalDays,
    });
    toast({
      title: result.success ? 'Saved' : 'Failed',
      description: result.message,
      variant: result.success ? 'default' : 'destructive',
    });
  };

  return (
    <div className="mb-8 space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Partner Program Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label>Program title</Label>
              <Input value={settings.partnerProgramTitle || ''} onChange={(e) => setSettings({ ...settings, partnerProgramTitle: e.target.value })} />
            </div>
            <div>
              <Label>Minimum account age (days)</Label>
              <Input
                type="number"
                value={settings.partnerMinimumAccountAgeDays || 0}
                onChange={(e) => setSettings({ ...settings, partnerMinimumAccountAgeDays: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label>Minimum wallet balance</Label>
              <Input
                type="number"
                value={settings.partnerMinimumWalletBalance || 0}
                onChange={(e) => setSettings({ ...settings, partnerMinimumWalletBalance: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label>Minimum completed transactions</Label>
              <Input
                type="number"
                value={settings.partnerMinimumCompletedTransactions || 0}
                onChange={(e) => setSettings({ ...settings, partnerMinimumCompletedTransactions: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label>Minimum package (ID)</Label>
              <Select
                value={settings.partnerMinimumPackageId || '__none__'}
                onValueChange={(value) => setSettings({ ...settings, partnerMinimumPackageId: value === '__none__' ? '' : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Leave empty to disable" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {(data.packages || []).map((pkg: any) => (
                    <SelectItem key={pkg.id} value={pkg.id}>
                      {pkg.name} ({pkg.id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Supported countries (comma-separated)</Label>
              <Input
                value={Array.isArray(settings.partnerSupportedCountries) ? settings.partnerSupportedCountries.join(', ') : settings.partnerSupportedCountries || ''}
                onChange={(e) => setSettings({ ...settings, partnerSupportedCountries: e.target.value })}
              />
            </div>
            <div>
              <Label>Partner deposit days</Label>
              <div className="mt-2 grid grid-cols-2 gap-2 rounded-md border p-3">
                {WEEKDAY_OPTIONS.map((day) => (
                  <label key={day} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={selectedPartnerDepositDays.includes(day)}
                      onCheckedChange={(value) => togglePartnerDepositDay(day, Boolean(value))}
                    />
                    {day}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label>Partner deposit minimum amount</Label>
              <Input
                type="number"
                value={settings.partnerDepositMinimumAmount || 0}
                onChange={(e) => setSettings({ ...settings, partnerDepositMinimumAmount: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label>Partner deposit maximum amount</Label>
              <Input
                type="number"
                value={settings.partnerDepositMaximumAmount || 0}
                onChange={(e) => setSettings({ ...settings, partnerDepositMaximumAmount: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label>Partner withdrawal days</Label>
              <div className="mt-2 grid grid-cols-2 gap-2 rounded-md border p-3">
                {WEEKDAY_OPTIONS.map((day) => (
                  <label key={day} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={selectedPartnerWithdrawalDays.includes(day)}
                      onCheckedChange={(value) => togglePartnerWithdrawalDay(day, Boolean(value))}
                    />
                    {day}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label>Partner withdrawal minimum amount</Label>
              <Input
                type="number"
                value={settings.partnerWithdrawalMinimumAmount || 0}
                onChange={(e) => setSettings({ ...settings, partnerWithdrawalMinimumAmount: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label>Partner withdrawal maximum amount</Label>
              <Input
                type="number"
                value={settings.partnerWithdrawalMaximumAmount || 0}
                onChange={(e) => setSettings({ ...settings, partnerWithdrawalMaximumAmount: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-4 pb-2">
            <label className="flex items-center gap-2">
              <Checkbox checked={settings.partnerProgramEnabled !== false} onCheckedChange={(v) => setSettings({ ...settings, partnerProgramEnabled: Boolean(v) })} />
              Enabled
            </label>
            <label className="flex items-center gap-2">
              <Checkbox checked={settings.partnerRequireVerifiedEmail === true} onCheckedChange={(v) => setSettings({ ...settings, partnerRequireVerifiedEmail: Boolean(v) })} />
              Verified email
            </label>
            <label className="flex items-center gap-2">
              <Checkbox checked={settings.partnerRequireKyc === true} onCheckedChange={(v) => setSettings({ ...settings, partnerRequireKyc: Boolean(v) })} />
              KYC
            </label>
          </div>

          <div>
            <Label>Program description</Label>
            <Textarea value={settings.partnerProgramDescription || ''} onChange={(e) => setSettings({ ...settings, partnerProgramDescription: e.target.value })} />
          </div>
          <div>
            <Label>Responsibilities and risks</Label>
            <Textarea value={settings.partnerProgramRules || ''} onChange={(e) => setSettings({ ...settings, partnerProgramRules: e.target.value })} />
          </div>

          <div>
            <Button onClick={saveSettings}>Save partner settings</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Partner Applications</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Applicant</TableHead>
                <TableHead>Country & methods</TableHead>
                <TableHead>Reason / hours</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Review</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.applications?.length ? data.applications.map((app: any) => (
                <TableRow key={app.id}>
                  <TableCell>
                    {app.name}
                    <div className="text-xs text-muted-foreground">{app.email}</div>
                  </TableCell>
                  <TableCell>
                    {app.country}
                    <div className="text-xs">{(app.paymentMethods || []).join(', ')}</div>
                  </TableCell>
                  <TableCell className="max-w-xs text-sm">
                    {app.reason}
                    <div className="text-xs text-muted-foreground">{app.workingHours}</div>
                  </TableCell>
                  <TableCell><Badge variant="outline">{app.status}</Badge></TableCell>
                  <TableCell>
                    {app.status === 'pending' && (
                      <div className="grid min-w-[280px] gap-2">
                        <div className="grid grid-cols-2 gap-2">
                          <Input placeholder="Deposit limit" type="number" onChange={(e) => setReview({ ...review, [app.id]: { ...review[app.id], depositLimit: Number(e.target.value) } })} />
                          <Input placeholder="Withdrawal limit" type="number" onChange={(e) => setReview({ ...review, [app.id]: { ...review[app.id], withdrawalLimit: Number(e.target.value) } })} />
                        </div>
                        <Input placeholder="Rejection reason" onChange={(e) => setReview({ ...review, [app.id]: { ...review[app.id], rejectionReason: e.target.value } })} />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={async () => { await reviewPartnerApplication(app.id, 'approved', { ...review[app.id], country: app.country, paymentMethods: app.paymentMethods }); await load(); }}>Approve</Button>
                          <Button size="sm" variant="destructive" onClick={async () => { await reviewPartnerApplication(app.id, 'rejected', review[app.id] || {}); await load(); }}>Reject</Button>
                        </div>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={5} className="text-center">No applications.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Partner Wallets & Funding</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Partner</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Wallet</TableHead>
                <TableHead>Limits</TableHead>
                <TableHead>Adjust</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data.partners || []).map((partner: any) => (
                <TableRow key={partner.id}>
                  <TableCell>{partner.name}</TableCell>
                  <TableCell>{partner.country}</TableCell>
                  <TableCell>${Number(partner.partnerWalletBalance || 0).toFixed(2)}</TableCell>
                  <TableCell>${Number(partner.depositLimit || 0).toFixed(2)} / ${Number(partner.withdrawalLimit || 0).toFixed(2)}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Input className="w-28" type="number" placeholder="Amount" value={adjustments[partner.id] || ''} onChange={(e) => setAdjustments({ ...adjustments, [partner.id]: e.target.value })} />
                      <Button size="sm" onClick={async () => { const amount = Number(adjustments[partner.id]); await adjustPartnerWallet(partner.id, amount, 'Admin wallet adjustment'); setAdjustments({ ...adjustments, [partner.id]: '' }); await load(); }}>Apply</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <h3 className="font-semibold">Funding requests</h3>
          {(data.fundingRequests || []).map((item: any) => (
            <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
              <span>{item.partnerName} · ${Number(item.amount).toFixed(2)} · {item.paymentMethod} · {item.reference}</span>
              <div>
                <Badge variant="outline">{item.status}</Badge>
                {item.status === 'pending' && (
                  <span className="ml-2">
                    <Button size="sm" onClick={async () => { await reviewPartnerFunding(item.id, 'approved'); await load(); }}>Approve</Button>{' '}
                    <Button size="sm" variant="destructive" onClick={async () => { await reviewPartnerFunding(item.id, 'rejected'); await load(); }}>Reject</Button>
                  </span>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Partner Transactions & Disputes</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Partner / user</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Admin action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.transactions?.length ? data.transactions.map((item: any) => (
                <TableRow key={item.id}>
                  <TableCell>{item.partnerName}<div className="text-xs text-muted-foreground">{item.userName}</div></TableCell>
                  <TableCell>{item.type}</TableCell>
                  <TableCell>${Number(item.amount).toFixed(2)}</TableCell>
                  <TableCell><Badge variant={item.status === 'disputed' ? 'destructive' : 'outline'}>{item.status}</Badge></TableCell>
                  <TableCell>
                    {item.status === 'disputed' && (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={async () => { await resolvePartnerTransaction(item.id, 'complete', 'Completed by admin review'); await load(); }}>Complete</Button>
                        <Button size="sm" variant="destructive" onClick={async () => { await resolvePartnerTransaction(item.id, 'cancel', 'Cancelled by admin review'); await load(); }}>Cancel</Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={5} className="text-center">No partner transactions.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
