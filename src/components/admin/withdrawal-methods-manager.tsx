"use client";

import { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { Edit3, PlusCircle, Trash2 } from "lucide-react";
import { WithdrawalMethod, WithdrawalMethodField } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CUSTOM_FIELD_INPUT_TYPES: Array<{ value: NonNullable<WithdrawalMethodField['inputType']>; label: string }> = [
  { value: 'text', label: 'Text' },
  { value: 'email', label: 'Email' },
  { value: 'number', label: 'Number' },
  { value: 'textarea', label: 'Textarea' },
  { value: 'password', label: 'Password' },
  { value: 'url', label: 'URL' },
  { value: 'tel', label: 'Phone' },
  { value: 'image', label: 'Image upload' },
];

type WithdrawalMethodDraft = {
  id: string;
  name: string;
  enabled: boolean;
  minimumAmount: string;
  maximumAmount: string;
  description: string;
  customFields: WithdrawalMethodField[];
};

function emptyDraft(): WithdrawalMethodDraft {
  return {
    id: uuidv4(),
    name: '',
    enabled: true,
    minimumAmount: '',
    maximumAmount: '',
    description: '',
    customFields: [],
  };
}

function methodToDraft(method: WithdrawalMethod): WithdrawalMethodDraft {
  return {
    id: method.id,
    name: method.name,
    enabled: method.enabled !== false,
    minimumAmount: typeof method.minimumAmount === 'number' ? String(method.minimumAmount) : '',
    maximumAmount: typeof method.maximumAmount === 'number' ? String(method.maximumAmount) : '',
    description: method.description || '',
    customFields: Array.isArray(method.customFields) ? method.customFields : [],
  };
}

function draftToMethod(draft: WithdrawalMethodDraft): WithdrawalMethod {
  const minimumAmount = draft.minimumAmount.trim() ? Number(draft.minimumAmount) : undefined;
  const maximumAmount = draft.maximumAmount.trim() ? Number(draft.maximumAmount) : undefined;

  return {
    id: draft.id,
    name: draft.name.trim(),
    provider: 'custom',
    enabled: draft.enabled,
    processingMode: 'admin_verified',
    minimumAmount: Number.isFinite(minimumAmount as number) ? minimumAmount : undefined,
    maximumAmount: Number.isFinite(maximumAmount as number) ? maximumAmount : undefined,
    description: draft.description.trim(),
    customFields: draft.customFields.filter((field) => field.key.trim() && field.label.trim()),
  };
}

export function WithdrawalMethodsManager({
  methods,
  onChange,
}: {
  methods: WithdrawalMethod[];
  onChange: (methods: WithdrawalMethod[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<WithdrawalMethodDraft>(emptyDraft());
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setDraft(emptyDraft());
      setEditingId(null);
    }
  }, [open]);

  const startCreate = () => {
    setDraft(emptyDraft());
    setEditingId(null);
    setOpen(true);
  };

  const startEdit = (method: WithdrawalMethod) => {
    setDraft(methodToDraft(method));
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

  const updateCustomField = (index: number, field: keyof WithdrawalMethodField, value: string | boolean) => {
    setDraft((current) => {
      const next = [...current.customFields];
      next[index] = { ...next[index], [field]: value } as WithdrawalMethodField;
      return { ...current, customFields: next };
    });
  };

  const addCustomField = () => {
    setDraft((current) => ({
      ...current,
      customFields: [...current.customFields, { key: '', label: '', placeholder: '', required: false, inputType: 'text' }],
    }));
  };

  const removeCustomField = (index: number) => {
    setDraft((current) => ({
      ...current,
      customFields: current.customFields.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const setAmountField = (field: 'minimumAmount' | 'maximumAmount', value: string) => {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
  };

  return (
    <div className="space-y-4 rounded-md border p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Label className="text-base font-semibold">Withdrawal Methods</Label>
          <p className="text-sm text-muted-foreground">Configure manual withdrawal methods users can request.</p>
        </div>
        <Button type="button" variant="outline" onClick={startCreate}>
          <PlusCircle className="mr-2 h-4 w-4" /> Configure Method
        </Button>
      </div>

      <div className="space-y-3">
        {methods.length === 0 ? (
          <p className="text-sm text-muted-foreground">No withdrawal methods configured yet.</p>
        ) : (
          methods.map((method) => (
            <div key={method.id} className="flex flex-col gap-3 rounded-md border p-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{method.name}</span>
                  <Badge variant={method.enabled ? 'default' : 'secondary'}>{method.enabled ? 'Enabled' : 'Disabled'}</Badge>
                  <Badge variant="outline">custom</Badge>
                  <Badge variant="outline">Admin verified</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{method.description || 'No description provided.'}</p>
                {(typeof method.minimumAmount === 'number' || typeof method.maximumAmount === 'number') ? (
                  <p className="text-xs text-muted-foreground">
                    {typeof method.minimumAmount === 'number' ? `Min: $${method.minimumAmount.toFixed(2)} ` : ''}
                    {typeof method.maximumAmount === 'number' ? `Max: $${method.maximumAmount.toFixed(2)}` : ''}
                  </p>
                ) : null}
                {(method.customFields?.length || 0) > 0 ? (
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
            <DialogTitle>{editingId ? 'Configure Withdrawal Method' : 'Add Withdrawal Method'}</DialogTitle>
            <DialogDescription>
              Custom withdrawal methods are always admin-verified. Add custom fields users must fill when requesting withdrawal.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4 max-h-[calc(90vh-10rem)] overflow-y-auto pr-2">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="withdrawal-method-name" className="text-right">Method Name</Label>
              <Input
                id="withdrawal-method-name"
                value={draft.name}
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                className="col-span-3"
                placeholder="Bank Transfer, Skrill, Wise, etc."
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="withdrawal-method-enabled" className="text-right">Enabled</Label>
              <div className="col-span-3 flex items-center gap-2">
                <Switch
                  id="withdrawal-method-enabled"
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

            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="withdrawal-method-description" className="text-right pt-2">Description</Label>
              <Textarea
                id="withdrawal-method-description"
                value={draft.description}
                onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                className="col-span-3"
                placeholder="Shown to users when selecting this method."
              />
            </div>

            <div className="space-y-3 rounded-md border p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Custom Fields</p>
                  <p className="text-xs text-muted-foreground">Collect account identifiers, wallet address, screenshots, or other method-specific details.</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addCustomField}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Field
                </Button>
              </div>

              {draft.customFields.length === 0 ? (
                <p className="text-xs text-muted-foreground">No custom fields configured.</p>
              ) : (
                <div className="space-y-3">
                  {draft.customFields.map((field, index) => (
                    <div key={`withdrawal-custom-field-${index}`} className="grid gap-2 rounded-md border p-3">
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                        <Input
                          value={field.label || ''}
                          onChange={(event) => updateCustomField(index, 'label', event.target.value)}
                          placeholder="Field label"
                        />
                        <Input
                          value={field.key || ''}
                          onChange={(event) => updateCustomField(index, 'key', event.target.value)}
                          placeholder="field_key"
                        />
                      </div>
                      <Input
                        value={field.placeholder || ''}
                        onChange={(event) => updateCustomField(index, 'placeholder', event.target.value)}
                        placeholder="Placeholder"
                      />
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                        <Select value={field.inputType || 'text'} onValueChange={(value) => updateCustomField(index, 'inputType', value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Input type" />
                          </SelectTrigger>
                          <SelectContent>
                            {CUSTOM_FIELD_INPUT_TYPES.map((option) => (
                              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="flex items-center justify-between rounded-md border px-3 py-2">
                          <span className="text-sm">Required</span>
                          <Switch
                            checked={field.required === true}
                            onCheckedChange={(checked) => updateCustomField(index, 'required', checked)}
                          />
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeCustomField(index)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="button" onClick={saveDraft} disabled={!draft.name.trim()}>Save Method</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
