import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  Activity,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import { format, addDays, differenceInDays, parseISO, startOfDay } from 'date-fns';
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
  Area,
  AreaChart,
  RadialBarChart,
  RadialBar,
} from 'recharts';

interface AnimalStats {
  id: string;
  numero_brinco: string;
  peso_entrada: number;
  data_entrada: string;
  peso_atual: number;
  dias_confinamento: number;
  ganho_total: number;
  gmd: number;
}

interface DashboardStats {
  totalAnimais: number;
  gmdMedio: number;
  pesoMedio: number;
  investimentoTotal: number;
  custoKgMedio: number;
  diasMedioConfinamento: number;
  ganhoTotalRebanho: number;
}

interface Alerta {
  tipo: 'success' | 'warning' | 'error' | 'info';
  mensagem: string;
  link?: string;
  icon: React.ReactNode;
}

const COLORS = [
  'hsl(152, 69%, 31%)',
  'hsl(239, 84%, 67%)',
  'hsl(38, 92%, 50%)',
  'hsl(0, 84%, 60%)',
  'hsl(270, 60%, 50%)',
  'hsl(180, 70%, 45%)',
];

const GRADIENT_COLORS = {
  primary: ['#10B981', '#059669'],
  secondary: ['#6366F1', '#4F46E5'],
  warning: ['#F59E0B', '#D97706'],
  danger: ['#EF4444', '#DC2626'],
};

// Função para parse seguro de data (evita problemas de timezone)
const parseDate = (dateStr: string): Date => {
  // Adiciona T12:00:00 para evitar problemas de timezone
  return parseISO(dateStr + 'T12:00:00');
};

// Função para calcular dias entre duas datas de forma precisa
const calcularDias = (dataInicio: string, dataFim: Date = new Date()): number => {
  const inicio = startOfDay(parseDate(dataInicio));
  const fim = startOfDay(dataFim);
  return Math.max(1, differenceInDays(fim, inicio));
};

