import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Beef, TrendingUp, Scale, DollarSign, Calendar, Target, Plus, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface DashboardStats {
  totalAnimais: number;
  gmdMedio: number;
  pesoMedio: number;
  investimentoTotal: number;
  custoKgMedio: number;
  diasMedioConfinamento: number;
}

export default function Dashboard() {
  const { user } = useAuth();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats', user?.id],
    queryFn: async (): Promise<DashboardStats> => {
      // Fetch animais ativos
      const { data: animais, error: animaisError } = await supabase
        .from('animais')
        .select('id, peso_entrada, data_entrada, valor_aquisicao')
        .eq('ativo', true);

      if (animaisError) throw animaisError;

      if (!animais || animais.length === 0) {
        return {
          totalAnimais: 0,
          gmdMedio: 0,
          pesoMedio: 0,
          investimentoTotal: 0,
          custoKgMedio: 0,
          diasMedioConfinamento: 0,
        };
      }

      // Fetch última pesagem de cada animal
      const animalIds = animais.map(a => a.id);
      const { data: pesagens } = await supabase
        .from('pesagens')
        .select('animal_id, peso, data')
        .in('animal_id', animalIds)
        .order('data', { ascending: false });

      // Calcular métricas
      let totalGanho = 0;
      let totalDias = 0;
      let totalPesoAtual = 0;
      let countWithPesagens = 0;

      const ultimasPesagens = new Map();
      pesagens?.forEach(p => {
        if (!ultimasPesagens.has(p.animal_id)) {
          ultimasPesagens.set(p.animal_id, p);
        }
      });

      animais.forEach(animal => {
        const ultimaPesagem = ultimasPesagens.get(animal.id);
        const pesoAtual = ultimaPesagem ? Number(ultimaPesagem.peso) : Number(animal.peso_entrada);
        const dataRef = ultimaPesagem ? new Date(ultimaPesagem.data) : new Date();
        const dias = Math.max(1, Math.floor((dataRef.getTime() - new Date(animal.data_entrada).getTime()) / (1000 * 60 * 60 * 24)));
        const ganho = pesoAtual - Number(animal.peso_entrada);

        totalPesoAtual += pesoAtual;
        totalGanho += ganho;
        totalDias += dias;
        if (ultimaPesagem) countWithPesagens++;
      });

      // Fetch gastos totais
      const { data: gastos } = await supabase
        .from('gastos')
        .select('valor');

      const totalGastos = gastos?.reduce((sum, g) => sum + Number(g.valor), 0) || 0;
      const totalAquisicao = animais.reduce((sum, a) => sum + Number(a.valor_aquisicao || 0), 0);

      const pesoMedio = totalPesoAtual / animais.length;
      const gmdMedio = totalGanho > 0 && totalDias > 0 ? totalGanho / totalDias : 0;
      const diasMedio = totalDias / animais.length;
      const investimentoTotal = totalGastos + totalAquisicao;
      const custoKgMedio = totalGanho > 0 ? investimentoTotal / totalGanho : 0;

      return {
        totalAnimais: animais.length,
        gmdMedio: Number(gmdMedio.toFixed(2)),
        pesoMedio: Math.round(pesoMedio),
        investimentoTotal,
        custoKgMedio: Number(custoKgMedio.toFixed(2)),
        diasMedioConfinamento: Math.round(diasMedio),
      };
    },
    enabled: !!user,
  });

  const { data: gastosPorTipo } = useQuery({
    queryKey: ['gastos-por-tipo', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('gastos')
        .select('tipo, valor');

      if (!data || data.length === 0) return [];

      const porTipo: Record<string, number> = {};
      data.forEach(g => {
        porTipo[g.tipo] = (porTipo[g.tipo] || 0) + Number(g.valor);
      });

      return Object.entries(porTipo).map(([name, value]) => ({ name, value }));
    },
    enabled: !!user,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getGMDBadge = (gmd: number) => {
    if (gmd >= 1.3) return { label: '⭐ Excelente', variant: 'default' as const };
    if (gmd >= 0.8) return { label: 'Bom', variant: 'secondary' as const };
    if (gmd >= 0.5) return { label: '⚠️ Regular', variant: 'outline' as const };
    return { label: '🔴 Atenção', variant: 'destructive' as const };
  };

  const COLORS = ['hsl(152, 69%, 31%)', 'hsl(239, 84%, 67%)', 'hsl(0, 84%, 60%)', 'hsl(38, 92%, 50%)', 'hsl(270, 60%, 50%)'];

  return (
    <AppLayout>
      <div className="container py-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Visão Geral</h1>
            <p className="text-muted-foreground">Acompanhe o desempenho do seu rebanho</p>
          </div>
          <div className="hidden gap-2 sm:flex">
            <Button asChild>
              <Link to="/animais/novo">
                <Plus className="mr-2 h-4 w-4" />
                Novo Animal
              </Link>
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {/* Total Animais */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Animais Ativos
              </CardTitle>
              <Beef className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold">{stats?.totalAnimais || 0}</div>
              )}
            </CardContent>
          </Card>

          {/* GMD Médio */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                GMD Médio
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">{stats?.gmdMedio || 0}</span>
                  <span className="text-sm text-muted-foreground">kg/dia</span>
                  {stats && stats.gmdMedio > 0 && (
                    <Badge variant={getGMDBadge(stats.gmdMedio).variant}>
                      {getGMDBadge(stats.gmdMedio).label}
                    </Badge>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Peso Médio */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Peso Médio
              </CardTitle>
              <Scale className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold">{stats?.pesoMedio || 0}</span>
                  <span className="text-sm text-muted-foreground">kg</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Investimento Total */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Investimento Total
              </CardTitle>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-2xl font-bold">
                  {formatCurrency(stats?.investimentoTotal || 0)}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Custo/kg Ganho */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Custo/kg Ganho
              </CardTitle>
              <Target className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold">
                    {formatCurrency(stats?.custoKgMedio || 0)}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dias Médio */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Tempo Médio
              </CardTitle>
              <Calendar className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold">{stats?.diasMedioConfinamento || 0}</span>
                  <span className="text-sm text-muted-foreground">dias</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Charts & Alerts Row */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Pie Chart - Gastos */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Distribuição de Custos</CardTitle>
            </CardHeader>
            <CardContent>
              {gastosPorTipo && gastosPorTipo.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={gastosPorTipo}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {gastosPorTipo.map((entry, index) => (
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

          {/* Alerts Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Alertas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {stats?.totalAnimais === 0 ? (
                <div className="flex items-start gap-3 rounded-lg border p-3">
                  <Info className="mt-0.5 h-5 w-5 shrink-0 text-secondary" />
                  <div>
                    <p className="text-sm font-medium">Comece cadastrando</p>
                    <p className="text-xs text-muted-foreground">
                      Adicione seus primeiros animais para começar o acompanhamento
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start gap-3 rounded-lg border border-success/20 bg-success/5 p-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                    <div>
                      <p className="text-sm font-medium">Tudo em ordem</p>
                      <p className="text-xs text-muted-foreground">
                        Sistema funcionando normalmente
                      </p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Mobile FAB */}
        <div className="fixed bottom-20 right-4 flex flex-col gap-2 md:hidden">
          <Button size="lg" className="h-14 w-14 rounded-full shadow-lg" asChild>
            <Link to="/animais/novo">
              <Plus className="h-6 w-6" />
            </Link>
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
