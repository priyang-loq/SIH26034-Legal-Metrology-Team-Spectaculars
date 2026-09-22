import React, { useState } from 'react';
import { Lock, ShieldAlert, Loader2 } from 'lucide-react';
import { authorityLogin, AuthorityUser } from '../../services/authApi';

interface AuthorityLoginProps {
  onLoginSuccess: (user: AuthorityUser) => void;
  onBack: () => void;
}

export const AuthorityLogin: React.FC<AuthorityLoginProps> = ({ onLoginSuccess, onBack }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await authorityLogin(username, password);
      onLoginSuccess(user);
    } catch (err: any) {
      setError(err.message || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 bg-[#EEF2F8] border border-[#D6DEEA] rounded-xl shadow-sm p-8">
      <div className="flex flex-col items-center text-center mb-6">
        <div className="w-14 h-14 rounded-full bg-[#14224A] text-[#B45309] flex items-center justify-center mb-3">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold font-heading text-[#14224A]">Authority Portal</h2>
        <p className="text-xs text-[#5B6B84] mt-1 font-mono">
          RESTRICTED ACCESS &middot; Legal Metrology Officers Only
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-[#FBEAE8] border border-[#B42318]/30 text-[#B42318] text-sm rounded-lg px-3 py-2 mb-4">
          <ShieldAlert className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-[#5B6B84] mb-1">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoFocus
            className="w-full px-3 py-2 rounded-lg border border-[#D6DEEA] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#14224A]/30"
            placeholder="authority_admin"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#5B6B84] mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-3 py-2 rounded-lg border border-[#D6DEEA] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#14224A]/30"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-[#14224A] text-[#F3F6FB] font-semibold text-sm py-2.5 rounded-lg hover:bg-[#14224A]/90 transition-colors disabled:opacity-60"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
          <span>{loading ? 'Verifying...' : 'Log In to Authority Portal'}</span>
        </button>

        <button
          type="button"
          onClick={onBack}
          className="w-full text-xs text-[#5B6B84] hover:text-[#14224A] underline text-center pt-1"
        >
          Back to public site
        </button>
      </form>
    </div>
  );
};