export default function Dashboard() {
  const { user } = useAuth();
  const hoje = new Date();

  // ═══════════════════════════════════════════════════════════════
  // QUERY PRINCIPAL: Estatísticas do Dashboard
  // ═══════════════════════════════════════════════════════════════
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats', user?.id],
    queryFn: async (): Promise<DashboardStats> => {
      // 1. Buscar todos os animais ativos
      const { data: animais, error: animaisError } = await supabase
        .from('animais')
        .select('id, numero_brinco, peso_entrada, data_entrada, valor_aquisicao')
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
          ganhoTotalRebanho: 0,
        };
      }

      // 2. Buscar todas as pesagens dos animais ativos
      const animalIds = animais.map(a => a.id);
      const { data: todasPesagens } = await supabase
        .from('pesagens')
        .select('animal_id, peso, data')
        .in('animal_id', animalIds)
        .order('data', { ascending: false });

      // 3. Mapear última pesagem por animal
      const ultimasPesagens = new Map<string, { peso: number; data: string }>();
      todasPesagens?.forEach(p => {
        if (!ultimasPesagens.has(p.animal_id)) {
          ultimasPesagens.set(p.animal_id, { peso: Number(p.peso), data: p.data });
        }
      });

      // 4. Calcular métricas individuais de cada animal
      let somaGMD = 0;
      let somaPesoAtual = 0;
      let somaDias = 0;
      let somaGanho = 0;
      let animaisComGMD = 0;

      animais.forEach(animal => {
        const pesoEntrada = Number(animal.peso_entrada);
        const ultimaPesagem = ultimasPesagens.get(animal.id);
        
        // Peso atual: última pesagem ou peso de entrada
        const pesoAtual = ultimaPesagem ? ultimaPesagem.peso : pesoEntrada;
        
        // Dias de confinamento: da data de entrada até hoje
        const diasConfinamento = calcularDias(animal.data_entrada, hoje);
        
        // Ganho total
        const ganho = pesoAtual - pesoEntrada;
        
        // GMD individual (ganho / dias)
        const gmdIndividual = ganho / diasConfinamento;

        somaPesoAtual += pesoAtual;
        somaDias += diasConfinamento;
        somaGanho += ganho;
        
        // Só conta GMD se há pesagem registrada após entrada
        if (ultimaPesagem) {
          somaGMD += gmdIndividual;
          animaisComGMD++;
        }
      });

      // 5. Buscar todos os gastos
      const { data: gastos } = await supabase
        .from('gastos')
        .select('valor');

      const totalGastos = gastos?.reduce((sum, g) => sum + Number(g.valor), 0) || 0;
      const totalAquisicao = animais.reduce((sum, a) => sum + Number(a.valor_aquisicao || 0), 0);

      // 6. Calcular médias
      const totalAnimais = animais.length;
      const pesoMedio = somaPesoAtual / totalAnimais;
      const diasMedio = somaDias / totalAnimais;
      const investimentoTotal = totalGastos + totalAquisicao;
      
      // GMD médio: média dos GMDs individuais (apenas animais com pesagens)
      const gmdMedio = animaisComGMD > 0 ? somaGMD / animaisComGMD : 0;
      
      // Custo por kg ganho: investimento total / ganho total do rebanho
      const custoKgMedio = somaGanho > 0 ? investimentoTotal / somaGanho : 0;

      return {
        totalAnimais,
        gmdMedio: Number(gmdMedio.toFixed(3)),
        pesoMedio: Math.round(pesoMedio),
        investimentoTotal,
        custoKgMedio: Number(custoKgMedio.toFixed(2)),
        diasMedioConfinamento: Math.round(diasMedio),
        ganhoTotalRebanho: Number(somaGanho.toFixed(2)),
      };
    },
    enabled: !!user,
  });

  // ═══════════════════════════════════════════════════════════════
  // QUERY: Distribuição de gastos por tipo
  // ═══════════════════════════════════════════════════════════════
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

      return Object.entries(porTipo).map(([name, value]) => ({ 
        name, 
        value,
        fill: COLORS[Object.keys(porTipo).indexOf(name) % COLORS.length]
      }));
    },
    enabled: !!user,
  });

  // ═══════════════════════════════════════════════════════════════
  // QUERY: Top 5 animais por GMD
  // ═══════════════════════════════════════════════════════════════
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

      // Mapear última pesagem
      const ultimasPesagens = new Map<string, { peso: number; data: string }>();
      pesagens?.forEach(p => {
        if (!ultimasPesagens.has(p.animal_id)) {
          ultimasPesagens.set(p.animal_id, { peso: Number(p.peso), data: p.data });
        }
      });

      const animaisComGMD = animais
        .filter(animal => ultimasPesagens.has(animal.id))
        .map(animal => {
          const pesoEntrada = Number(animal.peso_entrada);
          const ultimaPesagem = ultimasPesagens.get(animal.id)!;
          const pesoAtual = ultimaPesagem.peso;
          const diasConfinamento = calcularDias(animal.data_entrada, hoje);
          const ganho = pesoAtual - pesoEntrada;
          const gmd = ganho / diasConfinamento;

          return {
            numero_brinco: animal.numero_brinco,
            gmd: Number(gmd.toFixed(3)),
            peso_atual: pesoAtual,
            ganho: Number(ganho.toFixed(1)),
          };
        });

      return animaisComGMD
        .sort((a, b) => b.gmd - a.gmd)
        .slice(0, 5);
    },
    enabled: !!user,
  });

  // ═══════════════════════════════════════════════════════════════
  // QUERY: Evolução de peso por lote (últimas 10 pesagens por data)
  // ═══════════════════════════════════════════════════════════════
  const { data: evolucaoPeso } = useQuery({
    queryKey: ['evolucao-peso', user?.id],
    queryFn: async () => {
      const { data: pesagens } = await supabase
        .from('pesagens')
        .select(`
          data,
          peso,
          animais!inner(lote_id, lotes(nome))
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
            data: format(parseDate(data), 'dd/MM', { locale: ptBR }),
            dataFull: data,
          };
          Object.entries(lotes).forEach(([lote, { total, count }]) => {
            entry[lote] = Math.round(total / count);
          });
          return entry;
        })
        .slice(-10);

      return chartData;
    },
    enabled: !!user,
  });

  // ═══════════════════════════════════════════════════════════════
  // QUERY: Alertas do sistema
  // ═══════════════════════════════════════════════════════════════
  const { data: alertas } = useQuery({
    queryKey: ['alertas', user?.id],
    queryFn: async (): Promise<Alerta[]> => {
      const alertasList: Alerta[] = [];
      const daqui7Dias = addDays(hoje, 7);

      // 1. Animais prontos para abate (>=430kg)
      const { data: animaisPesados } = await supabase
        .from('animais')
        .select('id, numero_brinco, peso_entrada')
        .eq('ativo', true);

      if (animaisPesados && animaisPesados.length > 0) {
        const animalIds = animaisPesados.map(a => a.id);
        const { data: pesagens } = await supabase
          .from('pesagens')
          .select('animal_id, peso')
          .in('animal_id', animalIds)
          .order('data', { ascending: false });

        const ultimasPesagens = new Map<string, number>();
        pesagens?.forEach(p => {
          if (!ultimasPesagens.has(p.animal_id)) {
            ultimasPesagens.set(p.animal_id, Number(p.peso));
          }
        });

        let prontosAbate = 0;
        animaisPesados.forEach(animal => {
          const pesoAtual = ultimasPesagens.get(animal.id) || Number(animal.peso_entrada);
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

      // 3. Verificar lotes com GMD baixo
      const { data: animaisAtivos } = await supabase
        .from('animais')
        .select('id, peso_entrada, data_entrada, lotes(nome)')
        .eq('ativo', true);

      if (animaisAtivos && animaisAtivos.length > 0) {
        const animalIds = animaisAtivos.map(a => a.id);
        const { data: todasPesagens } = await supabase
          .from('pesagens')
          .select('animal_id, peso, data')
          .in('animal_id', animalIds)
          .order('data', { ascending: false });

        const ultimasPesagens = new Map<string, { peso: number; data: string }>();
        todasPesagens?.forEach(p => {
          if (!ultimasPesagens.has(p.animal_id)) {
            ultimasPesagens.set(p.animal_id, { peso: Number(p.peso), data: p.data });
          }
        });

        const gmdPorLote: Record<string, { somaGMD: number; count: number }> = {};
        
        animaisAtivos.forEach((animal: any) => {
          const loteNome = animal.lotes?.nome || 'Sem Lote';
          const ultimaPesagem = ultimasPesagens.get(animal.id);
          
          if (ultimaPesagem) {
            const pesoEntrada = Number(animal.peso_entrada);
            const diasConfinamento = calcularDias(animal.data_entrada, hoje);
            const ganho = ultimaPesagem.peso - pesoEntrada;
            const gmd = ganho / diasConfinamento;

            if (!gmdPorLote[loteNome]) {
              gmdPorLote[loteNome] = { somaGMD: 0, count: 0 };
            }
            gmdPorLote[loteNome].somaGMD += gmd;
            gmdPorLote[loteNome].count += 1;
          }
        });

        const lotesBaixoGMD = Object.entries(gmdPorLote)
          .filter(([_, data]) => data.count > 0 && (data.somaGMD / data.count) < 0.8)
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
    if (gmd >= 1.0) return { label: '✓ Ótimo', variant: 'secondary' as const };
    if (gmd >= 0.8) return { label: 'Bom', variant: 'outline' as const };
    if (gmd >= 0.5) return { label: '⚠️ Regular', variant: 'outline' as const };
    return { label: '🔴 Atenção', variant: 'destructive' as const };
  };

  // Get unique lotes from evolução
  const lotesUnicos = evolucaoPeso && evolucaoPeso.length > 0
    ? [...new Set(evolucaoPeso.flatMap(e => Object.keys(e).filter(k => k !== 'data' && k !== 'dataFull')))]
    : [];

  // Custom tooltip para gráficos modernos
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg border bg-background p-3 shadow-lg">
          <p className="text-sm font-medium">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {typeof entry.value === 'number' ? 
                entry.name.includes('R$') ? formatCurrency(entry.value) : 
                `${entry.value} ${entry.name === 'gmd' ? 'kg/dia' : 'kg'}`
              : entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <AppLayout>
      <div className="container py-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Visão Geral</h1>
            <p className="text-muted-foreground">
              Acompanhe o desempenho do seu rebanho • {format(hoje, "dd 'de' MMMM", { locale: ptBR })}
            </p>
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

        {/* Stats Cards - Grid 6 colunas */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {/* Total Animais */}
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 h-16 w-16 -translate-y-4 translate-x-4 rounded-full bg-primary/10" />
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
                <div className="text-3xl font-bold text-primary">{stats?.totalAnimais || 0}</div>
              )}
            </CardContent>
          </Card>

          {/* GMD Médio */}
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 h-16 w-16 -translate-y-4 translate-x-4 rounded-full bg-secondary/10" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                GMD Médio
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-secondary" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="flex flex-col gap-1">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold">{stats?.gmdMedio?.toFixed(2) || '0.00'}</span>
                    <span className="text-xs text-muted-foreground">kg/dia</span>
                  </div>
                  {stats && stats.gmdMedio > 0 && (
                    <Badge variant={getGMDBadge(stats.gmdMedio).variant} className="w-fit text-xs">
                      {getGMDBadge(stats.gmdMedio).label}
                    </Badge>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Peso Médio */}
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 h-16 w-16 -translate-y-4 translate-x-4 rounded-full bg-accent/10" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Peso Médio
              </CardTitle>
              <Scale className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold">{stats?.pesoMedio || 0}</span>
                  <span className="text-xs text-muted-foreground">kg</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Investimento Total */}
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 h-16 w-16 -translate-y-4 translate-x-4 rounded-full bg-primary/10" />
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
                <div className="text-xl font-bold">
                  {formatCurrency(stats?.investimentoTotal || 0)}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Custo/kg Ganho */}
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 h-16 w-16 -translate-y-4 translate-x-4 rounded-full bg-warning/10" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Custo/kg Ganho
              </CardTitle>
              <Target className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="flex flex-col">
                  <span className="text-xl font-bold">
                    {formatCurrency(stats?.custoKgMedio || 0)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Ganho total: {stats?.ganhoTotalRebanho?.toFixed(0) || 0} kg
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dias Médio */}
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 h-16 w-16 -translate-y-4 translate-x-4 rounded-full bg-secondary/10" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Tempo Médio
              </CardTitle>
              <Calendar className="h-4 w-4 text-secondary" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold">{stats?.diasMedioConfinamento || 0}</span>
                  <span className="text-xs text-muted-foreground">dias</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="mb-6 grid gap-6 lg:grid-cols-2">
          {/* Evolução de Peso por Lote - AreaChart moderno */}
          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-muted/30 pb-4">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Evolução de Peso por Lote</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {evolucaoPeso && evolucaoPeso.length > 0 ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={evolucaoPeso}>
                      <defs>
                        {lotesUnicos.map((lote, index) => (
                          <linearGradient key={lote} id={`gradient-${index}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={COLORS[index % COLORS.length]} stopOpacity={0.4}/>
                            <stop offset="95%" stopColor={COLORS[index % COLORS.length]} stopOpacity={0}/>
                          </linearGradient>
                        ))}
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="data" 
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis 
                        domain={['auto', 'auto']} 
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => `${v}kg`}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      {lotesUnicos.map((lote, index) => (
                        <Area
                          key={lote}
                          type="monotone"
                          dataKey={lote}
                          stroke={COLORS[index % COLORS.length]}
                          strokeWidth={2}
                          fill={`url(#gradient-${index})`}
                          dot={{ r: 4, fill: COLORS[index % COLORS.length] }}
                          activeDot={{ r: 6, stroke: 'white', strokeWidth: 2 }}
                        />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex h-72 items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <Scale className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Registre pesagens para ver a evolução</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pie Chart - Gastos com visual moderno */}
          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-muted/30 pb-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Distribuição de Custos</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {gastosPorTipo && gastosPorTipo.length > 0 ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <defs>
                        {gastosPorTipo.map((entry, index) => (
                          <linearGradient key={`pie-gradient-${index}`} id={`pieGradient-${index}`} x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor={COLORS[index % COLORS.length]} stopOpacity={1}/>
                            <stop offset="100%" stopColor={COLORS[index % COLORS.length]} stopOpacity={0.7}/>
                          </linearGradient>
                        ))}
                      </defs>
                      <Pie
                        data={gastosPorTipo}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {gastosPorTipo.map((_, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={`url(#pieGradient-${index})`}
                            stroke="white"
                            strokeWidth={2}
                          />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{
                          borderRadius: '8px',
                          border: '1px solid hsl(var(--border))',
                          background: 'hsl(var(--background))',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex h-72 items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Nenhum gasto registrado</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Second Row */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Top 5 Animais GMD - BarChart horizontal moderno */}
          <Card className="lg:col-span-2 overflow-hidden">
            <CardHeader className="border-b bg-muted/30 pb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Top 5 Animais (GMD)</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {top5Animais && top5Animais.length > 0 ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={top5Animais} layout="vertical" barCategoryGap="20%">
                      <defs>
                        <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="hsl(152, 69%, 31%)" stopOpacity={1}/>
                          <stop offset="100%" stopColor="hsl(152, 69%, 45%)" stopOpacity={1}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} className="stroke-muted" />
                      <XAxis 
                        type="number" 
                        domain={[0, 'auto']} 
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => `${v} kg/dia`}
                      />
                      <YAxis 
                        dataKey="numero_brinco" 
                        type="category" 
                        width={70} 
                        tickFormatter={(v) => `#${v}`}
                        tick={{ fill: 'hsl(var(--foreground))', fontSize: 12, fontWeight: 500 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="rounded-lg border bg-background p-3 shadow-lg">
                                <p className="font-semibold">Animal #{data.numero_brinco}</p>
                                <p className="text-sm text-primary">GMD: {data.gmd} kg/dia</p>
                                <p className="text-sm text-muted-foreground">Peso atual: {data.peso_atual} kg</p>
                                <p className="text-sm text-muted-foreground">Ganho: +{data.ganho} kg</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar 
                        dataKey="gmd" 
                        fill="url(#barGradient)"
                        radius={[0, 6, 6, 0]}
                        maxBarSize={40}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex h-72 items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Adicione animais e pesagens para ver o ranking</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Alerts Card */}
          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-muted/30 pb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                <CardTitle className="text-lg">Alertas</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {stats?.totalAnimais === 0 ? (
                <div className="flex items-start gap-3 rounded-lg border-2 border-dashed p-4">
                  <Info className="mt-0.5 h-5 w-5 shrink-0 text-secondary" />
                  <div>
                    <p className="text-sm font-medium">Comece cadastrando</p>
                    <p className="text-xs text-muted-foreground">
                      Adicione seus primeiros animais para começar o acompanhamento
                    </p>
                    <Button asChild variant="link" className="h-auto p-0 mt-2 text-primary">
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
                    className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                      alerta.tipo === 'success' ? 'border-success/30 bg-success/5 hover:bg-success/10' :
                      alerta.tipo === 'warning' ? 'border-warning/30 bg-warning/5 hover:bg-warning/10' :
                      alerta.tipo === 'error' ? 'border-destructive/30 bg-destructive/5 hover:bg-destructive/10' :
                      'hover:bg-muted/50'
                    }`}
                  >
                    {alerta.icon}
                    <div className="flex-1">
                      <p className="text-sm font-medium">{alerta.mensagem}</p>
                      {alerta.link && (
                        <Button asChild variant="link" className="h-auto p-0 mt-1 text-xs">
                          <Link to={alerta.link}>
                            Ver detalhes <ArrowRight className="ml-1 h-3 w-3" />
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex items-start gap-3 rounded-lg border border-success/30 bg-success/5 p-4">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                  <div>
                    <p className="text-sm font-medium text-success">Tudo em ordem!</p>
                    <p className="text-xs text-muted-foreground">
                      Sistema funcionando normalmente. Nenhum alerta no momento.
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
