import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Package,
  Users,
  TrendingUp,
  Utensils,
  DollarSign,
  Calendar,
  Edit,
  Loader2,
  Beef,
  Eye,
} from 'lucide-react';
import { format } from 'date-fns';
import { parseDateOnly } from '@/lib/date';

const tiposAlimentacao = ['Confinado', 'Milheto', 'Pasto', 'Tifton', 'Semi-Confinado'];

export default function LoteDetalhes() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  
  // Form states
  const [nome, setNome] = useState('');
  const [tipoAlimentacao, setTipoAlimentacao] = useState('');
  const [capacidade, setCapacidade] = useState('');
  const [dietaId, setDietaId] = useState('');

  // Fetch lote
  const { data: lote, isLoading } = useQuery({
    queryKey: ['lote-detalhes', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lotes')
        .select('*, dietas(id, nome, consumo_diario_kg, custo_por_kg, tipo, composicao)')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!user,
  });

  // Fetch animais do lote
  const { data: animais } = useQuery({
    queryKey: ['animais-lote', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('animais')
        .select('id, numero_brinco, peso_entrada, data_entrada, raca, sexo')
        .eq('lote_id', id)
        .eq('ativo', true)
        .order('numero_brinco');
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!user,
  });

  // Fetch pesagens para cálculo de GMD
  const { data: pesagensData } = useQuery({
    queryKey: ['pesagens-lote', id, animais],
    queryFn: async () => {
      if (!animais || animais.length === 0) return [];
      const animalIds = animais.map(a => a.id);
      const { data, error } = await supabase
        .from('pesagens')
        .select('animal_id, peso, data')
        .in('animal_id', animalIds)
        .order('data', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!animais && animais.length > 0,
  });

  // Fetch dietas para edição
  const { data: dietas } = useQuery({
    queryKey: ['dietas-ativas', user?.id],
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

  // Mutation para atualizar lote
  const updateLoteMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('ID do lote não encontrado');
      const { error } = await supabase
        .from('lotes')
        .update({
          nome,
          tipo_alimentacao: tipoAlimentacao || null,
          capacidade: capacidade ? parseInt(capacidade) : null,
          dieta_id: dietaId || null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lote-detalhes', id] });
      queryClient.invalidateQueries({ queryKey: ['lotes'] });
      toast.success('Lote atualizado!');
      setEditOpen(false);
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar lote', { description: error.message });
    },
  });

  const openEditModal = () => {
    if (lote) {
      setNome(lote.nome);
      setTipoAlimentacao(lote.tipo_alimentacao || '');
      setCapacidade(lote.capacidade?.toString() || '');
      setDietaId(lote.dieta_id || '');
      setEditOpen(true);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  };

  // Cálculos
  const calcularMetricas = () => {
    const totalAnimais = animais?.length || 0;
    
    // Calcular GMD médio
    let gmdTotal = 0;
    let pesoAtualTotal = 0;
    
    if (animais && pesagensData) {
      const ultimasPesagens = new Map();
      pesagensData.forEach(p => {
        if (!ultimasPesagens.has(p.animal_id)) {
          ultimasPesagens.set(p.animal_id, p);
        }
      });

      animais.forEach(animal => {
        const ultimaPesagem = ultimasPesagens.get(animal.id);
        const pesoAtual = ultimaPesagem ? Number(ultimaPesagem.peso) : Number(animal.peso_entrada);
        const ganho = pesoAtual - Number(animal.peso_entrada);
        const dias = Math.max(1, Math.floor((new Date().getTime() - new Date(animal.data_entrada).getTime()) / (1000 * 60 * 60 * 24)));
        gmdTotal += ganho / dias;
        pesoAtualTotal += pesoAtual;
      });
    }

    const gmdMedio = totalAnimais > 0 ? gmdTotal / totalAnimais : 0;
    const pesoMedio = totalAnimais > 0 ? pesoAtualTotal / totalAnimais : 0;

    // Calcular custos da dieta
    const dieta = lote?.dietas as any;
    const custoDietaPorAnimalDia = dieta 
      ? Number(dieta.consumo_diario_kg || 0) * Number(dieta.custo_por_kg || 0) 
      : 0;
    const custoTotalDia = custoDietaPorAnimalDia * totalAnimais;
    const custoTotalMes = custoTotalDia * 30;

    return {
      totalAnimais,
      gmdMedio: Number(gmdMedio.toFixed(2)),
      pesoMedio: Number(pesoMedio.toFixed(0)),
      custoDietaPorAnimalDia,
      custoTotalDia,
      custoTotalMes,
    };
  };

  const metricas = calcularMetricas();
  const dieta = lote?.dietas as any;

  // Preview da dieta selecionada para edição
  const dietaSelecionada = dietas?.find(d => d.id === dietaId);
  const previewCustoDiario = dietaSelecionada 
    ? Number(dietaSelecionada.consumo_diario_kg) * Number(dietaSelecionada.custo_por_kg || 0)
    : 0;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="container max-w-4xl py-6">
          <Skeleton className="mb-6 h-8 w-48" />
          <Skeleton className="mb-4 h-40 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!lote) {
    return (
      <AppLayout>
        <div className="container py-6">
          <p>Lote não encontrado</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container max-w-4xl py-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <Package className="h-6 w-6 text-primary" />
                <h1 className="text-2xl font-bold">{lote.nome}</h1>
                {lote.tipo_alimentacao && (
                  <Badge variant="secondary">{lote.tipo_alimentacao}</Badge>
                )}
              </div>
              <p className="text-muted-foreground">
                {metricas.totalAnimais} animais ativos
                {lote.capacidade && ` • Capacidade: ${lote.capacidade}`}
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={openEditModal}>
            <Edit className="mr-2 h-4 w-4" />
            Editar
          </Button>
        </div>

        {/* Métricas */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4 text-center">
              <Users className="mx-auto mb-1 h-5 w-5 text-primary" />
              <p className="text-2xl font-bold">{metricas.totalAnimais}</p>
              <p className="text-xs text-muted-foreground">Animais</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <TrendingUp className="mx-auto mb-1 h-5 w-5 text-primary" />
              <p className="text-2xl font-bold">{metricas.gmdMedio} kg/dia</p>
              <p className="text-xs text-muted-foreground">GMD Médio</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <DollarSign className="mx-auto mb-1 h-5 w-5 text-green-600" />
              <p className="text-xl font-bold text-green-600">{formatCurrency(metricas.custoTotalDia)}</p>
              <p className="text-xs text-muted-foreground">Custo/Dia</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <Calendar className="mx-auto mb-1 h-5 w-5 text-green-600" />
              <p className="text-xl font-bold text-green-600">{formatCurrency(metricas.custoTotalMes)}</p>
              <p className="text-xs text-muted-foreground">Custo/Mês</p>
            </CardContent>
          </Card>
        </div>

        {/* Dieta do Lote */}
        {dieta ? (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Utensils className="h-5 w-5 text-amber-600" />
                Dieta: {dieta.nome}
                {dieta.tipo && <Badge variant="outline">{dieta.tipo}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-sm text-muted-foreground">Consumo Diário</p>
                  <p className="font-medium">{dieta.consumo_diario_kg} kg/animal</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Custo por kg</p>
                  <p className="font-medium">{formatCurrency(Number(dieta.custo_por_kg || 0))}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Custo por Animal/Dia</p>
                  <p className="font-medium text-green-600">{formatCurrency(metricas.custoDietaPorAnimalDia)}</p>
                </div>
              </div>
              {dieta.composicao && (
                <div className="mt-4">
                  <p className="text-sm text-muted-foreground">Composição</p>
                  <p className="font-medium">{dieta.composicao}</p>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="mb-6 border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-8">
              <Utensils className="mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-muted-foreground">Nenhuma dieta vinculada a este lote</p>
              <Button variant="link" onClick={openEditModal}>
                Vincular uma dieta
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Animais do Lote */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Beef className="h-5 w-5 text-primary" />
              Animais do Lote ({metricas.totalAnimais})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {animais && animais.length > 0 ? (
              <div className="space-y-2">
                {animais.map((animal) => (
                  <div
                    key={animal.id}
                    className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 cursor-pointer"
                    onClick={() => navigate(`/animais/${animal.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <Beef className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium">#{animal.numero_brinco}</p>
                        <p className="text-sm text-muted-foreground">
                          {animal.raca || 'Sem raça'} • {animal.sexo || 'Sexo não informado'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{Number(animal.peso_entrada)}kg</Badge>
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-muted-foreground">
                Nenhum animal neste lote
              </p>
            )}
          </CardContent>
        </Card>

        {/* Modal de Edição */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Lote</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!nome.trim()) {
                  toast.error('Informe o nome do lote');
                  return;
                }
                updateLoteMutation.mutate();
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="nome">Nome do Lote *</Label>
                <Input
                  id="nome"
                  placeholder="Ex: Lote 1"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo de Alimentação</Label>
                <Select value={tipoAlimentacao} onValueChange={setTipoAlimentacao}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {tiposAlimentacao.map((tipo) => (
                      <SelectItem key={tipo} value={tipo}>
                        {tipo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Dieta</Label>
                <Select value={dietaId} onValueChange={setDietaId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma dieta..." />
                  </SelectTrigger>
                  <SelectContent>
                    {dietas?.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.nome} {d.tipo && `(${d.tipo})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {dietaSelecionada && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    Esta dieta custa{' '}
                    <span className="font-medium text-primary">
                      {formatCurrency(previewCustoDiario)}/dia
                    </span>{' '}
                    por animal
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="capacidade">Capacidade</Label>
                <Input
                  id="capacidade"
                  type="number"
                  min="1"
                  placeholder="Ex: 50"
                  value={capacidade}
                  onChange={(e) => setCapacidade(e.target.value)}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setEditOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1" disabled={updateLoteMutation.isPending}>
                  {updateLoteMutation.isPending ? (
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
      </div>
    </AppLayout>
  );
}
