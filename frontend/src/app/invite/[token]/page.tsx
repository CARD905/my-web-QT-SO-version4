'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CheckCircle2, Loader2, AlertCircle, Mail } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

interface InvitationInfo {
  email: string;
  name: string | null;
  role: { code: string; nameTh: string };
  team: { id: string; name: string } | null;
  invitedBy: { id: string; name: string; email: string };
  expiresAt: string;
}

export default function AcceptInvitationPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [invitation, setInvitation] = useState<InvitationInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/invitations/by-token/${token}`);
        const json = await res.json();
        if (!res.ok || !json.success) {
          setError(json.message || 'Invalid invitation');
          return;
        }
        setInvitation(json.data);
        setName(json.data.name || '');
      } catch (err) {
        setError('Failed to load invitation. Please try again.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const submit = async () => {
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (!name.trim()) {
      toast.error('Please enter your name');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/invitations/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, name, password }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.message || 'Failed to accept invitation');
        return;
      }
      toast.success('Account created! Please log in.');
      setTimeout(() => router.push('/login'), 1500);
    } catch (err) {
      console.error(err);
      toast.error('Failed to accept invitation');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-destructive/10 mx-auto flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="text-xl font-bold">Invitation Invalid</h2>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button onClick={() => router.push('/login')} className="w-full">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 space-y-5">
          {/* Header */}
          <div className="text-center space-y-3">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 mx-auto flex items-center justify-center">
              <Mail className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">You're invited! 🎉</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Complete your account setup below
              </p>
            </div>
          </div>

          {/* Invitation details */}
          <div className="bg-muted/40 rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email:</span>
              <span className="font-medium">{invitation.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Role:</span>
              <span className="font-medium">{invitation.role.nameTh}</span>
            </div>
            {invitation.team && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Team:</span>
                <span className="font-medium">{invitation.team.name}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Invited by:</span>
              <span className="font-medium">{invitation.invitedBy.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Expires:</span>
              <span className="font-medium">
                {new Date(invitation.expiresAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* Form */}
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Your Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-xs">Password (min 8 characters)</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-xs">Confirm Password</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>

          <Button onClick={submit} disabled={submitting} className="w-full">
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Create Account
          </Button>

          <p className="text-[10px] text-center text-muted-foreground">
            By creating an account, you agree to be part of this organization
          </p>
        </CardContent>
      </Card>
    </div>
  );
}