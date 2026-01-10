import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Users, Loader2, Trash2 } from 'lucide-react';

export default function Configuracoes() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [nomeResponsavel, setNomeResponsavel] = useState('');

  const { data: responsaveis, isLoading } = useQuery({
    queryKey: ['responsaveis', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('responsaveis')
        .select('*')
        .order('nome');
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const createResponsavelMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('responsaveis')
        .insert({
          user_id: user.id,
          nome: nomeResponsavel,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['responsaveis'] });
      toast.success('Responsável cadastrado!');
      setDialogOpen(false);
      setNomeResponsavel('');
    },
    onError: (error: any) => {
      toast.error('Erro ao cadastrar', {
        description: error.message,
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeResponsavel.trim()) {
      toast.error('Informe o nome');
      return;
    }
    createResponsavelMutation.mutate();
  };

  return (
    <AppLayout>
      <div className="container py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Configurações</h1>
          <p className="text-muted-foreground">Gerencie seu sistema</p>
        </div>

        {/* Responsáveis */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Responsáveis
            </CardTitle>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Novo
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Novo Responsável</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome *</Label>
                    <Input
                      id="nome"
                      placeholder="Ex: Ricardo Silva"
                      value={nomeResponsavel}
                      onChange={(e) => setNomeResponsavel(e.target.value)}
                      required
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setDialogOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1"
                      disabled={createResponsavelMutation.isPending}
                    >
                      {createResponsavelMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        'Salvar'
                      )}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : responsaveis && responsaveis.length > 0 ? (
              <div className="space-y-2">
                {responsaveis.map((resp) => (
                  <div
                    key={resp.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <span className="font-medium">{resp.nome}</span>
                    <span
                      className={`text-sm ${
                        resp.status === 'Ativo' ? 'text-success' : 'text-muted-foreground'
                      }`}
                    >
                      {resp.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-muted-foreground">
                Nenhum responsável cadastrado
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
