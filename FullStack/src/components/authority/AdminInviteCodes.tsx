import React, { useEffect, useState } from 'react';
import { Copy, Check, KeyRound, Loader2, ShieldOff, AlertTriangle } from 'lucide-react';
import {
  InviteCode, fetchInviteCodes, issueInviteCode, revokeInviteCode
} from '../../services/authorityApi';

const STATE_META: Record<InviteCode['state'], string> = {
  ACTIVE: 'bg-[#E7F5EC] text-[#1B7A43] border-[#1B7A43]/30',
  USED: 'bg-[#EAF0FB] text-[#2C5AA0] border-[#2C5AA0]/30',
  EXPIRED: 'bg-[#EEF2F8] text-[#5B6B84] border-[#D6DEEA]',
  REVOKED: 'bg-[#FCEAE8] text-[#B42318] border-[#B42318]/30'
};

/**
 * Administrator-only screen for issuing authority authentication codes.
 * Every code is random, single-use, and shown in plaintext exactly once,
 * right after issuance - it is never retrievable again afterwards.
 */
export const AdminInviteCodes: React.FC = () => {
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [issuing, setIssuing] = useState(false);
  const [justIssued, setJustIssued] = useState<InviteCode | null>(null);
  const [copied, setCopied] = useState(false);

  const [label, setLabel] = useState('');
  const [designation, setDesignation] = useState('Legal Metrology Inspector');
  const [district, setDistrict] = useState('');
  const [expiresInDays, setExpiresInDays] = useState(14);

  const load = () => {
    setLoading(true);
    fetchInviteCodes()
      .then(setCodes)
      .catch((err) => setError(err.message || 'Could not load authentication codes.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIssuing(true);
    setJustIssued(null);
    try {
      const created = await issueInviteCode({
        label: label.trim() || undefined,
        designation: designation.trim() || undefined,
        district: district.trim() || undefined,
        expiresInDays
      });
      setJustIssued(created);
      setLabel('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not issue a code.');
    } finally {
      setIssuing(false);
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      await revokeInviteCode(id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not revoke this code.');
    }
  };

  const copyCode = () => {
    if (!justIssued?.code) return;
    navigator.clipboard.writeText(justIssued.code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-[#D6DEEA] bg-white p-5">
        <h3 className="mb-1 text-sm font-bold text-[#14224A]">Issue a new authority authentication code</h3>
        <p className="mb-4 text-xs text-[#5B6B84]">
          Give this code to a newly assigned inspector. It works once, can expire, and is stored only as a hash - it
          is shown here in full exactly one time.
        </p>

        <form onSubmit={handleIssue} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-[#5B6B84]">Label (internal)</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. New Jorhat inspector"
              className="w-full rounded-lg border border-[#D6DEEA] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#14224A]/30"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-[#5B6B84]">Designation</label>
            <input
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              className="w-full rounded-lg border border-[#D6DEEA] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#14224A]/30"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-[#5B6B84]">District</label>
            <input
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              placeholder="Jorhat"
              className="w-full rounded-lg border border-[#D6DEEA] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#14224A]/30"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-[#5B6B84]">Expires in (days)</label>
            <input
              type="number"
              min={1}
              max={365}
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(Number(e.target.value))}
              className="w-full rounded-lg border border-[#D6DEEA] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#14224A]/30"
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-4">
            <button
              type="submit"
              disabled={issuing}
              className="inline-flex items-center gap-2 rounded-lg bg-[#14224A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1c2f63] disabled:opacity-60"
            >
              {issuing ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              Issue code
            </button>
          </div>
        </form>

        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-[#B42318]/30 bg-[#FCEAE8] px-3 py-2 text-xs text-[#B42318]">
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" /> {error}
          </div>
        )}

        {justIssued?.code && (
          <div className="mt-4 rounded-lg border border-[#1B7A43]/30 bg-[#F4FBF6] px-4 py-3">
            <p className="text-xs font-semibold text-[#1B7A43]">
              Copy this now ΓÇö it will not be shown again.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 rounded bg-white px-3 py-2 font-mono text-sm font-bold tracking-wide text-[#14224A]">
                {justIssued.code}
              </code>
              <button
                onClick={copyCode}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#14224A] px-3 py-2 text-xs font-semibold text-white hover:bg-[#1c2f63]"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-[#D6DEEA] bg-white">
        <header className="border-b border-[#D6DEEA] bg-[#F3F6FB] px-4 py-2.5">
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-[#14224A]">
            Issued codes ({codes.length})
          </h3>
        </header>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-[#5B6B84]">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading...
          </div>
        ) : codes.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#5B6B84]">No codes issued yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#E5EAF2] font-mono text-[11px] uppercase tracking-wider text-[#8B99B0]">
                  <th className="px-4 py-2 font-semibold">Label / designation</th>
                  <th className="px-4 py-2 font-semibold">District</th>
                  <th className="px-4 py-2 font-semibold">Role</th>
                  <th className="px-4 py-2 font-semibold">State</th>
                  <th className="px-4 py-2 font-semibold">Expires</th>
                  <th className="px-4 py-2 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {codes.map((c) => (
                  <tr key={c.id} className="border-b border-[#F0F3F8] last:border-0">
                    <td className="px-4 py-2.5">
                      <div className="font-semibold text-[#14224A]">{c.label || 'ΓÇö'}</div>
                      <div className="text-xs text-[#8B99B0]">{c.designation || 'ΓÇö'}</div>
                    </td>
                    <td className="px-4 py-2.5 text-[#5B6B84]">{c.district || 'ΓÇö'}</td>
                    <td className="px-4 py-2.5 text-[#5B6B84]">{c.role}</td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded border px-2 py-0.5 text-[11px] font-semibold ${STATE_META[c.state]}`}>
                        {c.state}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-[#5B6B84]">
                      {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : 'No expiry'}
                    </td>
                    <td className="px-4 py-2.5">
                      {c.state === 'ACTIVE' && (
                        <button
                          onClick={() => handleRevoke(c.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#B42318]/30 px-2.5 py-1 text-[11px] font-semibold text-[#B42318] hover:bg-[#FCEAE8]"
                        >
                          <ShieldOff className="h-3 w-3" /> Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
