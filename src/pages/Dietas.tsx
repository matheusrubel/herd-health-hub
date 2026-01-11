import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Plus, Wheat, Loader2, Package } from 'lucide-react';

const tiposDieta = [
  'Confinado',
  'Pasto',
  'Semi-confinado',
];

export default function Dietas() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [nome, setNome] = useState('');
  const [consumoDiario, setConsumoDiario] = useState('');
  const [custoPorKg, setCustoPorKg] = useState('');
  const [tipo, setTipo] = useState('');
  const [composicao, setComposicao] = useState('');

  const { data: dietas, isLoading } = useQuery({
    queryKey: ['dietas', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dietas')
        .select('*')
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch lotes usando cada dieta
  const { data: lotesUsandoDietas } = useQuery({
    queryKey: ['lotes-por-dieta', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lotes')
        .select('id, dieta_id')
        .eq('ativo', true);
      if (error) throw error;

      const count: Record<string, number> = {};
      data?.forEach(l => {
        if (l.dieta_id) {
          count[l.dieta_id] = (count[l.dieta_id] || 0) + 1;
        }
      });
      return count;
    },
    enabled: !!user,
  });

  const createDietaMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('dietas')
        .insert({
          user_id: user.id,
          nome,
          consumo_diario_kg: parseFloat(consumoDiario),
          custo_por_kg: custoPorKg ? parseFloat(custoPorKg) : null,
          tipo: tipo || null,
          composicao: composicao || null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dietas'] });
      toast.success('Dieta criada!');
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error('Erro ao criar dieta', {
        description: error.message,
      });
    },
  });

  const resetForm = () => {
    setNome('');
    setConsumoDiario('');
    setCustoPorKg('');
    setTipo('');
    setComposicao('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      toast.error('Informe o nome');
      return;
    }
    if (!consumoDiario || parseFloat(consumoDiario) <= 0) {
      toast.error('Informe o consumo diário');
      return;
    }
    createDietaMutation.mutate();
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <AppLayout>
      <div className="container py-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Dietas</h1>
            <p className="text-muted-foreground">Gestão de alimentação</p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="hidden sm:flex">
                <Plus className="mr-2 h-4 w-4" />
                Nova Dieta
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Dieta</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome *</Label>
                  <Input
                    id="nome"
                    placeholder="Ex: Alto Grão"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="consumo">Consumo/dia (kg) *</Label>
                  <Input
                    id="consumo"
                    type="number"
                    step="0.01"
                    min="0.1"
                    placeholder="Ex: 8.5"
                    value={consumoDiario}
                    onChange={(e) => setConsumoDiario(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="custo">Custo/kg (R$)</Label>
                  <Input
                    id="custo"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Ex: 1.50"
                    value={custoPorKg}
                    onChange={(e) => setCustoPorKg(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo</Label>
                  <Select value={tipo} onValueChange={setTipo}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {tiposDieta.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="composicao">Composição</Label>
                  <Textarea
                    id="composicao"
                    placeholder="Ex: Milho 60%, Soja 20%, Núcleo 20%"
                    value={composicao}
                    onChange={(e) => setComposicao(e.target.value)}
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
                    disabled={createDietaMutation.isPending}
                  >
                    {createDietaMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Criando...
                      </>
                    ) : (
                      'Criar'
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Lista de Dietas */}
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-32" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="mb-2 h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : dietas && dietas.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {dietas.map((dieta) => {
              const custoDiario = Number(dieta.consumo_diario_kg) * Number(dieta.custo_por_kg || 0);
              const lotesUsando = lotesUsandoDietas?.[dieta.id] || 0;

              return (
                <Card key={dieta.id} className="transition-shadow hover:shadow-md">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Wheat className="h-5 w-5 text-primary" />
                        {dieta.nome}
                      </CardTitle>
                      {dieta.tipo && (
                        <Badge variant="secondary">{dieta.tipo}</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="text-sm">
                      <span className="text-muted-foreground">Consumo: </span>
                      <span className="font-medium">{Number(dieta.consumo_diario_kg)} kg/dia</span>
                    </div>

                    {dieta.custo_por_kg && (
                      <>
                        <div className="text-sm">
                          <span className="text-muted-foreground">Custo: </span>
                          <span className="font-medium">{formatCurrency(Number(dieta.custo_por_kg))}/kg</span>
                        </div>
                        <div className="text-sm">
                          <span className="text-muted-foreground">Custo diário: </span>
                          <span className="font-semibold text-primary">{formatCurrency(custoDiario)}</span>
                        </div>
                      </>
                    )}

                    {dieta.composicao && (
                      <p className="text-xs text-muted-foreground">{dieta.composicao}</p>
                    )}

                    <div className="flex items-center gap-1 pt-2 text-xs text-muted-foreground">
                      <Package className="h-3 w-3" />
                      <span>{lotesUsando} {lotesUsando === 1 ? 'lote usando' : 'lotes usando'}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Wheat className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-semibold">Nenhuma dieta cadastrada</h3>
              <p className="mb-4 text-center text-sm text-muted-foreground">
                Crie dietas para gerenciar a alimentação dos lotes
              </p>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Criar Dieta
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Mobile FAB */}
        <div className="fixed bottom-20 right-4 md:hidden">
          <Button
            size="lg"
            className="h-14 w-14 rounded-full shadow-lg"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="h-6 w-6" />
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
