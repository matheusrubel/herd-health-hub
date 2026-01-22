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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Beef,
  Scale,
  TrendingUp,
  Calendar,
  DollarSign,
  Target,
  Package,
  Trash2,
  ArrowRightLeft,
  Loader2,
  History,
  Utensils,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { daysBetweenDateOnly, parseDateOnly } from '@/lib/date';
import { PesagemModal } from '@/components/modals/PesagemModal';

export default function AnimalDetalhes() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [pesagemModalOpen, setPesagemModalOpen] = useState(false);
  const [moverLoteOpen, setMoverLoteOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [novoLoteId, setNovoLoteId] = useState('');
  const [dataMudanca, setDataMudanca] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [motivoMudanca, setMotivoMudanca] = useState('');

  // Fetch animal
  const { data: animal, isLoading: animalLoading } = useQuery({
    queryKey: ['animal', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('animais')
        .select(`
          *,
          lotes(id, nome, dieta_id, dietas(id, nome, consumo_diario_kg, custo_por_kg, tipo)),
          responsaveis(id, nome)
        `)
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!user,
  });

  // Fetch pesagens
  const { data: pesagens } = useQuery({
    queryKey: ['pesagens-animal', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pesagens')
        .select('*, responsaveis(nome)')
        .eq('animal_id', id)
        .order('data', { ascending: true })
        .order('created_at', { ascending: true});
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!user,
  });

  // Fetch lotes para mover
  const { data: lotes } = useQuery({
    queryKey: ['lotes', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lotes')
        .select('id, nome')
        .order('nome');
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // ════════════════════════════════════════════════
  // FETCH GASTOS COMPLETO: DIRETOS + LOTE + RATEADOS
  // ════════════════════════════════════════════════
  const { data: gastosCompletos } = useQuery({
    queryKey: ['gastos-completos-animal', id, animal?.lote_id],
    queryFn: async () => {
      if (!animal || !user) return { diretos: [], lote: [], rateioValor: 0 };

      // 1. Gastos diretos do animal
      const { data: gastosDiretos } = await supabase
        .from('gastos')
        .select('*')
        .eq('animal_id', id)
        .order('data', { ascending: false });

      // 2. Gastos do lote (se animal tem lote)
      let gastosLote: any[] = [];
      if (animal.lote_id) {
        const { data } = await supabase
          .from('gastos')
          .select('*, lotes(nome)')
          .eq('aplicacao', 'lote')
          .eq('lote_id', animal.lote_id)
          .order('data', { ascending: false });
        gastosLote = data || [];
      }

      // 3. Gastos rateados (aplicacao = 'todos')
      const { data: gastosTodos } = await supabase
        .from('gastos')
        .select('valor')
        .eq('user_id', user.id)
        .eq('aplicacao', 'todos');
      
      const totalGastosTodos = gastosTodos?.reduce((sum, g) => sum + Number(g.valor), 0) || 0;
      
      const { count: totalAnimais } = await supabase
        .from('animais')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      
      const rateioValor = totalAnimais && totalAnimais > 0 ? totalGastosTodos / totalAnimais : 0;

      return {
        diretos: gastosDiretos || [],
        lote: gastosLote,
        rateioValor: Number(rateioValor.toFixed(2)),
      };
    },
    enabled: !!id && !!user && !!animal,
  });

  // ════════════════════════════════════════════════
  // FETCH MOVIMENTAÇÕES DE LOTE
  // ════════════════════════════════════════════════
  const { data: movimentacoes } = useQuery({
    queryKey: ['movimentacoes-animal', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('movimentacoes_lotes')
        .select(`
          *,
          lote_origem:lotes!movimentacoes_lotes_lote_origem_id_fkey(nome),
          lote_destino:lotes!movimentacoes_lotes_lote_destino_id_fkey(nome)
        `)
        .eq('animal_id', id)
        .order('data', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!user,
  });

  // Fetch protocolos
  const { data: protocolos } = useQuery({
    queryKey: ['protocolos-animal', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('protocolos_sanitarios')
        .select('*')
        .eq('animal_id', id)
        .order('data', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!user,
  });

  // ════════════════════════════════════════════════
  // CÁLCULO DE MÉTRICAS
  // ════════════════════════════════════════════════
  const calcularMetricas = () => {
    if (!animal || !gastosCompletos) return null;

    const ultimaPesagem = pesagens?.[pesagens.length - 1];
    const pesoAtual = ultimaPesagem ? Number(ultimaPesagem.peso) : Number(animal.peso_entrada);
    const ganhoTotal = pesoAtual - Number(animal.peso_entrada);
    const diasConfinamento = Math.max(1, daysBetweenDateOnly(animal.data_entrada));
    const gmd = ganhoTotal / diasConfinamento;

    // Custos
    const custoAquisicao = Number(animal.valor_aquisicao || 0);
    const custosGastosDiretos = gastosCompletos.diretos.reduce((sum, g) => sum + Number(g.valor), 0);
    const custosGastosLote = gastosCompletos.lote.reduce((sum, g) => sum + Number(g.valor), 0);
    const custosGastosRateados = gastosCompletos.rateioValor;
    
    const custoTotal = custoAquisicao + custosGastosDiretos + custosGastosLote + custosGastosRateados;
    const custoKg = ganhoTotal > 0 ? custoTotal / ganhoTotal : 0;

    return {
      pesoAtual: Number(pesoAtual.toFixed(2)),
      ganhoTotal: Number(ganhoTotal.toFixed(2)),
      diasConfinamento,
      gmd: Number(gmd.toFixed(3)),
      custoTotal: Number(custoTotal.toFixed(2)),
      custoKg: Number(custoKg.toFixed(2)),
      dataUltimaPesagem: ultimaPesagem?.data,
    };
  };

  const metricas = calcularMetricas();

  const getGMDBadge = (gmd: number) => {
    if (gmd >= 1.3) return { label: '⭐ Excelente', variant: 'default' as const };
    if (gmd >= 0.8) return { label: 'Bom', variant: 'secondary' as const };
    if (gmd >= 0.5) return { label: '⚠️ Regular', variant: 'outline' as const };
    return { label: '🔴 Atenção', variant: 'destructive' as const };
  };

  // Mutation para mover lote
  const moverLoteMutation = useMutation({
    mutationFn: async () => {
      if (!user || !animal) throw new Error('Erro');

      const { error: updateError } = await supabase
        .from('animais')
        .update({ lote_id: novoLoteId })
        .eq('id', animal.id);

      if (updateError) throw updateError;

      const { error: movError } = await supabase
        .from('movimentacoes_lotes')
        .insert({
          user_id: user.id,
          animal_id: animal.id,
          lote_origem_id: animal.lote_id,
          lote_destino_id: novoLoteId,
          data: dataMudanca,
          motivo: motivoMudanca || null,
        });

      if (movError) throw movError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['animal', id] });
      queryClient.invalidateQueries({ queryKey: ['movimentacoes-animal', id] });
      queryClient.invalidateQueries({ queryKey: ['gastos-completos-animal', id] });
      queryClient.invalidateQueries({ queryKey: ['animais'] });
      toast.success('Animal movido com sucesso!');
      setMoverLoteOpen(false);
      setNovoLoteId('');
      setMotivoMudanca('');
    },
    onError: (error: any) => {
      toast.error('Erro ao mover animal', {
        description: error.message,
      });
    },
  });

  // Mutation para excluir animal
  const deleteAnimalMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('ID do animal não encontrado');

      const { error: pesagensError } = await supabase
        .from('pesagens')
        .delete()
        .eq('animal_id', id);
      if (pesagensError) throw pesagensError;

      const { error: gastosError } = await supabase
        .from('gastos')
        .delete()
        .eq('animal_id', id);
      if (gastosError) throw gastosError;

      const { error: protocolosError } = await supabase
        .from('protocolos_sanitarios')
        .delete()
        .eq('animal_id', id);
      if (protocolosError) throw protocolosError;

      const { error: movError } = await supabase
        .from('movimentacoes_lotes')
        .delete()
        .eq('animal_id', id);
      if (movError) throw movError;

      const { error: animalError } = await supabase
        .from('animais')
        .delete()
        .eq('id', id);
      if (animalError) throw animalError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['animais'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Animal excluído com sucesso!');
      navigate('/animais');
    },
    onError: (error: any) => {
      toast.error('Erro ao excluir animal', {
        description: error.message,
      });
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const chartData =
    pesagens?.map((p) => ({
      data: format(parseDateOnly(p.data), 'dd/MM', { locale: ptBR }),
      peso: Number(p.peso),
    })) || [];

  if (animalLoading) {
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

  if (!animal) {
    return (
      <AppLayout>
        <div className="container py-6">
          <p>Animal não encontrado</p>
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
                <Beef className="h-6 w-6 text-primary" />
                <h1 className="text-2xl font-bold">#{animal.numero_brinco}</h1>
                {metricas && metricas.gmd >= 1.3 && (
                  <Badge variant="default">⭐</Badge>
                )}
              </div>
              <p className="text-muted-foreground">
                {(animal.lotes as any)?.nome || 'Sem lote'} • {animal.raca || 'Raça não informada'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Métricas */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Card>
            <CardContent className="p-4 text-center">
              <Scale className="mx-auto mb-1 h-5 w-5 text-primary" />
              <p className="text-2xl font-bold">{metricas?.pesoAtual || 0}kg</p>
              <p className="text-xs text-muted-foreground">Peso Atual</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <TrendingUp className="mx-auto mb-1 h-5 w-5 text-primary" />
              <p className="text-2xl font-bold">+{metricas?.ganhoTotal || 0}kg</p>
              <p className="text-xs text-muted-foreground">Ganho Total</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <TrendingUp className="mx-auto mb-1 h-5 w-5 text-primary" />
              <div className="flex flex-col items-center gap-1">
                <p className="text-xl font-bold">{metricas?.gmd || 0} kg/dia</p>
                {metricas && (
                  <Badge variant={getGMDBadge(metricas.gmd).variant} className="text-xs">
                    {getGMDBadge(metricas.gmd).label}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">GMD</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <Calendar className="mx-auto mb-1 h-5 w-5 text-primary" />
              <p className="text-2xl font-bold">{metricas?.diasConfinamento || 0}</p>
              <p className="text-xs text-muted-foreground">Dias</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <DollarSign className="mx-auto mb-1 h-5 w-5 text-primary" />
              <p className="text-lg font-bold">{formatCurrency(metricas?.custoTotal || 0)}</p>
              <p className="text-xs text-muted-foreground">Custo Total</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <Target className="mx-auto mb-1 h-5 w-5 text-primary" />
              <p className="text-lg font-bold">{formatCurrency(metricas?.custoKg || 0)}</p>
              <p className="text-xs text-muted-foreground">Custo/kg</p>
            </CardContent>
          </Card>
        </div>

        {/* Ações Rápidas */}
        <div className="mb-6 flex flex-wrap gap-2">
          <Button onClick={() => setPesagemModalOpen(true)}>
            <Scale className="mr-2 h-4 w-4" />
            Registrar Pesagem
          </Button>
          <Button variant="outline" onClick={() => setMoverLoteOpen(true)}>
            <ArrowRightLeft className="mr-2 h-4 w-4" />
            Mover Lote
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="resumo" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="resumo">Resumo</TabsTrigger>
            <TabsTrigger value="pesagens">Pesagens</TabsTrigger>
            <TabsTrigger value="gastos">Gastos</TabsTrigger>
            <TabsTrigger value="sanitario">Sanitário</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>

          {/* Resumo */}
          <TabsContent value="resumo" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Evolução de Peso</CardTitle>
              </CardHeader>
              <CardContent>
                {chartData.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="data" />
                        <YAxis domain={['auto', 'auto']} />
                        <Tooltip formatter={(value) => [`${value}kg`, 'Peso']} />
                        <Line
                          type="monotone"
                          dataKey="peso"
                          stroke="hsl(152, 69%, 31%)"
                          strokeWidth={2}
                          dot={{ fill: 'hsl(152, 69%, 31%)' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="py-8 text-center text-muted-foreground">
                    Nenhuma pesagem registrada
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Informações</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Data de Entrada</p>
                  <p className="font-medium">{format(parseDateOnly(animal.data_entrada), 'dd/MM/yyyy')}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Peso de Entrada</p>
                  <p className="font-medium">{Number(animal.peso_entrada)}kg</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Valor Aquisição</p>
                  <p className="font-medium">{formatCurrency(Number(animal.valor_aquisicao || 0))}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Responsável</p>
                  <p className="font-medium">{(animal.responsaveis as any)?.nome || 'Não informado'}</p>
                </div>
                {animal.sexo && (
                  <div>
                    <p className="text-sm text-muted-foreground">Sexo</p>
                    <p className="font-medium">{animal.sexo}</p>
                  </div>
                )}
                {animal.idade_meses && (
                  <div>
                    <p className="text-sm text-muted-foreground">Idade na entrada</p>
                    <p className="font-medium">{animal.idade_meses} meses</p>
                  </div>
                )}
                {animal.observacoes && (
                  <div className="sm:col-span-2">
                    <p className="text-sm text-muted-foreground">Observações</p>
                    <p className="font-medium">{animal.observacoes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Seção de Dieta */}
            {(animal.lotes as any)?.dietas && (
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Utensils className="h-5 w-5 text-amber-600" />
                    Dieta do Lote
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const dieta = (animal.lotes as any).dietas;
                    const custoDiario = Number(dieta.consumo_diario_kg || 0) * Number(dieta.custo_por_kg || 0);
                    return (
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div>
                          <p className="text-sm text-muted-foreground">Nome</p>
                          <p className="font-medium">{dieta.nome}</p>
                          {dieta.tipo && <span className="text-xs text-muted-foreground">({dieta.tipo})</span>}
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Consumo/Dia</p>
                          <p className="font-medium">{dieta.consumo_diario_kg} kg</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Custo/Dia</p>
                          <p className="font-medium text-green-600">{formatCurrency(custoDiario)}</p>
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Pesagens */}
          <TabsContent value="pesagens">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Histórico de Pesagens</CardTitle>
                <Button size="sm" onClick={() => setPesagemModalOpen(true)}>
                  <Scale className="mr-2 h-4 w-4" />
                  Nova
                </Button>
              </CardHeader>
              <CardContent>
                {pesagens && pesagens.length > 0 ? (
                  <div className="space-y-2">
                    {[...pesagens].reverse().map((p, index) => {
                      const pesagemAnterior = pesagens[pesagens.length - 2 - index];
                      const diff = pesagemAnterior ? Number(p.peso) - Number(pesagemAnterior.peso) : 0;

                      return (
                        <div key={p.id} className="rounded-lg border p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <p className="font-medium">{Number(p.peso)}kg</p>
                              <p className="text-sm text-muted-foreground">
                                {format(parseDateOnly(p.data), 'dd/MM/yyyy')}
                                {(p.responsaveis as any)?.nome && ` • ${(p.responsaveis as any).nome}`}
                              </p>
                            </div>
                            {diff !== 0 && (
                              <Badge variant={diff > 0 ? 'default' : 'destructive'}>
                                {diff > 0 ? '+' : ''}{diff.toFixed(1)}kg
                              </Badge>
                            )}
                          </div>
                          {p.observacoes && (
                            <p className="text-sm text-muted-foreground italic mt-2">
                              💬 {p.observacoes}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="py-8 text-center text-muted-foreground">
                    Nenhuma pesagem registrada
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Gastos */}
          <TabsContent value="gastos">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Gastos do Animal</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Aquisição */}
                  <div className="flex items-center justify-between rounded-lg border p-3 bg-green-50">
                    <div>
                      <p className="font-medium">Valor de Aquisição</p>
                      <p className="text-sm text-muted-foreground">Cadastro do animal</p>
                    </div>
                    <p className="font-semibold text-green-700">{formatCurrency(Number(animal.valor_aquisicao || 0))}</p>
                  </div>

                  {/* Gastos Diretos */}
                  {gastosCompletos && gastosCompletos.diretos.length > 0 && (
                    <>
                      <p className="text-sm font-medium text-muted-foreground mt-4">Gastos Diretos:</p>
                      {gastosCompletos.diretos.map((g) => (
                        <div key={g.id} className="flex items-center justify-between rounded-lg border p-3">
                          <div>
                            <p className="font-medium">{g.descricao}</p>
                            <p className="text-sm text-muted-foreground">
                              {g.tipo} • {format(parseDateOnly(g.data), 'dd/MM/yyyy')}
                            </p>
                          </div>
                          <p className="font-semibold text-primary">{formatCurrency(Number(g.valor))}</p>
                        </div>
                      ))}
                    </>
                  )}

                  {/* Gastos do Lote */}
                  {gastosCompletos && gastosCompletos.lote.length > 0 && (
                    <>
                      <p className="text-sm font-medium text-muted-foreground mt-4">Gastos do Lote:</p>
                      {gastosCompletos.lote.map((g) => (
                        <div key={g.id} className="flex items-center justify-between rounded-lg border p-3 bg-purple-50">
                          <div>
                            <p className="font-medium">{g.descricao}</p>
                            <p className="text-sm text-muted-foreground">
                              {g.tipo} • {format(parseDateOnly(g.data), 'dd/MM/yyyy')}
                              <br />
                              Aplicado no {(g.lotes as any)?.nome || 'lote'}
                            </p>
                          </div>
                          <p className="font-semibold text-purple-700">{formatCurrency(Number(g.valor))}</p>
                        </div>
                      ))}
                    </>
                  )}

                  {/* Gastos Rateados */}
                  {gastosCompletos && gastosCompletos.rateioValor > 0 && (
                    <>
                      <p className="text-sm font-medium text-muted-foreground mt-4">Gastos Rateados:</p>
                      <div className="flex items-center justify-between rounded-lg border p-3 bg-blue-50">
                        <div>
                          <p className="font-medium">Gastos gerais (rateio)</p>
                          <p className="text-sm text-muted-foreground">Aplicação: Todos os animais</p>
                        </div>
                        <p className="font-semibold text-blue-700">{formatCurrency(gastosCompletos.rateioValor)}</p>
                      </div>
                    </>
                  )}

                  {/* Total */}
                  <div className="flex items-center justify-between rounded-lg border-2 border-primary p-3 bg-primary/5 mt-4">
                    <div>
                      <p className="font-bold">TOTAL INVESTIDO</p>
                      <p className="text-sm text-muted-foreground">Aquisição + Diretos + Lote + Rateados</p>
                    </div>
                    <p className="text-xl font-bold text-primary">{formatCurrency(metricas?.custoTotal || 0)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sanitário */}
          <TabsContent value="sanitario">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Protocolos Sanitários</CardTitle>
              </CardHeader>
              <CardContent>
                {protocolos && protocolos.length > 0 ? (
                  <div className="space-y-2">
                    {protocolos.map((p) => (
                      <div key={p.id} className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <p className="font-medium">{p.produto}</p>
                          <p className="text-sm text-muted-foreground">
                            {p.tipo} • {format(parseDateOnly(p.data), 'dd/MM/yyyy')}
                          </p>
                        </div>
                        {p.proxima_dose && (
                          <Badge variant="outline">
                            Próx: {format(parseDateOnly(p.proxima_dose), 'dd/MM')}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-8 text-center text-muted-foreground">
                    Nenhum protocolo registrado
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Histórico */}
          <TabsContent value="historico">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  <CardTitle className="text-lg">Histórico de Movimentações</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {movimentacoes && movimentacoes.length > 0 ? (
                  <div className="space-y-3">
                    {movimentacoes.map((m) => (
                      <div key={m.id} className="rounded-lg border p-4 bg-slate-50">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <ArrowRightLeft className="h-4 w-4 text-primary" />
                            <p className="font-medium">
                              {(m.lote_origem as any)?.nome || 'Sem lote'} → {(m.lote_destino as any)?.nome || 'Sem lote'}
                            </p>
                          </div>
                          <Badge variant="outline">
                            {format(parseDateOnly(m.data), 'dd/MM/yyyy')}
                          </Badge>
                        </div>
                        {m.motivo && (
                          <p className="text-sm text-muted-foreground mt-2">
                            💬 Motivo: {m.motivo}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-muted-foreground">
                    <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Nenhuma movimentação registrada</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Modal Pesagem */}
        <PesagemModal
          open={pesagemModalOpen}
          onOpenChange={setPesagemModalOpen}
          animalId={id}
        />

        {/* Modal Mover Lote */}
        <Dialog open={moverLoteOpen} onOpenChange={setMoverLoteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Mover Animal
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Animal: <strong>#{animal.numero_brinco}</strong></p>
                <p className="text-sm text-muted-foreground">Lote atual: <strong>{(animal.lotes as any)?.nome || 'Sem lote'}</strong></p>
              </div>

              <div className="space-y-2">
                <Label>Novo Lote *</Label>
                <Select value={novoLoteId} onValueChange={setNovoLoteId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {lotes?.filter(l => l.id !== animal.lote_id).map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Data da Mudança *</Label>
                <Input
                  type="date"
                  value={dataMudanca}
                  onChange={(e) => setDataMudanca(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Motivo (opcional)</Label>
                <Input
                  placeholder="Ex: Reorganização de lotes"
                  value={motivoMudanca}
                  onChange={(e) => setMotivoMudanca(e.target.value)}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" className="flex-1" onClick={() => setMoverLoteOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => moverLoteMutation.mutate()}
                  disabled={!novoLoteId || moverLoteMutation.isPending}
                >
                  {moverLoteMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Movendo...
                    </>
                  ) : (
                    'Confirmar'
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog Excluir */}
        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-destructive">⚠️ Excluir Animal Permanentemente?</AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <p>O animal <strong>#{animal.numero_brinco}</strong> será <strong>excluído permanentemente</strong> junto com:</p>
                <ul className="list-disc list-inside text-sm mt-2 space-y-1">
                  <li>Todas as pesagens registradas</li>
                  <li>Todos os gastos associados</li>
                  <li>Todos os protocolos sanitários</li>
                  <li>Histórico de movimentações</li>
                </ul>
                <p className="text-destructive font-medium mt-3">Esta ação não pode ser desfeita!</p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteAnimalMutation.mutate()}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteAnimalMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Excluindo...
                  </>
                ) : (
                  'Excluir Permanentemente'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
