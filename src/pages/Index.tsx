import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  Users,
  DollarSign,
  Scale,
  Target,
  Calendar,
  AlertTriangle,
  ArrowRight,
  Settings,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

const COLORS = ['#10B981', '#6366F1', '#F59E0B', '#EF4444', '#8B5CF6'];

interface Animal {
  id: string;
  peso_entrada: number;
  data_entrada: string;
  valor_aquisicao: number;
}

interface Pesagem {
  animal_id: string;
  peso: number;
  data: string;
}

interface Gasto {
  tipo: string;
  valor: number;
}

const Index = () => {
  const navigate = useNavigate();

  // Buscar estatísticas principais
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // ====================================
      // 1. ANIMAIS ATIVOS
      // ====================================
      const { count: totalAnimais } = await supabase
        .from('animais')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('ativo', true);

      const { data: animais } = await supabase
        .from('animais')
        .select('id, peso_entrada, data_entrada, valor_aquisicao')
        .eq('user_id', user.id)
        .eq('ativo', true);

      const { data: todasPesagens } = await supabase
        .from('pesagens')
        .select('animal_id, peso, data')
        .eq('user_id', user.id)
        .order('data', { ascending: false });

      // ====================================
      // 2. CALCULAR MÉTRICAS POR ANIMAL
      // ====================================
      let gmdTotal = 0;
      let pesoAtualTotal = 0;
      let diasTotal = 0;
      let ganhoTotalKg = 0;
      let count = 0;

      animais?.forEach((animal: Animal) => {
        const ultimaPesagem = todasPesagens?.find((p: Pesagem) => p.animal_id === animal.id);
        const pesoAtual = ultimaPesagem?.peso || animal.peso_entrada;
        const dataUltimaPesagem = ultimaPesagem?.data || new Date().toISOString().split('T')[0];
        
        const dias = Math.max(1, Math.floor(
          (new Date(dataUltimaPesagem).getTime() - new Date(animal.data_entrada).getTime()) / (1000 * 60 * 60 * 24)
        ));
        
        const ganho = pesoAtual - animal.peso_entrada;
        const gmd = ganho / dias;

        gmdTotal += gmd;
        pesoAtualTotal += pesoAtual;
        diasTotal += dias;
        ganhoTotalKg += ganho;
        count++;
      });

      const gmdMedio = count > 0 ? gmdTotal / count : 0;
      const pesoMedio = count > 0 ? pesoAtualTotal / count : 0;
      const diasMedio = count > 0 ? diasTotal / count : 0;

      // ====================================
      // 3. INVESTIMENTO TOTAL (CORRETO!)
      // ====================================
      
      // 3A. Aquisições (do cadastro dos animais)
      const totalAquisicoes = animais?.reduce((acc: number, a: Animal) => 
        acc + Number(a.valor_aquisicao || 0), 0
      ) || 0;

      // 3B. Gastos operacionais (EXCETO Aquisição para evitar duplicação)
      const { data: gastosOperacionais } = await supabase
        .from('gastos')
        .select('valor, tipo')
        .eq('user_id', user.id)
        .neq('tipo', 'Aquisição');

      const totalGastosOperacionais = gastosOperacionais?.reduce((acc: number, g: Gasto) => 
        acc + Number(g.valor || 0), 0
      ) || 0;

      // 3C. Total = Aquisições + Gastos Operacionais
      const totalInvestido = totalAquisicoes + totalGastosOperacionais;

      // ====================================
      // 4. CUSTO POR KG GANHO
      // ====================================
      const custoPorKgGanho = ganhoTotalKg > 0 ? totalInvestido / ganhoTotalKg : 0;

      return {
        totalAnimais: totalAnimais || 0,
        gmdMedio: gmdMedio.toFixed(2),
        pesoMedio: pesoMedio.toFixed(0),
        totalInvestido,
        custoPorKgGanho: custoPorKgGanho.toFixed(2),
        diasMedio: diasMedio.toFixed(0),
        ganhoTotalKg: ganhoTotalKg.toFixed(0),
      };
    },
  });

  // ════════════════════════════════════════════════
  // DISTRIBUIÇÃO DE CUSTOS (COPIADO DO FINANCEIRO!)
  // ════════════════════════════════════════════════
  const { data: custosPorTipo } = useQuery({
    queryKey: ['custos-distribuicao'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // 1. Aquisições dos animais
      const { data: aquisicoes } = await supabase
        .from('animais')
        .select('valor_aquisicao')
        .eq('user_id', user.id)
        .eq('ativo', true);

      const totalAquisicoes = aquisicoes?.reduce((acc, a) => 
        acc + Number(a.valor_aquisicao || 0), 0
      ) || 0;

      // 2. Gastos operacionais (EXCETO Aquisição)
      const { data: gastos } = await supabase
        .from('gastos')
        .select('valor, tipo')
        .eq('user_id', user.id)
        .neq('tipo', 'Aquisição');

      const totalGastos = gastos?.reduce((acc, g) => 
        acc + Number(g.valor || 0), 0
      ) || 0;

      // Se não tem nada, retorna vazio
      if (totalAquisicoes === 0 && totalGastos === 0) return [];

      // 3. Montar distribuição
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
    },
  });

  // Top 5 animais
  const { data: top5Animais } = useQuery({
    queryKey: ['top5-animais'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: animais } = await supabase
        .from('animais')
        .select('id, numero_brinco, peso_entrada, data_entrada')
        .eq('user_id', user.id)
        .eq('ativo', true);

      const { data: pesagens } = await supabase
        .from('pesagens')
        .select('animal_id, peso, data')
        .eq('user_id', user.id)
        .order('data', { ascending: false });

      const animaisComGMD = animais?.map((animal: any) => {
        const ultimaPesagem = pesagens?.find((p: any) => p.animal_id === animal.id);
        const pesoAtual = ultimaPesagem?.peso || animal.peso_entrada;
        const dataUltimaPesagem = ultimaPesagem?.data || new Date().toISOString().split('T')[0];
        
        const dias = Math.max(1, Math.floor(
          (new Date(dataUltimaPesagem).getTime() - new Date(animal.data_entrada).getTime()) / (1000 * 60 * 60 * 24)
        ));
        
        const gmd = (pesoAtual - animal.peso_entrada) / dias;

        return {
          numero_brinco: `#${animal.numero_brinco}`,
          gmd: Number(gmd.toFixed(2)),
        };
      }) || [];

      return animaisComGMD
        .sort((a, b) => b.gmd - a.gmd)
        .slice(0, 5);
    },
  });

  // Alertas
  const { data: alertas } = useQuery({
    queryKey: ['dashboard-alertas'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const alertasList: any[] = [];
      const diasAlert = 7;

      const hoje = new Date().toISOString().split('T')[0];
      const futuro = new Date(Date.now() + diasAlert * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const { data: protocolos } = await supabase
        .from('protocolos_sanitarios')
        .select('produto')
        .eq('user_id', user.id)
        .gte('proxima_dose', hoje)
        .lte('proxima_dose', futuro);

      if (protocolos?.length) {
        alertasList.push({
          tipo: 'warning',
          icon: AlertTriangle,
          mensagem: `${protocolos.length} protocolos vencendo em ${diasAlert} dias`,
          link: '/sanitario',
        });
      }

      return alertasList;
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  };

  // Custom tooltip para gráfico de pizza moderno
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border">
          <p className="font-semibold">{payload[0].name}</p>
          <p className="text-primary font-bold">{formatCurrency(payload[0].value)}</p>
          <p className="text-sm text-muted-foreground">
            {((payload[0].value / payload[0].payload.total) * 100).toFixed(1)}%
          </p>
        </div>
      );
    }
    return null;
  };

  // Custom label para pizza moderno
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * Math.PI / 180);
    const y = cy + radius * Math.sin(-midAngle * Math.PI / 180);

    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        className="font-bold text-sm"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">Visão Geral</h1>
          <p className="text-muted-foreground">Acompanhe o desempenho do seu rebanho • {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/configuracoes')} className="gap-2">
          <Settings className="h-4 w-4" />
          Configurar Alertas
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Animais Ativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalAnimais || 0}</div>
            <p className="text-xs text-muted-foreground">Ganho total: {stats?.ganhoTotalKg || 0} kg</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">GMD Médio</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              {stats?.gmdMedio || '0.00'} kg/dia
              {stats && parseFloat(stats.gmdMedio) >= 1.3 && (
                <Badge className="bg-green-500">⭐</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Meta: 1.3 kg/dia</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Peso Médio</CardTitle>
            <Scale className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.pesoMedio || 0} kg</div>
            <p className="text-xs text-muted-foreground">Peso médio atual</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Investimento Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(stats?.totalInvestido || 0)}</div>
            <p className="text-xs text-muted-foreground">Aquisição + Operacional</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Custo/kg Ganho</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(parseFloat(stats?.custoPorKgGanho || '0'))}</div>
            <p className="text-xs text-muted-foreground">Investimento ÷ Ganho</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tempo Médio</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.diasMedio || 0} dias</div>
            <p className="text-xs text-muted-foreground">Confinamento médio</p>
          </CardContent>
        </Card>
      </div>

      {/* Alertas */}
      {alertas && alertas.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xl font-semibold">🔔 Alertas</h2>
          {alertas.map((alerta: any, idx: number) => {
            const Icon = alerta.icon;
            return (
              <Alert key={idx} className="flex items-center justify-between bg-yellow-50 border-yellow-200">
                <div className="flex items-center gap-3">
                  <Icon className="h-5 w-5" />
                  <AlertDescription>{alerta.mensagem}</AlertDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate(alerta.link)}>
                  Ver <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Alert>
            );
          })}
        </div>
      )}

      {/* Gráficos Modernos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de Pizza MODERNO */}
        {custosPorTipo && custosPorTipo.length > 0 && (
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-600" />
                Distribuição de Custos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={custosPorTipo}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={renderCustomizedLabel}
                    outerRadius={110}
                    innerRadius={60}
                    fill="#8884d8"
                    dataKey="value"
                    paddingAngle={2}
                  >
                    {custosPorTipo.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={COLORS[index % COLORS.length]}
                        className="hover:opacity-80 transition-opacity"
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36}
                    formatter={(value) => <span className="text-sm font-medium">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Gráfico de Barras MODERNO */}
        {top5Animais && top5Animais.length > 0 && (
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-600" />
                Top 5 Animais (GMD)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={top5Animais}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="numero_brinco"
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    label={{ value: 'kg/dia', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip 
                    formatter={(value: number) => [`${value} kg/dia`, 'GMD']}
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar 
                    dataKey="gmd" 
                    fill="#10B981"
                    radius={[8, 8, 0, 0]}
                    maxBarSize={60}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Empty State */}
      {stats?.totalAnimais === 0 && (
        <Card className="p-12">
          <div className="text-center space-y-4">
            <Users className="h-16 w-16 mx-auto text-muted-foreground" />
            <div>
              <h3 className="text-xl font-semibold">Nenhum animal cadastrado</h3>
              <p className="text-muted-foreground">Comece cadastrando seus primeiros animais</p>
            </div>
            <Button onClick={() => navigate('/animais')}>
              <Users className="mr-2 h-4 w-4" />
              Cadastrar Animal
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};

export default Index;
