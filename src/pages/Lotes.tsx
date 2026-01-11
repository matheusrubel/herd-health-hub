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
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Package, Users, TrendingUp, Loader2, Trash2 } from 'lucide-react';
import { DeleteLoteModal } from '@/components/modals/DeleteLoteModal';

const tiposAlimentacao = ['Confinado', 'Milheto', 'Pasto', 'Tifton', 'Semi-Confinado'];

export default function Lotes() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; lote: any; animais: number } | null>(null);

  const [nome, setNome] = useState('');
  const [tipoAlimentacao, setTipoAlimentacao] = useState('');
  const [capacidade, setCapacidade] = useState('');

  const { data: lotes, isLoading } = useQuery({
    queryKey: ['lotes-detalhados', user?.id],
    queryFn: async () => {
      const { data: lotesData, error } = await supabase
        .from('lotes')
        .select('*')
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;
      if (!lotesData || lotesData.length === 0) return [];

      const lotesWithStats = await Promise.all(
        lotesData.map(async (lote) => {
          const { data: animais } = await supabase
            .from('animais')
            .select('id, peso_entrada, data_entrada')
            .eq('lote_id', lote.id)
            .eq('ativo', true);

          const totalAnimais = animais?.length || 0;
          let gmdMedio = 0;

          if (animais && animais.length > 0) {
            const animalIds = animais.map(a => a.id);
            const { data: pesagens } = await supabase
              .from('pesagens')
              .select('animal_id, peso, data')
              .in('animal_id', animalIds)
              .order('data', { ascending: false });

            const ultimasPesagens = new Map();
            pesagens?.forEach(p => {
              if (!ultimasPesagens.has(p.animal_id)) {
                ultimasPesagens.set(p.animal_id, p);
              }
            });

            let totalGMD = 0;
            animais.forEach(animal => {
              const ultimaPesagem = ultimasPesagens.get(animal.id);
              const pesoAtual = ultimaPesagem ? Number(ultimaPesagem.peso) : Number(animal.peso_entrada);
              const ganho = pesoAtual - Number(animal.peso_entrada);
              const dias = Math.max(1, Math.floor((new Date().getTime() - new Date(animal.data_entrada).getTime()) / (1000 * 60 * 60 * 24)));
              totalGMD += ganho / dias;
            });

            gmdMedio = totalGMD / animais.length;
          }

          return { ...lote, totalAnimais, gmdMedio: Number(gmdMedio.toFixed(2)) };
        })
      );

      return lotesWithStats;
    },
    enabled: !!user,
  });

  const createLoteMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Usuário não autenticado');
      const { error } = await supabase.from('lotes').insert({
        user_id: user.id,
        nome,
        tipo_alimentacao: tipoAlimentacao || null,
        capacidade: capacidade ? parseInt(capacidade) : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lotes'] });
      toast.success('Lote criado!');
      setDialogOpen(false);
      setNome('');
      setTipoAlimentacao('');
      setCapacidade('');
    },
    onError: (error: any) => {
      toast.error('Erro ao criar lote', { description: error.message });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      toast.error('Informe o nome do lote');
      return;
    }
    createLoteMutation.mutate();
  };

  return (
    <AppLayout>
      <div className="container py-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Lotes</h1>
            <p className="text-muted-foreground">{lotes?.length || 0} lotes ativos</p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="hidden sm:flex">
                <Plus className="mr-2 h-4 w-4" />
                Novo Lote
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Lote</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome do Lote *</Label>
                  <Input id="nome" placeholder="Ex: Lote 1" value={nome} onChange={(e) => setNome(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Tipo de Alimentação</Label>
                  <Select value={tipoAlimentacao} onValueChange={setTipoAlimentacao}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {tiposAlimentacao.map((tipo) => (<SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="capacidade">Capacidade</Label>
                  <Input id="capacidade" type="number" min="1" placeholder="Ex: 50" value={capacidade} onChange={(e) => setCapacidade(e.target.value)} />
                </div>
                <div className="flex gap-3 pt-4">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                  <Button type="submit" className="flex-1" disabled={createLoteMutation.isPending}>
                    {createLoteMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Criando...</> : 'Criar'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (<Card key={i}><CardHeader><Skeleton className="h-6 w-32" /></CardHeader><CardContent><Skeleton className="h-4 w-24" /></CardContent></Card>))}
          </div>
        ) : lotes && lotes.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {lotes.map((lote) => (
              <Card key={lote.id} className="transition-shadow hover:shadow-md">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Package className="h-5 w-5 text-primary" />
                      {lote.nome}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      {lote.tipo_alimentacao && <Badge variant="secondary">{lote.tipo_alimentacao}</Badge>}
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => setDeleteModal({ open: true, lote, animais: lote.totalAnimais })}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>{lote.totalAnimais} animais ativos</span>
                    </div>
                    {lote.gmdMedio > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        <span>GMD Médio: {lote.gmdMedio} kg/dia</span>
                        {lote.gmdMedio >= 1.3 && <Badge variant="default">⭐</Badge>}
                      </div>
                    )}
                    {lote.capacidade && (
                      <div className="text-xs text-muted-foreground">
                        Ocupação: {lote.totalAnimais}/{lote.capacidade} ({Math.round((lote.totalAnimais / lote.capacidade) * 100)}%)
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Package className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-semibold">Nenhum lote cadastrado</h3>
              <Button onClick={() => setDialogOpen(true)}><Plus className="mr-2 h-4 w-4" />Criar Lote</Button>
            </CardContent>
          </Card>
        )}

        {deleteModal && (
          <DeleteLoteModal open={deleteModal.open} onOpenChange={(open) => !open && setDeleteModal(null)} lote={deleteModal.lote} animaisAtivos={deleteModal.animais} />
        )}

        <div className="fixed bottom-20 right-4 md:hidden">
          <Button size="lg" className="h-14 w-14 rounded-full shadow-lg" onClick={() => setDialogOpen(true)}><Plus className="h-6 w-6" /></Button>
        </div>
      </div>
    </AppLayout>
  );
}
