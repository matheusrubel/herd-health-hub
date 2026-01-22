import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { BarChart3, TrendingUp, FileSpreadsheet, Filter } from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface AnimalPerformance {
  id: string;
  numero_brinco: string;
  lote_nome: string | null;
  peso_entrada: number;
  peso_atual: number;
  ganho_total: number;
  gmd: number;
  dias: number;
  custo_total: number;
  custo_kg: number;
}

export default function Relatorios() {
  const { user } = useAuth();
  const [loteFilter, setLoteFilter] = useState('todos');

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

  const { data: performance, isLoading } = useQuery({
    queryKey: ['relatorio-performance', user?.id, loteFilter],
    queryFn: async (): Promise<AnimalPerformance[]> => {
      let query = supabase
        .from('animais')
        .select(`
          id,
          numero_brinco,
          peso_entrada,
          data_entrada,
          valor_aquisicao,
          lote_id,
          lotes(nome)
        `)
        .order('numero_brinco');

      if (loteFilter && loteFilter !== 'todos') {
        query = query.eq('lote_id', loteFilter);
      }

      const { data: animais, error } = await query;
      if (error) throw error;
      if (!animais || animais.length === 0) return [];

      // Fetch pesagens e gastos
      const animalIds = animais.map(a => a.id);

      const [pesagensRes, gastosRes] = await Promise.all([
        supabase
          .from('pesagens')
          .select('animal_id, peso, data')
          .in('animal_id', animalIds)
          .order('data', { ascending: false }),
        supabase
          .from('gastos')
          .select('animal_id, valor')
          .in('animal_id', animalIds),
      ]);

      const ultimasPesagens = new Map();
      pesagensRes.data?.forEach(p => {
        if (!ultimasPesagens.has(p.animal_id)) {
          ultimasPesagens.set(p.animal_id, p);
        }
      });

      const gastosPorAnimal = new Map<string, number>();
      gastosRes.data?.forEach(g => {
        if (g.animal_id) {
          gastosPorAnimal.set(g.animal_id, (gastosPorAnimal.get(g.animal_id) || 0) + Number(g.valor));
        }
      });

      return animais.map(animal => {
        const ultimaPesagem = ultimasPesagens.get(animal.id);
        const pesoAtual = ultimaPesagem ? Number(ultimaPesagem.peso) : Number(animal.peso_entrada);
        const ganhoTotal = pesoAtual - Number(animal.peso_entrada);
        const dias = Math.max(1, Math.floor((new Date().getTime() - new Date(animal.data_entrada).getTime()) / (1000 * 60 * 60 * 24)));
        const gmd = ganhoTotal / dias;
        const custoAquisicao = Number(animal.valor_aquisicao || 0);
        const custosGastos = gastosPorAnimal.get(animal.id) || 0;
        const custoTotal = custoAquisicao + custosGastos;
        const custoKg = ganhoTotal > 0 ? custoTotal / ganhoTotal : 0;

        return {
          id: animal.id,
          numero_brinco: animal.numero_brinco,
          lote_nome: (animal.lotes as any)?.nome || null,
          peso_entrada: Number(animal.peso_entrada),
          peso_atual: pesoAtual,
          ganho_total: ganhoTotal,
          gmd: Number(gmd.toFixed(2)),
          dias,
          custo_total: custoTotal,
          custo_kg: Number(custoKg.toFixed(2)),
        };
      }).sort((a, b) => b.gmd - a.gmd);
    },
    enabled: !!user,
  });

  const getGMDBadge = (gmd: number) => {
    if (gmd >= 1.3) return { label: '⭐ Excelente', variant: 'default' as const };
    if (gmd >= 0.8) return { label: 'Bom', variant: 'secondary' as const };
    if (gmd >= 0.5) return { label: 'Regular', variant: 'outline' as const };
    return { label: 'Atenção', variant: 'destructive' as const };
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Top 5 para gráfico
  const top5 = performance?.slice(0, 5).map(p => ({
    brinco: `#${p.numero_brinco}`,
    gmd: p.gmd,
  })) || [];

  // Estatísticas gerais
  const stats = performance && performance.length > 0
    ? {
        totalAnimais: performance.length,
        gmdMedio: (performance.reduce((sum, p) => sum + p.gmd, 0) / performance.length).toFixed(2),
        pesoMedio: Math.round(performance.reduce((sum, p) => sum + p.peso_atual, 0) / performance.length),
        custoTotal: performance.reduce((sum, p) => sum + p.custo_total, 0),
      }
    : null;

  const exportToExcel = () => {
    if (!performance || performance.length === 0) return;

    const dataToExport = performance.map(animal => ({
      'Brinco': `#${animal.numero_brinco}`,
      'Lote': animal.lote_nome || '-',
      'Peso Entrada (kg)': animal.peso_entrada,
      'Peso Atual (kg)': animal.peso_atual,
      'Ganho Total (kg)': animal.ganho_total,
      'GMD (kg/dia)': animal.gmd,
      'Dias': animal.dias,
      'Custo Total (R$)': animal.custo_total.toFixed(2),
      'Custo por kg (R$)': animal.custo_kg.toFixed(2),
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Performance');

    // Add summary sheet
    if (stats) {
      const summaryData = [
        { 'Métrica': 'Total de Animais', 'Valor': stats.totalAnimais },
        { 'Métrica': 'GMD Médio (kg/dia)', 'Valor': stats.gmdMedio },
        { 'Métrica': 'Peso Médio (kg)', 'Valor': stats.pesoMedio },
        { 'Métrica': 'Investimento Total (R$)', 'Valor': stats.custoTotal.toFixed(2) },
      ];
      const wsSummary = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumo');
    }

    const date = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `relatorio-performance-${date}.xlsx`);
  };

  return (
    <AppLayout>
      <div className="container py-6">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Relatórios</h1>
            <p className="text-muted-foreground">Análises de performance</p>
          </div>

          <div className="flex items-center gap-2">
            <Select value={loteFilter} onValueChange={setLoteFilter}>
              <SelectTrigger className="w-48">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filtrar por lote" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os lotes</SelectItem>
                {lotes?.map((lote) => (
                  <SelectItem key={lote.id} value={lote.id}>
                    {lote.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              onClick={exportToExcel}
              disabled={!performance || performance.length === 0}
              variant="outline"
              className="gap-2"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Exportar Excel
            </Button>
          </div>
        </div>

        {/* Resumo */}
        {stats && (
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Total de Animais</p>
                <p className="text-2xl font-bold">{stats.totalAnimais}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">GMD Médio</p>
                <p className="text-2xl font-bold">{stats.gmdMedio} kg/dia</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Peso Médio</p>
                <p className="text-2xl font-bold">{stats.pesoMedio} kg</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Investimento Total</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.custoTotal)}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Top 5 Gráfico */}
        {top5.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Top 5 - Melhor Performance (GMD)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={top5} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" domain={[0, 'auto']} />
                    <YAxis dataKey="brinco" type="category" width={60} />
                    <Tooltip formatter={(value) => [`${value} kg/dia`, 'GMD']} />
                    <Bar dataKey="gmd" fill="hsl(152, 69%, 31%)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabela */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Performance Individual
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : performance && performance.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Brinco</TableHead>
                      <TableHead>Lote</TableHead>
                      <TableHead className="text-right">P. Entrada</TableHead>
                      <TableHead className="text-right">P. Atual</TableHead>
                      <TableHead className="text-right">Ganho</TableHead>
                      <TableHead className="text-right">GMD</TableHead>
                      <TableHead className="text-right">Dias</TableHead>
                      <TableHead className="text-right">Custo Total</TableHead>
                      <TableHead className="text-right">R$/kg</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {performance.map((animal) => (
                      <TableRow key={animal.id}>
                        <TableCell className="font-medium">#{animal.numero_brinco}</TableCell>
                        <TableCell>{animal.lote_nome || '-'}</TableCell>
                        <TableCell className="text-right">{animal.peso_entrada}kg</TableCell>
                        <TableCell className="text-right">{animal.peso_atual}kg</TableCell>
                        <TableCell className="text-right text-primary">+{animal.ganho_total}kg</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {animal.gmd}
                            <Badge variant={getGMDBadge(animal.gmd).variant} className="text-xs">
                              {getGMDBadge(animal.gmd).label}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{animal.dias}</TableCell>
                        <TableCell className="text-right">{formatCurrency(animal.custo_total)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(animal.custo_kg)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <BarChart3 className="mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground">Nenhum animal encontrado</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
