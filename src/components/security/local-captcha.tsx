"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type LocalCaptchaState = {
  token: string;
  answer: string;
};

type LocalCaptchaProps = {
  onChange: (value: LocalCaptchaState) => void;
  disabled?: boolean;
};

export function LocalCaptcha({ onChange, disabled = false }: LocalCaptchaProps) {
  const [token, setToken] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const loadChallenge = useCallback(async () => {
    setLoading(true);
    setAnswer('');
    try {
      const response = await fetch('/api/security/captcha/challenge', { cache: 'no-store' });
      const payload = (await response.json().catch(() => null)) as { token?: string; question?: string } | null;
      const nextToken = String(payload?.token || '');
      const nextQuestion = String(payload?.question || '');
      setToken(nextToken);
      setQuestion(nextQuestion);
      onChangeRef.current({ token: nextToken, answer: '' });
    } catch {
      setToken('');
      setQuestion('');
      onChangeRef.current({ token: '', answer: '' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadChallenge();
  }, [loadChallenge]);

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <Label htmlFor="local-captcha-answer">Security Check</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void loadChallenge()}
          disabled={disabled || loading}
        >
          Refresh
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Solve this to continue: <span className="font-medium text-foreground">{question || 'Loading...'}</span>
      </p>
      <Input
        id="local-captcha-answer"
        value={answer}
        onChange={(event) => {
          const value = event.target.value;
          setAnswer(value);
          onChange({ token, answer: value });
        }}
        placeholder="Enter the result"
        inputMode="numeric"
        disabled={disabled || loading || !token}
      />
    </div>
  );
}
