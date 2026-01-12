import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Beef, 
  TrendingUp, 
  Scale, 
  DollarSign, 
  Calendar, 
  Target, 
  Plus, 
  AlertTriangle, 
  CheckCircle2, 
  Info,
  Syringe,
  ArrowRight,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import { format, addDays, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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
  BarChart,
  Bar,
  Legend,
} from 'recharts';

interface DashboardStats {
  totalAnimais: number;
  gmdMedio: number;
  pesoMedio: number;
  investimentoTotal: number;
  custoKgMedio: number;
  diasMedioConfinamento: number;
}

interface Alerta {
  tipo: 'success' | 'warning' | 'error' | 'info';
  mensagem: string;
  link?: string;
  icon: React.ReactNode;
}

const COLORS = [
  'hsl(152, 69%, 31%)', // verde
  'hsl(239, 84%, 67%)', // indigo
  'hsl(38, 92%, 50%)',  // amarelo
  'hsl(0, 84%, 60%)',   // vermelho
  'hsl(270, 60%, 50%)', // roxo
];

export default function Dashboard() {
  const { user } = useAuth();

  // Fetch stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats', user?.id],
    queryFn: async (): Promise<DashboardStats> => {
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

      const animalIds = animais.map(a => a.id);
      const { data: pesagens } = await supabase
        .from('pesagens')
        .select('animal_id, peso, data')
        .in('animal_id', animalIds)
        .order('data', { ascending: false });

      let totalGanho = 0;
      let totalDias = 0;
      let totalPesoAtual = 0;

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
        const dias = Math.max(1, differenceInDays(dataRef, new Date(animal.data_entrada)));
        const ganho = pesoAtual - Number(animal.peso_entrada);

        totalPesoAtual += pesoAtual;
        totalGanho += ganho;
        totalDias += dias;
      });

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

  // Fetch gastos por tipo
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

  // Fetch top 5 animais por GMD
  const { data: top5Animais } = useQuery({
    queryKey: ['top5-animais', user?.id],
    queryFn: async () => {
      const { data: animais } = await supabase
        .from('animais')
        .select('id, numero_brinco, peso_entrada, data_entrada')
        .eq('ativo', true);

      if (!animais || animais.length === 0) return [];

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

      const animaisComGMD = animais.map(animal => {
        const ultimaPesagem = ultimasPesagens.get(animal.id);
        const pesoAtual = ultimaPesagem ? Number(ultimaPesagem.peso) : Number(animal.peso_entrada);
        const dataRef = ultimaPesagem ? new Date(ultimaPesagem.data) : new Date();
        const dias = Math.max(1, differenceInDays(dataRef, new Date(animal.data_entrada)));
        const ganho = pesoAtual - Number(animal.peso_entrada);
        const gmd = ganho / dias;

        return {
          numero_brinco: animal.numero_brinco,
          gmd: Number(gmd.toFixed(2)),
          peso_atual: pesoAtual,
        };
      });

      return animaisComGMD
        .sort((a, b) => b.gmd - a.gmd)
        .slice(0, 5);
    },
    enabled: !!user,
  });

  // Fetch evolução de peso por lote
  const { data: evolucaoPeso } = useQuery({
    queryKey: ['evolucao-peso', user?.id],
    queryFn: async () => {
      const { data: pesagens } = await supabase
        .from('pesagens')
        .select(`
          data,
          peso,
          animais!inner(lote_id, lotes!inner(nome))
        `)
        .order('data', { ascending: true });

      if (!pesagens || pesagens.length === 0) return [];

      // Agrupar por data e lote
      const evolucao: Record<string, Record<string, { total: number; count: number }>> = {};
      
      pesagens.forEach((p: any) => {
        const data = p.data;
        const loteNome = p.animais?.lotes?.nome || 'Sem Lote';
        
        if (!evolucao[data]) {
          evolucao[data] = {};
        }
        if (!evolucao[data][loteNome]) {
          evolucao[data][loteNome] = { total: 0, count: 0 };
        }
        evolucao[data][loteNome].total += Number(p.peso);
        evolucao[data][loteNome].count += 1;
      });

      // Converter para formato do gráfico
      const chartData = Object.entries(evolucao)
        .map(([data, lotes]) => {
          const entry: Record<string, any> = { 
            data: format(new Date(data + 'T12:00:00'), 'dd/MM', { locale: ptBR }) 
          };
          Object.entries(lotes).forEach(([lote, { total, count }]) => {
            entry[lote] = Math.round(total / count);
          });
          return entry;
        })
        .slice(-10); // Últimas 10 datas

      return chartData;
    },
    enabled: !!user,
  });

  // Fetch alertas
  const { data: alertas } = useQuery({
    queryKey: ['alertas', user?.id],
    queryFn: async (): Promise<Alerta[]> => {
      const alertasList: Alerta[] = [];
      const hoje = new Date();
      const daqui7Dias = addDays(hoje, 7);

      // 1. Animais prontos para abate (>=430kg)
      const { data: animaisPesados } = await supabase
        .from('animais')
        .select('id, numero_brinco, peso_entrada')
        .eq('ativo', true);

      if (animaisPesados) {
        const animalIds = animaisPesados.map(a => a.id);
        const { data: pesagens } = await supabase
          .from('pesagens')
          .select('animal_id, peso')
          .in('animal_id', animalIds)
          .order('data', { ascending: false });

        const ultimasPesagens = new Map();
        pesagens?.forEach(p => {
          if (!ultimasPesagens.has(p.animal_id)) {
            ultimasPesagens.set(p.animal_id, p);
          }
        });

        let prontosAbate = 0;
        animaisPesados.forEach(animal => {
          const ultimaPesagem = ultimasPesagens.get(animal.id);
          const pesoAtual = ultimaPesagem ? Number(ultimaPesagem.peso) : Number(animal.peso_entrada);
          if (pesoAtual >= 430) prontosAbate++;
        });

        if (prontosAbate > 0) {
          alertasList.push({
            tipo: 'success',
            mensagem: `${prontosAbate} ${prontosAbate === 1 ? 'animal pronto' : 'animais prontos'} para abate (≥430kg)`,
            link: '/animais',
            icon: <CheckCircle2 className="h-5 w-5 text-success" />,
          });
        }
      }

      // 2. Protocolos vencendo nos próximos 7 dias
      const { data: protocolos } = await supabase
        .from('protocolos_sanitarios')
        .select('produto, proxima_dose')
        .gte('proxima_dose', format(hoje, 'yyyy-MM-dd'))
        .lte('proxima_dose', format(daqui7Dias, 'yyyy-MM-dd'));

      if (protocolos && protocolos.length > 0) {
        alertasList.push({
          tipo: 'warning',
          mensagem: `${protocolos.length} ${protocolos.length === 1 ? 'protocolo vencendo' : 'protocolos vencendo'} nos próximos 7 dias`,
          link: '/sanitario',
          icon: <Syringe className="h-5 w-5 text-warning" />,
        });
      }

      // 3. Lotes com GMD baixo (<0.8)
      const { data: animaisAtivos } = await supabase
        .from('animais')
        .select('id, peso_entrada, data_entrada, lotes(nome)')
        .eq('ativo', true);

      if (animaisAtivos) {
        const animalIds = animaisAtivos.map(a => a.id);
        const { data: todasPesagens } = await supabase
          .from('pesagens')
          .select('animal_id, peso, data')
          .in('animal_id', animalIds)
          .order('data', { ascending: false });

        const ultimasPesagens = new Map();
        todasPesagens?.forEach(p => {
          if (!ultimasPesagens.has(p.animal_id)) {
            ultimasPesagens.set(p.animal_id, p);
          }
        });

        const gmdPorLote: Record<string, { totalGMD: number; count: number }> = {};
        
        animaisAtivos.forEach((animal: any) => {
          const loteNome = animal.lotes?.nome || 'Sem Lote';
          const ultimaPesagem = ultimasPesagens.get(animal.id);
          const pesoAtual = ultimaPesagem ? Number(ultimaPesagem.peso) : Number(animal.peso_entrada);
          const dataRef = ultimaPesagem ? new Date(ultimaPesagem.data) : new Date();
          const dias = Math.max(1, differenceInDays(dataRef, new Date(animal.data_entrada)));
          const ganho = pesoAtual - Number(animal.peso_entrada);
          const gmd = ganho / dias;

          if (!gmdPorLote[loteNome]) {
            gmdPorLote[loteNome] = { totalGMD: 0, count: 0 };
          }
          gmdPorLote[loteNome].totalGMD += gmd;
          gmdPorLote[loteNome].count += 1;
        });

        const lotesBaixoGMD = Object.entries(gmdPorLote)
          .filter(([_, data]) => (data.totalGMD / data.count) < 0.8)
          .map(([nome]) => nome);

        if (lotesBaixoGMD.length > 0) {
          alertasList.push({
            tipo: 'error',
            mensagem: `${lotesBaixoGMD.length} ${lotesBaixoGMD.length === 1 ? 'lote' : 'lotes'} com GMD abaixo de 0.8 kg/dia`,
            link: '/lotes',
            icon: <AlertTriangle className="h-5 w-5 text-destructive" />,
          });
        }
      }

      // Se não houver alertas, mostrar status ok
      if (alertasList.length === 0) {
        alertasList.push({
          tipo: 'info',
          mensagem: 'Sistema funcionando normalmente. Nenhum alerta no momento.',
          icon: <Info className="h-5 w-5 text-secondary" />,
        });
      }

      return alertasList;
    },
    enabled: !!user && stats?.totalAnimais !== undefined && stats.totalAnimais > 0,
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

  // Get unique lotes from evolução
  const lotesUnicos = evolucaoPeso && evolucaoPeso.length > 0
    ? [...new Set(evolucaoPeso.flatMap(e => Object.keys(e).filter(k => k !== 'data')))]
    : [];

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
                <div className="flex flex-col gap-1">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold">{stats?.gmdMedio || 0}</span>
                    <span className="text-sm text-muted-foreground">kg/dia</span>
                  </div>
                  {stats && stats.gmdMedio > 0 && (
                    <Badge variant={getGMDBadge(stats.gmdMedio).variant} className="w-fit">
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
                <div className="text-2xl font-bold">
                  {formatCurrency(stats?.custoKgMedio || 0)}
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

        {/* Charts Row */}
        <div className="mb-6 grid gap-6 lg:grid-cols-2">
          {/* Evolução de Peso por Lote */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Evolução de Peso por Lote</CardTitle>
            </CardHeader>
            <CardContent>
              {evolucaoPeso && evolucaoPeso.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={evolucaoPeso}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="data" />
                      <YAxis domain={['auto', 'auto']} />
                      <Tooltip formatter={(value) => `${value} kg`} />
                      <Legend />
                      {lotesUnicos.map((lote, index) => (
                        <Line
                          key={lote}
                          type="monotone"
                          dataKey={lote}
                          stroke={COLORS[index % COLORS.length]}
                          strokeWidth={2}
                          dot={{ r: 4 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex h-64 items-center justify-center text-muted-foreground">
                  <p>Registre pesagens para ver a evolução</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pie Chart - Gastos */}
          <Card>
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
                        {gastosPorTipo.map((_, index) => (
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
        </div>

        {/* Second Row */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Top 5 Animais GMD */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Top 5 Animais (GMD)</CardTitle>
            </CardHeader>
            <CardContent>
              {top5Animais && top5Animais.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={top5Animais} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" domain={[0, 'auto']} />
                      <YAxis dataKey="numero_brinco" type="category" width={80} tickFormatter={(v) => `#${v}`} />
                      <Tooltip 
                        formatter={(value, name) => {
                          if (name === 'gmd') return [`${value} kg/dia`, 'GMD'];
                          return [value, name];
                        }}
                      />
                      <Bar 
                        dataKey="gmd" 
                        fill="hsl(152, 69%, 31%)" 
                        radius={[0, 4, 4, 0]}
                        label={{ position: 'right', formatter: (v: number) => `${v} kg/dia` }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex h-64 items-center justify-center text-muted-foreground">
                  <p>Adicione animais e pesagens para ver o ranking</p>
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
                    <Button asChild variant="link" className="h-auto p-0 mt-1">
                      <Link to="/animais/novo">
                        Adicionar animal <ArrowRight className="ml-1 h-3 w-3" />
                      </Link>
                    </Button>
                  </div>
                </div>
              ) : alertas && alertas.length > 0 ? (
                alertas.map((alerta, idx) => (
                  <div
                    key={idx}
                    className={`flex items-start gap-3 rounded-lg border p-3 ${
                      alerta.tipo === 'success' ? 'border-success/20 bg-success/5' :
                      alerta.tipo === 'warning' ? 'border-warning/20 bg-warning/5' :
                      alerta.tipo === 'error' ? 'border-destructive/20 bg-destructive/5' :
                      ''
                    }`}
                  >
                    {alerta.icon}
                    <div className="flex-1">
                      <p className="text-sm font-medium">{alerta.mensagem}</p>
                      {alerta.link && (
                        <Button asChild variant="link" className="h-auto p-0 mt-1">
                          <Link to={alerta.link}>
                            Ver detalhes <ArrowRight className="ml-1 h-3 w-3" />
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex items-start gap-3 rounded-lg border border-success/20 bg-success/5 p-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                  <div>
                    <p className="text-sm font-medium">Tudo em ordem</p>
                    <p className="text-xs text-muted-foreground">
                      Sistema funcionando normalmente
                    </p>
                  </div>
                </div>
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
