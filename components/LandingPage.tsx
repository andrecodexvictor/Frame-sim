
import React from 'react';
import { ArrowRight, Play, Star, Zap, Instagram, TrendingUp, Users } from 'lucide-react';

interface LandingPageProps {
  onLogin: () => void;
  onRegister: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLogin, onRegister }) => {
  return (
    <div className="relative">
      {/* Navbar */}
      <nav className="fixed top-0 w-full z-40 glass-panel border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="text-2xl font-black tracking-tighter italic">
            eu.sou<span className="text-sarah-blue">sarah</span>
            <span className="text-xs font-normal not-italic ml-2 opacity-70 tracking-widest uppercase">creators club</span>
          </div>
          <button 
            onClick={onLogin}
            className="px-6 py-2 font-bold text-sm uppercase tracking-wider hover:text-sarah-blue transition-colors"
          >
            Login de Aluno
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="relative min-h-screen flex items-center justify-center pt-20 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-tr from-sarah-dark via-transparent to-transparent opacity-50 blur-[100px]"></div>
        </div>
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 text-left space-y-8">
            <div className="inline-block px-4 py-1 border border-sarah-cyan text-sarah-cyan text-xs font-bold uppercase tracking-[0.2em] bg-sarah-cyan/10 backdrop-blur-md">
              Vagas Abertas por tempo limitado
            </div>
            
            <h1 className="text-6xl md:text-8xl font-black leading-[0.9] tracking-tighter uppercase">
              oooo <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-sarah-blue to-sarah-cyan">paaaaaaii...</span>
            </h1>
            
            <p className="text-xl md:text-2xl font-medium text-gray-300 max-w-2xl leading-relaxed">
              Quer bombar de verdade ou só ficar postando pro crush ver? Entre pro clube e aprenda a 
              <span className="text-white font-bold bg-sarah-blue/20 px-1">viralizar FEIO</span> com quem já tem 2M de seguidores.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <button 
                onClick={onRegister}
                className="group relative px-8 py-5 bg-sarah-blue text-black font-black text-lg uppercase tracking-wider brutal-btn shadow-hard hover:bg-white transition-all"
              >
                Quero entrar agora
                <span className="absolute inset-0 border-2 border-white pointer-events-none translate-x-1 translate-y-1 group-hover:translate-x-0 group-hover:translate-y-0 transition-transform"></span>
              </button>
              <button className="px-8 py-5 border-2 border-white/20 hover:border-sarah-cyan hover:text-sarah-cyan font-bold text-lg uppercase tracking-wider transition-all flex items-center gap-2">
                <Play className="w-5 h-5 fill-current" />
                Ver o vídeo
              </button>
            </div>

            <div className="flex items-center gap-4 text-sm font-mono text-gray-400 pt-4">
              <div className="flex -space-x-3">
                {[1,2,3,4].map(i => (
                  <div key={i} className="w-10 h-10 rounded-full border-2 border-black bg-gray-800 bg-cover" style={{backgroundImage: `url(https://i.pravatar.cc/100?img=${10+i})`}}></div>
                ))}
              </div>
              <p>+1.200 criadores já estão fazendo merda no cabelo</p>
            </div>
          </div>

          <div className="lg:col-span-5 relative hidden lg:block">
            <div className="relative z-10 w-full aspect-[3/4] rounded-2xl overflow-hidden border-4 border-white/10 shadow-2xl rotate-3 hover:rotate-0 transition-transform duration-500">
               {/* Placeholder for Sarah's Photo - Using a stylistic gradient placeholder as I can't generate images */}
               <div className="absolute inset-0 bg-gradient-to-b from-gray-800 to-black flex flex-col items-center justify-end p-8">
                  <span className="text-9xl font-black text-white/5 absolute top-10 left-10">SARAH</span>
                  <div className="w-full bg-glass-panel p-6 backdrop-blur-xl border-t border-white/20">
                     <div className="flex justify-between items-end">
                        <div>
                          <p className="text-sarah-cyan font-bold text-xs uppercase mb-1">Engajamento Mensal</p>
                          <p className="text-4xl font-black font-mono">1.5M+</p>
                        </div>
                        <Instagram className="w-8 h-8 text-white" />
                     </div>
                  </div>
               </div>
            </div>
            {/* Decorative Elements */}
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-sarah-blue rounded-full blur-[40px] animate-pulse"></div>
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-sarah-cyan rounded-full blur-[50px] opacity-60"></div>
          </div>
        </div>
      </header>

      {/* Social Proof Bar */}
      <div className="border-y border-white/10 bg-black/50 backdrop-blur-sm overflow-hidden py-4">
        <div className="flex justify-around items-center min-w-max animate-float gap-12 px-8">
          {["TIKTOK: 2M+", "INSTA: 712K", "VÍDEOS VIRAIS", "STORYTELLING", "AUTENTICIDADE", "TIKTOK: 2M+", "INSTA: 712K"].map((item, idx) => (
             <span key={idx} className="text-xl font-black text-transparent text-outline uppercase tracking-tighter hover:text-sarah-blue transition-colors cursor-default">
               {item}
             </span>
          ))}
        </div>
      </div>

      {/* Problem/Solution Section */}
      <section className="py-24 px-4 bg-[#050b1e]">
        <div className="max-w-4xl mx-auto text-center space-y-12">
           <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter">
             Cansou de ser <br/> <span className="text-sarah-blue underline decoration-sarah-cyan decoration-4 underline-offset-4">flopada?</span>
           </h2>
           <div className="grid md:grid-cols-2 gap-8 text-left">
             <div className="p-8 bg-white/5 border border-white/10 rounded-lg hover:border-red-500/50 transition-colors group">
               <h3 className="text-xl font-bold text-red-400 mb-4 group-hover:translate-x-2 transition-transform">O Jeito Errado</h3>
               <ul className="space-y-4 text-gray-400">
                 <li className="flex gap-2"><span className="text-red-500">×</span> Copiar gringo sem contexto</li>
                 <li className="flex gap-2"><span className="text-red-500">×</span> Postar 50x por dia sem estratégia</li>
                 <li className="flex gap-2"><span className="text-red-500">×</span> Fingir uma vida que não é sua</li>
               </ul>
             </div>
             <div className="p-8 glass-panel rounded-lg hover:border-sarah-cyan/50 transition-colors group relative overflow-hidden">
               <div className="absolute top-0 right-0 w-20 h-20 bg-sarah-blue/20 blur-[30px]"></div>
               <h3 className="text-xl font-bold text-sarah-cyan mb-4 group-hover:translate-x-2 transition-transform">O Jeito Sarah</h3>
               <ul className="space-y-4 text-gray-200">
                 <li className="flex gap-2"><span className="text-sarah-cyan">✓</span> Storytelling emocional que conecta</li>
                 <li className="flex gap-2"><span className="text-sarah-cyan">✓</span> Vulnerabilidade real (sem filtro)</li>
                 <li className="flex gap-2"><span className="text-sarah-cyan">✓</span> Humor que gera identificação</li>
               </ul>
             </div>
           </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 px-4 relative">
         <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
              <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter leading-none">
                O que tem <br/> no <span className="text-sarah-blue">Clube?</span>
              </h2>
              <p className="text-gray-400 max-w-sm text-right">
                Tudo que eu uso pra manter 2M de pessoas obcecadas pelo meu conteúdo.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
               {[
                 { icon: Play, title: "Aulas Sem Enrolação", desc: "Vídeos de 5-15 min direto ao ponto. Aprendeu, aplicou, viralizou." },
                 { icon: Users, title: "Comunidade VIP", desc: "Eu entro todo dia. Feedback sincero, sem massagem no ego." },
                 { icon: Zap, title: "Fábrica de Criativos", desc: "Templates de roteiro que eu uso e packs de edição prontos." },
                 { icon: TrendingUp, title: "Radar de Trends", desc: "Toda semana eu te falo o que vai bombar ANTES de todo mundo." },
                 { icon: Star, title: "Saúde Mental", desc: "Como criar muito sem pifar a cabeça. O segredo da consistência." },
                 { icon: Instagram, title: "Análise de Perfil", desc: "Sorteios mensais onde eu desmonto e arrumo seu perfil ao vivo." },
               ].map((feature, i) => (
                 <div key={i} className="p-8 border border-white/10 hover:bg-white/5 hover:border-sarah-blue/30 transition-all group">
                    <feature.icon className="w-10 h-10 text-sarah-cyan mb-6 group-hover:scale-110 transition-transform" />
                    <h3 className="text-xl font-bold uppercase mb-3">{feature.title}</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">{feature.desc}</p>
                 </div>
               ))}
            </div>
         </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 bg-sarah-blue text-black text-center px-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/concrete-wall.png')] opacity-10 mix-blend-multiply"></div>
        <div className="relative z-10 max-w-3xl mx-auto space-y-8">
           <h2 className="text-5xl md:text-8xl font-black uppercase tracking-tighter">
             Bora fazer <br/> história?
           </h2>
           <p className="text-xl font-bold max-w-xl mx-auto">
             Se em 7 dias você não amar, eu devolvo seu dinheiro e ainda te dou um beijo no créu.
           </p>
           <button 
             onClick={onRegister}
             className="px-12 py-6 bg-black text-white font-black text-2xl uppercase tracking-wider hover:scale-105 hover:shadow-2xl transition-all border-4 border-transparent hover:border-white"
           >
             Quero Minha Vaga
           </button>
           <p className="text-sm font-mono opacity-60">⚠️ As vagas fecham em 24h</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black py-12 border-t border-white/10 px-4">
         <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="text-2xl font-black italic tracking-tighter">eu.sousarah</div>
            <div className="text-sm text-gray-500 font-mono">
              © 2024 Creators Club. Todos os direitos reservados.
            </div>
            <div className="flex gap-6">
               <a href="#" className="text-gray-500 hover:text-sarah-blue font-bold uppercase text-xs">Termos</a>
               <a href="#" className="text-gray-500 hover:text-sarah-blue font-bold uppercase text-xs">Privacidade</a>
            </div>
         </div>
      </footer>
    </div>
  );
};
