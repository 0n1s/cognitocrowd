"use client";

import { useEffect, useMemo, useState } from 'react';
import { addPartnerTransactionNote, createPartnerTransaction, getPartnerProgramData, partnerTransactionAction } from '@/lib/user-api';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useDisplayCurrency } from '@/hooks/use-display-currency';
import { useSessionCurrency } from '@/hooks/use-session-currency';

export function PartnerTransactions({ onChanged }: { onChanged: () => void }) {
  const { formatAmount } = useDisplayCurrency();
  const { currency } = useSessionCurrency();
  const { toast } = useToast();
  const [data, setData] = useState<any>(null);
  const [form, setForm] = useState({
    type: 'deposit' as 'deposit' | 'withdrawal',
    partnerId: '',
    amount: '',
    paymentMethod: '',
  });
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = () => getPartnerProgramData().then((result) => result.success && setData(result));

  useEffect(() => {
    void load();
  }, []);

  const partners = data?.partners || [];
  const userCountry = String(data?.userCountry || '');
  const selectedPartner = partners.find((item: any) => item.id === form.partnerId) || null;
  const selectedPartnerMethods = selectedPartner?.paymentMethods || [];

  const selectedPartnerEligible = useMemo(() => {
    if (!selectedPartner) return false;
    if (selectedPartner.isAvailable === false) return false;
    if (userCountry && selectedPartner.country !== userCountry) return false;
    if (form.type === 'deposit' && selectedPartner.permissions?.deposits === false) return false;
    if (form.type === 'withdrawal' && selectedPartner.permissions?.withdrawals === false) return false;
    return true;
  }, [selectedPartner, form.type, userCountry]);

  const submit = async () => {
    const result = await createPartnerTransaction({
      ...form,
      amount: Number(form.amount),
      currency,
    });

    toast({
      title: result.success ? 'Request created' : 'Request failed',
      description: result.message,
      variant: result.success ? 'default' : 'destructive',
    });

    if (result.success) {
      setForm((current) => ({ ...current, amount: '' }));
      void load();
      onChanged();
    }
  };

  if (!partners.length && !data?.transactions?.length) return null;

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle>Partner marketplace</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {partners.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Partner</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Preferred payment methods</TableHead>
                  <TableHead>Availability</TableHead>
                  <TableHead>Limits</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partners.map((partner: any) => {
                  const depositsAvailable = partner.isAvailable !== false && partner.permissions?.deposits !== false;
                  const withdrawalsAvailable = partner.isAvailable !== false && partner.permissions?.withdrawals !== false;
                  return (
                    <TableRow key={partner.id}>
                      <TableCell>
                        <div className="font-medium">{partner.name}</div>
                        <div className="text-xs text-muted-foreground">{partner.email}</div>
                      </TableCell>
                      <TableCell>{partner.country || 'N/A'}</TableCell>
                      <TableCell>{(partner.paymentMethods || []).join(', ') || 'Not configured'}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant={depositsAvailable ? 'secondary' : 'outline'}>Deposits {depositsAvailable ? 'On' : 'Off'}</Badge>
                          <Badge variant={withdrawalsAvailable ? 'secondary' : 'outline'}>Withdrawals {withdrawalsAvailable ? 'On' : 'Off'}</Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        Deposit: {formatAmount(Number(partner.depositLimit || 0), 'USD')}
                        <div className="text-xs text-muted-foreground">Withdrawal: {formatAmount(Number(partner.withdrawalLimit || 0), 'USD')}</div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : null}

        <div className="rounded-lg border p-4">
          <h3 className="mb-3 font-medium">Start a partner transaction</h3>
          <div className="grid gap-3 md:grid-cols-5">
            <div>
              <Label>Type</Label>
              <Select
                value={form.type}
                onValueChange={(value) => setForm((current) => ({ ...current, type: value as 'deposit' | 'withdrawal', paymentMethod: '' }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="deposit">Deposit</SelectItem>
                  <SelectItem value="withdrawal">Withdrawal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Partner</Label>
              <Select
                value={form.partnerId}
                onValueChange={(value) => setForm((current) => ({ ...current, partnerId: value, paymentMethod: '' }))}
              >
                <SelectTrigger><SelectValue placeholder="Select partner" /></SelectTrigger>
                <SelectContent>
                  {partners.map((partner: any) => (
                    <SelectItem key={partner.id} value={partner.id}>
                      {partner.name} ({partner.country || 'N/A'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Payment method</Label>
              <Select value={form.paymentMethod} onValueChange={(value) => setForm((current) => ({ ...current, paymentMethod: value }))}>
                <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                <SelectContent>
                  {selectedPartnerMethods.map((method: string) => (
                    <SelectItem key={method} value={method}>{method}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Amount</Label>
              <Input type="number" value={form.amount} onChange={(e) => setForm((current) => ({ ...current, amount: e.target.value }))} />
            </div>

            <Button
              className="self-end"
              disabled={!form.partnerId || !form.paymentMethod || Number(form.amount) <= 0 || !selectedPartnerEligible}
              onClick={submit}
            >
              Create request
            </Button>
          </div>
          {!selectedPartnerEligible && selectedPartner ? (
            <p className="mt-2 text-sm text-destructive">
              This partner cannot process this request now. Ensure they are available, support this transaction type, and are in your country.
            </p>
          ) : null}
          <p className="mt-2 text-xs text-muted-foreground">
            Partner deposits use partner wallet escrow: once the partner confirms your local payment, your platform balance is credited from the partner wallet.
          </p>
        </div>

        <div className="space-y-3">
          {(data.transactions || []).map((item: any) => (
            <div key={item.id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-medium capitalize">{item.type}</span> through {item.partnerName} · {formatAmount(Number(item.amount), item.amountCurrency || 'USD')}
                </div>
                <Badge variant="outline">{item.status}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{item.paymentMethod} {item.paymentInstructions ? `· ${item.paymentInstructions}` : ''}</p>
              <div className="mt-2 space-y-1 text-xs">
                {(item.notes || []).map((note: any, index: number) => <p key={index}><b>{note.senderRole}:</b> {note.message}</p>)}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {item.type === 'deposit' && item.status === 'awaiting_payment' ? <Button size="sm" onClick={async () => { await partnerTransactionAction(item.id, 'user_paid'); void load(); }}>I have paid</Button> : null}
                {item.type === 'withdrawal' && item.status === 'paid_by_partner' ? <Button size="sm" onClick={async () => { await partnerTransactionAction(item.id, 'confirm_withdrawal'); void load(); onChanged(); }}>Confirm receipt</Button> : null}
                {['pending', 'awaiting_payment'].includes(item.status) ? <Button size="sm" variant="outline" onClick={async () => { await partnerTransactionAction(item.id, 'cancel'); void load(); onChanged(); }}>Cancel</Button> : null}
                {!['completed', 'cancelled', 'disputed'].includes(item.status) ? <Button size="sm" variant="destructive" onClick={async () => { await partnerTransactionAction(item.id, 'dispute'); void load(); }}>Dispute</Button> : null}
                <Input className="max-w-xs" placeholder="Message partner" value={notes[item.id] || ''} onChange={(e) => setNotes((current) => ({ ...current, [item.id]: e.target.value }))} />
                <Button size="sm" variant="outline" onClick={async () => { await addPartnerTransactionNote(item.id, notes[item.id] || ''); setNotes((current) => ({ ...current, [item.id]: '' })); void load(); }}>Send</Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
