import { Button } from '@/components/ui/button';
import { DollarSign } from 'lucide-react';
import Script from 'next/script';
import Image from 'next/image';
import { Github, Linkedin } from 'lucide-react';

// Add the global type declaration for PayPal
declare global {
  interface Window {
    paypal: any;
  }
}

// Custom X Logo component
function XLogo() {
  return (
    <svg 
      viewBox="0 0 24 24" 
      aria-hidden="true" 
      className="h-5 w-5"
      fill="currentColor"
    >
      <path d="M13.3174 10.7749L19.1457 4H17.7646L12.7852 9.88256L8.80099 4H4L10.0114 12.8955L4 20H5.38115L10.5446 13.7878L14.7064 20H19.5074L13.3174 10.7749ZM11.1087 12.9787L10.3666 11.9324L5.62947 5.11896H8.01397L11.8461 10.6942L12.5881 11.7405L17.5769 18.881H15.1924L11.1087 12.9787Z"></path>
    </svg>
  );
}

export function SocialButtons({ isMobile = false }) {
  return (
    <div className={`flex items-center ${isMobile ? 'justify-center space-x-4' : 'space-x-2'}`}>
      <a 
        href="https://x.com/sreehariX" 
        target="_blank" 
        rel="noopener noreferrer"
        className="text-gray-300 hover:text-white transition-colors"
      >
        <Button variant="ghost" size="icon" className="rounded-full">
          <XLogo />
        </Button>
      </a>
      
      <a 
        href="https://github.com/sreehariX/vitess-rag" 
        target="_blank" 
        rel="noopener noreferrer"
        className="text-gray-300 hover:text-white transition-colors"
      >
        <Button variant="ghost" size="icon" className="rounded-full">
          <Github className="h-5 w-5" />
        </Button>
      </a>
      
      <a 
        href="https://www.linkedin.com/in/sreeharix/" 
        target="_blank" 
        rel="noopener noreferrer"
        className="text-gray-300 hover:text-white transition-colors"
      >
        <Button variant="ghost" size="icon" className="rounded-full">
          <Linkedin className="h-5 w-5" />
        </Button>
      </a>
    </div>
  );
} 