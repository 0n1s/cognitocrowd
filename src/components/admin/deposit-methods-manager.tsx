"use client";

import { useEffect, useMemo, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { Edit3, PlusCircle, Trash2 } from "lucide-react";
import { DepositMethod, DepositMethodField, DepositMethodProcessingMode, DepositMethodProvider } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PROVIDER_OPTIONS: Array<{ value: DepositMethodProvider; label: string; description: string }> = [
  { value: 'plisio', label: 'Plisio', description: 'Crypto deposits via Plisio invoices.' },
  { value: 'custom', label: 'Custom', description: 'Define your own method and custom fields.' },
];

const CUSTOM_FIELD_INPUT_TYPES: Array<{ value: NonNullable<DepositMethodField['inputType']>; label: string }> = [
  { value: 'text', label: 'Text' },
  { value: 'email', label: 'Email' },
  { value: 'number', label: 'Number' },
  { value: 'textarea', label: 'Textarea' },
  { value: 'password', label: 'Password' },
  { value: 'url', label: 'URL' },
  { value: 'tel', label: 'Phone' },
  { value: 'image', label: 'Image upload' },
];

type DepositMethodDraft = {
  id: string;
  name: string;
  provider: DepositMethodProvider;
  enabled: boolean;
  processingMode: DepositMethodProcessingMode;
  minimumAmount: string;
  maximumAmount: string;
  description: string;
  publicBaseUrl: string;
  credentials: Array<{ key: string; value: string }>;
  customFields: DepositMethodField[];
};

function defaultProcessingMode(provider: DepositMethodProvider): DepositMethodProcessingMode {
  return provider === 'plisio' ? 'automatic' : 'admin_verified';
}

function emptyDraft(): DepositMethodDraft {
  return {
    id: uuidv4(),
    name: '',
    provider: 'plisio',
    enabled: true,
    processingMode: 'automatic',
    minimumAmount: '',
    maximumAmount: '',
    description: '',
    publicBaseUrl: typeof window !== 'undefined' ? window.location.origin : '',
    credentials: [{ key: 'apiKey', value: '' }],
    customFields: [],
  };
}

function methodToDraft(method: DepositMethod): DepositMethodDraft {
  return {
    id: method.id,
    name: method.name,
    provider: method.provider,
    enabled: method.enabled !== false,
    processingMode: method.processingMode || defaultProcessingMode(method.provider),
    minimumAmount: typeof method.minimumAmount === 'number' ? String(method.minimumAmount) : '',
    maximumAmount: typeof method.maximumAmount === 'number' ? String(method.maximumAmount) : '',
    description: method.description || '',
    publicBaseUrl: method.credentials?.publicBaseUrl || '',
    credentials: Object.entries(method.credentials || {}).map(([key, value]) => ({ key, value })),
    customFields: Array.isArray(method.customFields) ? method.customFields : [],
  };
}

function draftToMethod(draft: DepositMethodDraft): DepositMethod {
  const credentials = draft.credentials.reduce<Record<string, string>>((acc, entry) => {
    const key = entry.key.trim();
    if (!key) return acc;
    acc[key] = entry.value;
    return acc;
  }, {});

  if (draft.provider === 'plisio' && draft.publicBaseUrl.trim()) {
    credentials.publicBaseUrl = draft.publicBaseUrl.trim();
  }

  const minimumAmount = draft.minimumAmount.trim() ? Number(draft.minimumAmount) : undefined;
  const maximumAmount = draft.maximumAmount.trim() ? Number(draft.maximumAmount) : undefined;

  return {
    id: draft.id,
    name: draft.name.trim(),
    provider: draft.provider,
    enabled: draft.enabled,
    processingMode: draft.provider === 'custom' ? 'admin_verified' : draft.processingMode,
    minimumAmount: Number.isFinite(minimumAmount as number) ? minimumAmount : undefined,
    maximumAmount: Number.isFinite(maximumAmount as number) ? maximumAmount : undefined,
    description: draft.description.trim(),
    credentials,
    customFields: draft.provider === 'custom' ? draft.customFields.filter((field) => field.key.trim() && field.label.trim()) : [],
  };
}

export function DepositMethodsManager({
  methods,
  onChange,
}: {
  methods: DepositMethod[];
  onChange: (methods: DepositMethod[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DepositMethodDraft>(emptyDraft());
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setDraft(emptyDraft());
      setEditingId(null);
    }
  }, [open]);

  const enabledMethods = useMemo(() => methods.filter((method) => method.enabled !== false), [methods]);
  const plisioCallbackUrl = useMemo(() => {
    const baseUrl = draft.publicBaseUrl.trim().replace(/\/+$/, '');
    return baseUrl ? `${baseUrl}/api/payments/plisio/callback?json=true` : '';
  }, [draft.publicBaseUrl]);

  const startCreate = () => {
    setDraft(emptyDraft());
    setEditingId(null);
    setOpen(true);
  };

  const startEdit = (method: DepositMethod) => {
    const nextDraft = methodToDraft(method);
    if (nextDraft.provider === 'plisio' && !nextDraft.publicBaseUrl.trim() && typeof window !== 'undefined') {
      nextDraft.publicBaseUrl = window.location.origin;
    }
    setDraft(nextDraft);
    setEditingId(method.id);
    setOpen(true);
  };

  const saveDraft = () => {
    const nextMethod = draftToMethod(draft);
    if (!nextMethod.name) return;
    if (typeof nextMethod.minimumAmount === 'number' && typeof nextMethod.maximumAmount === 'number' && nextMethod.minimumAmount > nextMethod.maximumAmount) {
      return;
    }

    const existingIndex = methods.findIndex((method) => method.id === editingId);
    const nextMethods = [...methods];
    if (existingIndex >= 0) {
      nextMethods[existingIndex] = nextMethod;
    } else {
      nextMethods.push(nextMethod);
    }
    onChange(nextMethods);
    setOpen(false);
  };

  const removeMethod = (id: string) => {
    onChange(methods.filter((method) => method.id !== id));
  };

  const updateCredential = (index: number, field: 'key' | 'value', value: string) => {
    setDraft((current) => {
      const next = [...current.credentials];
      next[index] = { ...next[index], [field]: value };
      return { ...current, credentials: next };
    });
  };

  const addCredential = () => {
    setDraft((current) => ({ ...current, credentials: [...current.credentials, { key: '', value: '' }] }));
  };

  const removeCredential = (index: number) => {
    setDraft((current) => ({
      ...current,
      credentials: current.credentials.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const updateCustomField = (index: number, field: keyof DepositMethodField, value: string | boolean) => {
    setDraft((current) => {
      const next = [...current.customFields];
      next[index] = { ...next[index], [field]: value } as DepositMethodField;
      return { ...current, customFields: next };
    });
  };

  const addCustomField = () => {
    setDraft((current) => ({
      ...current,
      customFields: [...current.customFields, { key: '', label: '', placeholder: '', required: false, inputType: 'text' }],
    }));
  };

  const setAmountField = (field: 'minimumAmount' | 'maximumAmount', value: string) => {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const setPlisioBaseUrl = (value: string) => {
    setDraft((current) => ({
      ...current,
      publicBaseUrl: value,
    }));
  };

  const removeCustomField = (index: number) => {
    setDraft((current) => ({
      ...current,
      customFields: current.customFields.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  return (
    <div className="space-y-4 rounded-md border p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Label className="text-base font-semibold">Deposit Settings</Label>
          <p className="text-sm text-muted-foreground">Configure the deposit methods users can see.</p>
        </div>
        <Button type="button" variant="outline" onClick={startCreate}>
          <PlusCircle className="mr-2 h-4 w-4" /> Configure Method
        </Button>
      </div>

      <div className="space-y-3">
        {methods.length === 0 ? (
          <p className="text-sm text-muted-foreground">No deposit methods configured yet.</p>
        ) : (
          methods.map((method) => (
            <div key={method.id} className="flex flex-col gap-3 rounded-md border p-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{method.name}</span>
                  <Badge variant={method.enabled ? 'default' : 'secondary'}>{method.enabled ? 'Enabled' : 'Disabled'}</Badge>
                  <Badge variant="outline">{method.provider}</Badge>
                  <Badge variant="outline">{method.processingMode === 'automatic' ? 'Automatic' : 'Admin verified'}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{method.description || 'No description provided.'}</p>
                {(typeof method.minimumAmount === 'number' || typeof method.maximumAmount === 'number') ? (
                  <p className="text-xs text-muted-foreground">
                    {typeof method.minimumAmount === 'number' ? `Min: $${method.minimumAmount.toFixed(2)} ` : ''}
                    {typeof method.maximumAmount === 'number' ? `Max: $${method.maximumAmount.toFixed(2)}` : ''}
                  </p>
                ) : null}
                {method.provider === 'custom' && (method.customFields?.length || 0) > 0 ? (
                  <p className="text-xs text-muted-foreground">Custom fields: {method.customFields?.map((field) => `${field.label || field.key}${field.inputType ? ` (${field.inputType})` : ''}`).join(', ')}</p>
                ) : null}
              </div>
              <div className="flex items-center gap-2 self-start md:self-auto">
                <Button type="button" variant="outline" size="sm" onClick={() => startEdit(method)}>
                  <Edit3 className="mr-2 h-4 w-4" /> Configure
                </Button>
                <Button type="button" variant="ghost" size="icon" onClick={() => removeMethod(method.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Configure Deposit Method' : 'Add Deposit Method'}</DialogTitle>
            <DialogDescription>
              Choose a provider, set its enabled state, and enter the credentials or custom fields it needs.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4 max-h-[calc(90vh-10rem)] overflow-y-auto pr-2">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Provider</Label>
              <Select value={draft.provider} onValueChange={(value) => setDraft((current) => ({
                ...current,
                provider: value as DepositMethodProvider,
                credentials: value === 'plisio' ? [{ key: 'apiKey', value: current.credentials.find((entry) => entry.key === 'apiKey')?.value || '' }] : current.credentials.length > 0 ? current.credentials : [{ key: '', value: '' }],
                customFields: value === 'custom' ? current.customFields : [],
                publicBaseUrl: value === 'plisio' && !current.publicBaseUrl.trim() && typeof window !== 'undefined' ? window.location.origin : current.publicBaseUrl,
                processingMode: value === 'plisio' ? (current.processingMode || 'automatic') : 'admin_verified',
                name: value === 'plisio' && !current.name ? 'Plisio' : current.name,
              }))}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="deposit-method-name" className="text-right">Method Name</Label>
              <Input
                id="deposit-method-name"
                value={draft.name}
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                className="col-span-3"
                placeholder="Plisio, Crypto Gateway, etc."
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="deposit-method-enabled" className="text-right">Enabled</Label>
              <div className="col-span-3 flex items-center gap-2">
                <Switch
                  id="deposit-method-enabled"
                  checked={draft.enabled}
                  onCheckedChange={(checked) => setDraft((current) => ({ ...current, enabled: checked }))}
                />
                <span className="text-sm text-muted-foreground">Show this method to users.</span>
              </div>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Limits</Label>
              <div className="col-span-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.minimumAmount}
                  onChange={(event) => setAmountField('minimumAmount', event.target.value)}
                  placeholder="Minimum amount"
                />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.maximumAmount}
                  onChange={(event) => setAmountField('maximumAmount', event.target.value)}
                  placeholder="Maximum amount"
                />
              </div>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="deposit-method-processing-mode" className="text-right">Payment Type</Label>
              <div className="col-span-3 space-y-2">
                <Select
                  value={draft.provider === 'custom' ? 'admin_verified' : draft.processingMode}
                  onValueChange={(value) => setDraft((current) => ({
                    ...current,
                    processingMode: current.provider === 'custom' ? 'admin_verified' : value as DepositMethodProcessingMode,
                  }))}
                  disabled={draft.provider === 'custom'}
                >
                  <SelectTrigger id="deposit-method-processing-mode">
                    <SelectValue placeholder="Select payment type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="automatic">Automatic</SelectItem>
                    <SelectItem value="admin_verified">Admin verified</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {draft.provider === 'custom'
                    ? 'Custom methods are admin verified because they do not use an automatic payment API.'
                    : draft.processingMode === 'automatic'
                      ? 'Users are sent straight into the payment flow.'
                      : 'Users submit a request that an admin must approve before crediting the balance.'}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="deposit-method-description">Description</Label>
              <Textarea
                id="deposit-method-description"
                value={draft.description}
                onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                placeholder="Short note shown to users or admins."
              />
            </div>

            {draft.provider === 'plisio' ? (
              <div className="space-y-3 rounded-md border p-3">
                <div className="space-y-2">
                  <Label htmlFor="deposit-method-plisio-base-url" className="text-sm font-semibold">Callback Host</Label>
                  <Input
                    id="deposit-method-plisio-base-url"
                    value={draft.publicBaseUrl}
                    onChange={(event) => setPlisioBaseUrl(event.target.value)}
                    placeholder={typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'}
                  />
                  <p className="text-xs text-muted-foreground">The callback endpoint will be generated from this host.</p>
                </div>
                {plisioCallbackUrl ? (
                  <div className="rounded-md bg-muted/60 p-2 text-xs text-muted-foreground">
                    Callback URL: <span className="font-mono break-all text-foreground">{plisioCallbackUrl}</span>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-3 rounded-md border p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label className="text-sm font-semibold">Credentials</Label>
                  <p className="text-xs text-muted-foreground">Add whatever keys this provider needs, such as apiKey or secret.</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addCredential}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Key
                </Button>
              </div>
              <div className="space-y-2">
                {draft.credentials.map((entry, index) => (
                  <div key={`${index}-${entry.key}`} className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_auto]">
                    <Input
                      value={entry.key}
                      onChange={(event) => updateCredential(index, 'key', event.target.value)}
                      placeholder="Key"
                    />
                    <Input
                      value={entry.value}
                      onChange={(event) => updateCredential(index, 'value', event.target.value)}
                      placeholder={draft.provider === 'plisio' && entry.key === 'apiKey' ? 'Plisio secret key' : 'Value'}
                      type={entry.key.toLowerCase().includes('secret') || entry.key.toLowerCase().includes('key') ? 'password' : 'text'}
                    />
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeCredential(index)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {draft.provider === 'custom' && (
              <div className="space-y-3 rounded-md border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label className="text-sm font-semibold">Custom Fields</Label>
                    <p className="text-xs text-muted-foreground">These fields are shown to users when they choose this method.</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addCustomField}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Field
                  </Button>
                </div>
                <div className="space-y-2">
                  {draft.customFields.map((field, index) => (
                    <div key={`custom-field-${index}`} className="space-y-2 rounded-md border p-3">
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                        <Input
                          value={field.key}
                          onChange={(event) => updateCustomField(index, 'key', event.target.value)}
                          placeholder="Field key"
                        />
                        <Input
                          value={field.label}
                          onChange={(event) => updateCustomField(index, 'label', event.target.value)}
                          placeholder="Field label"
                        />
                        <Select
                          value={field.inputType || 'text'}
                          onValueChange={(value) => updateCustomField(index, 'inputType', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Input type" />
                          </SelectTrigger>
                          <SelectContent>
                            {CUSTOM_FIELD_INPUT_TYPES.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          value={field.placeholder || ''}
                          onChange={(event) => updateCustomField(index, 'placeholder', event.target.value)}
                            placeholder={field.inputType === 'image' ? 'Optional helper text' : 'Placeholder'}
                        />
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={field.required || false}
                            onCheckedChange={(checked) => updateCustomField(index, 'required', checked)}
                          />
                          <span className="text-sm text-muted-foreground">Required</span>
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeCustomField(index)}>
                          <Trash2 className="mr-2 h-4 w-4 text-destructive" /> Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {draft.provider === 'plisio' ? (
              <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
                Plisio normally needs an API key. Enter it in the credentials list as <span className="font-mono text-foreground">apiKey</span>. The callback URL above will be used for webhook delivery.
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={saveDraft} disabled={!draft.name.trim()}>
              Save Method
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
