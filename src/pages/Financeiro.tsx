import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { GastoModal } from '@/components/modals/GastoModal';
import { toast } from 'sonner';
import {
  DollarSign,
  Plus,
  Trash2,
  ShoppingCart,
  Receipt,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';

const COLORS = ['#10B981', '#6366F1', '#F59E0B', '#EF4444', '#8B5CF6'];

const Financeiro = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const queryClient = useQueryClient();

  // ════════════════════════════════════════
  // 1. BUSCAR AQUISIÇÕES (DOS ANIMAIS)
  // ════════════════════════════════════════
  const { data: aquisicoes, isLoading: aquisicoesLoading } = useQuery({
    queryKey: ['financeiro-aquisicoes'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('animais')
        .select('id, numero_brinco, valor_aquisicao, data_entrada')
        .eq('user_id', user.id)
        .eq('ativo', true)
        .order('data_entrada', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // ════════════════════════════════════════
  // 2. BUSCAR GASTOS OPERACIONAIS
  // ════════════════════════════════════════
  const { data: gastos, isLoading: gastosLoading } = useQuery({
    queryKey: ['financeiro-gastos'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('gastos')
        .select(`
          *,
          lotes(nome),
          animais(numero_brinco)
        `)
        .eq('user_id', user.id)
        .neq('tipo', 'Aquisição')
        .order('data', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // ════════════════════════════════════════
  // 3. CALCULAR TOTAIS
  // ════════════════════════════════════════
  const totalAquisicoes = aquisicoes?.reduce((acc, a) => acc + Number(a.valor_aquisicao || 0), 0) || 0;
  const totalGastos = gastos?.reduce((acc, g) => acc + Number(g.valor || 0), 0) || 0;
  const totalGeral = totalAquisicoes + totalGastos;

  // ════════════════════════════════════════
  // 4. DISTRIBUIÇÃO PARA GRÁFICO
  // ════════════════════════════════════════
  const distribuicao = () => {
    const dist: Record<string, number> = {};

    // Adicionar aquisições
    if (totalAquisicoes > 0) {
      dist['Aquisição'] = totalAquisicoes;
    }

    // Adicionar gastos por tipo
    gastos?.forEach((g: any) => {
      dist[g.tipo] = (dist[g.tipo] || 0) + Number(g.valor);
    });

    return Object.entries(dist).map(([name, value]) => ({ name, value }));
  };

  // ════════════════════════════════════════
  // 5. DELETAR GASTO
  // ════════════════════════════════════════
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('gastos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financeiro-gastos'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['custos-distribuicao'] });
      toast.success('Gasto excluído com sucesso!');
    },
    onError: (error: any) => {
      toast.error('Erro ao excluir gasto: ' + error.message);
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value || 0);
  };

  const formatDate = (dateStr: string) => {
    // Parse seguro de data para evitar problemas de timezone
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('pt-BR');
  };

  const getAplicacaoText = (gasto: any) => {
    if (gasto.aplicacao === 'todos') return 'Todos';
    if (gasto.aplicacao === 'lote') return `Lote: ${gasto.lotes?.nome || '-'}`;
    if (gasto.aplicacao === 'animal') return `#${gasto.animais?.numero_brinco || '-'}`;
    return '-';
  };

  const isLoading = aquisicoesLoading || gastosLoading;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="container py-6">
          <Skeleton className="h-8 w-48 mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container py-6 space-y-6">
        {/* ════════════════════════════════════════ */}
        {/* HEADER */}
        {/* ════════════════════════════════════════ */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Financeiro</h1>
            <p className="text-muted-foreground">Controle de gastos e investimentos</p>
          </div>
          <Button onClick={() => setModalOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Gasto
          </Button>
        </div>

        {/* ════════════════════════════════════════ */}
        {/* CARDS DE RESUMO */}
        {/* ════════════════════════════════════════ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Investimento Total</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(totalGeral)}</div>
              <p className="text-xs text-muted-foreground">Aquisições + Operacional</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Aquisições</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalAquisicoes)}</div>
              <p className="text-xs text-muted-foreground">{aquisicoes?.length || 0} animais</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gastos Operacionais</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalGastos)}</div>
              <p className="text-xs text-muted-foreground">{gastos?.length || 0} registros</p>
            </CardContent>
          </Card>
        </div>

        {/* ════════════════════════════════════════ */}
        {/* GRÁFICO DE DISTRIBUIÇÃO */}
        {/* ════════════════════════════════════════ */}
        {distribuicao().length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Distribuição de Custos</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={distribuicao()}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {distribuicao().map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* ════════════════════════════════════════ */}
        {/* SEÇÃO 1: AQUISIÇÕES DE ANIMAIS */}
        {/* ════════════════════════════════════════ */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-green-600" />
                <CardTitle>💰 Aquisições de Animais</CardTitle>
              </div>
              <div className="text-sm text-muted-foreground">
                Total: <span className="font-bold text-green-600">{formatCurrency(totalAquisicoes)}</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Valores de aquisição cadastrados no registro de cada animal
            </p>
          </CardHeader>
          <CardContent>
            {aquisicoes && aquisicoes.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data Entrada</TableHead>
                      <TableHead>Animal</TableHead>
                      <TableHead className="text-right">Valor Aquisição</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {aquisicoes.map((animal: any) => (
                      <TableRow key={animal.id}>
                        <TableCell>{formatDate(animal.data_entrada)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full" />
                            Animal #{animal.numero_brinco}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium text-green-600">
                          {formatCurrency(animal.valor_aquisicao)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Nenhuma aquisição registrada</p>
                <p className="text-sm">Cadastre animais com valor de aquisição</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ════════════════════════════════════════ */}
        {/* SEÇÃO 2: GASTOS OPERACIONAIS */}
        {/* ════════════════════════════════════════ */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-blue-600" />
                <CardTitle>📋 Gastos Operacionais</CardTitle>
              </div>
              <div className="text-sm text-muted-foreground">
                Total: <span className="font-bold text-blue-600">{formatCurrency(totalGastos)}</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Gastos operacionais (alimentação, sanitário, mão de obra, etc)
            </p>
          </CardHeader>
          <CardContent>
            {gastos && gastos.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Aplicação</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gastos.map((gasto: any) => (
                      <TableRow key={gasto.id}>
                        <TableCell>{formatDate(gasto.data)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {gasto.tipo === 'Alimentação' && '🌾'}
                            {gasto.tipo === 'Sanitário' && '💉'}
                            {gasto.tipo === 'Mão de Obra' && '👷'}
                            {gasto.tipo === 'Outros' && '📦'}
                            <span>{gasto.tipo}</span>
                          </div>
                        </TableCell>
                        <TableCell>{gasto.descricao}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(gasto.valor)}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {getAplicacaoText(gasto)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (window.confirm('Deseja excluir este gasto?')) {
                                deleteMutation.mutate(gasto.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Receipt className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Nenhum gasto operacional registrado</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setModalOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Cadastrar Primeiro Gasto
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ════════════════════════════════════════ */}
        {/* CARD DE RESUMO TOTAL */}
        {/* ════════════════════════════════════════ */}
        {(totalAquisicoes > 0 || totalGastos > 0) && (
          <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center">
                    <DollarSign className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Investimento Total</p>
                    <h3 className="text-3xl font-bold text-green-700">
                      {formatCurrency(totalGeral)}
                    </h3>
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <div className="flex items-center gap-2 justify-end">
                    <ShoppingCart className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Aquisições:</span>
                    <span className="font-semibold">{formatCurrency(totalAquisicoes)}</span>
                  </div>
                  <div className="flex items-center gap-2 justify-end">
                    <Receipt className="h-4 w-4 text-blue-600" />
                    <span className="text-sm">Operacional:</span>
                    <span className="font-semibold">{formatCurrency(totalGastos)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Modal de Gastos */}
        <GastoModal open={modalOpen} onOpenChange={setModalOpen} />
      </div>
    </AppLayout>
  );
};

export default Financeiro;
