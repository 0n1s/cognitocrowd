"use client";

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, HandCoins, Landmark, ShieldCheck, WalletCards, XCircle } from 'lucide-react';
import { getPartnerProgramData, submitPartnerApplication } from '@/lib/user-api';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { COUNTRIES } from '@/lib/countries';

const WEEKDAY_OPTIONS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function PartnerProgramPage() {
  const { toast } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    country: '',
    paymentMethods: '',
    reason: '',
    workingDays: [] as string[],
    extraInformation: '',
  });

  const load = () =>
    getPartnerProgramData()
      .then((result) => {
        if (!result.success) throw new Error(result.message);
        setData(result);
      })
      .catch((error) => toast({ title: 'Partner program unavailable', description: error.message, variant: 'destructive' }))
      .finally(() => setLoading(false));

  useEffect(() => {
    void load();
  }, []);

  const countryOptions = useMemo(() => {
    const configured = Array.isArray(data?.settings?.supportedCountries) ? data.settings.supportedCountries : [];
    if (configured.length > 0) {
      return configured.map((country: string) => {
        const matched = COUNTRIES.find((item) => item.name === country);
        return { value: country, label: matched ? `${matched.name} (${matched.code})` : country };
      });
    }
    return COUNTRIES.map((country) => ({ value: country.name, label: `${country.name} (${country.code})` }));
  }, [data?.settings?.supportedCountries]);

  const toggleWorkingDay = (day: string, checked: boolean) => {
    setForm((current) => ({
      ...current,
      workingDays: checked
        ? Array.from(new Set([...current.workingDays, day]))
        : current.workingDays.filter((item) => item !== day),
    }));
  };

  const submit = async () => {
    setSubmitting(true);
    const result = await submitPartnerApplication({
      ...form,
      paymentMethods: form.paymentMethods.split(',').map((item) => item.trim()).filter(Boolean),
      workingHours: form.workingDays.join(', '),
    });
    setSubmitting(false);
    if (!result.success) {
      return toast({ title: 'Application not submitted', description: result.message, variant: 'destructive' });
    }
    toast({ title: 'Application submitted', description: result.message });
    void load();
  };

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  const requirements = data?.requirements || {};

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">{data?.settings?.title || 'Partner Program'}</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">{data?.settings?.description || 'Help users in your country deposit and withdraw through trusted local payment methods.'}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <Landmark className="h-6 w-6 text-primary" />
            <CardTitle className="text-lg">Local support</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Receive local payments and confirm platform deposits for users assigned to your country.</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <WalletCards className="h-6 w-6 text-primary" />
            <CardTitle className="text-lg">Partner wallet</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Fund a controlled partner wallet. Confirmed user deposits deduct from this balance.</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <HandCoins className="h-6 w-6 text-primary" />
            <CardTitle className="text-lg">Withdrawals</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Pay approved withdrawals locally; the user confirms receipt before settlement completes.</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Responsibilities and risks</CardTitle>
        </CardHeader>
        <CardContent className="whitespace-pre-wrap text-sm text-muted-foreground">{data?.settings?.rules || 'Partners must confirm funds honestly, keep transaction communication on-platform, protect user information, maintain sufficient wallet funds, and promptly resolve disputes. Misuse can result in suspension and account restrictions.'}</CardContent>
      </Card>

      {/* <Card>
        <CardHeader>
          <CardTitle>Minimum requirements</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(requirements).map(([key, met]) => (
            <div key={key} className="flex items-center gap-2 rounded-md border p-3 text-sm">
              {met ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-destructive" />}
              <span className="capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
            </div>
          ))}
        </CardContent>
      </Card> */}

      {data?.application ? (
        <Card>
          <CardHeader>
            <CardTitle>Your application</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={data.application.status === 'approved' ? 'secondary' : data.application.status === 'rejected' ? 'destructive' : 'outline'}>
              {data.application.status}
            </Badge>
            {data.application.rejectionReason ? <p className="mt-3 text-sm text-destructive">{data.application.rejectionReason}</p> : null}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Apply to become a partner</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Country</Label>
              <Select value={form.country} onValueChange={(value) => setForm((current) => ({ ...current, country: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select your country" />
                </SelectTrigger>
                <SelectContent>
                  {countryOptions.map((country) => (
                    <SelectItem key={country.value} value={country.value}>{country.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Preferred payment methods</Label>
              <Input placeholder="Bank transfer etc" value={form.paymentMethods} onChange={(e) => setForm((current) => ({ ...current, paymentMethods: e.target.value }))} />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Available working days</Label>
              <div className="grid grid-cols-2 gap-2 rounded-md border p-3 sm:grid-cols-4">
                {WEEKDAY_OPTIONS.map((day) => (
                  <label key={day} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={form.workingDays.includes(day)} onCheckedChange={(checked) => toggleWorkingDay(day, Boolean(checked))} />
                    {day}
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Why do you want to become a partner?</Label>
              <Textarea value={form.reason} onChange={(e) => setForm((current) => ({ ...current, reason: e.target.value }))} />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Additional information</Label>
              <Textarea value={form.extraInformation} onChange={(e) => setForm((current) => ({ ...current, extraInformation: e.target.value }))} />
            </div>

            <Button className="md:col-span-2" disabled={!data?.eligible || submitting} onClick={submit}>
              {submitting ? 'Submitting…' : data?.eligible ? 'Submit application' : 'Requirements not yet met'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
