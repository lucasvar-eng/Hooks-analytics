import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const { login, isAuthenticated, loading, error } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) navigate('/');
  }, [isAuthenticated, navigate]);

  const handleSubmit = (e) => {
    e.preventDefault();
    login(email, password);
  };

  return (
    <div className="app-shell min-h-screen flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <div className="mb-8 text-center">
        <span className="text-[15px] font-extrabold tracking-[3px] text-white uppercase">
          HOOKS<span className="text-blue-500"> ANALYTICS</span>
        </span>
      </div>

      {/* Card */}
      <div className="w-full max-w-[420px] bg-[#141414] rounded-2xl border border-white/[0.08] p-8 shadow-2xl shadow-black/60">
        <div className="mb-7">
          <h1 className="text-[22px] font-bold text-white">Welcome Back</h1>
          <p className="text-[13px] text-gray-500 mt-1">
            Enter your credentials to access your workspace
          </p>
        </div>

        {error && (
          <div className="mb-5 px-3.5 py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-[12px]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-dark"
              placeholder="name@agency.com"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="password" className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                Password
              </label>
              <button type="button" className="text-[11px] text-blue-400 hover:text-blue-300 transition font-medium">
                Forgot Password?
              </button>
            </div>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-dark"
              placeholder="••••••••"
            />
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="w-4 h-4 rounded border border-white/[0.12] bg-white/[0.04] accent-blue-500"
            />
            <span className="text-[12px] text-gray-500">Keep me signed in for 30 days</span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700
                       disabled:opacity-50 disabled:cursor-not-allowed
                       text-white text-[13px] font-semibold rounded-xl transition shadow-lg shadow-blue-500/20"
          >
            {loading ? 'Ingresando...' : 'Iniciar sesión'}
          </button>
        </form>
      </div>

      <p className="mt-6 text-[12px] text-gray-600">
        © 2026 Hooks Analytics
      </p>
    </div>
  );
}
