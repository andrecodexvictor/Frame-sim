
import React, { useState } from 'react';
import { ArrowLeft, User, Mail, Lock, ArrowRight } from 'lucide-react';

interface AuthScreenProps {
  mode: 'login' | 'register';
  onBack: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ mode, onBack }) => {
  const isLogin = mode === 'login';
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulação de delay
    setTimeout(() => setLoading(false), 2000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-sarah-dark">
      {/* Dynamic Background */}
      <div className="absolute inset-0 z-0">
         <div className="absolute top-0 right-0 w-3/4 h-full bg-black skew-x-12 translate-x-1/4 border-l border-white/10"></div>
      </div>

      <button 
        onClick={onBack}
        className="absolute top-8 left-8 z-50 text-white/50 hover:text-white flex items-center gap-2 font-mono text-sm uppercase transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 text-center">
          <h2 className="text-5xl font-black uppercase tracking-tighter mb-2 italic">
            {isLogin ? 'Bem vinda de volta' : 'Crie sua conta'}
          </h2>
          <p className="text-sarah-blue font-mono text-sm uppercase tracking-widest">
            {isLogin ? 'Acesse o Clube' : 'Junte-se a 1.2k creators'}
          </p>
        </div>

        <div className="glass-panel p-8 md:p-10 shadow-neon backdrop-blur-xl relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-sarah-blue to-sarah-cyan opacity-20 blur transition duration-1000 group-hover:opacity-50"></div>
          
          <form onSubmit={handleSubmit} className="relative space-y-6">
            {!isLogin && (
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Nome</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input 
                    type="text" 
                    placeholder="Seu nome artístico" 
                    className="w-full bg-black/50 border border-white/10 focus:border-sarah-blue text-white p-4 pl-12 outline-none transition-colors font-medium placeholder-gray-600"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input 
                  type="email" 
                  placeholder="seu@email.com" 
                  className="w-full bg-black/50 border border-white/10 focus:border-sarah-blue text-white p-4 pl-12 outline-none transition-colors font-medium placeholder-gray-600"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Senha</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  className="w-full bg-black/50 border border-white/10 focus:border-sarah-blue text-white p-4 pl-12 outline-none transition-colors font-medium placeholder-gray-600"
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-4 bg-sarah-blue hover:bg-white text-black font-black uppercase tracking-widest shadow-hard transition-all active:translate-x-1 active:translate-y-1 active:shadow-none flex items-center justify-center gap-2 mt-8 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Carregando...' : (
                <>
                  {isLogin ? 'Entrar' : 'Cadastrar'} <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center mt-8 text-gray-500 text-sm">
          {isLogin ? 'Ainda não é do bonde?' : 'Já tem conta?'}
          <button className="text-sarah-cyan font-bold ml-2 uppercase hover:underline">
            {isLogin ? 'Clique aqui' : 'Faça login'}
          </button>
        </p>
      </div>
    </div>
  );
};
