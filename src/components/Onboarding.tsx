import React, { useState } from 'react';
import { Sprout, Mail, Chrome, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../services/firebase';

const Onboarding: React.FC = () => {
  const { loginWithGoogle, loginWithEmail, registerWithEmail } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  const [mode, setMode] = useState<'landing' | 'login' | 'signup'>('landing');
  const [landingConsentChecked, setLandingConsentChecked] = useState(false);
  const [signupConsentChecked, setSignupConsentChecked] = useState(false);
  const [shakeLandingCheckbox, setShakeLandingCheckbox] = useState(false);
  const [shakeSignupCheckbox, setShakeSignupCheckbox] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const checkFirebase = () => {
    if (!auth) {
      setError("Firebase is not configured! Please set up your .env file with Firebase credentials.");
      return false;
    }
    return true;
  };

  const handleGoogleSignIn = async () => {
    if (!landingConsentChecked) {
      setError("Please acknowledge the Privacy Policy and Terms of Service to continue.");
      setShakeLandingCheckbox(true);
      setTimeout(() => setShakeLandingCheckbox(false), 500);
      return;
    }
    if (!checkFirebase()) return;
    try {
      setError(null);
      setLoading(true);
      await loginWithGoogle();
    } catch (err: any) {
      setError(err.message || 'Failed to sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'signup' && !signupConsentChecked) {
      setError("Please acknowledge the Privacy Policy and Terms of Service to continue.");
      setShakeSignupCheckbox(true);
      setTimeout(() => setShakeSignupCheckbox(false), 500);
      return;
    }
    if (!checkFirebase()) return;
    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }
    
    try {
      setError(null);
      setLoading(true);
      if (mode === 'login') {
        await loginWithEmail(email, password);
      } else {
        await registerWithEmail(email, password);
      }
    } catch (err: any) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError("Invalid email or password.");
      } else if (err.code === 'auth/email-already-in-use') {
        setError("An account with this email already exists.");
      } else {
        setError(err.message || 'Authentication failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const renderLanding = () => (
    <>
      <div className="w-full space-y-4">
        <button 
          id="google-signin-btn"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-white text-stone border border-clay hover:bg-gray-50 font-medium py-3.5 px-6 rounded-2xl shadow-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <Chrome size={20} />
          {loading ? 'Signing in...' : 'Continue with Google'}
        </button>
        
        <button 
          id="email-signup-btn"
          onClick={() => { setError(null); setMode('signup'); }}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-moss text-white hover:bg-moss/90 font-medium py-3.5 px-6 rounded-2xl shadow-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <Mail size={20} />
          Sign up with Email
        </button>
      </div>

      <div className={`w-full mt-6 flex items-start gap-3 bg-white/40 p-4 rounded-2xl border transition-all duration-300 text-left ${shakeLandingCheckbox ? 'shake border-red-400 bg-red-50/20 shadow-md shadow-red-100' : 'border-moss/5'}`}>
        <input 
          id="gdpr-consent-landing"
          type="checkbox"
          checked={landingConsentChecked}
          onChange={e => { setLandingConsentChecked(e.target.checked); if (error && error.includes("Privacy Policy")) setError(null); }}
          className="mt-1 h-4.5 w-4.5 accent-moss rounded cursor-pointer shrink-0"
        />
        <label htmlFor="gdpr-consent-landing" className="text-xs text-stone/70 leading-relaxed cursor-pointer select-none">
          I acknowledge having read the{' '}
          <a href="/privacy-policy.html" target="_blank" rel="noopener noreferrer" className="underline text-moss font-bold hover:text-moss/80">Privacy Policy</a>
          {' '}and agree to the{' '}
          <a href="/terms-of-service.html" target="_blank" rel="noopener noreferrer" className="underline text-moss font-bold hover:text-moss/80">Terms of Service</a>
          {' '}for secure data storage on Firebase.
        </label>
      </div>

      <p className="mt-6 text-sm text-stone/70 text-center">
        Already have an account?{' '}
        <button onClick={() => { setError(null); setMode('login'); }} className="font-bold text-moss hover:underline cursor-pointer">
          Log in
        </button>
      </p>
    </>
  );

  const renderEmailForm = () => (
    <form onSubmit={handleEmailAuth} className="w-full flex flex-col gap-4">
      <button 
        type="button"
        onClick={() => { setError(null); setMode('landing'); }}
        className="self-start flex items-center gap-2 text-sm text-stone/60 hover:text-moss mb-2 cursor-pointer"
      >
        <ArrowLeft size={16} /> Back
      </button>

      <h2 className="text-2xl font-serif font-bold text-moss mb-4 text-center">
        {mode === 'login' ? 'Welcome Back' : 'Create Account'}
      </h2>

      {error && (
        <div className="w-full bg-red-100 text-red-800 p-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-stone/70 mb-1 ml-1">Email</label>
        <input 
          type="email" 
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          className="w-full p-4 rounded-2xl border border-clay bg-white focus:outline-none focus:ring-2 focus:ring-moss/50 transition-all"
          placeholder="you@example.com"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-stone/70 mb-1 ml-1">Password</label>
        <input 
          type="password" 
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          minLength={6}
          className="w-full p-4 rounded-2xl border border-clay bg-white focus:outline-none focus:ring-2 focus:ring-moss/50 transition-all"
          placeholder="••••••••"
        />
      </div>

      {mode === 'signup' && (
        <div className={`w-full mt-2 mb-2 flex items-start gap-3 bg-white/40 p-4 rounded-2xl border transition-all duration-300 text-left ${shakeSignupCheckbox ? 'shake border-red-400 bg-red-50/20 shadow-md shadow-red-100' : 'border-moss/5'}`}>
          <input 
            id="gdpr-consent-signup"
            type="checkbox"
            checked={signupConsentChecked}
            onChange={e => { setSignupConsentChecked(e.target.checked); if (error && error.includes("Privacy Policy")) setError(null); }}
            className="mt-1 h-4.5 w-4.5 accent-moss rounded cursor-pointer shrink-0"
          />
          <label htmlFor="gdpr-consent-signup" className="text-xs text-stone/70 leading-relaxed cursor-pointer select-none">
            I acknowledge having read the{' '}
            <a href="/privacy-policy.html" target="_blank" rel="noopener noreferrer" className="underline text-moss font-bold hover:text-moss/80">Privacy Policy</a>
            {' '}and agree to the{' '}
            <a href="/terms-of-service.html" target="_blank" rel="noopener noreferrer" className="underline text-moss font-bold hover:text-moss/80">Terms of Service</a>.
          </label>
        </div>
      )}

      <button 
        id="email-submit-btn"
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center bg-moss text-white hover:bg-moss/90 font-bold py-4 rounded-2xl shadow-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed mt-2 cursor-pointer"
      >
        {loading ? 'Please wait...' : mode === 'login' ? 'Log In' : 'Sign Up'}
      </button>

      <p className="mt-4 text-sm text-stone/70 text-center">
        {mode === 'login' ? "Don't have an account? " : "Already have an account? "}
        <button 
          type="button"
          onClick={() => { setError(null); setMode(mode === 'login' ? 'signup' : 'login'); }} 
          className="font-bold text-moss hover:underline cursor-pointer"
        >
          {mode === 'login' ? 'Sign up' : 'Log in'}
        </button>
      </p>
    </form>
  );

  return (
    <div className="min-h-screen bg-sand text-stone flex flex-col justify-center items-center p-6 relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-moss/10 rounded-full blur-3xl" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-terracotta/10 rounded-full blur-3xl" />

      <div className="z-10 flex flex-col items-center w-full max-w-md">
        {mode === 'landing' && (
          <>
            <div className="w-24 h-24 bg-white rounded-3xl shadow-xl flex items-center justify-center mb-8">
              <Sprout size={48} className="text-moss" />
            </div>
            <h1 className="text-4xl font-serif font-bold text-moss mb-3 text-center">
              PlantPatrol
            </h1>
            <p className="text-lg text-stone/70 text-center mb-12">
              Your personal AI assistant for keeping your plants healthy and thriving.
            </p>
            
            {error && (
              <div className="w-full bg-red-100 text-red-800 p-4 rounded-xl mb-6 text-sm">
                {error}
              </div>
            )}
          </>
        )}

        {mode === 'landing' ? renderLanding() : renderEmailForm()}
      </div>
    </div>
  );
};

export default Onboarding;
