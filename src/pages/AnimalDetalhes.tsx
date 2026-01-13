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
  Edit,
  Trash2,
  ArrowRightLeft,
  Loader2,
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
          lotes(id, nome),
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
        .select('*')
        .eq('animal_id', id)
        .order('data', { ascending: true })
        .order('created_at', { ascending: true });
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
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch gastos do animal
  const { data: gastos } = useQuery({
    queryKey: ['gastos-animal', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gastos')
        .select('*')
        .eq('animal_id', id)
        .order('data', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!user,
  });

  // Fetch protocolos do animal
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

  // Calcular métricas
  const calcularMetricas = () => {
    if (!animal) return null;

    const ultimaPesagem = pesagens?.[pesagens.length - 1];
    const pesoAtual = ultimaPesagem ? Number(ultimaPesagem.peso) : Number(animal.peso_entrada);
    const ganhoTotal = pesoAtual - Number(animal.peso_entrada);
    const diasConfinamento = daysBetweenDateOnly(animal.data_entrada);
    const gmd = ganhoTotal / diasConfinamento;

    // Custos
    const custoAquisicao = Number(animal.valor_aquisicao || 0);
    const custosGastos = gastos?.reduce((sum, g) => sum + Number(g.valor), 0) || 0;
    const custoTotal = custoAquisicao + custosGastos;
    const custoKg = ganhoTotal > 0 ? custoTotal / ganhoTotal : 0;

    return {
      pesoAtual,
      ganhoTotal,
      diasConfinamento,
      gmd: Number(gmd.toFixed(2)),
      custoTotal,
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

      // Atualizar animal
      const { error: updateError } = await supabase
        .from('animais')
        .update({ lote_id: novoLoteId })
        .eq('id', animal.id);

      if (updateError) throw updateError;

      // Registrar movimentação
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
      queryClient.invalidateQueries({ queryKey: ['animais'] });
      toast.success('Animal movido com sucesso!');
      setMoverLoteOpen(false);
    },
    onError: (error: any) => {
      toast.error('Erro ao mover animal', {
        description: error.message,
      });
    },
  });

  // Mutation para inativar animal
  const deleteAnimalMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('animais')
        .update({ ativo: false })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['animais'] });
      toast.success('Animal removido com sucesso!');
      navigate('/animais');
    },
    onError: (error: any) => {
      toast.error('Erro ao remover animal', {
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

  // Dados do gráfico
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
              <div className="flex items-center justify-center gap-1">
                <p className="text-2xl font-bold">{metricas?.gmd || 0}</p>
                <Badge variant={metricas ? getGMDBadge(metricas.gmd).variant : 'outline'} className="text-xs">
                  {metricas && getGMDBadge(metricas.gmd).label}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">GMD kg/dia</p>
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
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="resumo">Resumo</TabsTrigger>
            <TabsTrigger value="pesagens">Pesagens</TabsTrigger>
            <TabsTrigger value="gastos">Gastos</TabsTrigger>
            <TabsTrigger value="sanitario">Sanitário</TabsTrigger>
          </TabsList>

          {/* Resumo */}
          <TabsContent value="resumo" className="space-y-4">
            {/* Gráfico */}
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

            {/* Dados básicos */}
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
                        <div key={p.id} className="flex items-center justify-between rounded-lg border p-3">
                          <div>
                            <p className="font-medium">{Number(p.peso)}kg</p>
                            <p className="text-sm text-muted-foreground">
                              {format(parseDateOnly(p.data), 'dd/MM/yyyy')}
                            </p>
                          </div>
                          {diff !== 0 && (
                            <Badge variant={diff > 0 ? 'default' : 'destructive'}>
                              {diff > 0 ? '+' : ''}{diff}kg
                            </Badge>
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
                {gastos && gastos.length > 0 ? (
                  <div className="space-y-2">
                    {gastos.map((g) => (
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
                  </div>
                ) : (
                  <p className="py-8 text-center text-muted-foreground">
                    Nenhum gasto registrado
                  </p>
                )}
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
              <AlertDialogTitle>Remover Animal?</AlertDialogTitle>
              <AlertDialogDescription>
                O animal #{animal.numero_brinco} será marcado como inativo. Seus dados históricos serão mantidos para relatórios.
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
                    Removendo...
                  </>
                ) : (
                  'Remover'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
