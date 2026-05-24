import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import toast from 'react-hot-toast';

export default function OAuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setAuthToken } = useAuthStore();

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const token = hashParams.get('token') || searchParams.get('token');
    const error = searchParams.get('error');

    if (error) {
      toast.error('OAuth authentication failed');
      navigate('/login');
      return;
    }

    if (token) {
      setAuthToken(token)
        .then(() => {
          toast.success('Welcome!');
          navigate('/dashboard');
        })
        .catch(() => {
          toast.error('OAuth authentication failed');
          navigate('/login');
        });
    } else {
      navigate('/login');
    }
  }, [searchParams, navigate, setAuthToken]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Completing authentication...</p>
      </div>
    </div>
  );
}
