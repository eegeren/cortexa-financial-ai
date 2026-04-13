import { useState, type ReactNode } from 'react';
import { isAxiosError } from 'axios';
import { createCheckoutSession } from '@/services/api';
import { useAuthStore } from '@/store/auth';

type UpgradeToPremiumButtonProps = {
  className?: string;
  children: ReactNode;
};

const UpgradeToPremiumButton = ({ className = '', children }: UpgradeToPremiumButtonProps) => {
  const token = useAuthStore((state) => state.token);
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    if (!token) {
      window.location.href = '/login';
      return;
    }

    setLoading(true);
    try {
      const session = await createCheckoutSession({
        plan_code: 'premium',
        success_url: `${window.location.origin}/billing?checkout=success`,
        cancel_url: window.location.href,
      });
      window.location.href = session.checkout_url;
    } catch (error) {
      let message = 'Checkout failed';
      if (isAxiosError(error)) {
        const detail = error.response?.data;
        if (typeof detail === 'string' && detail.trim()) {
          message = detail.trim();
        } else if (detail && typeof detail === 'object') {
          const knownMessage =
            ('message' in detail && typeof detail.message === 'string' && detail.message) ||
            ('error' in detail && typeof detail.error === 'string' && detail.error) ||
            ('detail' in detail && typeof detail.detail === 'string' && detail.detail);
          if (knownMessage) {
            message = knownMessage;
          }
        }
      } else if (error instanceof Error && error.message) {
        message = error.message;
      }
      window.alert(message);
      setLoading(false);
    }
  };

  return (
    <button type="button" onClick={handleUpgrade} disabled={loading} className={className}>
      {loading ? 'Redirecting…' : children}
    </button>
  );
};

export default UpgradeToPremiumButton;
