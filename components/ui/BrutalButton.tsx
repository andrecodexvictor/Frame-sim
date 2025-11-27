import React from 'react';

interface BrutalButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  isLoading?: boolean;
}

export const BrutalButton: React.FC<BrutalButtonProps> = ({ 
  children, 
  variant = 'primary', 
  isLoading, 
  className = '', 
  ...props 
}) => {
  const baseStyles = "px-6 py-3 font-bold text-sm md:text-base flex items-center justify-center gap-2 relative transition-all duration-200 uppercase tracking-wider";
  
  // Updated variants for Modern Brutalism (works in light/dark)
  const variants = {
    primary: "bg-[#00ff88] text-black border border-[#00ff88] hover:bg-[#00cc6a] shadow-[0_0_15px_rgba(0,255,136,0.4)] hover:shadow-[0_0_25px_rgba(0,255,136,0.6)]",
    secondary: "bg-transparent text-current border border-current hover:bg-current hover:text-black/80 backdrop-blur-sm",
    danger: "bg-red-500 text-white border border-red-500 hover:bg-red-600 shadow-[0_0_15px_rgba(239,68,68,0.4)]",
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${isLoading ? 'opacity-80 cursor-wait' : ''} ${className}`}
      disabled={isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <span className="animate-spin mr-2 h-4 w-4 border-2 border-current border-t-transparent rounded-full"></span>
          CALCULANDO...
        </>
      ) : children}
    </button>
  );
};