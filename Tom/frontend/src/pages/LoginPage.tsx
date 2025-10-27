import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Globe } from '@/components/ui/globe';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading } = useAuthStore();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast({
        title: 'Erro',
        description: 'Por favor, preencha todos os campos',
        variant: 'destructive',
      });
      return;
    }

    try {
      await login(email, password);
      toast({
        title: 'Sucesso',
        description: 'Login realizado com sucesso!',
      });
      navigate('/dashboard');
    } catch (error: any) {
      toast({
        title: 'Erro ao fazer login',
        description: error.response?.data?.message || 'Verifique suas credenciais',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-white">
      {/* Globe Background - Menor e um pouco mais acima */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-[65%] opacity-15 z-0">
        <div className="w-[800px] h-[800px]">
          <Globe />
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-md px-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-lg">
          {/* Logo e título */}
          <div className="text-center mb-8">
            <h1 className="text-gray-900 text-center text-5xl md:text-6xl font-bold tracking-wider mb-2">
              AutoChat
            </h1>
            <p className="text-gray-600 text-center text-sm font-light">
              Sistema de Atendimento
            </p>
          </div>

            {/* Formulário */}
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/20"
                    disabled={isLoading}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                    Senha
                  </label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/20"
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                disabled={isLoading}
                className="w-full bg-gray-900 text-white hover:bg-gray-800 font-semibold py-6 text-lg mt-6"
              >
                {isLoading ? 'Entrando...' : 'Entrar'}
              </Button>

              <div className="text-center text-sm mt-4">
                <span className="text-gray-600">Não tem uma conta? </span>
                <Link to="/register" className="font-medium text-gray-900 hover:text-gray-700 underline">
                  Cadastre-se
                </Link>
              </div>
            </form>
        </div>
      </div>
    </div>
  );
}
