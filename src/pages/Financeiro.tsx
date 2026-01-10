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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, DollarSign, TrendingUp, Loader2 } from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

const tiposGasto = [
  'Alimentação',
  'Sanitário',
  'Mão de Obra',
  'Outros',
];

const COLORS = ['hsl(152, 69%, 31%)', 'hsl(239, 84%, 67%)', 'hsl(38, 92%, 50%)', 'hsl(270, 60%, 50%)'];

export default function Financeiro() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [data, setData] = useState(new Date().toISOString().split('T')[0]);
  const [tipo, setTipo] = useState('');
  const [valor, setValor] = useState('');
  const [descricao, setDescricao] = useState('');
  const [aplicacao, setAplicacao] = useState('todos');
  const [loteId, setLoteId] = useState('');

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

  const { data: stats, isLoading } = useQuery({
    queryKey: ['financeiro-stats', user?.id],
    queryFn: async () => {
      // Fetch gastos
      const { data: gastos, error } = await supabase
        .from('gastos')
        .select('tipo, valor');

      if (error) throw error;

      // Fetch aquisicoes from animais
      const { data: animais } = await supabase
        .from('animais')
        .select('valor_aquisicao')
        .eq('ativo', true);

      const totalAquisicao = animais?.reduce((sum, a) => sum + Number(a.valor_aquisicao || 0), 0) || 0;

      // Group by tipo
      const porTipo: Record<string, number> = {
        'Aquisição': totalAquisicao,
      };

      gastos?.forEach(g => {
        if (g.tipo !== 'Aquisição') {
          porTipo[g.tipo] = (porTipo[g.tipo] || 0) + Number(g.valor);
        }
      });

      const totalGastos = Object.values(porTipo).reduce((sum, val) => sum + val, 0);

      const chartData = Object.entries(porTipo)
        .filter(([_, val]) => val > 0)
        .map(([name, value]) => ({ name, value }));

      return {
        total: totalGastos,
        porTipo,
        chartData,
      };
    },
    enabled: !!user,
  });

  const createGastoMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('gastos')
        .insert({
          user_id: user.id,
          data,
          tipo,
          valor: parseFloat(valor),
          descricao,
          aplicacao,
          lote_id: aplicacao === 'lote' ? loteId : null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financeiro'] });
      queryClient.invalidateQueries({ queryKey: ['gastos'] });
      toast.success('Gasto registrado!');
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error('Erro ao registrar gasto', {
        description: error.message,
      });
    },
  });

  const resetForm = () => {
    setData(new Date().toISOString().split('T')[0]);
    setTipo('');
    setValor('');
    setDescricao('');
    setAplicacao('todos');
    setLoteId('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tipo) {
      toast.error('Selecione o tipo de gasto');
      return;
    }
    if (!valor || parseFloat(valor) <= 0) {
      toast.error('Informe um valor válido');
      return;
    }
    if (!descricao.trim()) {
      toast.error('Informe a descrição');
      return;
    }
    createGastoMutation.mutate();
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
            <h1 className="text-2xl font-bold">Financeiro</h1>
            <p className="text-muted-foreground">Controle de gastos e investimentos</p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="hidden sm:flex">
                <Plus className="mr-2 h-4 w-4" />
                Novo Gasto
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Registrar Gasto</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="data">Data *</Label>
                  <Input
                    id="data"
                    type="date"
                    value={data}
                    onChange={(e) => setData(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo *</Label>
                  <Select value={tipo} onValueChange={setTipo}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {tiposGasto.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="valor">Valor (R$) *</Label>
                  <Input
                    id="valor"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Ex: 1500.00"
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="descricao">Descrição *</Label>
                  <Input
                    id="descricao"
                    placeholder="Ex: Ração 10 toneladas"
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Aplicar em:</Label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="aplicacao"
                        value="todos"
                        checked={aplicacao === 'todos'}
                        onChange={(e) => setAplicacao(e.target.value)}
                        className="h-4 w-4"
                      />
                      Todos animais
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="aplicacao"
                        value="lote"
                        checked={aplicacao === 'lote'}
                        onChange={(e) => setAplicacao(e.target.value)}
                        className="h-4 w-4"
                      />
                      Lote
                    </label>
                  </div>
                </div>

                {aplicacao === 'lote' && (
                  <div className="space-y-2">
                    <Label htmlFor="lote">Lote *</Label>
                    <Select value={loteId} onValueChange={setLoteId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o lote" />
                      </SelectTrigger>
                      <SelectContent>
                        {lotes?.map((lote) => (
                          <SelectItem key={lote.id} value={lote.id}>
                            {lote.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

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
                    disabled={createGastoMutation.isPending}
                  >
                    {createGastoMutation.isPending ? (
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

        {/* Total Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              Total Investido
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-10 w-48" />
            ) : (
              <p className="text-3xl font-bold text-primary">
                {formatCurrency(stats?.total || 0)}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Chart */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Distribuição de Custos</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : stats?.chartData && stats.chartData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.chartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {stats.chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
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

        {/* Breakdown */}
        {stats?.porTipo && Object.keys(stats.porTipo).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Detalhamento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(stats.porTipo)
                .filter(([_, val]) => val > 0)
                .sort((a, b) => b[1] - a[1])
                .map(([tipo, valor], index) => (
                  <div key={tipo} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="font-medium">{tipo}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(valor)}</p>
                      <p className="text-xs text-muted-foreground">
                        {((valor / stats.total) * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                ))}
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
