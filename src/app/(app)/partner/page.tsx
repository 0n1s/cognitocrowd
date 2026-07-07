"use client";

import { useEffect, useMemo, useState } from 'react';
import {
  addPartnerTransactionNote,
  getPartnerPortalData,
  partnerTransactionAction,
  requestPartnerWalletFunding,
  requestPartnerWithdrawal,
  updatePartnerPortalConfig,
} from '@/lib/user-api';
import { useToast } from '@/hooks/use-toast';
import { auth } from '@/lib/firebase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2 } from 'lucide-react';
import { useDisplayCurrency } from '@/hooks/use-display-currency';
import { useSessionCurrency } from '@/hooks/use-session-currency';

export default function PartnerPortalPage() {
  const { formatAmount, currency } = useDisplayCurrency();
  const { currency: sessionCurrency } = useSessionCurrency();
  const { toast } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fundAmount, setFundAmount] = useState('');
  const [fundingBusy, setFundingBusy] = useState(false);
  const [depositDialogOpen, setDepositDialogOpen] = useState(false);
  const [withdrawalDialogOpen, setWithdrawalDialogOpen] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [partnerConfig, setPartnerConfig] = useState({
    available: true,
    depositAvailable: true,
    withdrawalAvailable: true,
    depositLimit: 0,
    withdrawalLimit: 0,
    paymentMethods: '',
  });
  const [configSaving, setConfigSaving] = useState(false);

  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawMethodId, setWithdrawMethodId] = useState('');
  const [withdrawDetails, setWithdrawDetails] = useState('');
  const [withdrawFieldValues, setWithdrawFieldValues] = useState<Record<string, string>>({});
  const [uploadingFieldKeys, setUploadingFieldKeys] = useState<Record<string, boolean>>({});
  const [withdrawingBusy, setWithdrawingBusy] = useState(false);

  const load = () => getPartnerPortalData()
    .then((result) => {
      if (!result.success) throw new Error(result.message);
      setData(result);
      const partner = result.partner || {};
      setPartnerConfig({
        available: partner.isAvailable !== false,
        depositAvailable: partner.permissions?.deposits !== false,
        withdrawalAvailable: partner.permissions?.withdrawals !== false,
        depositLimit: Number(partner.depositLimit || 0),
        withdrawalLimit: Number(partner.withdrawalLimit || 0),
        paymentMethods: Array.isArray(partner.paymentMethods) ? partner.paymentMethods.join(', ') : '',
      });
    })
    .catch((error) => toast({ title: 'Partner portal unavailable', description: error.message, variant: 'destructive' }))
    .finally(() => setLoading(false));

  useEffect(() => {
    void load();
  }, []);

  const action = async (transactionId: string, actionName: string) => {
    const result = await partnerTransactionAction(transactionId, actionName);
    if (!result.success) {
      toast({ title: 'Action failed', description: result.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Transaction updated' });
    void load();
  };

  const addNote = async (id: string) => {
    const result = await addPartnerTransactionNote(id, notes[id] || '');
    if (!result.success) {
      toast({ title: 'Message failed', description: result.message, variant: 'destructive' });
      return;
    }
    setNotes((current) => ({ ...current, [id]: '' }));
    void load();
  };

  const savePartnerConfig = async () => {
    if (partnerConfig.depositLimit < 0 || partnerConfig.withdrawalLimit < 0) {
      toast({ title: 'Invalid limits', description: 'Limits must be zero or greater.', variant: 'destructive' });
      return;
    }

    setConfigSaving(true);
    const result = await updatePartnerPortalConfig({
      available: partnerConfig.available,
      depositAvailable: partnerConfig.depositAvailable,
      withdrawalAvailable: partnerConfig.withdrawalAvailable,
      depositLimit: Number(partnerConfig.depositLimit || 0),
      withdrawalLimit: Number(partnerConfig.withdrawalLimit || 0),
      paymentMethods: String(partnerConfig.paymentMethods || '').split(',').map((item) => item.trim()).filter(Boolean),
    });
    setConfigSaving(false);

    toast({
      title: result.success ? 'Saved' : 'Save failed',
      description: result.message,
      variant: result.success ? 'default' : 'destructive',
    });
    if (result.success) void load();
  };

  const configuredWithdrawalMethods = useMemo(() => {
    const methods = data?.settings?.withdrawalMethods;
    return Array.isArray(methods) ? methods.filter((method: any) => method.enabled !== false) : [];
  }, [data?.settings?.withdrawalMethods]);

  const selectedMethod = configuredWithdrawalMethods.find((method: any) => method.id === withdrawMethodId) || null;
  const selectedCustomFields = selectedMethod?.customFields || [];
  const shouldUseLegacyDetailsField = selectedCustomFields.length === 0;

  const setWithdrawFieldValue = (key: string, value: string) => {
    setWithdrawFieldValues((current) => ({ ...current, [key]: value }));
  };

  const uploadFieldImage = async (fieldKey: string, file: File) => {
    if (!auth?.currentUser) {
      throw new Error('You must be logged in.');
    }

    const idToken = await auth.currentUser.getIdToken();
    const formData = new FormData();
    formData.append('purpose', 'deposit-receipt');
    formData.append('file', file);

    const uploadResponse = await fetch('/api/storage/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}` },
      body: formData,
    });

    const uploadResult = await uploadResponse.json().catch(() => ({}));
    if (!uploadResponse.ok || !uploadResult?.downloadUrl) {
      throw new Error(uploadResult?.message || 'Upload failed.');
    }

    setWithdrawFieldValue(fieldKey, String(uploadResult.downloadUrl));
  };

  const handleFieldFileChange = async (fieldKey: string, file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid File', description: 'Please select an image file.', variant: 'destructive' });
      return;
    }

    setUploadingFieldKeys((current) => ({ ...current, [fieldKey]: true }));
    try {
      await uploadFieldImage(fieldKey, file);
      toast({ title: 'Uploaded', description: 'Your image has been attached to the withdrawal request.' });
    } catch (error) {
      toast({ title: 'Upload Failed', description: error instanceof Error ? error.message : 'An unexpected error occurred.', variant: 'destructive' });
    } finally {
      setUploadingFieldKeys((current) => ({ ...current, [fieldKey]: false }));
    }
  };

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!data?.partner) {
    return (
      <Card>
        <CardContent className="py-10 text-center">You do not currently have access to the Partner Portal.</CardContent>
      </Card>
    );
  }

  const partner = data.partner;
  const depositBalance = Number(data?.userBalances?.depositBalance || 0);
  const partnerWalletBalance = Number(partner.partnerWalletBalance || 0);

  const depositDays: string[] = data?.settings?.depositDays || [];
  const depositMin = Number(data?.settings?.depositMinimumAmount || 0);
  const depositMax = Number(data?.settings?.depositMaximumAmount || 0);

  const withdrawalDays: string[] = data?.settings?.withdrawalDays || [];
  const withdrawalScheduleInfo = String(data?.settings?.withdrawalScheduleInfo || '');
  const globalMin = Number(data?.settings?.withdrawalMinimumAmount || 0);
  const globalMax = Number(data?.settings?.withdrawalMaximumAmount || 0);
  const methodMin = Number(selectedMethod?.minimumAmount || 0);
  const methodMax = Number(selectedMethod?.maximumAmount || 0);
  const effectiveMin = Math.max(globalMin > 0 ? globalMin : 0, methodMin > 0 ? methodMin : 0);
  const maxCandidates = [globalMax, methodMax].filter((candidate) => candidate > 0);
  const effectiveMax = maxCandidates.length > 0 ? Math.min(...maxCandidates) : 0;

  const scheduleParts = [];
  if (withdrawalDays.length > 0) {
    scheduleParts.push(`Weekly processing is available on ${withdrawalDays.join(', ')}.`);
  }
  if (withdrawalScheduleInfo) {
    scheduleParts.push(withdrawalScheduleInfo);
  }
  const scheduleDescription = scheduleParts.join(' ') || 'Withdrawal processing times are configured by the admin.';

  const currentWeekday = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }).format(new Date());
  const normalizedToday = currentWeekday.trim().toLowerCase();
  const normalizedAllowedDays = withdrawalDays.map((day) => day.trim().toLowerCase());
  const isWithdrawalDayAllowed = normalizedAllowedDays.length === 0 || normalizedAllowedDays.includes(normalizedToday);
  const normalizedDepositAllowedDays = depositDays.map((day) => day.trim().toLowerCase());
  const isDepositDayAllowed = normalizedDepositAllowedDays.length === 0 || normalizedDepositAllowedDays.includes(normalizedToday);

  const submitFundingTransfer = async () => {
    const amount = Number(fundAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({ title: 'Invalid amount', description: 'Enter a valid amount.', variant: 'destructive' });
      return;
    }
    if (amount > depositBalance) {
      toast({ title: 'Insufficient deposit balance', description: 'You do not have enough deposit balance for this transfer.', variant: 'destructive' });
      return;
    }
    if (!isDepositDayAllowed) {
      toast({ title: 'Partner deposit unavailable today', description: depositDays.length > 0 ? `Partner deposits are only available on ${depositDays.join(', ')}.` : 'Partner deposits are currently unavailable today.', variant: 'destructive' });
      return;
    }
    if (depositMin > 0 && amount < depositMin) {
      toast({ title: 'Below minimum', description: `Minimum partner deposit amount is ${formatAmount(depositMin, 'USD')}.`, variant: 'destructive' });
      return;
    }
    if (depositMax > 0 && amount > depositMax) {
      toast({ title: 'Above maximum', description: `Maximum partner deposit amount is ${formatAmount(depositMax, 'USD')}.`, variant: 'destructive' });
      return;
    }

    setFundingBusy(true);
    const result = await requestPartnerWalletFunding(amount);
    setFundingBusy(false);

    toast({
      title: result.success ? 'Transfer completed' : 'Transfer failed',
      description: result.message,
      variant: result.success ? 'default' : 'destructive',
    });

    if (result.success) {
      setFundAmount('');
      setDepositDialogOpen(false);
      void load();
    }
  };

  const submitPartnerWithdrawal = async () => {
    const amount = Number(withdrawAmount);
    if (!isWithdrawalDayAllowed) {
      toast({ title: 'Withdrawals unavailable today', description: withdrawalDays.length > 0 ? `Withdrawals are only processed on ${withdrawalDays.join(', ')}.` : 'Withdrawals are currently unavailable today.', variant: 'destructive' });
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({ title: 'Invalid amount', description: 'Enter a valid amount.', variant: 'destructive' });
      return;
    }
    if (amount > partnerWalletBalance) {
      toast({ title: 'Insufficient partner wallet balance', description: 'You do not have enough partner wallet balance.', variant: 'destructive' });
      return;
    }
    if (effectiveMin > 0 && amount < effectiveMin) {
      toast({ title: 'Below minimum', description: `Minimum withdrawal amount is ${formatAmount(effectiveMin, 'USD')}.`, variant: 'destructive' });
      return;
    }
    if (effectiveMax > 0 && amount > effectiveMax) {
      toast({ title: 'Above maximum', description: `Maximum withdrawal amount is ${formatAmount(effectiveMax, 'USD')}.`, variant: 'destructive' });
      return;
    }
    if (!withdrawMethodId || !selectedMethod) {
      toast({ title: 'No method selected', description: 'Please select a withdrawal method.', variant: 'destructive' });
      return;
    }

    const missingField = selectedCustomFields.find((field: any) => field.required && !String(withdrawFieldValues[field.key] || '').trim());
    if (missingField) {
      toast({ title: 'Missing field', description: `${missingField.label} is required.`, variant: 'destructive' });
      return;
    }

    if (Object.values(uploadingFieldKeys).some(Boolean)) {
      toast({ title: 'Please wait', description: 'An image upload is still in progress.', variant: 'destructive' });
      return;
    }

    if (shouldUseLegacyDetailsField && !withdrawDetails.trim()) {
      toast({ title: 'Payment details required', description: 'Please provide payout details.', variant: 'destructive' });
      return;
    }

    const payloadFields = shouldUseLegacyDetailsField
      ? { details: withdrawDetails.trim() }
      : withdrawFieldValues;

    setWithdrawingBusy(true);
    const result = await requestPartnerWithdrawal(amount, withdrawMethodId, payloadFields, sessionCurrency);
    setWithdrawingBusy(false);

    toast({
      title: result.success ? 'Withdrawal submitted' : 'Withdrawal failed',
      description: result.message,
      variant: result.success ? 'default' : 'destructive',
    });

    if (result.success) {
      setWithdrawAmount('');
      setWithdrawMethodId('');
      setWithdrawDetails('');
      setWithdrawFieldValues({});
      setWithdrawalDialogOpen(false);
      void load();
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Partner Portal</h1>
        <p className="text-muted-foreground">Manage local transactions for {partner.country}.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Partner wallet</CardTitle></CardHeader>
          <CardContent className="text-3xl font-bold">{formatAmount(partnerWalletBalance, 'USD')}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Deposit Balance</CardTitle></CardHeader>
          <CardContent className="text-xl font-semibold">{formatAmount(depositBalance, 'USD')}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Country</CardTitle></CardHeader>
          <CardContent className="text-xl font-semibold">{partner.country}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Deposit limit</CardTitle></CardHeader>
          <CardContent>{formatAmount(Number(partner.depositLimit || 0), 'USD')}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Withdrawal limit</CardTitle></CardHeader>
          <CardContent>{formatAmount(Number(partner.withdrawalLimit || 0), 'USD')}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Availability and permissions</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center gap-2">
              <Switch
                checked={partnerConfig.available}
                onCheckedChange={(checked) => setPartnerConfig((current) => ({ ...current, available: checked }))}
              />
              <span>{partnerConfig.available ? 'Portal available' : 'Portal unavailable'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={partnerConfig.depositAvailable}
                onCheckedChange={(checked) => setPartnerConfig((current) => ({ ...current, depositAvailable: checked }))}
              />
              <span>{partnerConfig.depositAvailable ? 'Deposits available' : 'Deposits unavailable'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={partnerConfig.withdrawalAvailable}
                onCheckedChange={(checked) => setPartnerConfig((current) => ({ ...current, withdrawalAvailable: checked }))}
              />
              <span>{partnerConfig.withdrawalAvailable ? 'Withdrawals available' : 'Withdrawals unavailable'}</span>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Deposit limit (set by partner)</Label>
              <Input
                type="number"
                min="0"
                value={partnerConfig.depositLimit}
                onChange={(e) => setPartnerConfig((current) => ({ ...current, depositLimit: Number(e.target.value || 0) }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Withdrawal limit (set by partner)</Label>
              <Input
                type="number"
                min="0"
                value={partnerConfig.withdrawalLimit}
                onChange={(e) => setPartnerConfig((current) => ({ ...current, withdrawalLimit: Number(e.target.value || 0) }))}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Preferred payment gateways/methods</Label>
              <Input
                placeholder="Bank Transfer etc"
                value={partnerConfig.paymentMethods}
                onChange={(e) => setPartnerConfig((current) => ({ ...current, paymentMethods: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={savePartnerConfig} disabled={configSaving}>
              {configSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save partner configuration
            </Button>
          </div>
          <span className="text-sm text-muted-foreground">
            Deposits: {partner.permissions?.deposits === false ? 'No' : 'Yes'} · Withdrawals: {partner.permissions?.withdrawals === false ? 'No' : 'Yes'} · Methods: {(partner.paymentMethods || []).join(', ') || 'Not configured'}
          </span>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Partner wallet actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Dialog open={depositDialogOpen} onOpenChange={setDepositDialogOpen}>
            <DialogTrigger asChild>
              <Button>Partner deposit</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[520px]">
              <DialogHeader>
                <DialogTitle>Partner deposit</DialogTitle>
                <DialogDescription>
                  Move funds from your Deposit Balance to your Partner Wallet.
                  {depositDays.length > 0 ? ` Available on ${depositDays.join(', ')}.` : ''}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {(depositMin > 0 || depositMax > 0) ? (
                  <p className="text-sm text-muted-foreground">Limits: {depositMin > 0 ? `Min ${formatAmount(depositMin, 'USD')}` : 'No min'} / {depositMax > 0 ? `Max ${formatAmount(depositMax, 'USD')}` : 'No max'}</p>
                ) : null}
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Deposit Balance</p>
                    <p className="text-lg font-semibold">{formatAmount(depositBalance, 'USD')}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Max amount that can be moved</p>
                    <p className="text-lg font-semibold">{formatAmount(depositBalance, 'USD')}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <Input
                    type="number"
                    value={fundAmount}
                    onChange={(e) => setFundAmount(e.target.value)}
                    placeholder={`Max ${formatAmount(depositBalance, 'USD')}`}
                    step="0.01"
                    min="0.01"
                    max={depositBalance}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDepositDialogOpen(false)}>Cancel</Button>
                <Button onClick={submitFundingTransfer} disabled={fundingBusy || !isDepositDayAllowed}>
                  {fundingBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Move funds
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={withdrawalDialogOpen} onOpenChange={setWithdrawalDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary">Partner Withdrawal</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[640px]">
              <DialogHeader>
                <DialogTitle>Partner Withdrawal</DialogTitle>
                <DialogDescription>
                  {scheduleDescription}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {(effectiveMin > 0 || effectiveMax > 0) ? (
                  <p className="text-sm text-muted-foreground">Limits: {effectiveMin > 0 ? `Min ${formatAmount(effectiveMin, 'USD')}` : 'No min'} / {effectiveMax > 0 ? `Max ${formatAmount(effectiveMax, 'USD')}` : 'No max'}</p>
                ) : null}

                <div className="space-y-2">
                  <Label>Amount ({currency})</Label>
                  <Input
                    type="number"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder={`Max ${formatAmount(partnerWalletBalance, 'USD')}`}
                    step="0.01"
                    min={effectiveMin > 0 ? effectiveMin : 0.01}
                    max={effectiveMax > 0 ? Math.min(partnerWalletBalance, effectiveMax) : partnerWalletBalance}
                    disabled={withdrawingBusy}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <Select
                    value={withdrawMethodId}
                    onValueChange={(value) => {
                      setWithdrawMethodId(value);
                      setWithdrawFieldValues({});
                    }}
                    disabled={withdrawingBusy}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a method" />
                    </SelectTrigger>
                    <SelectContent>
                      {configuredWithdrawalMethods.map((method: any) => (
                        <SelectItem key={method.id} value={method.id}>{method.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedCustomFields.length > 0 ? (
                  <div className="space-y-3 rounded-md border p-3">
                    {selectedCustomFields.map((field: any) => (
                      <div key={field.key} className="space-y-2">
                        <Label htmlFor={`partner-withdrawal-field-${field.key}`}>{field.label}{field.required ? ' *' : ''}</Label>
                        {field.inputType === 'image' ? (
                          <div className="space-y-2">
                            <Input
                              id={`partner-withdrawal-field-${field.key}`}
                              type="file"
                              accept="image/*"
                              disabled={withdrawingBusy || uploadingFieldKeys[field.key] === true}
                              onChange={(e) => {
                                void handleFieldFileChange(field.key, e.target.files?.[0]);
                              }}
                            />
                            {uploadingFieldKeys[field.key] ? <p className="text-xs text-muted-foreground">Uploading...</p> : null}
                            {withdrawFieldValues[field.key] ? <p className="text-xs text-muted-foreground">Uploaded successfully.</p> : null}
                          </div>
                        ) : field.inputType === 'textarea' ? (
                          <Textarea
                            id={`partner-withdrawal-field-${field.key}`}
                            value={withdrawFieldValues[field.key] || ''}
                            onChange={(e) => setWithdrawFieldValue(field.key, e.target.value)}
                            placeholder={field.placeholder || ''}
                            rows={3}
                            disabled={withdrawingBusy}
                          />
                        ) : (
                          <Input
                            id={`partner-withdrawal-field-${field.key}`}
                            value={withdrawFieldValues[field.key] || ''}
                            onChange={(e) => setWithdrawFieldValue(field.key, e.target.value)}
                            placeholder={field.placeholder || ''}
                            type={field.inputType || 'text'}
                            disabled={withdrawingBusy}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Payment Details</Label>
                    <Textarea
                      value={withdrawDetails}
                      onChange={(e) => setWithdrawDetails(e.target.value)}
                      placeholder="Enter payout account details"
                      rows={3}
                      disabled={withdrawingBusy}
                    />
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setWithdrawalDialogOpen(false)}>Cancel</Button>
                <Button onClick={submitPartnerWithdrawal} disabled={withdrawingBusy || !isWithdrawalDayAllowed}>
                  {withdrawingBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Submit partner withdrawal
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Partner withdrawal requests</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.partnerWithdrawals?.length ? data.partnerWithdrawals.map((item: any) => (
                <TableRow key={item.id}>
                  <TableCell>{item.requestedAt ? new Date(item.requestedAt).toLocaleString() : 'N/A'}</TableCell>
                  <TableCell>{formatAmount(Number(item.amount || 0), item.amountCurrency || 'USD')}</TableCell>
                  <TableCell>{item.paymentMethod || 'N/A'}</TableCell>
                  <TableCell><Badge variant="outline">{item.status || 'pending'}</Badge></TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={4} className="h-20 text-center">No partner withdrawal requests yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Partner transactions</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions & communication</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.transactions?.length ? data.transactions.map((item: any) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="font-medium">{item.userName}</div>
                    <div className="text-xs text-muted-foreground">{item.userEmail}</div>
                  </TableCell>
                  <TableCell>{item.type}</TableCell>
                  <TableCell>{formatAmount(Number(item.amount), item.amountCurrency || 'USD')}</TableCell>
                  <TableCell>{item.paymentMethod}</TableCell>
                  <TableCell><Badge variant="outline">{item.status}</Badge></TableCell>
                  <TableCell className="min-w-[300px]">
                    <div className="mb-2 flex flex-wrap gap-2">
                      {item.type === 'deposit' && item.status === 'paid_by_user' ? <Button size="sm" onClick={() => action(item.id, 'confirm_deposit')}>Confirm payment</Button> : null}
                      {item.type === 'withdrawal' && item.status === 'pending' ? <Button size="sm" onClick={() => action(item.id, 'mark_withdrawal_paid')}>Mark paid</Button> : null}
                      {!['completed', 'cancelled', 'disputed'].includes(item.status) ? <Button size="sm" variant="destructive" onClick={() => action(item.id, 'dispute')}>Dispute</Button> : null}
                    </div>
                    <div className="max-h-24 space-y-1 overflow-auto text-xs">
                      {(item.notes || []).map((note: any, index: number) => <p key={index}><b>{note.senderRole}:</b> {note.message}</p>)}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <Input value={notes[item.id] || ''} onChange={(e) => setNotes({ ...notes, [item.id]: e.target.value })} placeholder="Add transaction note" />
                      <Button size="sm" variant="outline" onClick={() => addNote(item.id)}>Send</Button>
                    </div>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={6} className="h-24 text-center">No partner transactions yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
