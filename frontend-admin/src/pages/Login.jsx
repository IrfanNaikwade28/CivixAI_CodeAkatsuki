import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Shield, Loader2 } from 'lucide-react';

export default function Login() {
  const { login } = useApp();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e3a8a] to-[#0f172a] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm border border-white/20">
            <Shield size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">CivixAI Admin</h1>
          <p className="text-blue-300 text-sm mt-1">Ichalkaranji Municipal Corporation</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-lg font-bold text-gray-900 mb-1">Admin Sign In</h2>
          <p className="text-gray-400 text-sm mb-6">Restricted access — authorised personnel only</p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-5">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@civixai.gov.in"
                required
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1e3a8a] hover:bg-blue-900 text-white font-semibold py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-60 mt-2"
            >
              {loading ? <><Loader2 size={16} className="animate-spin" /> Signing in...</> : 'Sign In'}
            </button>
          </form>

          {/* Demo credentials */}
          <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50/60 p-4">
            <p className="text-xs font-bold text-blue-700 mb-2">Demo Credentials</p>
            <button
              type="button"
              onClick={() => { setEmail('admin@civixai.gov.in'); setPassword('admin1234'); }}
              className="w-full flex items-center justify-between px-3 py-2 bg-white hover:bg-blue-50 border border-blue-200 rounded-lg text-left transition-colors cursor-pointer mb-2"
            >
              <span className="text-sm font-medium text-gray-800">Admin</span>
              <span className="text-xs text-gray-500">admin@civixai.gov.in</span>
            </button>
            <p className="text-[10px] text-blue-600/70 mt-1">Password: admin1234</p>
          </div>
        </div>

        <p className="text-center text-blue-400/60 text-xs mt-6">
          CivixAI v1.0 · Ichalkaranji Municipal Corporation
        </p>
      </div>
    </div>
  );
}
