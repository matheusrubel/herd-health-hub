import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { GastoModal } from '@/components/modals/GastoModal';
import { toast } from 'sonner';
import { 
  Plus, 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  Wheat, 
  Syringe, 
  Users, 
  MoreHorizontal,
  ShoppingCart,
  Edit2,
  Trash2,
  Loader2,
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';

const tipoIcons: Record<string, React.ReactNode> = {
  'Aquisição': <ShoppingCart className="h-4 w-4" />,
  'Alimentação': <Wheat className="h-4 w-4" />,
  'Sanitário': <Syringe className="h-4 w-4" />,
  'Mão de Obra': <Users className="h-4 w-4" />,
  'Outros': <MoreHorizontal className="h-4 w-4" />,
};

const COLORS = [
  'hsl(152, 69%, 31%)', // verde
  'hsl(239, 84%, 67%)', // indigo
  'hsl(38, 92%, 50%)',  // amarelo
  'hsl(0, 84%, 60%)',   // vermelho
  'hsl(270, 60%, 50%)', // roxo
];

interface Gasto {
  id: string;
  data: string;
  tipo: string;
  valor: number;
  descricao: string;
  aplicacao: string | null;
  lote_id: string | null;
  animal_id: string | null;
  lotes: { nome: string } | null;
  animais: { numero_brinco: string } | null;
}

export default function Financeiro() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedGasto, setSelectedGasto] = useState<Gasto | null>(null);
  const [gastoToDelete, setGastoToDelete] = useState<string | null>(null);

  // Fetch gastos
  const { data: gastos, isLoading: gastosLoading } = useQuery({
    queryKey: ['gastos', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gastos')
        .select(`
          *,
          lotes(nome),
          animais(numero_brinco)
        `)
        .order('data', { ascending: false });

      if (error) throw error;
      return data as Gasto[];
    },
    enabled: !!user,
  });

  // Fetch stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['financeiro-stats', user?.id],
    queryFn: async () => {
      // Gastos
      const { data: gastosData, error } = await supabase
        .from('gastos')
        .select('tipo, valor, data');

      if (error) throw error;

      // Aquisições dos animais
      const { data: animais } = await supabase
        .from('animais')
        .select('valor_aquisicao')
        .eq('ativo', true);

      const totalAquisicao = animais?.reduce((sum, a) => sum + Number(a.valor_aquisicao || 0), 0) || 0;

      // Agrupar por tipo
      const porTipo: Record<string, number> = {
        'Aquisição': totalAquisicao,
      };

      const hoje = new Date();
      const dias30Atras = subDays(hoje, 30);
      let total30Dias = 0;
      let totalAnterior = 0;

      gastosData?.forEach(g => {
        if (g.tipo !== 'Aquisição') {
          porTipo[g.tipo] = (porTipo[g.tipo] || 0) + Number(g.valor);
        }

        const dataGasto = new Date(g.data);
        if (dataGasto >= dias30Atras) {
          total30Dias += Number(g.valor);
        } else {
          totalAnterior += Number(g.valor);
        }
      });

      const totalGastos = Object.values(porTipo).reduce((sum, val) => sum + val, 0);

      const chartData = Object.entries(porTipo)
        .filter(([_, val]) => val > 0)
        .map(([name, value]) => ({ name, value }));

      return {
        total: totalGastos,
        total30Dias,
        totalAnterior,
        porTipo,
        chartData,
      };
    },
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('gastos')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gastos'] });
      queryClient.invalidateQueries({ queryKey: ['financeiro-stats'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['gastos-por-tipo'] });
      toast.success('Gasto excluído com sucesso!');
      setDeleteDialogOpen(false);
      setGastoToDelete(null);
    },
    onError: (error: any) => {
      console.error('Erro ao excluir gasto:', error);
      toast.error('Erro ao excluir gasto', {
        description: error.message,
      });
    },
  });

  const handleEdit = (gasto: Gasto) => {
    setSelectedGasto(gasto);
    setModalOpen(true);
  };

  const handleDelete = (id: string) => {
    setGastoToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleNewGasto = () => {
    setSelectedGasto(null);
    setModalOpen(true);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getAplicacaoLabel = (gasto: Gasto) => {
    if (gasto.aplicacao === 'lote' && gasto.lotes) {
      return `Lote: ${gasto.lotes.nome}`;
    }
    if (gasto.aplicacao === 'animal' && gasto.animais) {
      return `#${gasto.animais.numero_brinco}`;
    }
    return 'Todos';
  };

  const variacao30Dias = stats ? ((stats.total30Dias - stats.totalAnterior) / (stats.totalAnterior || 1)) * 100 : 0;

  return (
    <AppLayout>
      <div className="container py-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Financeiro</h1>
            <p className="text-muted-foreground">Controle de gastos e investimentos</p>
          </div>

          <Button onClick={handleNewGasto} className="hidden sm:flex">
            <Plus className="mr-2 h-4 w-4" />
            Novo Gasto
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Total Investido */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Investido
              </CardTitle>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-10 w-48" />
              ) : (
                <p className="text-3xl font-bold text-primary">
                  {formatCurrency(stats?.total || 0)}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Últimos 30 dias */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Últimos 30 dias
              </CardTitle>
              {variacao30Dias >= 0 ? (
                <TrendingUp className="h-4 w-4 text-destructive" />
              ) : (
                <TrendingDown className="h-4 w-4 text-success" />
              )}
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-10 w-48" />
              ) : (
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold">
                    {formatCurrency(stats?.total30Dias || 0)}
                  </p>
                  <Badge variant={variacao30Dias >= 0 ? 'destructive' : 'default'}>
                    {variacao30Dias >= 0 ? '+' : ''}{variacao30Dias.toFixed(0)}%
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Registros */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total de Registros
              </CardTitle>
            </CardHeader>
            <CardContent>
              {gastosLoading ? (
                <Skeleton className="h-10 w-20" />
              ) : (
                <p className="text-2xl font-bold">
                  {gastos?.length || 0}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Chart */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Distribuição de Custos</CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : stats?.chartData && stats.chartData.length > 0 ? (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.chartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {stats.chartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center text-muted-foreground">
                <p>Nenhum gasto registrado</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabela de gastos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Histórico de Gastos</CardTitle>
          </CardHeader>
          <CardContent>
            {gastosLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : gastos && gastos.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="hidden sm:table-cell">Descrição</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead className="hidden md:table-cell">Aplicação</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gastos.map((gasto) => (
                      <TableRow key={gasto.id}>
                        <TableCell>
                          {format(new Date(gasto.data + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {tipoIcons[gasto.tipo]}
                            <span className="hidden sm:inline">{gasto.tipo}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden max-w-xs truncate sm:table-cell">
                          {gasto.descricao}
                        </TableCell>
                        <TableCell className="font-medium text-primary">
                          {formatCurrency(Number(gasto.valor))}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge variant="outline">
                            {getAplicacaoLabel(gasto)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(gasto)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(gasto.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex h-32 items-center justify-center text-muted-foreground">
                <p>Nenhum gasto registrado. Clique em "Novo Gasto" para começar.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Mobile FAB */}
        <div className="fixed bottom-20 right-4 md:hidden">
          <Button
            size="lg"
            className="h-14 w-14 rounded-full shadow-lg"
            onClick={handleNewGasto}
          >
            <Plus className="h-6 w-6" />
          </Button>
        </div>

        {/* Gasto Modal */}
        <GastoModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          editData={selectedGasto ? {
            id: selectedGasto.id,
            data: selectedGasto.data,
            tipo: selectedGasto.tipo,
            valor: Number(selectedGasto.valor),
            descricao: selectedGasto.descricao,
            aplicacao: selectedGasto.aplicacao || 'todos',
            lote_id: selectedGasto.lote_id || undefined,
            animal_id: selectedGasto.animal_id || undefined,
          } : undefined}
        />

        {/* Delete Confirmation */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir este gasto? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => gastoToDelete && deleteMutation.mutate(gastoToDelete)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Excluir'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
