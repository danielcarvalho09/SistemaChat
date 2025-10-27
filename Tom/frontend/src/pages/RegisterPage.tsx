import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Globe } from '@/components/ui/globe';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const { register, isLoading } = useAuthStore();
  const { toast } = useToast();
  const navigate = useNavigate();

  const validatePassword = (pwd: string): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    if (pwd.length < 8) {
      errors.push('Mínimo 8 caracteres');
    }
    if (!/[A-Z]/.test(pwd)) {
      errors.push('Pelo menos 1 letra maiúscula');
    }
    if (!/[a-z]/.test(pwd)) {
      errors.push('Pelo menos 1 letra minúscula');
    }
    if (!/[0-9]/.test(pwd)) {
      errors.push('Pelo menos 1 número');
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd)) {
      errors.push('Pelo menos 1 caractere especial (!@#$%^&* etc)');
    }
    
    return { valid: errors.length === 0, errors };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !email || !password || !confirmPassword) {
      toast({
        title: 'Erro',
        description: 'Por favor, preencha todos os campos',
        variant: 'destructive',
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: 'Erro',
        description: 'As senhas não coincidem',
        variant: 'destructive',
      });
      return;
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      toast({
        title: 'Senha inválida',
        description: passwordValidation.errors.join(', '),
        variant: 'destructive',
      });
      return;
    }

    try {
      await register(email, password, name);
      toast({
        title: 'Sucesso',
        description: 'Conta criada com sucesso!',
      });
      navigate('/dashboard');
    } catch (error: any) {
      toast({
        title: 'Erro ao criar conta',
        description: error.response?.data?.message || 'Tente novamente mais tarde',
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
              Criar Nova Conta
            </p>
          </div>

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Nome Completo
              </label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome"
                className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/20"
                disabled={isLoading}
                required
              />
            </div>

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
              <div className="mt-2 space-y-1">
                <p className="text-xs font-medium text-gray-700">A senha deve conter:</p>
                <ul className="text-xs text-gray-600 space-y-0.5 ml-4">
                  <li className={password.length >= 8 ? 'text-green-600' : ''}>
                    {password.length >= 8 ? '✓' : '•'} Mínimo 8 caracteres
                  </li>
                  <li className={/[A-Z]/.test(password) ? 'text-green-600' : ''}>
                    {/[A-Z]/.test(password) ? '✓' : '•'} 1 letra maiúscula
                  </li>
                  <li className={/[a-z]/.test(password) ? 'text-green-600' : ''}>
                    {/[a-z]/.test(password) ? '✓' : '•'} 1 letra minúscula
                  </li>
                  <li className={/[0-9]/.test(password) ? 'text-green-600' : ''}>
                    {/[0-9]/.test(password) ? '✓' : '•'} 1 número
                  </li>
                  <li className={/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) ? 'text-green-600' : ''}>
                    {/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) ? '✓' : '•'} 1 caractere especial
                  </li>
                </ul>
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                Confirmar Senha
              </label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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
            {isLoading ? 'Criando conta...' : 'Criar Conta'}
          </Button>

          <div className="text-center text-sm mt-4">
            <span className="text-gray-600">Já tem uma conta? </span>
            <Link to="/login" className="font-medium text-gray-900 hover:text-gray-700 underline">
              Faça login
            </Link>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
}
