'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { QrCode, Smartphone, CheckCircle2, Loader2, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

declare global {
  interface Window {
    fbAsyncInit?: () => void;
    FB?: {
      init: (params: {
        appId: string;
        autoLogAppEvents: boolean;
        xfbml: boolean;
        version: string;
      }) => void;
      login: (
        callback: (response: {
          authResponse?: { code?: string; accessToken?: string };
          status?: string;
        }) => void,
        options: Record<string, unknown>,
      ) => void;
    };
  }
}

interface CoexistenceOnboardingProps {
  onIdsReceived: (ids: { phoneNumberId: string; wabaId: string }) => void;
}

export function CoexistenceOnboarding({ onIdsReceived }: CoexistenceOnboardingProps) {
  const [metaAppId, setMetaAppId] = useState(
    process.env.NEXT_PUBLIC_META_APP_ID || '',
  );
  const [metaConfigId, setMetaConfigId] = useState(
    process.env.NEXT_PUBLIC_META_CONFIG_ID || '',
  );
  const [launching, setLaunching] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [onboardedInfo, setOnboardedInfo] = useState<{
    phoneNumberId: string;
    wabaId: string;
  } | null>(null);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (
        !event.origin.endsWith('facebook.com') &&
        !event.origin.endsWith('fbcdn.net')
      ) {
        return;
      }

      try {
        const payload =
          typeof event.data === 'string' ? JSON.parse(event.data) : event.data;

        if (payload?.type === 'WA_EMBEDDED_SIGNUP') {
          if (payload.event === 'FINISH' || payload.event === 'FINISH_ONLY_WABA') {
            const phoneNumberId = String(payload.data?.phone_number_id || '');
            const wabaId = String(payload.data?.waba_id || '');

            if (phoneNumberId || wabaId) {
              setOnboardedInfo({ phoneNumberId, wabaId });
              onIdsReceived({ phoneNumberId, wabaId });
              toast.success(
                'WhatsApp Coexistence Connected! Phone Number ID & WABA ID auto-filled below.',
                { duration: 10000 },
              );
            }
            setLaunching(false);
          } else if (payload.event === 'CANCEL') {
            setLaunching(false);
            toast.info('WhatsApp Embedded Signup popup was closed.');
          } else if (payload.event === 'ERROR') {
            setLaunching(false);
            toast.error(
              `Meta Embedded Signup error: ${payload.data?.error_message || 'Unknown error'}`,
            );
          }
        }
      } catch {
        // Ignore non-JSON postMessage events
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onIdsReceived]);

  function loadFbSdk(appId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (window.FB) {
        window.FB.init({
          appId,
          autoLogAppEvents: true,
          xfbml: true,
          version: 'v22.0',
        });
        resolve();
        return;
      }

      window.fbAsyncInit = function () {
        window.FB?.init({
          appId,
          autoLogAppEvents: true,
          xfbml: true,
          version: 'v22.0',
        });
        resolve();
      };

      const existingScript = document.getElementById('facebook-jssdk');
      if (existingScript) {
        existingScript.remove();
      }

      const script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.src = 'https://connect.facebook.net/en_US/sdk.js';
      script.async = true;
      script.defer = true;
      script.onerror = () => reject(new Error('Failed to load Facebook SDK'));
      document.body.appendChild(script);
    });
  }

  async function handleLaunchCoexistence() {
    const cleanAppId = metaAppId.trim();
    const cleanConfigId = metaConfigId.trim();

    if (!cleanAppId || !/^\d+$/.test(cleanAppId)) {
      toast.error('Please enter your numeric Meta App ID first.');
      return;
    }
    if (!cleanConfigId || !/^\d+$/.test(cleanConfigId)) {
      toast.error(
        'Please enter your numeric Meta Embedded Signup Configuration ID first.',
      );
      return;
    }

    try {
      setLaunching(true);
      await loadFbSdk(cleanAppId);

      if (!window.FB) {
        throw new Error('Facebook SDK did not initialize');
      }

      window.FB.login(
        (response) => {
          if (response.authResponse?.code) {
            toast.success(
              'Meta authorization complete! Verify the auto-filled IDs below and click Save Configuration.',
            );
          }
          setLaunching(false);
        },
        {
          config_id: cleanConfigId,
          response_type: 'code',
          override_default_response_type: true,
          extras: {
            featureType: 'whatsapp_business_app_onboarding',
            sessionInfoVersion: '3',
          },
        },
      );
    } catch (err) {
      console.error('Coexistence launch failed:', err);
      toast.error(
        'Could not launch Meta popup. Check that ad-blockers are disabled for facebook.com.',
      );
      setLaunching(false);
    }
  }

  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <QrCode className="size-5" />
            </div>
            <div>
              <CardTitle className="text-base text-foreground">
                WhatsApp Coexistence (Use Existing WhatsApp Business App + CRM Together)
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Connect your active WhatsApp Business mobile app via QR code without deleting your account or losing old client chats.
              </CardDescription>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowGuide(!showGuide)}
            className="h-8 text-xs text-muted-foreground hover:text-foreground"
          >
            <HelpCircle className="mr-1 size-3.5" />
            {showGuide ? 'Hide Guide' : 'Setup Guide'}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {showGuide && (
          <div className="rounded-lg border border-border bg-card p-3.5 text-xs leading-relaxed text-muted-foreground space-y-2">
            <p className="font-semibold text-foreground">
              How to get Meta App ID &amp; Configuration ID for Coexistence:
            </p>
            <ol className="list-decimal pl-4 space-y-1">
              <li>
                Open <strong>developers.facebook.com</strong> &rarr; Create a <strong>Business App</strong> &rarr; Add <strong>WhatsApp</strong> and <strong>Facebook Login for Business</strong>.
              </li>
              <li>
                Copy your <strong>App ID</strong> from <code>App Settings &rarr; Basic</code> and paste it below.
              </li>
              <li>
                Complete <strong>Tech Provider Onboarding</strong> under <code>WhatsApp &rarr; Quickstart</code>, then go to <code>Facebook Login for Business &rarr; Configurations</code>.
              </li>
              <li>
                Create a configuration with <strong>WhatsApp Embedded Signup</strong> + enable <strong>WhatsApp Business App Onboarding (Coexistence)</strong> &rarr; Copy the <strong>Configuration ID</strong> and paste it below.
              </li>
              <li>
                Subscribe to webhook fields: <code>messages</code>, <code>smb_message_echoes</code>, and <code>history</code>.
              </li>
            </ol>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Meta App ID
            </Label>
            <Input
              placeholder="e.g. 123456789012345"
              value={metaAppId}
              onChange={(e) => setMetaAppId(e.target.value)}
              className="h-9 bg-card border-border text-foreground text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Embedded Signup Configuration ID
            </Label>
            <Input
              placeholder="e.g. 987654321098765"
              value={metaConfigId}
              onChange={(e) => setMetaConfigId(e.target.value)}
              className="h-9 bg-card border-border text-foreground text-sm"
            />
          </div>
        </div>

        {onboardedInfo && (
          <div className="flex items-center gap-2 rounded-md border border-emerald-700/50 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-200">
            <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
            <span>
              Coexistence Linked! <strong>Phone Number ID:</strong>{' '}
              <code>{onboardedInfo.phoneNumberId}</code> &middot;{' '}
              <strong>WABA ID:</strong> <code>{onboardedInfo.wabaId}</code>. Now paste your System User Access Token below and click <strong>Save Configuration</strong>.
            </span>
          </div>
        )}

        <Button
          type="button"
          onClick={handleLaunchCoexistence}
          disabled={launching}
          className="w-full sm:w-auto"
        >
          {launching ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Waiting for Meta QR Popup...
            </>
          ) : (
            <>
              <Smartphone className="mr-2 size-4" />
              Connect Existing WhatsApp Business App (QR Code)
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
